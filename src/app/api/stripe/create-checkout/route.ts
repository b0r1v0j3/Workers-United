import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICES, getCheckoutSuccessUrl, getCheckoutCancelUrl, PaymentType } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntryFeeEligibility } from "@/lib/payment-eligibility";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";

export async function POST(request: NextRequest) {
    let userIdForLog: string | null = null;

    try {
        const supabase = await createClient();
        const admin = createAdminClient();

        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userIdForLog = user.id;

        const body = await request.json();
        const { type, offerId } = body as { type: PaymentType; offerId?: string };

        if (!type || !["entry_fee", "confirmation_fee"].includes(type)) {
            return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
        }

        await logServerActivity(user.id, "checkout_session_create_attempt", "payment", {
            type,
            offer_id: offerId || null,
        });

        // Get user profile
        let { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (!profile) {
            // Self-heal missing profile records to prevent onboarding dead-ends.
            await admin.from("profiles").upsert({
                id: user.id,
                email: user.email || "",
                full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
                user_type: user.user_metadata?.user_type || "worker",
            });

            const { data: repairedProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            profile = repairedProfile ?? null;
        }

        if (!profile) {
            await logServerActivity(user.id, "checkout_profile_missing", "payment", { type }, "error");
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

        // For entry fee, allow payment for all worker profiles
        if (type === "entry_fee") {
            // Guard against duplicate checkout creation when payment is already completed.
            const { data: existingCompletedPayment } = await supabase
                .from("payments")
                .select("id")
                .eq("payment_type", "entry_fee")
                .in("status", ["completed", "paid"])
                .or(`user_id.eq.${user.id},profile_id.eq.${user.id}`)
                .limit(1)
                .maybeSingle();

            if (existingCompletedPayment) {
                return NextResponse.json({ error: "Entry fee already paid" }, { status: 400 });
            }

            const { data: initialCandidate, error: candidateError } = await supabase
                .from("candidates")
                .select("entry_fee_paid, status, job_search_active, queue_joined_at")
                .eq("profile_id", user.id)
                .maybeSingle();
            let candidate = initialCandidate;

            if (candidateError) {
                console.error("Candidate fetch error:", candidateError);
                return NextResponse.json({ error: "Failed to check worker status" }, { status: 500 });
            }

            if (!candidate) {
                await admin
                    .from("candidates")
                    .upsert(
                        {
                            profile_id: user.id,
                            status: "NEW",
                            entry_fee_paid: false,
                        },
                        { onConflict: "profile_id" }
                    );

                const { data: repairedCandidate, error: repairedCandidateError } = await supabase
                    .from("candidates")
                    .select("entry_fee_paid, status, job_search_active, queue_joined_at")
                    .eq("profile_id", user.id)
                    .maybeSingle();

                if (repairedCandidateError) {
                    console.error("Candidate repair fetch error:", repairedCandidateError);
                    return NextResponse.json({ error: "Failed to initialize worker profile" }, { status: 500 });
                }

                candidate = repairedCandidate;

                await logServerActivity(user.id, "checkout_candidate_auto_created", "payment", {
                    source: "create_checkout",
                });
            }

            const alreadyActivated =
                !!candidate?.entry_fee_paid ||
                !!candidate?.job_search_active ||
                !!candidate?.queue_joined_at ||
                isPostEntryFeeWorkerStatus(candidate?.status);

            if (alreadyActivated) {
                return NextResponse.json({ error: "Entry fee already paid" }, { status: 400 });
            }

            const eligibility = getEntryFeeEligibility(candidate);
            if (!eligibility.allowed) {
                return NextResponse.json(
                    { error: eligibility.error || "Entry fee is not available" },
                    { status: eligibility.status || 400 }
                );
            }
        }

        // Create payment record
        const amount = type === "entry_fee" ? 9 : 190;
        const amountCents = type === "entry_fee" ? 900 : 19000;
        const { data: payment, error: paymentError } = await supabase
            .from("payments")
            .insert({
                user_id: user.id,
                profile_id: user.id,
                amount,
                amount_cents: amountCents,
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
                                ? "Join the active worker queue"
                                : `Confirm your position for: ${offer?.job_requests?.title || "Job Opportunity"}`,
                        },
                        unit_amount: priceConfig.amount,
                    },
                    quantity: 1,
                },
            ],
            success_url: getCheckoutSuccessUrl(type, offerId),
            cancel_url: getCheckoutCancelUrl(type, offerId),
            metadata: {
                payment_id: payment.id,
                user_id: user.id,
                payment_type: type,
                offer_id: offerId || "",
            },
        });

        // Update payment record with session ID
        const { error: sessionIdUpdateError } = await supabase
            .from("payments")
            .update({ stripe_checkout_session_id: session.id })
            .eq("id", payment.id);

        if (sessionIdUpdateError) {
            // Fallback via admin client in case user RLS blocks the update.
            const { error: adminSessionIdUpdateError } = await admin
                .from("payments")
                .update({ stripe_checkout_session_id: session.id })
                .eq("id", payment.id);

            if (adminSessionIdUpdateError) {
                await logServerActivity(user.id, "checkout_session_id_update_failed", "payment", {
                    payment_id: payment.id,
                    stripe_session_id: session.id,
                    user_update_error: sessionIdUpdateError.message,
                    admin_update_error: adminSessionIdUpdateError.message,
                }, "error");
            }
        }

        await logServerActivity(user.id, "checkout_session_created", "payment", {
            type,
            payment_id: payment.id,
            stripe_session_id: session.id,
            amount_cents: amountCents,
        });

        return NextResponse.json({
            checkoutUrl: session.url,
            sessionId: session.id,
        });
    } catch (error: unknown) {
        if (userIdForLog) {
            await logServerActivity(
                userIdForLog,
                "checkout_session_failed",
                "payment",
                { error: error instanceof Error ? error.message : String(error) },
                "error"
            );
        }
        console.error("Checkout error:", error);
        return NextResponse.json(
            { error: "Failed to create checkout session" },
            { status: 500 }
        );
    }
}
