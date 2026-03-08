import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email-templates";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { resolveWorkerStatusAfterEntryFee } from "@/lib/worker-status";
import { finalizeConfirmationFeeOffer } from "@/lib/offer-finalization";
import { loadCanonicalWorkerRecord } from "@/lib/workers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2024-04-10",
});

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
}

function assertNoDbError(error: { message: string } | null, context: string): void {
    if (error) {
        throw new Error(`${context}: ${error.message}`);
    }
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const admin = createAdminClient();

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
        const sessionUserId = session.metadata?.user_id;
        const paymentType = session.metadata?.payment_type || "entry_fee";
        const paymentId = session.metadata?.payment_id;
        const offerId = session.metadata?.offer_id;
        const targetProfileId = session.metadata?.target_profile_id || sessionUserId;
        const paidByProfileId = session.metadata?.paid_by_profile_id || sessionUserId;
        const targetWorkerId = session.metadata?.target_worker_id || null;

        if (!sessionUserId || sessionUserId !== user.id) {
            return NextResponse.json({ error: "Session does not belong to current user" }, { status: 403 });
        }

        if (!targetProfileId) {
            return NextResponse.json({ error: "Missing target profile" }, { status: 400 });
        }

        if (session.payment_status !== "paid") {
            return NextResponse.json({
                state: "pending",
                paymentStatus: session.payment_status,
                sessionStatus: session.status,
            });
        }

        const expectedAmountCents = paymentType === "confirmation_fee" ? 19000 : 900;
        const amount = paymentType === "confirmation_fee" ? 190 : 9;

        if (session.amount_total && session.amount_total !== expectedAmountCents) {
            return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
        }

        const paymentMetadata = {
            ...(session.metadata || {}),
            stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
            stripe_currency: session.currency?.toUpperCase() || "USD",
            stripe_session_status: session.status,
            stripe_payment_status: session.payment_status,
            confirmed_via: "confirm-session-route",
        };

        const paymentPayload = {
            user_id: targetProfileId,
            profile_id: targetProfileId,
            payment_type: paymentType,
            amount,
            amount_cents: expectedAmountCents,
            status: "completed",
            stripe_checkout_session_id: session.id,
            paid_at: new Date().toISOString(),
            metadata: {
                ...paymentMetadata,
                paid_by_profile_id: paidByProfileId || null,
                target_worker_id: targetWorkerId || null,
            },
        };

        if (paymentId) {
            const { error: paymentUpdateError } = await admin
                .from("payments")
                .update(paymentPayload)
                .eq("id", paymentId);
            assertNoDbError(paymentUpdateError, "Failed to update payment by payment_id");
        } else {
            const { data: existingBySession } = await admin
                .from("payments")
                .select("id")
                .eq("stripe_checkout_session_id", session.id)
                .maybeSingle();

            if (existingBySession?.id) {
                const { error: paymentUpdateBySessionError } = await admin
                    .from("payments")
                    .update(paymentPayload)
                    .eq("id", existingBySession.id);
                assertNoDbError(paymentUpdateBySessionError, "Failed to update payment by session");
            } else {
                const { error: paymentInsertError } = await admin
                    .from("payments")
                    .insert(paymentPayload);
                assertNoDbError(paymentInsertError, "Failed to insert payment row");
            }
        }

        if (paymentType === "entry_fee") {
            const nowIso = new Date().toISOString();
            const { data: existingWorkerRecord, error: existingWorkerRecordError } = await loadCanonicalWorkerRecord(
                admin,
                targetProfileId,
                "id, status, queue_joined_at, phone, updated_at, entry_fee_paid, job_search_active, nationality, current_country, preferred_job"
            );
            assertNoDbError(existingWorkerRecordError, "Failed to load worker record after payment");

            if (!existingWorkerRecord) {
                const { error: workerRecordUpsertError } = await admin
                    .from("worker_onboarding")
                    .upsert(
                        {
                            profile_id: targetProfileId,
                            entry_fee_paid: true,
                            status: "IN_QUEUE",
                            queue_joined_at: nowIso,
                            job_search_active: true,
                            job_search_activated_at: nowIso,
                        },
                        { onConflict: "profile_id" }
                    );
                assertNoDbError(workerRecordUpsertError, "Failed to create missing worker record");
            } else {
                const updatePayload: Record<string, unknown> = {
                    entry_fee_paid: true,
                    job_search_active: true,
                    job_search_activated_at: nowIso,
                };

                if (!existingWorkerRecord.queue_joined_at) {
                    updatePayload.queue_joined_at = nowIso;
                }

                const nextStatus = resolveWorkerStatusAfterEntryFee(existingWorkerRecord.status);
                if (existingWorkerRecord.status !== nextStatus) {
                    updatePayload.status = nextStatus;
                }

                const { error: workerRecordUpdateError } = await admin
                    .from("worker_onboarding")
                    .update(updatePayload)
                    .eq("profile_id", targetProfileId);
                assertNoDbError(workerRecordUpdateError, "Failed to update worker record after payment");
            }

            await logServerActivity(targetProfileId, "payment_completed", "payment", {
                type: "entry_fee",
                amount: 9,
                source: "confirm-session-route",
                stripe_session_id: session.id,
                paid_by_profile_id: paidByProfileId || null,
                target_worker_id: targetWorkerId,
            });

            // Send email fallback if webhook didn't send one yet
            const { data: existingPaymentEmail } = await admin
                .from("email_queue")
                .select("id")
                .eq("user_id", targetProfileId)
                .eq("email_type", "payment_success")
                .in("status", ["pending", "sent"])
                .maybeSingle();

            if (!existingPaymentEmail?.id) {
                const [{ data: profile }, { data: workerRecord }] = await Promise.all([
                    admin.from("profiles").select("full_name, email").eq("id", targetProfileId).maybeSingle(),
                    loadCanonicalWorkerRecord(admin, targetProfileId, "id, phone, updated_at").then((result) => ({
                        data: result.data,
                    })),
                ]);

                const recipientEmail = profile?.email || session.customer_email || "";
                if (recipientEmail) {
                    await queueEmail(
                        admin,
                        targetProfileId,
                        "payment_success",
                        recipientEmail,
                        profile?.full_name || "Worker",
                        { amount: "$9" },
                        undefined,
                        workerRecord?.phone || undefined
                    );
                }
            }

            return NextResponse.json({
                state: "paid",
                paymentType,
                message: "Payment verified and worker queue status activated.",
            });
        }

        if (paymentType === "confirmation_fee" && offerId) {
            await finalizeConfirmationFeeOffer(admin, targetProfileId, offerId);
        }

        await logServerActivity(targetProfileId, "payment_completed", "payment", {
            type: paymentType,
            amount,
            source: "confirm-session-route",
            stripe_session_id: session.id,
            paid_by_profile_id: paidByProfileId || null,
        });

        return NextResponse.json({ state: "paid", paymentType });
    } catch (error) {
        await logServerActivity(
            user.id,
            "payment_failed",
            "payment",
            { source: "confirm-session-route", error: getErrorMessage(error) },
            "error"
        );
        return NextResponse.json({ error: "Failed to confirm payment session" }, { status: 500 });
    }
}
