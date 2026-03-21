import { NextResponse } from "next/server";
import { hasValidCronBearerToken } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOfferNotification, sendOfferExpiredNotification } from "@/lib/notifications";

// Vercel Cron: runs every hour
// Add to vercel.json: { "crons": [{ "path": "/api/cron/check-expiry", "schedule": "0 * * * *" }] }

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 second timeout for edge functions

function assertNoDbError(error: { message: string } | null | undefined, context: string) {
    if (error) {
        throw new Error(`${context}: ${error.message}`);
    }
}

export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (!hasValidCronBearerToken(authHeader)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
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
        worker_onboarding!offers_worker_id_fkey(*),
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
                    const { error: expireOfferError } = await supabase
                        .from("offers")
                        .update({ status: "expired" })
                        .eq("id", offer.id);
                    assertNoDbError(expireOfferError, `Failed to mark offer ${offer.id} as expired`);

                    // Return worker to queue
                    const { error: queueWorkerError } = await supabase
                        .from("worker_onboarding")
                        .update({ status: "IN_QUEUE" })
                        .eq("id", offer.worker_id);
                    assertNoDbError(queueWorkerError, `Failed to return worker ${offer.worker_id} to queue`);

                    results.expiredOffers++;

                    // Send expiry notification
                    try {
                        // Fetch profile to get email and name
                        const { data: workerProfile, error: workerProfileError } = await supabase
                            .from("profiles")
                            .select("email, full_name")
                            .eq("id", offer.worker_onboarding?.profile_id)
                            .single();
                        assertNoDbError(workerProfileError, `Failed to load worker profile for expired offer ${offer.id}`);

                        if (workerProfile?.email && offer.worker_onboarding?.profile_id) {
                            await sendOfferExpiredNotification({
                                supabase,
                                workerUserId: offer.worker_onboarding.profile_id,
                                workerEmail: workerProfile.email,
                                workerName: workerProfile.full_name || "Worker",
                                workerPhone: offer.worker_onboarding?.phone || undefined,
                                jobTitle: offer.job_requests?.title || "Position",
                                queuePosition: offer.worker_onboarding?.queue_position || 0,
                            });
                        }
                    } catch (notifError) {
                        console.error("Failed to send expiry notification:", notifError);
                    }

                    // Find and create offer for the next worker in queue
                    const newOfferId = await shiftOfferToNextWorker(supabase, offer);

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

        const { data: refundWorkers, error: refundError } = await supabase
            .from("worker_onboarding")
            .select("*")
            .eq("status", "IN_QUEUE")
            .eq("entry_fee_paid", true)
            .lt("queue_joined_at", ninetyDaysAgo.toISOString());

        if (refundError) {
            results.errors.push(`Failed to fetch refund workers: ${refundError.message}`);
        } else if (refundWorkers && refundWorkers.length > 0) {
            for (const workerRecord of refundWorkers) {
                try {
                    // Flag worker for refund
                    const { error: flagRefundError } = await supabase
                        .from("worker_onboarding")
                        .update({ status: "REFUND_FLAGGED" })
                        .eq("id", workerRecord.id);
                    assertNoDbError(flagRefundError, `Failed to flag worker ${workerRecord.id} for refund`);

                    // Flag the payment
                    if (workerRecord.entry_payment_id) {
                        const { error: flagPaymentError } = await supabase
                            .from("payments")
                            .update({ status: "flagged_for_refund" })
                            .eq("id", workerRecord.entry_payment_id);
                        assertNoDbError(flagPaymentError, `Failed to flag payment ${workerRecord.entry_payment_id} for refund`);
                    }

                    results.refundsFlagged++;
                } catch (refundProcessError) {
                    results.errors.push(`Failed to flag refund for ${workerRecord.id}: ${refundProcessError}`);
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

async function shiftOfferToNextWorker(
    supabase: ReturnType<typeof createAdminClient>,
    expiredOffer: {
        id: string;
        job_request_id: string;
        queue_position_at_offer: number;
        job_requests?: { title?: string; positions_count?: number; positions_filled?: number };
    }
): Promise<string | null> {
    // Check if job request is still open
    const { data: jobRequest, error: jobRequestError } = await supabase
        .from("job_requests")
        .select("*")
        .eq("id", expiredOffer.job_request_id)
        .maybeSingle();
    assertNoDbError(jobRequestError, `Failed to load job request ${expiredOffer.job_request_id} during offer shift`);

    if (!jobRequest || jobRequest.status === "filled" || jobRequest.status === "closed") {
        return null;
    }

    // Find next eligible worker
    const { data: nextWorkerRecord, error: nextWorkerError } = await supabase
        .from("worker_onboarding")
        .select("*")
        .eq("status", "IN_QUEUE")
        .eq("entry_fee_paid", true)
        .gt("queue_position", expiredOffer.queue_position_at_offer)
        .order("queue_position", { ascending: true })
        .limit(1)
        .maybeSingle();
    assertNoDbError(nextWorkerError, `Failed to load next worker for shifted offer ${expiredOffer.id}`);

    if (!nextWorkerRecord) {
        return null;
    }

    // Check worker doesn't already have an offer for this job
    const { data: existingOffer, error: existingOfferError } = await supabase
        .from("offers")
        .select("id")
        .eq("job_request_id", expiredOffer.job_request_id)
        .eq("worker_id", nextWorkerRecord.id)
        .maybeSingle();
    assertNoDbError(existingOfferError, `Failed to check existing offer for worker ${nextWorkerRecord.id}`);

    if (existingOffer) {
        // Recurse to find the next worker
        return shiftOfferToNextWorker(supabase, {
            ...expiredOffer,
            queue_position_at_offer: nextWorkerRecord.queue_position,
        });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create new offer
    const { data: newOffer, error: offerError } = await supabase
        .from("offers")
        .insert({
            job_request_id: expiredOffer.job_request_id,
            worker_id: nextWorkerRecord.id,
            queue_position_at_offer: nextWorkerRecord.queue_position,
            expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

    if (offerError) {
        console.error("Failed to create shifted offer:", offerError);
        return null;
    }

    // Update worker status
    const { error: workerStatusError } = await supabase
        .from("worker_onboarding")
        .update({ status: "OFFER_PENDING" })
        .eq("id", nextWorkerRecord.id);
    assertNoDbError(workerStatusError, `Failed to mark worker ${nextWorkerRecord.id} as OFFER_PENDING`);

    // Get profile for notification
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", nextWorkerRecord.profile_id)
        .maybeSingle();
    assertNoDbError(profileError, `Failed to load profile for shifted offer worker ${nextWorkerRecord.id}`);

    // Send offer notification
    if (profile?.email && nextWorkerRecord.profile_id) {
        try {
            await sendOfferNotification({
                supabase,
                workerUserId: nextWorkerRecord.profile_id,
                workerEmail: profile.email,
                workerName: profile.full_name || "Worker",
                workerPhone: nextWorkerRecord.phone || undefined,
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
