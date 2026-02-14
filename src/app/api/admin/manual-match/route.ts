import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST: Create a manual match between a candidate and a job
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

        if (profile?.user_type !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { candidateId, jobRequestId } = await request.json();

        if (!candidateId || !jobRequestId) {
            return NextResponse.json(
                { error: "Missing required fields: candidateId, jobRequestId" },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        // Verify candidate exists
        const { data: candidate, error: candErr } = await admin
            .from("candidates")
            .select("id, profile_id, status")
            .eq("id", candidateId)
            .single();

        if (!candidate || candErr) {
            return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
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

        // Check for duplicate — same candidate + same job
        const { data: existingOffer } = await admin
            .from("offers")
            .select("id")
            .eq("candidate_id", candidateId)
            .eq("job_request_id", jobRequestId)
            .in("status", ["pending", "accepted"])
            .limit(1);

        if (existingOffer && existingOffer.length > 0) {
            return NextResponse.json(
                { error: "An active offer already exists for this candidate and job" },
                { status: 409 }
            );
        }

        // Create match row (candidate ↔ employer)
        const { data: match, error: matchErr } = await admin
            .from("matches")
            .insert({
                candidate_id: candidateId,
                employer_id: job.employer_id,
                status: "PENDING",
                notes: `Manual match by admin (${user.email})`,
            })
            .select("id")
            .single();

        if (matchErr) {
            console.error("[Manual Match] Error creating match:", matchErr);
            return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
        }

        // Create offer row (candidate ↔ job, no expiry for manual matches)
        const { data: offer, error: offerErr } = await admin
            .from("offers")
            .insert({
                job_request_id: jobRequestId,
                candidate_id: candidateId,
                status: "accepted", // Admin-matched = auto-accepted
                offered_at: new Date().toISOString(),
                accepted_at: new Date().toISOString(),
            })
            .select("id")
            .single();

        if (offerErr) {
            console.error("[Manual Match] Error creating offer:", offerErr);
            return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
        }

        // Update candidate status
        await admin
            .from("candidates")
            .update({ status: "OFFER_ACCEPTED" })
            .eq("id", candidateId);

        // Create contract_data row skeleton for document generation
        const { data: candidateProfile } = await admin
            .from("profiles")
            .select("full_name")
            .eq("id", candidate.profile_id)
            .single();

        const { data: employer } = await admin
            .from("employers")
            .select("company_name, company_address, pib")
            .eq("id", job.employer_id)
            .single();

        await admin.from("contract_data").insert({
            match_id: match.id,
            candidate_full_name: candidateProfile?.full_name || null,
            employer_company_name: employer?.company_name || null,
            employer_pib: employer?.pib || null,
            employer_address: employer?.company_address || null,
            job_title: job.title,
            salary_rsd: null,
            accommodation_address: null,
            contract_duration_months: null,
            work_schedule: null,
        });

        return NextResponse.json({
            success: true,
            matchId: match.id,
            offerId: offer.id,
            message: `Successfully matched candidate to "${job.title}"`,
        });

    } catch (error) {
        console.error("[Manual Match] System error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET: List available jobs for matching dropdown
export async function GET(request: NextRequest) {
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

        if (profile?.user_type !== "admin") {
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
