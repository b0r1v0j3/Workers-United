import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    handleStripeChargeFailedEvent,
    handleStripeCheckoutSessionCompletedEvent,
    handleStripeCheckoutSessionExpiredEvent,
    handleStripePaymentIntentFailedEvent,
    type StripeWebhookHandlerResult,
} from "@/lib/stripe-webhook-handlers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-04-10",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
}

function toJsonResponse(result: StripeWebhookHandlerResult) {
    return NextResponse.json(result.body, result.status ? { status: result.status } : undefined);
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
        return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        if (!webhookSecret) {
            throw new Error("Missing STRIPE_WEBHOOK_SECRET");
        }
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
        console.error(`Webhook signature verification failed: ${getErrorMessage(err)}`);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const admin = createAdminClient();

    switch (event.type) {
        case "payment_intent.payment_failed":
            return toJsonResponse(
                await handleStripePaymentIntentFailedEvent(admin, event.data.object as Stripe.PaymentIntent)
            );
        case "charge.failed":
            return toJsonResponse(
                await handleStripeChargeFailedEvent(admin, event.data.object as Stripe.Charge)
            );
        case "checkout.session.completed":
            return toJsonResponse(
                await handleStripeCheckoutSessionCompletedEvent(admin, event.data.object as Stripe.Checkout.Session)
            );
        case "checkout.session.expired":
            return toJsonResponse(
                await handleStripeCheckoutSessionExpiredEvent(admin, event.data.object as Stripe.Checkout.Session)
            );
        default:
            return NextResponse.json({ received: true });
    }
}
