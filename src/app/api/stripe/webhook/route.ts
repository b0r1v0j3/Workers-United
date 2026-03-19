import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { finalizeConfirmationFeeOffer } from "@/lib/offer-finalization";
import {
    activateEntryFeeWorkerAfterPayment,
    getStripePaymentAmounts,
    mergeStripePaymentMetadata,
    persistCompletedStripeCheckoutPayment,
    queueEntryFeePaymentSuccessEmail,
    updateStripePaymentRecordByReference,
} from "@/lib/stripe-payment-finalization";

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

    if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentId = getMetadataValue(paymentIntent.metadata?.payment_id);
        const userId = getMetadataValue(paymentIntent.metadata?.user_id);
        const targetProfileId = getMetadataValue(paymentIntent.metadata?.target_profile_id);
        const targetWorkerId = getMetadataValue(paymentIntent.metadata?.target_worker_id);
        const paymentType = paymentIntent.metadata?.payment_type || "entry_fee";
        const activitySubjectId = targetProfileId || userId;
        const failure = paymentIntent.last_payment_error;

        const failureMetadata = {
            stripe_payment_intent_id: paymentIntent.id,
            stripe_failure_event: "payment_intent.payment_failed",
            stripe_failure_code: failure?.code || null,
            stripe_decline_code: failure?.decline_code || null,
            stripe_failure_message: failure?.message || null,
            stripe_failure_type: failure?.type || null,
            stripe_failure_payment_method: typeof failure?.payment_method?.id === "string" ? failure.payment_method.id : null,
            stripe_failure_at: new Date().toISOString(),
            stripe_billing_country: null,
            stripe_card_country: null,
        };

        try {
            await updateStripePaymentRecordByReference({
                admin: supabase,
                paymentId,
                patch: {
                    metadata: mergeStripePaymentMetadata(paymentIntent.metadata, failureMetadata),
                },
            });
        } catch (error) {
            console.error("Failed to persist payment_intent failure metadata:", error);
        }

        if (activitySubjectId) {
            await logServerActivity(activitySubjectId, "payment_failed", "payment", {
                type: paymentType,
                payment_id: paymentId,
                stripe_payment_intent_id: paymentIntent.id,
                target_worker_id: targetWorkerId,
                failure_code: failure?.code || null,
                decline_code: failure?.decline_code || null,
                error: failure?.message || "Payment was declined before completion",
            }, "warning");
        }

        return NextResponse.json({ received: true });
    }

    if (event.type === "charge.failed") {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id || null;
        const failureMetadata = {
            stripe_payment_intent_id: paymentIntentId,
            stripe_failure_event: "charge.failed",
            stripe_charge_id: charge.id,
            stripe_failure_code: charge.failure_code || null,
            stripe_failure_message: charge.failure_message || null,
            stripe_outcome_type: charge.outcome?.type || null,
            stripe_outcome_reason: charge.outcome?.reason || null,
            stripe_network_status: charge.outcome?.network_status || null,
            stripe_risk_level: charge.outcome?.risk_level || null,
            stripe_failure_at: new Date().toISOString(),
            stripe_billing_country: charge.billing_details.address?.country || null,
            stripe_billing_postal_code: charge.billing_details.address?.postal_code || null,
            stripe_card_country: charge.payment_method_details?.card?.country || null,
        };

        const paymentId = getMetadataValue(charge.metadata?.payment_id);
        const userId = getMetadataValue(charge.metadata?.user_id);
        const targetProfileId = getMetadataValue(charge.metadata?.target_profile_id);
        const targetWorkerId = getMetadataValue(charge.metadata?.target_worker_id);
        const paymentType = charge.metadata?.payment_type || "entry_fee";
        const activitySubjectId = targetProfileId || userId;

        try {
            await updateStripePaymentRecordByReference({
                admin: supabase,
                paymentId,
                patch: {
                    metadata: mergeStripePaymentMetadata(charge.metadata, failureMetadata),
                },
            });
        } catch (error) {
            console.error("Failed to persist charge failure metadata:", error);
        }

        if (activitySubjectId) {
            await logServerActivity(activitySubjectId, "payment_failed", "payment", {
                type: paymentType,
                payment_id: paymentId,
                stripe_payment_intent_id: paymentIntentId,
                stripe_charge_id: charge.id,
                target_worker_id: targetWorkerId,
                failure_code: charge.failure_code || null,
                outcome_reason: charge.outcome?.reason || null,
                network_status: charge.outcome?.network_status || null,
                risk_level: charge.outcome?.risk_level || null,
                error: charge.failure_message || "Charge failed before completion",
            }, "warning");
        }

        return NextResponse.json({ received: true });
    }

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

            const { amount, amountCents: expectedAmountCents } = getStripePaymentAmounts(paymentType);

            if (session.amount_total && session.amount_total !== expectedAmountCents) {
                console.error(`[Stripe] Amount mismatch: expected ${expectedAmountCents}, got ${session.amount_total}`);
                return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
            }

            await persistCompletedStripeCheckoutPayment({
                admin: supabase,
                session,
                paymentId,
                paymentType,
                targetProfileId,
                paidByProfileId,
                targetWorkerId,
            });

            // Handle post-payment actions based on type
            if (paymentType === "entry_fee") {
                await activateEntryFeeWorkerAfterPayment({
                    admin: supabase,
                    targetProfileId,
                    targetWorkerId,
                });

                await logServerActivity(activitySubjectId, "payment_completed", "payment", {
                    type: "entry_fee",
                    amount: 9,
                    currency: session.currency?.toUpperCase() || "USD",
                    paid_by_profile_id: paidByProfileId || null,
                    target_worker_id: targetWorkerId,
                });

                // Send payment confirmation email
                if (!targetProfileId) {
                    await logServerActivity(activitySubjectId, "payment_success_email_skipped", "payment", {
                        reason: "Agency-managed worker payment has no linked worker profile for worker-side payment_success template",
                        target_worker_id: targetWorkerId,
                    }, "warning");
                } else {
                    try {
                        const emailResult = await queueEntryFeePaymentSuccessEmail({
                            admin: supabase,
                            targetProfileId,
                            sessionCustomerEmail: session.customer_email,
                        });

                        if (emailResult.status === "missing_recipient") {
                            await logServerActivity(userId, "payment_success_email_skipped", "payment", {
                                reason: "No recipient email found in session/customer/profile",
                            }, "warning");
                        }
                    } catch (emailErr) {
                        console.error("Failed to send payment confirmation email:", emailErr);
                        // Don't fail the webhook for email errors
                    }
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

    if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = getMetadataValue(session.metadata?.payment_id);
        const userId = getMetadataValue(session.metadata?.user_id);
        const targetProfileId = getMetadataValue(session.metadata?.target_profile_id);
        const targetWorkerId = getMetadataValue(session.metadata?.target_worker_id);
        const paymentType = session.metadata?.payment_type || "entry_fee";
        const activitySubjectId = targetProfileId || userId;

        try {
            await updateStripePaymentRecordByReference({
                admin: supabase,
                paymentId,
                stripeSessionId: session.id,
                pendingOnly: true,
                patch: {
                    metadata: mergeStripePaymentMetadata(session.metadata, {
                        stripe_session_status: session.status,
                        stripe_payment_status: session.payment_status,
                        stripe_session_expired_at: new Date().toISOString(),
                    }),
                },
            });
        } catch (error) {
            console.error("Failed to persist checkout.session.expired metadata:", error);
        }

        if (activitySubjectId) {
            await logServerActivity(activitySubjectId, "checkout_session_expired", "payment", {
                type: paymentType,
                payment_id: paymentId,
                stripe_session_id: session.id,
                target_worker_id: targetWorkerId,
            }, "warning");
        }

        return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
}

