import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AgencySetupRequired from "@/components/AgencySetupRequired";
import AgencyWorkerDocumentsPanel from "@/app/profile/agency/AgencyWorkerDocumentsPanel";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAdminTestUser, getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { getAdminTestAgencyWorker } from "@/lib/admin-test-data";
import { getAgencyOwnedWorker, getAgencySchemaState } from "@/lib/agencies";
import { normalizeUserType } from "@/lib/domain";

export const dynamic = "force-dynamic";

interface AgencyWorkerDocumentsPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ inspect?: string }>;
}

export default async function AgencyWorkerDocumentsPage({
    params,
    searchParams,
}: AgencyWorkerDocumentsPageProps) {
    const { id } = await params;
    const query = await searchParams;
    const supabase = await createClient();
    const admin = createAdminClient();
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
    const user = session.user;

    if (!user) {
        redirect("/login");
    }

    if (session.activePersona) {
        if (session.activePersona.role !== "agency") {
            redirect(getAdminTestWorkspaceHref(session.activePersona.role));
        }

        const worker = await getAdminTestAgencyWorker(admin, session.activePersona.id, id);
        if (!worker) {
            redirect("/profile/agency");
        }

        return (
            <AppShell
                user={buildAdminTestUser(user, {
                    persona: session.activePersona,
                    displayName: session.activePersona.label,
                    email: session.ownerProfile?.email || user.email,
                })}
                variant="dashboard"
                adminTestMode={{
                    active: true,
                    role: "agency",
                    label: session.activePersona.label,
                }}
            >
                <div className="space-y-6">
                    <div>
                        <Link href="/profile/agency" className="text-sm font-semibold text-[#57534e] hover:text-[#18181b]">
                            ← Back to agency dashboard
                        </Link>
                    </div>

                    <section className="rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#faf7ef_0%,#f4efe3_100%)] p-6 shadow-[0_30px_70px_-48px_rgba(15,23,42,0.35)]">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                            <FileCheck2 size={13} />
                            Documents
                        </div>
                        <h1 className="mt-4 text-[2rem] font-semibold tracking-tight text-[#18181b]">
                            {worker.full_name || "Sandbox worker"}
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                            Upload and review worker documents without opening the full worker profile editor.
                        </p>
                    </section>

                    <AgencyWorkerDocumentsPanel
                        workerId={id}
                        readOnlyPreview={false}
                        adminTestMode
                    />
                </div>
            </AppShell>
        );
    }

    const userType = normalizeUserType(session.liveUserType || user.user_metadata?.user_type);
    if (userType !== "agency" && userType !== "admin") {
        redirect(userType === "employer" ? "/profile/employer" : "/profile/worker");
    }

    const inspectProfileId = userType === "admin" ? query?.inspect?.trim() || null : null;
    if (userType === "admin" && !inspectProfileId) {
        redirect("/admin");
    }

    const agencySchemaState = await getAgencySchemaState(admin);
    if (!agencySchemaState.ready) {
        return (
            <AppShell user={user} variant="dashboard">
                <AgencySetupRequired />
            </AppShell>
        );
    }

    const agencyDashboardHref = inspectProfileId ? `/profile/agency?inspect=${inspectProfileId}` : "/profile/agency";
    const targetAgencyProfileId = inspectProfileId || user.id;
    const { worker } = await getAgencyOwnedWorker(admin, targetAgencyProfileId, id);
    if (!worker) {
        redirect(agencyDashboardHref);
    }

    return (
        <AppShell user={user} variant="dashboard">
            <div className="space-y-6">
                <div>
                    <Link href={agencyDashboardHref} className="text-sm font-semibold text-[#57534e] hover:text-[#18181b]">
                        ← Back to agency dashboard
                    </Link>
                </div>

                <section className="rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#faf7ef_0%,#f4efe3_100%)] p-6 shadow-[0_30px_70px_-48px_rgba(15,23,42,0.35)]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                        <FileCheck2 size={13} />
                        Documents
                    </div>
                    <h1 className="mt-4 text-[2rem] font-semibold tracking-tight text-[#18181b]">
                        {worker.submitted_full_name || "Worker documents"}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                        Upload and review worker documents without opening the full worker profile editor.
                    </p>
                </section>

                <AgencyWorkerDocumentsPanel
                    workerId={id}
                    readOnlyPreview={userType === "admin"}
                    adminTestMode={false}
                    inspectProfileId={inspectProfileId}
                />
            </div>
        </AppShell>
    );
}
