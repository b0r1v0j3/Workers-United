import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { normalizeUserType } from "@/lib/domain";
import AppShell from "@/components/AppShell";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import JobsMatchClient from "./JobsMatchClient";
import { pickCanonicalWorkerRecord } from "@/lib/workers";

type QueueWorkerRow = {
    id: string;
    profile_id: string | null;
    status: string | null;
    preferred_job: string | null;
    nationality: string | null;
    phone: string | null;
    queue_joined_at: string | null;
    updated_at: string | null;
    entry_fee_paid: boolean | null;
};

export default async function AdminJobsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);
    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const adminClient = createAdminClient();

    // Get all job requests
    const { data: jobRequestsRaw } = await adminClient
        .from("job_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

    const employerIds = (jobRequestsRaw || [])
        .map((job) => job.employer_id)
        .filter((employerId): employerId is string => Boolean(employerId));

    const { data: employers } = employerIds.length > 0
        ? await adminClient
            .from("employers")
            .select("id, company_name, profile_id")
            .in("id", employerIds)
        : { data: [] as { company_name: string | null; id: string; profile_id: string | null }[] };

    const employerProfileIds = (employers || [])
        .map((employer) => employer.profile_id)
        .filter((profileId): profileId is string => Boolean(profileId));

    const { data: employerProfiles } = employerProfileIds.length > 0
        ? await adminClient
            .from("profiles")
            .select("id, email")
            .in("id", employerProfileIds)
        : { data: [] as { email: string | null; id: string }[] };

    const employerProfileMap = new Map((employerProfiles || []).map((profile) => [profile.id, profile]));
    const employerMap = new Map((employers || []).map((employer) => [
        employer.id,
        {
            ...employer,
            profiles: employer.profile_id ? employerProfileMap.get(employer.profile_id) || null : null,
        },
    ]));

    const jobRequests = (jobRequestsRaw || []).map((job) => ({
        ...job,
        employer: job.employer_id ? employerMap.get(job.employer_id) || null : null,
    }));

    // Get all IN_QUEUE worker rows for matching
    const { data: queueWorkerRowsRaw } = await adminClient
        .from("worker_onboarding")
        .select("id, profile_id, status, preferred_job, nationality, phone, queue_joined_at, updated_at, entry_fee_paid")
        .eq("status", "IN_QUEUE");

    const workerRowsByProfileId = new Map<string, QueueWorkerRow[]>();
    for (const workerRow of (queueWorkerRowsRaw || []) as QueueWorkerRow[]) {
        if (!workerRow.profile_id) continue;
        const current = workerRowsByProfileId.get(workerRow.profile_id) || [];
        current.push(workerRow);
        workerRowsByProfileId.set(workerRow.profile_id, current);
    }

    const queuedWorkers = Array.from(workerRowsByProfileId.values())
        .map((rows) => pickCanonicalWorkerRecord(rows))
        .filter((worker): worker is QueueWorkerRow => Boolean(worker));

    const profileIds = queuedWorkers
        .map((worker) => worker.profile_id)
        .filter((profileId): profileId is string => Boolean(profileId));

    const { data: queueProfiles } = profileIds.length > 0
        ? await adminClient
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds)
        : { data: [] as { email: string | null; full_name: string | null; id: string }[] };

    const profileMap = new Map((queueProfiles || []).map((profile) => [profile.id, profile]));

    const queueWorkers = queuedWorkers.map((worker) => ({
        ...worker,
        profiles: worker.profile_id ? profileMap.get(worker.profile_id) || null : null,
    }));
    const openJobsCount = jobRequests.filter((job) => (job.status || "").toLowerCase() === "open").length;
    const openEmployerCount = new Set(jobRequests.map((job) => job.employer_id).filter(Boolean)).size;
    const destinationCount = new Set(jobRequests.map((job) => job.destination_country).filter(Boolean)).size;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Admin jobs"
                    title="Smart Match Hub"
                    description="Select an open job request, compare it against the live worker queue, and move only through employer-job pairs that already exist inside Workers United."
                    metrics={[
                        { label: "Open Jobs", value: openJobsCount, meta: `${jobRequests.length} total loaded` },
                        { label: "Queue", value: queueWorkers.length, meta: "Workers available for matching" },
                        { label: "Employers", value: openEmployerCount, meta: "Employers with loaded jobs" },
                        { label: "Markets", value: destinationCount, meta: "Destination countries in current jobs" },
                    ]}
                />

                <section className="grid gap-4 md:grid-cols-3">
                    <InfoPanel
                        title="Job-first matching"
                        copy="Start from a concrete employer request, then review workers already inside the verified and paid queue."
                        tone="dark"
                    />
                    <InfoPanel
                        title="Closed system"
                        copy="This hub only uses data already in the platform. No direct off-platform worker discovery or employer contact happens here."
                        tone="blue"
                    />
                    <InfoPanel
                        title="Use with case view"
                        copy="After identifying a good fit here, jump into the worker case or employer workspace for the operational next step."
                        tone="amber"
                    />
                </section>

                <JobsMatchClient jobs={jobRequests} queue={queueWorkers} />
            </div>
        </AppShell>
    );
}

function InfoPanel({ title, copy, tone }: { title: string; copy: string; tone: "dark" | "blue" | "amber" }) {
    const toneClass = tone === "blue"
        ? "bg-blue-600 text-white"
        : tone === "amber"
            ? "bg-amber-500 text-white"
            : "bg-[#111111] text-white";

    return (
        <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className={`mb-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
                {title}
            </div>
            <p className="text-sm leading-relaxed text-[#57534e]">{copy}</p>
        </div>
    );
}

