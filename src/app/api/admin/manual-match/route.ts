import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";

export const dynamic = "force-dynamic";

// POST: Create a manual match between a worker and a job
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Admin check
        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { workerId, jobRequestId } = await request.json() as {
            workerId?: string;
            jobRequestId?: string;
        };
        const targetWorkerRecordId =
            typeof workerId === "string" && workerId.trim()
                ? workerId.trim()
                : null;

        if (!targetWorkerRecordId || !jobRequestId) {
            return NextResponse.json(
                { error: "Missing required fields: workerId, jobRequestId" },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        // Verify worker exists
        const { data: workerRecord, error: workerRecordError } = await admin
            .from("worker_onboarding")
            .select("id, profile_id, status")
            .eq("id", targetWorkerRecordId)
            .single();

        if (!workerRecord || workerRecordError) {
            return NextResponse.json({ error: "Worker not found" }, { status: 404 });
        }

        // Verify job exists and has open positions
        const { data: job, error: jobErr } = await admin
            .from("job_requests")
            .select("id, employer_id, title, positions_count, positions_filled, status")
            .eq("id", jobRequestId)
            .single();

        if (!job || jobErr) {
            return NextResponse.json({ error: "Job request not found" }, { status: 404 });
        }

        if (job.positions_filled >= job.positions_count) {
            return NextResponse.json({ error: "No open positions remaining for this job" }, { status: 400 });
        }

        // Check for duplicate — same worker + same job
        const { data: existingOffer } = await admin
            .from("offers")
            .select("id")
            .eq("worker_id", targetWorkerRecordId)
            .eq("job_request_id", jobRequestId)
            .in("status", ["pending", "accepted"])
            .limit(1);

        if (existingOffer && existingOffer.length > 0) {
            return NextResponse.json(
                { error: "An active offer already exists for this worker and job" },
                { status: 409 }
            );
        }

        let createdMatchId: string | null = null;
        let createdOfferId: string | null = null;

        // Create match row (worker ↔ employer)
        const { data: match, error: matchErr } = await admin
            .from("matches")
            .insert({
                worker_id: targetWorkerRecordId,
                employer_id: job.employer_id,
                status: "PENDING",
            })
            .select("id")
            .single();

        if (matchErr) {
            console.error("[Manual Match] Error creating match:", matchErr);
            return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
        }
        createdMatchId = match.id;

        // Create offer row (worker ↔ job, no expiry for manual matches)
        const { data: offer, error: offerErr } = await admin
            .from("offers")
            .insert({
                job_request_id: jobRequestId,
                worker_id: targetWorkerRecordId,
                status: "accepted", // Admin-matched = auto-accepted
            })
            .select("id")
            .single();

        if (offerErr) {
            console.error("[Manual Match] Error creating offer:", offerErr);
            if (createdMatchId) {
                await admin.from("matches").delete().eq("id", createdMatchId);
            }
            return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
        }
        createdOfferId = offer.id;

        // Update worker status
        const { error: workerStatusError } = await admin
            .from("worker_onboarding")
            .update({ status: "OFFER_ACCEPTED" })
            .eq("id", targetWorkerRecordId);

        if (workerStatusError) {
            console.error("[Manual Match] Error updating worker status:", workerStatusError);
            if (createdOfferId) {
                await admin.from("offers").delete().eq("id", createdOfferId);
            }
            if (createdMatchId) {
                await admin.from("matches").delete().eq("id", createdMatchId);
            }
            return NextResponse.json({ error: "Failed to update worker status" }, { status: 500 });
        }

        const { error: positionsError } = await admin.rpc("increment_positions_filled", {
            job_request_id: jobRequestId,
        });

        if (positionsError) {
            console.error("[Manual Match] Error incrementing positions:", positionsError);
            await admin.from("worker_onboarding").update({ status: workerRecord.status }).eq("id", targetWorkerRecordId);
            if (createdOfferId) {
                await admin.from("offers").delete().eq("id", createdOfferId);
            }
            if (createdMatchId) {
                await admin.from("matches").delete().eq("id", createdMatchId);
            }
            return NextResponse.json({ error: "Failed to reserve the job position" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            matchId: match.id,
            offerId: offer.id,
            message: `Successfully matched worker to "${job.title}"`,
        });

    } catch (error) {
        console.error("[Manual Match] System error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET: List available jobs for matching dropdown
export async function GET() {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Admin check
        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const admin = createAdminClient();

        // Get jobs that still have open positions
        const { data: jobs, error } = await admin
            .from("job_requests")
            .select(`
                id, title, industry, positions_count, positions_filled,
                destination_country, salary_rsd, status,
                employer:employers(company_name)
            `)
            .in("status", ["open", "matching"])
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Filter to jobs with available positions
        const availableJobs = (jobs || []).filter(
            (j: any) => j.positions_filled < j.positions_count
        );

        return NextResponse.json({ jobs: availableJobs });

    } catch (error) {
        console.error("[Manual Match] GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
