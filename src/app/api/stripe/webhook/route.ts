import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { queueEmail } from "@/lib/email-templates";
import { resolveWorkerStatusAfterEntryFee } from "@/lib/worker-status";
import { finalizeConfirmationFeeOffer } from "@/lib/offer-finalization";
import { loadCanonicalWorkerRecord } from "@/lib/workers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-04-10",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : "Unknown error";
};

function getMetadataValue(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
        return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        if (!webhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
        console.error(`Webhook signature verification failed: ${getErrorMessage(err)}`);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = createAdminClient();

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = getMetadataValue(session.metadata?.user_id);
        const paymentType = session.metadata?.payment_type || "entry_fee";
        const paymentId = getMetadataValue(session.metadata?.payment_id);
        const offerId = getMetadataValue(session.metadata?.offer_id);
        const targetProfileId = getMetadataValue(session.metadata?.target_profile_id);
        const paidByProfileId = getMetadataValue(session.metadata?.paid_by_profile_id) || userId;
        const targetWorkerId = getMetadataValue(session.metadata?.target_worker_id);
        const activitySubjectId = targetProfileId || paidByProfileId || userId;

        if (!userId) {
            console.error("No user_id found in session metadata");
            return NextResponse.json({ error: "No user_id in metadata" }, { status: 400 });
        }

        if (!targetProfileId && !targetWorkerId) {
            console.error("No target worker reference found in session metadata");
            return NextResponse.json({ error: "No target worker in metadata" }, { status: 400 });
        }

        try {
            // Validate payment was actually completed and amount matches expected
            if (session.payment_status !== "paid") {
                console.warn(`[Stripe] Session ${session.id} not paid (status: ${session.payment_status})`);
                return NextResponse.json({ received: true, message: "Payment not completed" });
            }

            // Determine expected amount (in cents) and validate against Stripe
            const expectedAmountCents = paymentType === "confirmation_fee" ? 19000 : 900;
            const amount = paymentType === "confirmation_fee" ? 190 : 9;

            if (session.amount_total && session.amount_total !== expectedAmountCents) {
                console.error(`[Stripe] Amount mismatch: expected ${expectedAmountCents}, got ${session.amount_total}`);
                return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
            }

            const paymentMetadata = {
                ...(session.metadata || {}),
                stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
                stripe_currency: session.currency?.toUpperCase() || "USD",
                stripe_session_status: session.status,
                stripe_payment_status: session.payment_status,
            };

            const paymentPayload = {
                user_id: targetProfileId,
                profile_id: targetProfileId,
                amount,
                amount_cents: expectedAmountCents,
                status: "completed",
                stripe_checkout_session_id: session.id,
                payment_type: paymentType,
                paid_at: new Date().toISOString(),
                metadata: {
                    ...paymentMetadata,
                    paid_by_profile_id: paidByProfileId || null,
                    target_worker_id: targetWorkerId || null,
                },
            };

            if (paymentId) {
                const { error } = await supabase
                    .from("payments")
                    .update(paymentPayload)
                    .eq("id", paymentId);

                if (error) {
                    console.error("Failed to update payment record by payment_id:", error);
                    throw error;
                }
            } else {
                // Fallback 1: update an existing row by checkout session ID.
                const { data: existingBySession } = await supabase
                    .from("payments")
                    .select("id")
                    .eq("stripe_checkout_session_id", session.id)
                    .maybeSingle();

                if (existingBySession?.id) {
                    const { error } = await supabase
                        .from("payments")
                        .update(paymentPayload)
                        .eq("id", existingBySession.id);
                    if (error) throw error;
                } else {
                    // Fallback 2: insert completed payment row.
                    const { error } = await supabase.from("payments").insert(paymentPayload);
                    if (error) {
                        if (error.code === "23505") {
                            return NextResponse.json({ received: true, message: "Duplicate event ignored" });
                        }
                        throw error;
                    }
                }
            }

            // Handle post-payment actions based on type
            if (paymentType === "entry_fee") {
                const nowIso = new Date().toISOString();
                if (targetProfileId) {
                    const { data: existingWorkerRecord, error: existingWorkerRecordError } = await loadCanonicalWorkerRecord(
                        supabase,
                        targetProfileId,
                        "id, status, queue_joined_at, phone, updated_at, entry_fee_paid, job_search_active, nationality, current_country, preferred_job"
                    );
                    if (existingWorkerRecordError) {
                        throw existingWorkerRecordError;
                    }

                    if (!existingWorkerRecord) {
                        const { error: workerRecordUpsertError } = await supabase
                            .from("worker_onboarding")
                            .upsert(
                                {
                                    profile_id: targetProfileId,
                                    entry_fee_paid: true,
                                    status: "IN_QUEUE",
                                    queue_joined_at: nowIso,
                                    job_search_active: true,
                                    job_search_activated_at: nowIso,
                                },
                                { onConflict: "profile_id" }
                            );
                        if (workerRecordUpsertError) {
                            throw workerRecordUpsertError;
                        }
                    } else {
                        const updatePayload: Record<string, unknown> = {
                            entry_fee_paid: true,
                            job_search_active: true,
                            job_search_activated_at: nowIso,
                        };

                        if (!existingWorkerRecord.queue_joined_at) {
                            updatePayload.queue_joined_at = nowIso;
                        }

                        const nextStatus = resolveWorkerStatusAfterEntryFee(existingWorkerRecord.status);
                        if (existingWorkerRecord.status !== nextStatus) {
                            updatePayload.status = nextStatus;
                        }

                        const { error: workerRecordUpdateError } = await supabase
                            .from("worker_onboarding")
                            .update(updatePayload)
                            .eq("profile_id", targetProfileId);
                        if (workerRecordUpdateError) {
                            throw workerRecordUpdateError;
                        }
                    }
                } else if (targetWorkerId) {
                    const { data: agencyWorkerRecord, error: agencyWorkerRecordError } = await supabase
                        .from("worker_onboarding")
                        .select("id, status, queue_joined_at")
                        .eq("id", targetWorkerId)
                        .maybeSingle();

                    if (agencyWorkerRecordError || !agencyWorkerRecord) {
                        throw agencyWorkerRecordError || new Error("Agency worker not found");
                    }

                    const updatePayload: Record<string, unknown> = {
                        entry_fee_paid: true,
                        job_search_active: true,
                        job_search_activated_at: nowIso,
                    };

                    if (!agencyWorkerRecord.queue_joined_at) {
                        updatePayload.queue_joined_at = nowIso;
                    }

                    const nextStatus = resolveWorkerStatusAfterEntryFee(agencyWorkerRecord.status);
                    if (agencyWorkerRecord.status !== nextStatus) {
                        updatePayload.status = nextStatus;
                    }

                    const { error: agencyWorkerUpdateError } = await supabase
                        .from("worker_onboarding")
                        .update(updatePayload)
                        .eq("id", targetWorkerId);
                    if (agencyWorkerUpdateError) {
                        throw agencyWorkerUpdateError;
                    }
                }

                await logServerActivity(activitySubjectId, "payment_completed", "payment", {
                    type: "entry_fee",
                    amount: 9,
                    currency: session.currency?.toUpperCase() || "USD",
                    paid_by_profile_id: paidByProfileId || null,
                    target_worker_id: targetWorkerId,
                });

                // Send payment confirmation email
                if (targetProfileId) {
                    try {
                        const { data: existingPaymentEmail } = await supabase
                            .from("email_queue")
                            .select("id")
                            .eq("user_id", targetProfileId)
                            .eq("email_type", "payment_success")
                            .in("status", ["pending", "sent"])
                            .maybeSingle();

                        if (existingPaymentEmail?.id) {
                            return NextResponse.json({ received: true, message: "Payment already processed" });
                        }

                        const { data: profile } = await supabase
                            .from("profiles")
                            .select("full_name, email")
                            .eq("id", targetProfileId)
                            .single();

                        const { data: workerRecord } = await loadCanonicalWorkerRecord(
                            supabase,
                            targetProfileId,
                            "id, phone, updated_at"
                        );

                        const recipientEmail = profile?.email || session.customer_email || "";
                        if (recipientEmail) {
                            await queueEmail(
                                supabase,
                                targetProfileId,
                                "payment_success",
                                recipientEmail,
                                profile?.full_name || "Worker",
                                { amount: "$9" },
                                undefined,
                                workerRecord?.phone || undefined
                            );
                        } else {
                            await logServerActivity(userId, "payment_success_email_skipped", "payment", {
                                reason: "No recipient email found in session/customer/profile",
                            }, "warning");
                        }
                    } catch (emailErr) {
                        console.error("Failed to send payment confirmation email:", emailErr);
                        // Don't fail the webhook for email errors
                    }
                } else {
                    await logServerActivity(activitySubjectId, "payment_success_email_skipped", "payment", {
                        reason: "Agency-managed worker payment has no linked worker profile for worker-side payment_success template",
                        target_worker_id: targetWorkerId,
                    }, "warning");
                }
            } else if (paymentType === "confirmation_fee" && offerId) {
                if (!targetProfileId) {
                    throw new Error("Confirmation fee requires a linked worker profile");
                }
                await finalizeConfirmationFeeOffer(supabase, targetProfileId, offerId);

                await logServerActivity(activitySubjectId, "payment_completed", "payment", {
                    type: "confirmation_fee",
                    amount: 190,
                    offer_id: offerId,
                    paid_by_profile_id: paidByProfileId || null,
                });
            }

        } catch (err: unknown) {
            const message = getErrorMessage(err);
            console.error(`Database error: ${message}`);
            await logServerActivity(userId, "payment_failed", "payment", { type: paymentType, error: message }, "error");
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}

