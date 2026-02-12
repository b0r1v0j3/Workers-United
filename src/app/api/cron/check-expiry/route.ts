import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOfferNotification, sendOfferExpiredNotification } from "@/lib/notifications";

// Vercel Cron: runs every hour
// Add to vercel.json: { "crons": [{ "path": "/api/cron/check-expiry", "schedule": "0 * * * *" }] }

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 second timeout for edge functions

export async function GET(request: Request) {
    // Verify cron secret (optional security)
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const now = new Date().toISOString();

    const results = {
        expiredOffers: 0,
        newOffers: 0,
        refundsFlagged: 0,
        errors: [] as string[],
    };

    try {
        // =====================================================
        // 1. Find and process expired offers
        // =====================================================
        const { data: expiredOffers, error: expiredError } = await supabase
            .from("offers")
            .select(`
        *,
        candidates(*),
        job_requests(*)
      `)
            .eq("status", "pending")
            .lt("expires_at", now);

        if (expiredError) {
            results.errors.push(`Failed to fetch expired offers: ${expiredError.message}`);
        } else if (expiredOffers && expiredOffers.length > 0) {
            for (const offer of expiredOffers) {
                try {
                    // Mark offer as expired
                    await supabase
                        .from("offers")
                        .update({ status: "expired" })
                        .eq("id", offer.id);

                    // Return candidate to queue
                    await supabase
                        .from("candidates")
                        .update({ status: "IN_QUEUE" })
                        .eq("id", offer.candidate_id);

                    results.expiredOffers++;

                    // Send expiry notification
                    try {
                        await sendOfferExpiredNotification({
                            candidateEmail: offer.candidates?.profile_id, // needs join to profiles
                            candidateName: offer.candidates?.phone || "Candidate",
                            jobTitle: offer.job_requests?.title || "Position",
                            queuePosition: offer.candidates?.queue_position || 0,
                        });
                    } catch (notifError) {
                        console.error("Failed to send expiry notification:", notifError);
                    }

                    // Find and create offer for next candidate
                    const newOfferId = await shiftOfferToNextCandidate(supabase, offer);

                    if (newOfferId) {
                        results.newOffers++;
                    }
                } catch (offerError) {
                    results.errors.push(`Failed to process offer ${offer.id}: ${offerError}`);
                }
            }
        }

        // =====================================================
        // 2. Check for 90-day refund eligibility
        // =====================================================
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data: refundCandidates, error: refundError } = await supabase
            .from("candidates")
            .select("*")
            .eq("status", "IN_QUEUE")
            .eq("entry_fee_paid", true)
            .lt("queue_joined_at", ninetyDaysAgo.toISOString());

        if (refundError) {
            results.errors.push(`Failed to fetch refund candidates: ${refundError.message}`);
        } else if (refundCandidates && refundCandidates.length > 0) {
            for (const candidate of refundCandidates) {
                try {
                    // Flag candidate for refund
                    await supabase
                        .from("candidates")
                        .update({ status: "REFUND_FLAGGED" })
                        .eq("id", candidate.id);

                    // Flag the payment
                    if (candidate.entry_payment_id) {
                        await supabase
                            .from("payments")
                            .update({ status: "flagged_for_refund" })
                            .eq("id", candidate.entry_payment_id);
                    }

                    results.refundsFlagged++;
                } catch (refundProcessError) {
                    results.errors.push(`Failed to flag refund for ${candidate.id}: ${refundProcessError}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: now,
            ...results,
        });
    } catch (error) {
        console.error("Cron job failed:", error);
        return NextResponse.json(
            { error: "Cron job failed", details: String(error) },
            { status: 500 }
        );
    }
}

async function shiftOfferToNextCandidate(
    supabase: Awaited<ReturnType<typeof createClient>>,
    expiredOffer: {
        id: string;
        job_request_id: string;
        queue_position_at_offer: number;
        job_requests?: { title?: string; positions_count?: number; positions_filled?: number };
    }
): Promise<string | null> {
    // Check if job request is still open
    const { data: jobRequest } = await supabase
        .from("job_requests")
        .select("*")
        .eq("id", expiredOffer.job_request_id)
        .single();

    if (!jobRequest || jobRequest.status === "filled" || jobRequest.status === "closed") {
        return null;
    }

    // Find next eligible candidate
    const { data: nextCandidate } = await supabase
        .from("candidates")
        .select("*")
        .eq("status", "IN_QUEUE")
        .eq("entry_fee_paid", true)
        .gt("queue_position", expiredOffer.queue_position_at_offer)
        .order("queue_position", { ascending: true })
        .limit(1)
        .single();

    if (!nextCandidate) {
        return null;
    }

    // Check candidate doesn't already have an offer for this job
    const { data: existingOffer } = await supabase
        .from("offers")
        .select("id")
        .eq("job_request_id", expiredOffer.job_request_id)
        .eq("candidate_id", nextCandidate.id)
        .single();

    if (existingOffer) {
        // Recurse to find next candidate
        return shiftOfferToNextCandidate(supabase, {
            ...expiredOffer,
            queue_position_at_offer: nextCandidate.queue_position,
        });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create new offer
    const { data: newOffer, error: offerError } = await supabase
        .from("offers")
        .insert({
            job_request_id: expiredOffer.job_request_id,
            candidate_id: nextCandidate.id,
            queue_position_at_offer: nextCandidate.queue_position,
            expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

    if (offerError) {
        console.error("Failed to create shifted offer:", offerError);
        return null;
    }

    // Update candidate status
    await supabase
        .from("candidates")
        .update({ status: "OFFER_PENDING" })
        .eq("id", nextCandidate.id);

    // Get profile for notification
    const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", nextCandidate.profile_id)
        .single();

    // Send offer notification
    if (profile) {
        try {
            await sendOfferNotification({
                candidateEmail: profile.email,
                candidateName: profile.full_name || "Candidate",
                jobTitle: jobRequest.title,
                companyName: "Employer", // Would need employer join
                country: jobRequest.destination_country,
                expiresAt: expiresAt.toISOString(),
                offerId: newOffer.id,
            });
        } catch (notifError) {
            console.error("Failed to send offer notification:", notifError);
        }
    }

    return newOffer.id;
}
