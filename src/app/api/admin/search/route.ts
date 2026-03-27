import { NextResponse } from "next/server";
import { normalizeUserType } from "@/lib/domain";
import { pickCanonicalEmployerRecord, shouldHideEmployerFromBusinessViews } from "@/lib/employers";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { pickCanonicalWorkerRecord } from "@/lib/workers";

type WorkerSearchRow = {
    id: string;
    profile_id: string | null;
    status: string | null;
    passport_number: string | null;
    preferred_job: string | null;
    entry_fee_paid: boolean | null;
    queue_joined_at: string | null;
    updated_at: string | null;
};

type EmployerSearchRow = {
    id: string;
    profile_id: string | null;
    company_name: string | null;
    status: string | null;
    tax_id: string | null;
    contact_email: string | null;
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get("q")?.trim() || "";

        if (q.length < 2) {
            return NextResponse.json({ success: true, results: [] });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const adminClient = createTypedAdminClient();

        // Perform parallel searches. We use ilike for case-insensitive partial match
        const [
            { data: profiles },
            { data: workerPassportMatches },
            { data: employers }
        ] = await Promise.all([
            adminClient.from("profiles")
                .select("id, full_name, email, user_type")
                .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
                .limit(10),
            adminClient.from("worker_onboarding")
                .select("id, profile_id, status, passport_number, preferred_job, entry_fee_paid, queue_joined_at, updated_at")
                .ilike("passport_number", `%${q}%`)
                .limit(10),
            adminClient.from("employers")
                .select("id, profile_id, company_name, status, tax_id, contact_email")
                .or(`company_name.ilike.%${q}%,tax_id.ilike.%${q}%`)
                .limit(10)
        ]);

        const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
        const employerGroups = new Map<string, EmployerSearchRow[]>();
        for (const employer of (employers || []) as EmployerSearchRow[]) {
            const profileId = employer.profile_id || employer.id;
            const current = employerGroups.get(profileId) || [];
            current.push(employer);
            employerGroups.set(profileId, current);
        }

        const visibleEmployers = Array.from(employerGroups.entries())
            .map(([profileId, rows]) => {
                const employer = pickCanonicalEmployerRecord(rows);
                if (!employer) {
                    return null;
                }

                const profileEntry = employer.profile_id ? profileMap.get(employer.profile_id) || null : profileMap.get(profileId) || null;
                if (shouldHideEmployerFromBusinessViews({ employer, profile: profileEntry })) {
                    return null;
                }

                return employer;
            })
            .filter(Boolean) as EmployerSearchRow[];

        const results: Array<{ id: string; type: string; title: string; subtitle: string; link: string }> = [];

        // Map employers
        if (visibleEmployers.length > 0) {
            visibleEmployers.forEach((employer) => {
                results.push({
                    id: employer.profile_id || employer.id,
                    type: "Employer",
                    title: employer.company_name || "Employer",
                    subtitle: employer.tax_id || employer.status || "Employer account",
                    link: `/admin/employers` // Basic link, no specific employer param yet
                });
            });
        }

        // Map worker rows found via passport_number
        const workerProfileIds = new Set(
            (workerPassportMatches || [])
                .map((worker) => worker.profile_id)
                .filter((profileId): profileId is string => Boolean(profileId))
        );

        // Add worker profiles found via name/email
        const allWorkerProfileIds = new Set([...workerProfileIds]);
        profiles?.forEach((p) => {
            if (normalizeUserType(p.user_type) === "worker") {
                allWorkerProfileIds.add(p.id);
            }
        });

        if (allWorkerProfileIds.size > 0) {
            const idsList = Array.from(allWorkerProfileIds);
            const { data: matchedWorkerRows } = await adminClient
                .from("worker_onboarding")
                .select("id, profile_id, status, preferred_job, entry_fee_paid, queue_joined_at, updated_at")
                .in("profile_id", idsList.length > 0 ? idsList : ["__none__"])
                .limit(20);

            const { data: matchedProfiles } = await adminClient
                .from("profiles")
                .select("id, full_name, email")
                .in("id", idsList.length > 0 ? idsList : ["__none__"]);

            const workerRowsByProfileId = new Map<string, WorkerSearchRow[]>();
            for (const workerRow of (matchedWorkerRows || []) as WorkerSearchRow[]) {
                if (!workerRow.profile_id) continue;
                const current = workerRowsByProfileId.get(workerRow.profile_id) || [];
                current.push(workerRow);
                workerRowsByProfileId.set(workerRow.profile_id, current);
            }

            Array.from(workerRowsByProfileId.values())
                .map((rows) => pickCanonicalWorkerRecord(rows))
                .filter((worker): worker is WorkerSearchRow => Boolean(worker))
                .forEach((worker) => {
                const profileEntry = matchedProfiles?.find((profile) => profile.id === worker?.profile_id);
                results.push({
                    id: worker.profile_id || worker.id,
                    type: "Worker",
                    title: profileEntry?.full_name || profileEntry?.email || "Unknown",
                    subtitle: `${worker.preferred_job || "No job"} • ${worker.status || "NEW"}`,
                    link: `/admin/workers/${worker.profile_id || worker.id}`
                });
            });
        }

        // Add matching employers from profiles search if company name didn't match
        profiles?.forEach((p) => {
            if (normalizeUserType(p.user_type) === "employer") {
                if (shouldHideEmployerFromBusinessViews({ profile: p })) {
                    return;
                }
                // Ignore if we already added it via employers search
                if (!visibleEmployers.find(e => e.profile_id === p.id)) {
                    results.push({
                        id: p.id,
                        type: "Employer",
                        title: p.full_name || p.email,
                        subtitle: "Employer Account",
                        link: `/admin/employers`
                    });
                }
            }
        });

        // Remove duplicates and limit
        const uniqueResults = Array.from(
            new Map(results.map((item) => [`${item.type}:${item.id}`, item])).values()
        ).slice(0, 10);

        return NextResponse.json({ success: true, results: uniqueResults });
    } catch (error: unknown) {
        console.error("Global search error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
