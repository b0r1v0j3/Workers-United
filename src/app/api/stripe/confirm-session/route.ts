import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { finalizeConfirmationFeeOffer } from "@/lib/offer-finalization";
import {
    activateEntryFeeWorkerAfterPayment,
    buildStripePaymentCompletedActivityPayload,
    buildStripePaymentFailedActivityPayload,
    getStripePaymentAmounts,
    persistCompletedStripeCheckoutPayment,
    queueEntryFeePaymentSuccessEmail,
} from "@/lib/stripe-payment-finalization";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-04-10",
});

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
}

function getMetadataValue(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const admin = createAdminClient();
    let attemptedPaymentType = "entry_fee";

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { sessionId } = (await request.json()) as { sessionId?: string };
        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const sessionUserId = getMetadataValue(session.metadata?.user_id);
        const paymentType = session.metadata?.payment_type || "entry_fee";
        attemptedPaymentType = paymentType;
        const paymentId = getMetadataValue(session.metadata?.payment_id);
        const offerId = getMetadataValue(session.metadata?.offer_id);
        const targetProfileId = getMetadataValue(session.metadata?.target_profile_id);
        const paidByProfileId = getMetadataValue(session.metadata?.paid_by_profile_id) || sessionUserId;
        const targetWorkerId = getMetadataValue(session.metadata?.target_worker_id);
        const activitySubjectId = targetProfileId || paidByProfileId || sessionUserId;

        if (!sessionUserId || sessionUserId !== user.id) {
            return NextResponse.json({ error: "Session does not belong to current user" }, { status: 403 });
        }

        if (!targetProfileId && !targetWorkerId) {
            return NextResponse.json({ error: "Missing target worker" }, { status: 400 });
        }

        if (session.payment_status !== "paid") {
            return NextResponse.json({
                state: "pending",
                paymentStatus: session.payment_status,
                sessionStatus: session.status,
            });
        }

        const { amount, amountCents: expectedAmountCents } = getStripePaymentAmounts(paymentType);

        if (session.amount_total && session.amount_total !== expectedAmountCents) {
            return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
        }

        await persistCompletedStripeCheckoutPayment({
            admin,
            session,
            paymentId,
            paymentType,
            targetProfileId,
            paidByProfileId,
            targetWorkerId,
            metadataPatch: {
                confirmed_via: "confirm-session-route",
            },
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
                    source: "confirm-session-route",
                    stripeSessionId: session.id,
                    paidByProfileId: paidByProfileId || null,
                    targetWorkerId,
                })
            );

            await queueEntryFeePaymentSuccessEmail({
                admin,
                targetProfileId,
                sessionCustomerEmail: session.customer_email,
            });

            return NextResponse.json({
                state: "paid",
                paymentType,
                message: "Payment verified and worker queue status activated.",
            });
        }

        if (paymentType === "confirmation_fee" && offerId) {
            if (!targetProfileId) {
                return NextResponse.json({ error: "Confirmation fee requires a linked worker profile" }, { status: 400 });
            }
            await finalizeConfirmationFeeOffer(admin, targetProfileId, offerId);
        }

        await logServerActivity(
            activitySubjectId,
            "payment_completed",
            "payment",
            buildStripePaymentCompletedActivityPayload({
                paymentType,
                amount,
                source: "confirm-session-route",
                stripeSessionId: session.id,
                paidByProfileId: paidByProfileId || null,
            })
        );

        return NextResponse.json({ state: "paid", paymentType });
    } catch (error) {
        await logServerActivity(
            user.id,
            "payment_failed",
            "payment",
            buildStripePaymentFailedActivityPayload({
                paymentType: attemptedPaymentType,
                source: "confirm-session-route",
                error: getErrorMessage(error),
            }),
            "error"
        );
        return NextResponse.json({ error: "Failed to confirm payment session" }, { status: 500 });
    }
}
