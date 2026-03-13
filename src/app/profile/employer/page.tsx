import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildAdminTestUser, getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { getAdminTestEmployerWorkspace } from "@/lib/admin-test-data";
import AppShell from "@/components/AppShell";
import EmployerProfileClient, { type EmployerInspectSnapshot } from "./EmployerProfileClient";

export const dynamic = "force-dynamic";

export default async function EmployerProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string; inspect?: string }>;
}) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const params = await searchParams;
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
    const user = session.user;

    if (!user) redirect("/login");

    if (session.activePersona) {
        if (session.activePersona.role !== "employer") {
            redirect(getAdminTestWorkspaceHref(session.activePersona.role));
        }

        const workspace = await getAdminTestEmployerWorkspace(admin, session.activePersona.id);
        const sandboxEmail = workspace.employer?.contact_email || session.ownerProfile?.email || user.email || "";
        const sandboxName = workspace.employer?.company_name || session.activePersona.label;
        const initialSandboxState = {
            employer: workspace.employer
                ? {
                    id: workspace.employer.persona_id,
                    company_name: workspace.employer.company_name || "",
                    tax_id: workspace.employer.tax_id || null,
                    company_registration_number: workspace.employer.company_registration_number || null,
                    company_address: workspace.employer.company_address || null,
                    contact_phone: workspace.employer.contact_phone || null,
                    status: workspace.employer.status || "PENDING",
                    website: workspace.employer.website || null,
                    industry: workspace.employer.industry || null,
                    company_size: workspace.employer.company_size || null,
                    founded_year: workspace.employer.founded_year || null,
                    description: workspace.employer.description || null,
                    country: workspace.employer.country || null,
                    city: workspace.employer.city || null,
                    postal_code: workspace.employer.postal_code || null,
                    business_registry_number: workspace.employer.business_registry_number || null,
                    founding_date: workspace.employer.founding_date || null,
                }
                : null,
            jobs: workspace.jobs.map((job) => ({
                id: job.id,
                title: job.title,
                description: job.description || null,
                industry: job.industry || "",
                positions_count: job.positions_count ?? 1,
                positions_filled: job.positions_filled ?? 0,
                work_city: job.work_city || null,
                salary_rsd: job.salary_rsd ?? null,
                accommodation_address: job.accommodation_address || null,
                work_schedule: job.work_schedule || null,
                contract_duration_months: job.contract_duration_months ?? null,
                experience_required_years: job.experience_required_years ?? null,
                destination_country: job.destination_country || "",
                status: job.status || "open",
                created_at: job.created_at,
            })),
        };

        return (
            <AppShell
                user={buildAdminTestUser(user, {
                    persona: session.activePersona,
                    displayName: sandboxName,
                    email: sandboxEmail,
                })}
                variant="dashboard"
                adminTestMode={{
                    active: true,
                    role: "employer",
                    label: session.activePersona.label,
                }}
            >
                <EmployerProfileClient
                    adminTestMode
                    readOnlyPreview={false}
                    initialSandboxState={initialSandboxState}
                />
            </AppShell>
        );
    }

    const userType = normalizeUserType(session.liveUserType || user.user_metadata?.user_type);
    if (userType !== "employer" && userType !== "admin") {
        redirect(userType === "agency" ? "/profile/agency" : "/profile/worker");
    }
    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    if (isAdminPreview && !inspectProfileId) {
        redirect("/admin");
    }
    let inspectSnapshot: EmployerInspectSnapshot | null = null;

    if (inspectProfileId) {
        const { data: inspectedProfile } = await admin
            .from("profiles")
            .select("id, email, full_name")
            .eq("id", inspectProfileId)
            .maybeSingle();

        if (!inspectedProfile) {
            redirect("/admin/employers");
        }

        const { data: inspectedEmployer } = await admin
            .from("employers")
            .select("*")
            .eq("profile_id", inspectProfileId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data: inspectedJobs } = inspectedEmployer
            ? await admin
                .from("job_requests")
                .select("*")
                .eq("employer_id", inspectedEmployer.id)
                .order("created_at", { ascending: false })
            : { data: [] };

        inspectSnapshot = {
            profile: inspectedProfile,
            employer: inspectedEmployer,
            jobs: inspectedJobs || [],
        };
    }

    return (
        <AppShell user={user} variant="dashboard">
            <EmployerProfileClient readOnlyPreview={isAdminPreview} inspectSnapshot={inspectSnapshot} />
        </AppShell>
    );
}
