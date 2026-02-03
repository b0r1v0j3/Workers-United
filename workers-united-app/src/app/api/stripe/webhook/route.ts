import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-04-10" as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") as string;

    let event: Stripe.Event;

    try {
        if (!webhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = await createClient();

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (!userId) {
            console.error("No userId found in session metadata");
            return NextResponse.json({ error: "No userId in metadata" }, { status: 400 });
        }

        try {
            // Insert payment record
            const { error } = await supabase.from("payments").insert({
                user_id: userId,
                amount: 9, // Activation fee is $9
                currency: session.currency?.toUpperCase() || "USD",
                status: "completed",
                stripe_payment_intent_id: session.payment_intent as string,
                stripe_checkout_session_id: session.id,
                payment_type: "find_job_activation",
                paid_at: new Date().toISOString(),
            });

            if (error) {
                // Handle unique constraint violation (idempotency)
                if (error.code === "23505") {
                    console.log(`Payment already processed for session ${session.id}`);
                    return NextResponse.json({ received: true, message: "Duplicate event ignored" });
                }
                throw error;
            }

            console.log(`Successfully processed payment for user ${userId}`);
        } catch (err: any) {
            console.error(`Database error: ${err.message}`);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}

// Next.js config to ensure raw body is available
export const config = {
    api: {
        bodyParser: false,
    },
};
