import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Disable body parsing - Stripe needs raw body
export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = await createClient();

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(supabase, session);
                break;
            }

            case "payment_intent.payment_failed": {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                await handlePaymentFailed(supabase, paymentIntent);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Webhook handler error:", error);
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }
}

async function handleCheckoutCompleted(
    supabase: Awaited<ReturnType<typeof createClient>>,
    session: Stripe.Checkout.Session
) {
    const { payment_id, user_id, payment_type, offer_id } = session.metadata || {};

    if (!payment_id || !user_id || !payment_type) {
        console.error("Missing metadata in checkout session");
        return;
    }

    // Update payment record
    await supabase
        .from("payments")
        .update({
            status: "completed",
            stripe_payment_intent_id: session.payment_intent as string,
            completed_at: new Date().toISOString(),
        })
        .eq("id", payment_id);

    if (payment_type === "entry_fee") {
        await handleEntryFeePayment(supabase, user_id, payment_id);
    } else if (payment_type === "confirmation_fee" && offer_id) {
        await handleConfirmationFeePayment(supabase, user_id, offer_id, payment_id);
    }
}

async function handleEntryFeePayment(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    paymentId: string
) {
    // Get candidate record
    const { data: candidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("profile_id", userId)
        .single();

    if (!candidate) {
        console.error("Candidate not found for entry fee payment");
        return;
    }

    // Call Supabase function to add to queue
    // This assigns queue position and updates status
    const { data: queuePosition, error } = await supabase
        .rpc("add_candidate_to_queue", {
            p_candidate_id: candidate.id,
            p_payment_id: paymentId,
        });

    if (error) {
        console.error("Failed to add candidate to queue:", error);
        // Fallback: manual update
        const { data: maxPos } = await supabase
            .from("candidates")
            .select("queue_position")
            .eq("entry_fee_paid", true)
            .order("queue_position", { ascending: false })
            .limit(1)
            .single();

        const newPosition = (maxPos?.queue_position || 0) + 1;

        await supabase
            .from("candidates")
            .update({
                queue_position: newPosition,
                queue_joined_at: new Date().toISOString(),
                entry_fee_paid: true,
                entry_payment_id: paymentId,
                status: "IN_QUEUE",
            })
            .eq("id", candidate.id);
    }

    console.log(`Candidate ${candidate.id} added to queue at position ${queuePosition}`);
}

async function handleConfirmationFeePayment(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    offerId: string,
    paymentId: string
) {
    // Get offer details
    const { data: offer, error: offerError } = await supabase
        .from("offers")
        .select("*, job_requests(*)")
        .eq("id", offerId)
        .single();

    if (offerError || !offer) {
        console.error("Offer not found:", offerError);
        return;
    }

    // Check offer hasn't expired
    if (new Date(offer.expires_at) < new Date()) {
        console.error("Offer expired, cannot process payment");
        // TODO: Trigger refund
        return;
    }

    // Update offer status
    await supabase
        .from("offers")
        .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            payment_id: paymentId,
        })
        .eq("id", offerId);

    // Update candidate status
    await supabase
        .from("candidates")
        .update({ status: "VISA_PROCESS_STARTED" })
        .eq("id", offer.candidate_id);

    // Increment positions filled on job request
    await supabase
        .from("job_requests")
        .update({
            positions_filled: offer.job_requests.positions_filled + 1,
            status:
                offer.job_requests.positions_filled + 1 >= offer.job_requests.positions_count
                    ? "filled"
                    : "matching",
        })
        .eq("id", offer.job_request_id);

    console.log(`Offer ${offerId} accepted, candidate moved to VISA_PROCESS_STARTED`);
}

async function handlePaymentFailed(
    supabase: Awaited<ReturnType<typeof createClient>>,
    paymentIntent: Stripe.PaymentIntent
) {
    // Find payment by intent ID
    const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("stripe_payment_intent_id", paymentIntent.id)
        .single();

    if (payment) {
        await supabase
            .from("payments")
            .update({ status: "failed" })
            .eq("id", payment.id);
    }

    console.log("Payment failed:", paymentIntent.id);
}
