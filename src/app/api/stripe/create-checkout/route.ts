import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICES, getCheckoutSuccessUrl, getCheckoutCancelUrl, PaymentType } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyOwnedWorker } from "@/lib/agencies";
import { getEntryFeeEligibility } from "@/lib/payment-eligibility";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { normalizeUserType } from "@/lib/domain";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import { loadCanonicalWorkerRecord } from "@/lib/workers";

function normalizeRelativePath(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
        return null;
    }

    if (trimmed.includes("://") || trimmed.includes("\r") || trimmed.includes("\n")) {
        return null;
    }

    return trimmed;
}

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
        const {
            type,
            offerId,
            targetWorkerId,
            successPath,
            cancelPath,
        } = body as {
            type: PaymentType;
            offerId?: string;
            targetWorkerId?: string;
            successPath?: string;
            cancelPath?: string;
        };

        if (!type || !["entry_fee", "confirmation_fee"].includes(type)) {
            return NextResponse.json({ error: "Invalid payment type" }, { status: 400 });
        }

        const normalizedSuccessPath = normalizeRelativePath(successPath);
        const normalizedCancelPath = normalizeRelativePath(cancelPath);

        await logServerActivity(user.id, "checkout_session_create_attempt", "payment", {
            type,
            offer_id: offerId || null,
            target_worker_id: targetWorkerId || null,
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

        const requesterRole = normalizeUserType(profile.user_type || user.user_metadata?.user_type);
        let paymentOwnerProfileId = user.id;
        let paymentOwnerEmail = profile.email || user.email || "";
        let paymentOwnerName = profile.full_name || user.user_metadata?.full_name || "Worker";
        let paymentRowClient = supabase;
        let agencyTargetWorkerId: string | null = null;
        let isAgencyPayingForWorker = false;

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
            if (targetWorkerId) {
                if (requesterRole !== "agency") {
                    return NextResponse.json({ error: "Agency access required for target worker payments" }, { status: 403 });
                }

                const { worker } = await getAgencyOwnedWorker(admin, user.id, targetWorkerId);
                if (!worker?.profile_id) {
                    return NextResponse.json({ error: "Claimed worker not found" }, { status: 404 });
                }

                paymentOwnerProfileId = worker.profile_id;
                agencyTargetWorkerId = worker.id;
                isAgencyPayingForWorker = true;
                paymentRowClient = admin;

                const { data: targetProfile, error: targetProfileError } = await admin
                    .from("profiles")
                    .select("email, full_name")
                    .eq("id", paymentOwnerProfileId)
                    .maybeSingle();

                if (targetProfileError) {
                    console.error("Target worker profile fetch error:", targetProfileError);
                    return NextResponse.json({ error: "Failed to load worker payment profile" }, { status: 500 });
                }

                paymentOwnerEmail = targetProfile?.email || paymentOwnerEmail;
                paymentOwnerName = targetProfile?.full_name || paymentOwnerName;
            }

            // Guard against duplicate checkout creation when payment is already completed.
            const { data: existingCompletedPayment } = await admin
                .from("payments")
                .select("id")
                .eq("payment_type", "entry_fee")
                .in("status", ["completed", "paid"])
                .or(`user_id.eq.${paymentOwnerProfileId},profile_id.eq.${paymentOwnerProfileId}`)
                .limit(1)
                .maybeSingle();

            if (existingCompletedPayment) {
                return NextResponse.json({ error: "Entry fee already paid" }, { status: 400 });
            }

            const {
                data: initialWorkerRecord,
                error: workerRecordError,
            } = await loadCanonicalWorkerRecord(
                admin,
                paymentOwnerProfileId,
                "id, entry_fee_paid, status, job_search_active, queue_joined_at, updated_at, phone, nationality, current_country, preferred_job"
            );
            let workerRecord = initialWorkerRecord;

            if (workerRecordError) {
                console.error("Worker record fetch error:", workerRecordError);
                return NextResponse.json({ error: "Failed to check worker status" }, { status: 500 });
            }

            if (!workerRecord) {
                if (isAgencyPayingForWorker) {
                    return NextResponse.json({ error: "Worker profile is not linked yet" }, { status: 400 });
                }

                await admin
                    .from("worker_onboarding")
                    .upsert(
                        {
                            profile_id: paymentOwnerProfileId,
                            status: "NEW",
                            entry_fee_paid: false,
                        },
                        { onConflict: "profile_id" }
                    );

                const {
                    data: repairedWorkerRecord,
                    error: repairedWorkerRecordError,
                } = await loadCanonicalWorkerRecord(
                    admin,
                    paymentOwnerProfileId,
                    "id, entry_fee_paid, status, job_search_active, queue_joined_at, updated_at, phone, nationality, current_country, preferred_job"
                );

                if (repairedWorkerRecordError) {
                    console.error("Worker record repair fetch error:", repairedWorkerRecordError);
                    return NextResponse.json({ error: "Failed to initialize worker profile" }, { status: 500 });
                }

                workerRecord = repairedWorkerRecord;

                await logServerActivity(user.id, "checkout_worker_auto_created", "payment", {
                    source: "create_checkout",
                    target_profile_id: paymentOwnerProfileId,
                });
            }

            const alreadyActivated =
                !!workerRecord?.entry_fee_paid ||
                !!workerRecord?.job_search_active ||
                !!workerRecord?.queue_joined_at ||
                isPostEntryFeeWorkerStatus(workerRecord?.status);

            if (alreadyActivated) {
                return NextResponse.json({ error: "Entry fee already paid" }, { status: 400 });
            }

            const eligibility = getEntryFeeEligibility(workerRecord);
            if (!eligibility.allowed) {
                return NextResponse.json(
                    { error: eligibility.error || "Entry fee is not available" },
                    { status: eligibility.status || 400 }
                );
            }
        }

        // Create payment record
        const checkoutStartedAt = new Date();
        const checkoutStartedAtIso = checkoutStartedAt.toISOString();
        const amount = type === "entry_fee" ? 9 : 190;
        const amountCents = type === "entry_fee" ? 900 : 19000;
        const paymentDeadlineAt =
            type === "entry_fee"
                ? new Date(checkoutStartedAt.getTime() + 72 * 60 * 60 * 1000).toISOString()
                : offer?.expires_at || null;
        const { data: payment, error: paymentError } = await paymentRowClient
            .from("payments")
            .insert({
                user_id: paymentOwnerProfileId,
                profile_id: paymentOwnerProfileId,
                amount,
                amount_cents: amountCents,
                payment_type: type,
                status: "pending",
                deadline_at: paymentDeadlineAt,
                metadata: {
                    checkout_started_at: checkoutStartedAtIso,
                    ...(offer ? { offer_id: offerId } : {}),
                    ...(isAgencyPayingForWorker
                        ? {
                            agency_checkout: true,
                            paid_by_profile_id: user.id,
                            paid_by_role: "agency",
                            target_worker_id: agencyTargetWorkerId,
                        }
                        : {}),
                },
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
                                ? isAgencyPayingForWorker
                                    ? `Workers United - Job Finder for ${paymentOwnerName}`
                                    : "Workers United - Queue Entry Fee"
                                : "Workers United - Position Confirmation",
                            description: type === "entry_fee"
                                ? isAgencyPayingForWorker
                                    ? "Activate job search for an agency-submitted worker"
                                    : "Join the active worker queue"
                                : `Confirm your position for: ${offer?.job_requests?.title || "Job Opportunity"}`,
                        },
                        unit_amount: priceConfig.amount,
                    },
                    quantity: 1,
                },
            ],
            success_url: getCheckoutSuccessUrl(type, offerId, normalizedSuccessPath),
            cancel_url: getCheckoutCancelUrl(type, offerId, normalizedCancelPath),
            metadata: {
                payment_id: payment.id,
                user_id: user.id,
                payment_type: type,
                offer_id: offerId || "",
                target_profile_id: paymentOwnerProfileId,
                target_worker_id: agencyTargetWorkerId || "",
                paid_by_profile_id: isAgencyPayingForWorker ? user.id : "",
                agency_checkout: isAgencyPayingForWorker ? "true" : "",
            },
        });

        // Update payment record with session ID
        const { error: sessionIdUpdateError } = await admin
            .from("payments")
            .update({ stripe_checkout_session_id: session.id })
            .eq("id", payment.id);

        if (sessionIdUpdateError) {
            await logServerActivity(user.id, "checkout_session_id_update_failed", "payment", {
                payment_id: payment.id,
                stripe_session_id: session.id,
                admin_update_error: sessionIdUpdateError.message,
            }, "error");
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
