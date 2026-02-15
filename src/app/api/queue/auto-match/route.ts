import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOfferNotification } from "@/lib/notifications";

// POST: Trigger auto-matching for a job request
export async function POST(request: NextRequest) {
    const supabase = await createClient();

    // Check admin authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { jobRequestId } = body;

    if (!jobRequestId) {
        return NextResponse.json({ error: "Job request ID required" }, { status: 400 });
    }

    try {
        const admin = createAdminClient();

        // Get job request
        const { data: jobRequest, error: jobError } = await admin
            .from("job_requests")
            .select(`
        *,
        employers(*, profiles(*))
      `)
            .eq("id", jobRequestId)
            .single();

        if (jobError || !jobRequest) {
            return NextResponse.json({ error: "Job request not found" }, { status: 404 });
        }

        if (jobRequest.status !== "open") {
            return NextResponse.json({ error: "Job request is not open for matching" }, { status: 400 });
        }

        const positionsToFill = jobRequest.positions_count - jobRequest.positions_filled;

        if (positionsToFill <= 0) {
            return NextResponse.json({ error: "All positions already filled" }, { status: 400 });
        }

        // Find eligible candidates in FIFO order
        const { data: candidates, error: candidatesError } = await admin
            .from("candidates")
            .select(`
        *,
        profiles(*)
      `)
            .eq("status", "IN_QUEUE")
            .eq("entry_fee_paid", true)
            .order("queue_position", { ascending: true })
            .limit(positionsToFill);

        if (candidatesError) {
            return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
        }

        if (!candidates || candidates.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No eligible candidates in queue",
                matchedCount: 0
            });
        }

        // Filter out candidates with existing offers for this job
        const { data: existingOffers } = await admin
            .from("offers")
            .select("candidate_id")
            .eq("job_request_id", jobRequestId);

        const existingCandidateIds = new Set(existingOffers?.map(o => o.candidate_id) || []);
        const eligibleCandidates = candidates.filter(c => !existingCandidateIds.has(c.id));

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const matchedOffers = [];

        for (const candidate of eligibleCandidates) {
            // Create offer
            const { data: offer, error: offerError } = await admin
                .from("offers")
                .insert({
                    job_request_id: jobRequestId,
                    candidate_id: candidate.id,
                    queue_position_at_offer: candidate.queue_position,
                    expires_at: expiresAt.toISOString(),
                })
                .select()
                .single();

            if (offerError) {
                console.error("Failed to create offer for candidate:", candidate.id, offerError);
                continue;
            }

            // Update candidate status
            await admin
                .from("candidates")
                .update({ status: "OFFER_PENDING" })
                .eq("id", candidate.id);

            matchedOffers.push(offer);

            // Send notification
            if (candidate.profiles?.email) {
                try {
                    await sendOfferNotification({
                        candidateEmail: candidate.profiles.email,
                        candidateName: candidate.profiles.full_name || "Candidate",
                        jobTitle: jobRequest.title,
                        companyName: jobRequest.employers?.company_name || "Employer",
                        country: jobRequest.destination_country,
                        expiresAt: expiresAt.toISOString(),
                        offerId: offer.id,
                    });
                } catch (notifError) {
                    console.error("Failed to send notification:", notifError);
                }
            }
        }

        // Update job request status
        if (matchedOffers.length > 0) {
            await admin
                .from("job_requests")
                .update({
                    status: "matching",
                    auto_match_triggered: true
                })
                .eq("id", jobRequestId);
        }

        return NextResponse.json({
            success: true,
            matchedCount: matchedOffers.length,
            offers: matchedOffers.map(o => ({
                id: o.id,
                candidateId: o.candidate_id,
                expiresAt: o.expires_at,
            })),
        });
    } catch (error) {
        console.error("Auto-match error:", error);
        return NextResponse.json(
            { error: "Failed to process auto-matching" },
            { status: 500 }
        );
    }
}
