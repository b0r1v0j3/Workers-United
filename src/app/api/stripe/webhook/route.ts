import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerActivity } from "@/lib/activityLoggerServer";

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

    const supabase = createAdminClient();

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const paymentType = session.metadata?.payment_type || "entry_fee";
        const paymentId = session.metadata?.payment_id;
        const offerId = session.metadata?.offer_id;

        if (!userId) {
            console.error("No user_id found in session metadata");
            return NextResponse.json({ error: "No user_id in metadata" }, { status: 400 });
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

            if (paymentId) {
                // Update existing payment record (created during checkout)
                const { error } = await supabase
                    .from("payments")
                    .update({
                        status: "completed",
                        stripe_payment_intent_id: session.payment_intent as string,
                        paid_at: new Date().toISOString(),
                    })
                    .eq("id", paymentId);

                if (error) {
                    console.error("Failed to update payment record:", error);
                    throw error;
                }
            } else {
                // Fallback: insert payment record if it doesn't exist
                const { error } = await supabase.from("payments").insert({
                    user_id: userId,
                    amount,
                    currency: session.currency?.toUpperCase() || "USD",
                    status: "completed",
                    stripe_payment_intent_id: session.payment_intent as string,
                    stripe_checkout_session_id: session.id,
                    payment_type: paymentType,
                    paid_at: new Date().toISOString(),
                });

                if (error) {
                    // Handle unique constraint violation (idempotency)
                    if (error.code === "23505") {
                        return NextResponse.json({ received: true, message: "Duplicate event ignored" });
                    }
                    throw error;
                }
            }

            // Handle post-payment actions based on type
            if (paymentType === "entry_fee") {
                // Mark candidate as having paid entry fee and activate queue
                // Idempotency: double guard prevents race conditions from concurrent webhooks
                // - .eq("entry_fee_paid", false) prevents double payment processing
                // - .eq("status", "VERIFIED") ensures only VERIFIED → IN_QUEUE transition
                await supabase
                    .from("candidates")
                    .update({
                        entry_fee_paid: true,
                        status: "IN_QUEUE",
                        queue_joined_at: new Date().toISOString(),
                        job_search_active: true,
                        job_search_activated_at: new Date().toISOString(),
                    })
                    .eq("profile_id", userId)
                    .eq("entry_fee_paid", false)
                    .eq("status", "VERIFIED");

                await logServerActivity(userId, "payment_completed", "payment", { type: "entry_fee", amount: 9, currency: session.currency?.toUpperCase() || "USD" });

                // Send payment confirmation email
                try {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("full_name")
                        .eq("id", userId)
                        .single();

                    const { data: candidate } = await supabase
                        .from("candidates")
                        .select("phone")
                        .eq("profile_id", userId)
                        .single();

                    const { queueEmail } = await import("@/lib/email-templates");
                    await queueEmail(
                        supabase,
                        userId,
                        "payment_success",
                        session.customer_email || "",
                        profile?.full_name || "Worker",
                        { amount: "$9" },
                        undefined,
                        candidate?.phone || undefined
                    );
                } catch (emailErr) {
                    console.error("Failed to send payment confirmation email:", emailErr);
                    // Don't fail the webhook for email errors
                }
            } else if (paymentType === "confirmation_fee" && offerId) {
                // Accept the offer
                await supabase
                    .from("offers")
                    .update({ status: "accepted", accepted_at: new Date().toISOString() })
                    .eq("id", offerId);

                // Update candidate status
                await supabase
                    .from("candidates")
                    .update({ status: "OFFER_ACCEPTED" })
                    .eq("profile_id", userId);

                await logServerActivity(userId, "payment_completed", "payment", { type: "confirmation_fee", amount: 190, offer_id: offerId });
            }

        } catch (err: any) {
            console.error(`Database error: ${err.message}`);
            await logServerActivity(userId, "payment_failed", "payment", { type: paymentType, error: err.message }, "error");
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}

