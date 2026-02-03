import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICES, getCheckoutSuccessUrl, getCheckoutCancelUrl, PaymentType } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { type, offerId } = body as { type: PaymentType; offerId?: string };

        if (!type || !["entry_fee", "confirmation_fee"].includes(type)) {
            return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
        }

        // Get user profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        // For confirmation fee, verify offer exists and is pending
        let offer = null;
        if (type === "confirmation_fee") {
            if (!offerId) {
                return NextResponse.json({ error: "Offer ID required for confirmation fee" }, { status: 400 });
            }

            const { data: offerData, error: offerError } = await supabase
                .from("offers")
                .select("*, job_requests(*)")
                .eq("id", offerId)
                .single();

            if (offerError || !offerData) {
                return NextResponse.json({ error: "Offer not found" }, { status: 404 });
            }

            if (offerData.status !== "pending") {
                return NextResponse.json({ error: "Offer is no longer available" }, { status: 400 });
            }

            // Check if offer expired
            if (new Date(offerData.expires_at) < new Date()) {
                return NextResponse.json({ error: "Offer has expired" }, { status: 400 });
            }

            offer = offerData;
        }

        // For entry fee, check if already paid
        if (type === "entry_fee") {
            const { data: candidate } = await supabase
                .from("candidates")
                .select("entry_fee_paid")
                .eq("profile_id", user.id)
                .single();

            if (candidate?.entry_fee_paid) {
                return NextResponse.json({ error: "Entry fee already paid" }, { status: 400 });
            }
        }

        // Create payment record
        const { data: payment, error: paymentError } = await supabase
            .from("payments")
            .insert({
                user_id: user.id,
                amount: type === "entry_fee" ? 9.00 : 190.00,
                payment_type: type,
                status: "pending",
                metadata: offer ? { offer_id: offerId } : {},
            })
            .select()
            .single();

        if (paymentError) {
            console.error("Payment record error:", paymentError);
            return NextResponse.json({ error: "Failed to create payment record" }, { status: 500 });
        }

        // Create Stripe checkout session
        const priceConfig = type === "entry_fee" ? PRICES.ENTRY_FEE : PRICES.CONFIRMATION_FEE;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: user.email,
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: type === "entry_fee"
                                ? "Workers United - Queue Entry Fee"
                                : "Workers United - Position Confirmation",
                            description: type === "entry_fee"
                                ? "Join the active candidate queue"
                                : `Confirm your position for: ${offer?.job_requests?.title || "Job Opportunity"}`,
                        },
                        unit_amount: priceConfig.amount,
                    },
                    quantity: 1,
                },
            ],
            success_url: getCheckoutSuccessUrl(type),
            cancel_url: getCheckoutCancelUrl(type),
            metadata: {
                payment_id: payment.id,
                user_id: user.id,
                payment_type: type,
                offer_id: offerId || "",
            },
        });

        // Update payment record with session ID
        await supabase
            .from("payments")
            .update({ stripe_checkout_session_id: session.id })
            .eq("id", payment.id);

        return NextResponse.json({
            checkoutUrl: session.url,
            sessionId: session.id,
        });
    } catch (error) {
        console.error("Checkout error:", error);
        return NextResponse.json(
            { error: "Failed to create checkout session" },
            { status: 500 }
        );
    }
}
