import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { finalizeConfirmationFeeOffer } from "@/lib/offer-finalization";
import {
    activateEntryFeeWorkerAfterPayment,
    buildStripeCheckoutExpiredActivityPayload,
    buildStripePaymentCompletedActivityPayload,
    buildStripePaymentFailedActivityPayload,
    getStripePaymentAmounts,
    mergeStripePaymentMetadata,
    persistCompletedStripeCheckoutPayment,
    queueEntryFeePaymentSuccessEmail,
    updateStripePaymentRecordByReference,
} from "@/lib/stripe-payment-finalization";

type AdminDbClient = SupabaseClient<Database>;

export interface StripeWebhookHandlerResult {
    body: Record<string, unknown>;
    status?: number;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
}

export function getStripeWebhookMetadataValue(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function handleStripePaymentIntentFailedEvent(
    admin: AdminDbClient,
    paymentIntent: Stripe.PaymentIntent
): Promise<StripeWebhookHandlerResult> {
    const paymentId = getStripeWebhookMetadataValue(paymentIntent.metadata?.payment_id);
    const userId = getStripeWebhookMetadataValue(paymentIntent.metadata?.user_id);
    const targetProfileId = getStripeWebhookMetadataValue(paymentIntent.metadata?.target_profile_id);
    const targetWorkerId = getStripeWebhookMetadataValue(paymentIntent.metadata?.target_worker_id);
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
            admin,
            paymentId,
            patch: {
                metadata: mergeStripePaymentMetadata(paymentIntent.metadata, failureMetadata),
            },
        });
    } catch (error) {
        console.error("Failed to persist payment_intent failure metadata:", error);
    }

    if (activitySubjectId) {
        await logServerActivity(
            activitySubjectId,
            "payment_failed",
            "payment",
            buildStripePaymentFailedActivityPayload({
                paymentType,
                paymentId,
                stripePaymentIntentId: paymentIntent.id,
                targetWorkerId,
                failureCode: failure?.code || null,
                declineCode: failure?.decline_code || null,
                error: failure?.message || "Payment was declined before completion",
            }),
            "warning"
        );
    }

    return { body: { received: true } };
}

export async function handleStripeChargeFailedEvent(
    admin: AdminDbClient,
    charge: Stripe.Charge
): Promise<StripeWebhookHandlerResult> {
    const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id || null;
    const paymentId = getStripeWebhookMetadataValue(charge.metadata?.payment_id);
    const userId = getStripeWebhookMetadataValue(charge.metadata?.user_id);
    const targetProfileId = getStripeWebhookMetadataValue(charge.metadata?.target_profile_id);
    const targetWorkerId = getStripeWebhookMetadataValue(charge.metadata?.target_worker_id);
    const paymentType = charge.metadata?.payment_type || "entry_fee";
    const activitySubjectId = targetProfileId || userId;

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

    try {
        await updateStripePaymentRecordByReference({
            admin,
            paymentId,
            patch: {
                metadata: mergeStripePaymentMetadata(charge.metadata, failureMetadata),
            },
        });
    } catch (error) {
        console.error("Failed to persist charge failure metadata:", error);
    }

    if (activitySubjectId) {
        await logServerActivity(
            activitySubjectId,
            "payment_failed",
            "payment",
            buildStripePaymentFailedActivityPayload({
                paymentType,
                paymentId,
                stripePaymentIntentId: paymentIntentId,
                stripeChargeId: charge.id,
                targetWorkerId,
                failureCode: charge.failure_code || null,
                outcomeReason: charge.outcome?.reason || null,
                networkStatus: charge.outcome?.network_status || null,
                riskLevel: charge.outcome?.risk_level || null,
                error: charge.failure_message || "Charge failed before completion",
            }),
            "warning"
        );
    }

    return { body: { received: true } };
}

export async function handleStripeCheckoutSessionCompletedEvent(
    admin: AdminDbClient,
    session: Stripe.Checkout.Session
): Promise<StripeWebhookHandlerResult> {
    const userId = getStripeWebhookMetadataValue(session.metadata?.user_id);
    const paymentType = session.metadata?.payment_type || "entry_fee";
    const paymentId = getStripeWebhookMetadataValue(session.metadata?.payment_id);
    const offerId = getStripeWebhookMetadataValue(session.metadata?.offer_id);
    const targetProfileId = getStripeWebhookMetadataValue(session.metadata?.target_profile_id);
    const paidByProfileId = getStripeWebhookMetadataValue(session.metadata?.paid_by_profile_id) || userId;
    const targetWorkerId = getStripeWebhookMetadataValue(session.metadata?.target_worker_id);
    const activitySubjectId = targetProfileId || paidByProfileId || userId;

    if (!userId) {
        console.error("No user_id found in session metadata");
        return { body: { error: "No user_id in metadata" }, status: 400 };
    }

    if (!targetProfileId && !targetWorkerId) {
        console.error("No target worker reference found in session metadata");
        return { body: { error: "No target worker in metadata" }, status: 400 };
    }

    try {
        if (session.payment_status !== "paid") {
            console.warn(`[Stripe] Session ${session.id} not paid (status: ${session.payment_status})`);
            return { body: { received: true, message: "Payment not completed" } };
        }

        const { amount, amountCents: expectedAmountCents } = getStripePaymentAmounts(paymentType);

        if (session.amount_total && session.amount_total !== expectedAmountCents) {
            console.error(`[Stripe] Amount mismatch: expected ${expectedAmountCents}, got ${session.amount_total}`);
            return { body: { error: "Amount mismatch" }, status: 400 };
        }

        await persistCompletedStripeCheckoutPayment({
            admin,
            session,
            paymentId,
            paymentType,
            targetProfileId,
            paidByProfileId,
            targetWorkerId,
        });

        if (paymentType === "entry_fee") {
            await activateEntryFeeWorkerAfterPayment({
                admin,
                targetProfileId,
                targetWorkerId,
            });

            await logServerActivity(
                activitySubjectId,
                "payment_completed",
                "payment",
                buildStripePaymentCompletedActivityPayload({
                    paymentType: "entry_fee",
                    amount,
                    currency: session.currency?.toUpperCase() || "USD",
                    paidByProfileId: paidByProfileId || null,
                    targetWorkerId,
                })
            );

            if (!targetProfileId) {
                await logServerActivity(activitySubjectId, "payment_success_email_skipped", "payment", {
                    reason: "Agency-managed worker payment has no linked worker profile for worker-side payment_success template",
                    target_worker_id: targetWorkerId,
                }, "warning");
            } else {
                try {
                    const emailResult = await queueEntryFeePaymentSuccessEmail({
                        admin,
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
                }
            }

            return { body: { received: true } };
        }

        if (paymentType === "confirmation_fee" && offerId) {
            if (!targetProfileId) {
                throw new Error("Confirmation fee requires a linked worker profile");
            }
            await finalizeConfirmationFeeOffer(admin, targetProfileId, offerId);

            await logServerActivity(
                activitySubjectId,
                "payment_completed",
                "payment",
                buildStripePaymentCompletedActivityPayload({
                    paymentType: "confirmation_fee",
                    amount,
                    offerId,
                    paidByProfileId: paidByProfileId || null,
                })
            );
        }
    } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error(`Database error: ${message}`);
        await logServerActivity(
            userId,
            "payment_failed",
            "payment",
            buildStripePaymentFailedActivityPayload({
                paymentType,
                error: message,
            }),
            "error"
        );
        return { body: { error: "Database error" }, status: 500 };
    }

    return { body: { received: true } };
}

export async function handleStripeCheckoutSessionExpiredEvent(
    admin: AdminDbClient,
    session: Stripe.Checkout.Session
): Promise<StripeWebhookHandlerResult> {
    const paymentId = getStripeWebhookMetadataValue(session.metadata?.payment_id);
    const userId = getStripeWebhookMetadataValue(session.metadata?.user_id);
    const targetProfileId = getStripeWebhookMetadataValue(session.metadata?.target_profile_id);
    const targetWorkerId = getStripeWebhookMetadataValue(session.metadata?.target_worker_id);
    const paymentType = session.metadata?.payment_type || "entry_fee";
    const activitySubjectId = targetProfileId || userId;

    try {
        await updateStripePaymentRecordByReference({
            admin,
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
        await logServerActivity(
            activitySubjectId,
            "checkout_session_expired",
            "payment",
            buildStripeCheckoutExpiredActivityPayload({
                paymentType,
                paymentId,
                stripeSessionId: session.id,
                targetWorkerId,
            }),
            "warning"
        );
    }

    return { body: { received: true } };
}
