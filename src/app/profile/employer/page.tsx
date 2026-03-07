import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import EmployerProfileClient, { type EmployerInspectSnapshot } from "./EmployerProfileClient";

export const dynamic = "force-dynamic";

export default async function EmployerProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string; inspect?: string }>;
}) {
    const supabase = await createClient();
    const params = await searchParams;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType !== "employer" && userType !== "admin") {
        redirect(userType === "agency" ? "/profile/agency" : "/profile/worker");
    }
    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    let inspectSnapshot: EmployerInspectSnapshot | null = null;

    if (inspectProfileId) {
        const admin = createAdminClient();
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
