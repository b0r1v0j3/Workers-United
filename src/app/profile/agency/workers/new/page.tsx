import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AgencySetupRequired from "@/components/AgencySetupRequired";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAdminTestUser, getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { getAdminTestAgencyWorkspace } from "@/lib/admin-test-data";
import { ensureAgencyRecord, getAgencyRecordByProfileId, getAgencySchemaState } from "@/lib/agencies";
import { normalizeUserType } from "@/lib/domain";
import AgencyWorkerCreatePageClient from "./AgencyWorkerCreatePageClient";

export const dynamic = "force-dynamic";

interface AgencyWorkerCreatePageProps {
    searchParams: Promise<{ inspect?: string }>;
}

export default async function AgencyWorkerCreatePage({ searchParams }: AgencyWorkerCreatePageProps) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const params = await searchParams;
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
    const user = session.user;

    if (!user) {
        redirect("/login");
    }

    if (session.activePersona) {
        if (session.activePersona.role !== "agency") {
            redirect(getAdminTestWorkspaceHref(session.activePersona.role));
        }

        const sandboxWorkspace = await getAdminTestAgencyWorkspace(admin, session.activePersona.id);

        return (
            <AppShell
                user={buildAdminTestUser(user, {
                    persona: session.activePersona,
                    displayName: sandboxWorkspace.agency?.display_name || session.activePersona.label,
                    email: sandboxWorkspace.agency?.contact_email || session.ownerProfile?.email || user.email,
                })}
                variant="dashboard"
                adminTestMode={{
                    active: true,
                    role: "agency",
                    label: session.activePersona.label,
                }}
            >
                <AgencyWorkerCreatePageClient
                    readOnlyPreview={false}
                    inspectProfileId={null}
                />
            </AppShell>
        );
    }

    const userType = normalizeUserType(session.liveUserType || user.user_metadata?.user_type);
    if (userType === "employer") {
        redirect("/profile/employer");
    }
    if (userType !== "agency" && userType !== "admin") {
        redirect("/profile/worker");
    }

    const agencySchemaState = await getAgencySchemaState(admin);
    if (!agencySchemaState.ready) {
        return (
            <AppShell user={user} variant="dashboard">
                <AgencySetupRequired />
            </AppShell>
        );
    }

    const inspectProfileId = userType === "admin" ? params?.inspect?.trim() || null : null;
    if (userType === "admin" && !inspectProfileId) {
        redirect("/admin");
    }

    const targetAgencyProfileId = inspectProfileId || user.id;
    const { data: profile } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", targetAgencyProfileId)
        .maybeSingle();

    if (inspectProfileId && !profile) {
        redirect("/admin/agencies");
    }

    if (userType === "agency") {
        const { agency } = await ensureAgencyRecord(admin, {
            userId: user.id,
            email: user.email,
            fullName: profile?.full_name || user.user_metadata?.full_name,
            agencyName: user.user_metadata?.company_name,
        });

        if (!agency) {
            redirect("/profile");
        }
    } else {
        const agency = await getAgencyRecordByProfileId(admin, targetAgencyProfileId);
        if (!agency) {
            redirect("/admin/agencies");
        }
    }

    return (
        <AppShell user={user} variant="dashboard">
            <AgencyWorkerCreatePageClient
                readOnlyPreview={userType === "admin"}
                inspectProfileId={inspectProfileId}
            />
        </AppShell>
    );
}
