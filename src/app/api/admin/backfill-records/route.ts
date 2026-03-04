import { NextResponse } from "next/server";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/backfill-records
 * 
 * One-shot admin endpoint that creates missing profiles + candidates
 * for all auth users with user_type = 'worker' who are missing those records.
 * 
 * Auth: CRON_SECRET bearer token
 */
export async function POST(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const allUsers = await getAllAuthUsers(supabase);

    // Filter to workers only (exclude employers and admins)
    const workers = allUsers.filter((u) => {
        const userType = u.user_metadata?.user_type;
        return !userType || userType === "worker" || userType === "candidate";
    });

    let profilesCreated = 0;
    let candidatesCreated = 0;
    let errors = 0;

    for (const user of workers) {
        try {
            // Ensure profile exists
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", user.id)
                .maybeSingle();

            if (!existingProfile) {
                const { error: profileErr } = await supabase.from("profiles").upsert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
                    user_type: "worker",
                });
                if (!profileErr) {
                    profilesCreated++;
                } else {
                    console.error(`[Backfill] Profile create failed for ${user.id}:`, profileErr.message);
                    errors++;
                }
            }

            // Ensure candidate exists
            const { data: existingCandidate } = await supabase
                .from("candidates")
                .select("id")
                .eq("profile_id", user.id)
                .maybeSingle();

            if (!existingCandidate) {
                const { error: candErr } = await supabase.from("candidates").insert({
                    profile_id: user.id,
                    status: "NEW",
                });
                if (!candErr) {
                    candidatesCreated++;
                } else {
                    console.error(`[Backfill] Candidate create failed for ${user.id}:`, candErr.message);
                    errors++;
                }
            }
        } catch (err) {
            console.error(`[Backfill] Error for user ${user.id}:`, err);
            errors++;
        }
    }

    return NextResponse.json({
        success: true,
        totalWorkers: workers.length,
        profilesCreated,
        candidatesCreated,
        errors,
    });
}
