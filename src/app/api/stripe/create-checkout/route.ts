import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICES, getCheckoutSuccessUrl, getCheckoutCancelUrl, PaymentType } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyOwnedWorker, getAgencyWorkerName } from "@/lib/agencies";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { getEntryFeeEligibility } from "@/lib/payment-eligibility";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import { getAdminTestWorkerWorkspace, markAdminTestAgencyWorkerEntryFeePaid, markAdminTestWorkerEntryFeePaid } from "@/lib/admin-test-data";
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

function appendPaymentState(path: string, payment: string): string {
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}payment=${payment}`;
}

function sortByNewestDeadlineFirst<T extends { deadline_at?: string | null }>(payments: T[]) {
    return [...payments].sort((left, right) => {
        const leftTime = left.deadline_at ? new Date(left.deadline_at).getTime() : 0;
        const rightTime = right.deadline_at ? new Date(right.deadline_at).getTime() : 0;
        return rightTime - leftTime;
    });
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
        const adminTestSession = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (adminTestSession.activePersona) {
            if (type !== "entry_fee") {
                return NextResponse.json({ error: "Sandbox checkout only supports the $9 entry fee flow." }, { status: 400 });
            }

            if (adminTestSession.activePersona.role === "worker") {
                const workspace = await getAdminTestWorkerWorkspace(admin, adminTestSession.activePersona.id);
                const sandboxWorker = workspace.worker;
                const sandboxProfile = {
                    full_name: sandboxWorker?.full_name || adminTestSession.activePersona.label,
                    email: sandboxWorker?.email || user.email || "",
                };
                const { completion: sandboxProfileCompletion } = getWorkerCompletion({
                    profile: sandboxProfile,
                    worker: sandboxWorker,
                    documents: workspace.documents,
                });
                const sandboxEligibility = getEntryFeeEligibility({
                    entry_fee_paid:
                        !!sandboxWorker?.entry_fee_paid ||
                        !!sandboxWorker?.job_search_active ||
                        isPostEntryFeeWorkerStatus(sandboxWorker?.status),
                    profile_completion: sandboxProfileCompletion,
                });

                if (!sandboxEligibility.allowed) {
                    return NextResponse.json(
                        { error: sandboxEligibility.error || "Entry fee is not available" },
                        { status: sandboxEligibility.status || 400 }
                    );
                }

                await markAdminTestWorkerEntryFeePaid(admin, adminTestSession.activePersona.id);
                const targetPath = normalizedSuccessPath || "/profile/worker/queue";
                return NextResponse.json({
                    checkoutUrl: appendPaymentState(targetPath, "sandbox_success"),
                    sandbox: true,
                });
            }

            if (adminTestSession.activePersona.role === "agency") {
                if (!targetWorkerId) {
                    return NextResponse.json({ error: "Sandbox agency payments require a worker target." }, { status: 400 });
                }

                await markAdminTestAgencyWorkerEntryFeePaid(admin, adminTestSession.activePersona.id, targetWorkerId);
                const targetPath = normalizedSuccessPath || "/profile/agency";
                return NextResponse.json({
                    checkoutUrl: appendPaymentState(targetPath, "sandbox_success"),
                    sandbox: true,
                });
            }

            return NextResponse.json({ error: "Employer sandbox does not have a payment flow." }, { status: 400 });
        }

        await logServerActivity(user.id, "checkout_session_create_attempt", "payment", {
            type,
            offer_id: offerId || null,
            target_worker_id: targetWorkerId || null,
        });

        // Get user profile
        const { data: initialProfile, error: initialProfileError } = await admin
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
        let profile = initialProfile ?? null;

        if (!profile) {
            // Self-heal missing profile records to prevent onboarding dead-ends.
            await admin.from("profiles").upsert({
                id: user.id,
                email: user.email || "",
                full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
                user_type: user.user_metadata?.user_type || "worker",
            });

            const { data: repairedProfile, error: repairedProfileError } = await admin
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            profile = repairedProfile ?? null;

            if (repairedProfileError) {
                console.error("Checkout profile repair fetch error:", repairedProfileError);
            }
        }

        if (!profile) {
            await logServerActivity(
                user.id,
                "checkout_profile_missing",
                "payment",
                {
                    type,
                    initial_profile_error: initialProfileError?.message || null,
                },
                "error"
            );
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        const requesterRole = normalizeUserType(profile.user_type || user.user_metadata?.user_type);
        let paymentOwnerProfileId: string | null = user.id;
        let paymentOwnerEmail = profile.email || user.email || "";
        let paymentOwnerName = profile.full_name || user.user_metadata?.full_name || "Worker";
        let paymentRowClient = admin;
        let agencyTargetWorkerId: string | null = null;
        let isAgencyPayingForWorker = false;
        let agencyWorkerRecordForCheckout: {
            id: string;
            entry_fee_paid: boolean | null;
            admin_approved: boolean | null;
            status: string | null;
            job_search_active: boolean | null;
            queue_joined_at: string | null;
            updated_at: string | null;
            phone: string | null;
            nationality: string | null;
            current_country: string | null;
            preferred_job: string | null;
            submitted_full_name: string | null;
            submitted_email: string | null;
        } | null = null;

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

        // Worker record for pre-filling Stripe checkout (populated in entry_fee block)
        let workerRecord: any = null;

        // For entry fee, allow payment for all worker profiles
        if (type === "entry_fee") {
            if (targetWorkerId) {
                if (requesterRole !== "agency") {
                    return NextResponse.json({ error: "Agency access required for target worker payments" }, { status: 403 });
                }

                const { worker } = await getAgencyOwnedWorker(admin, user.id, targetWorkerId);
                if (!worker?.id) {
                    return NextResponse.json({ error: "Agency worker not found" }, { status: 404 });
                }

                agencyTargetWorkerId = worker.id;
                isAgencyPayingForWorker = true;
                paymentRowClient = admin;
                paymentOwnerProfileId = worker.profile_id || null;

                paymentOwnerName = getAgencyWorkerName({
                    submitted_full_name: worker.submitted_full_name,
                });
                paymentOwnerEmail = worker.submitted_email || paymentOwnerEmail;

                if (paymentOwnerProfileId) {
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

                const { data: agencyWorkerRecord, error: agencyWorkerRecordError } = await admin
                    .from("worker_onboarding")
                    .select("id, entry_fee_paid, admin_approved, status, job_search_active, queue_joined_at, updated_at, phone, nationality, current_country, preferred_job, submitted_full_name, submitted_email")
                    .eq("id", worker.id)
                    .maybeSingle();

                if (agencyWorkerRecordError || !agencyWorkerRecord) {
                    console.error("Agency worker checkout fetch error:", agencyWorkerRecordError);
                    return NextResponse.json({ error: "Failed to load agency worker state" }, { status: 500 });
                }

                agencyWorkerRecordForCheckout = agencyWorkerRecord;
            }

            // Guard against duplicate checkout creation when payment is already completed.
            if (paymentOwnerProfileId) {
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
            } else if (agencyTargetWorkerId) {
                const { data: existingAgencyWorkerPayments, error: existingAgencyWorkerPaymentError } = await admin
                    .from("payments")
                    .select("id, status, deadline_at, stripe_checkout_session_id, metadata")
                    .eq("payment_type", "entry_fee")
                    .contains("metadata", { target_worker_id: agencyTargetWorkerId })
                    .in("status", ["pending", "completed", "paid"])
                    .limit(10);

                if (existingAgencyWorkerPaymentError) {
                    console.error("Agency worker payment lookup error:", existingAgencyWorkerPaymentError);
                    return NextResponse.json({ error: "Failed to check existing worker payments" }, { status: 500 });
                }

                const existingAgencyWorkerPayment = sortByNewestDeadlineFirst(existingAgencyWorkerPayments || [])[0];

                if (existingAgencyWorkerPayment?.status === "completed" || existingAgencyWorkerPayment?.status === "paid") {
                    return NextResponse.json({ error: "Entry fee already paid" }, { status: 400 });
                }

                if (existingAgencyWorkerPayment?.status === "pending" && existingAgencyWorkerPayment.stripe_checkout_session_id) {
                    try {
                        const existingSession = await stripe.checkout.sessions.retrieve(existingAgencyWorkerPayment.stripe_checkout_session_id);
                        if (existingSession.payment_status === "paid") {
                            return NextResponse.json({ error: "Entry fee already paid" }, { status: 400 });
                        }

                        if (existingSession.status === "open" && existingSession.url) {
                            await logServerActivity(user.id, "checkout_session_reused", "payment", {
                                type,
                                payment_id: existingAgencyWorkerPayment.id,
                                target_worker_id: agencyTargetWorkerId,
                                stripe_session_id: existingSession.id,
                            });

                            return NextResponse.json({
                                checkoutUrl: existingSession.url,
                                sessionId: existingSession.id,
                                reused: true,
                            });
                        }
                    } catch (sessionLookupError) {
                        await logServerActivity(user.id, "checkout_session_reuse_failed", "payment", {
                            type,
                            payment_id: existingAgencyWorkerPayment.id,
                            target_worker_id: agencyTargetWorkerId,
                            stripe_session_id: existingAgencyWorkerPayment.stripe_checkout_session_id,
                            error: sessionLookupError instanceof Error ? sessionLookupError.message : String(sessionLookupError),
                        }, "warning");
                    }
                }
            }

            const {
                data: initialWorkerRecord,
                error: workerRecordError,
            } = paymentOwnerProfileId
                ? await loadCanonicalWorkerRecord(
                    admin,
                    paymentOwnerProfileId,
                    "id, entry_fee_paid, admin_approved, status, job_search_active, queue_joined_at, updated_at, phone, nationality, current_country, preferred_job, address"
                )
                : { data: null, error: null };
            workerRecord = paymentOwnerProfileId ? initialWorkerRecord : agencyWorkerRecordForCheckout;

            if (paymentOwnerProfileId && workerRecordError) {
                console.error("Worker record fetch error:", workerRecordError);
                return NextResponse.json({ error: "Failed to check worker status" }, { status: 500 });
            }

            if (!workerRecord) {
                if (isAgencyPayingForWorker) {
                    return NextResponse.json({ error: "Agency worker record is missing" }, { status: 400 });
                }
                if (!paymentOwnerProfileId) {
                    return NextResponse.json({ error: "Target worker profile is missing" }, { status: 400 });
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
                    "id, entry_fee_paid, admin_approved, status, job_search_active, queue_joined_at, updated_at, phone, nationality, current_country, preferred_job, address"
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

            let workerProfileCompletion: number | null = null;
            const paymentDocumentOwnerId = isAgencyPayingForWorker
                ? paymentOwnerProfileId || agencyTargetWorkerId
                : paymentOwnerProfileId;
            if (paymentDocumentOwnerId) {
                const { data: paymentDocuments, error: paymentDocumentsError } = await admin
                    .from("worker_documents")
                    .select("document_type, status")
                    .eq("user_id", paymentDocumentOwnerId);

                if (paymentDocumentsError) {
                    console.error("Worker payment documents fetch error:", paymentDocumentsError);
                    return NextResponse.json({ error: "Failed to check worker payment readiness" }, { status: 500 });
                }

                workerProfileCompletion = getWorkerCompletion({
                    profile: isAgencyPayingForWorker
                        ? { full_name: paymentOwnerName }
                        : profile,
                    worker: workerRecord,
                    documents: paymentDocuments || [],
                }, { phoneOptional: isAgencyPayingForWorker }).completion;
            }

            const eligibility = getEntryFeeEligibility({
                entry_fee_paid: workerRecord?.entry_fee_paid,
                profile_completion: workerProfileCompletion,
                admin_approved: isAgencyPayingForWorker || paymentOwnerProfileId
                    ? !!workerRecord?.admin_approved
                    : undefined,
            });
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
                            target_worker_name: paymentOwnerName,
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

        // Build Stripe Checkout session with pre-filled worker data for better Radar scoring
        const workerPhone = (workerRecord as any)?.phone || "";
        const workerCountry = (workerRecord as any)?.current_country || (workerRecord as any)?.nationality || "";
        const workerAddress = (workerRecord as any)?.address || "";

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: paymentOwnerEmail || user.email,
            phone_number_collection: { enabled: true },
            billing_address_collection: "required",
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: type === "entry_fee"
                                ? isAgencyPayingForWorker
                                    ? `Job Finder Service for ${paymentOwnerName}`
                                    : "Job Finder Service — Workers United"
                                : "Position Confirmation — Workers United",
                            description: type === "entry_fee"
                                ? "Personalized European job matching with visa guidance, interview prep, and 90-day money-back guarantee."
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
                target_profile_id: paymentOwnerProfileId || "",
                target_worker_id: agencyTargetWorkerId || "",
                paid_by_profile_id: isAgencyPayingForWorker ? user.id : "",
                agency_checkout: isAgencyPayingForWorker ? "true" : "",
                worker_name: paymentOwnerName,
                worker_country: workerCountry,
            },
            payment_intent_data: {
                description: `Job Finder Service for ${paymentOwnerName}`,
                metadata: {
                    worker_name: paymentOwnerName,
                    worker_email: paymentOwnerEmail,
                    worker_phone: workerPhone,
                    worker_country: workerCountry,
                },
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
