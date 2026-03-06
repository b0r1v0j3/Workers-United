import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email-templates";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { resolveWorkerStatusAfterEntryFee } from "@/lib/worker-status";

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

        if (!sessionUserId || sessionUserId !== user.id) {
            return NextResponse.json({ error: "Session does not belong to current user" }, { status: 403 });
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
            user_id: user.id,
            profile_id: user.id,
            payment_type: paymentType,
            amount,
            amount_cents: expectedAmountCents,
            status: "completed",
            stripe_checkout_session_id: session.id,
            paid_at: new Date().toISOString(),
            metadata: paymentMetadata,
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
            const { data: existingCandidate } = await admin
                .from("candidates")
                .select("status, queue_joined_at, phone")
                .eq("profile_id", user.id)
                .maybeSingle();

            if (!existingCandidate) {
                const { error: candidateUpsertError } = await admin
                    .from("candidates")
                    .upsert(
                        {
                            profile_id: user.id,
                            entry_fee_paid: true,
                            status: "IN_QUEUE",
                            queue_joined_at: nowIso,
                            job_search_active: true,
                            job_search_activated_at: nowIso,
                        },
                        { onConflict: "profile_id" }
                    );
                assertNoDbError(candidateUpsertError, "Failed to create missing candidate");
            } else {
                const updatePayload: Record<string, unknown> = {
                    entry_fee_paid: true,
                    job_search_active: true,
                    job_search_activated_at: nowIso,
                };

                if (!existingCandidate.queue_joined_at) {
                    updatePayload.queue_joined_at = nowIso;
                }

                const nextStatus = resolveWorkerStatusAfterEntryFee(existingCandidate.status);
                if (existingCandidate.status !== nextStatus) {
                    updatePayload.status = nextStatus;
                }

                const { error: candidateUpdateError } = await admin
                    .from("candidates")
                    .update(updatePayload)
                    .eq("profile_id", user.id);
                assertNoDbError(candidateUpdateError, "Failed to update candidate after payment");
            }

            await logServerActivity(user.id, "payment_completed", "payment", {
                type: "entry_fee",
                amount: 9,
                source: "confirm-session-route",
                stripe_session_id: session.id,
            });

            // Send email fallback if webhook didn't send one yet
            const { data: existingPaymentEmail } = await admin
                .from("email_queue")
                .select("id")
                .eq("user_id", user.id)
                .eq("email_type", "payment_success")
                .in("status", ["pending", "sent"])
                .maybeSingle();

            if (!existingPaymentEmail?.id) {
                const [{ data: profile }, { data: candidate }] = await Promise.all([
                    admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
                    admin.from("candidates").select("phone").eq("profile_id", user.id).maybeSingle(),
                ]);

                const recipientEmail = session.customer_email || profile?.email || "";
                if (recipientEmail) {
                    await queueEmail(
                        admin,
                        user.id,
                        "payment_success",
                        recipientEmail,
                        profile?.full_name || "Worker",
                        { amount: "$9" },
                        undefined,
                        candidate?.phone || undefined
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
            const { error: offerUpdateError } = await admin
                .from("offers")
                .update({ status: "accepted", accepted_at: new Date().toISOString() })
                .eq("id", offerId);
            assertNoDbError(offerUpdateError, "Failed to accept offer");

            const { error: candidateStatusError } = await admin
                .from("candidates")
                .update({ status: "OFFER_ACCEPTED" })
                .eq("profile_id", user.id);
            assertNoDbError(candidateStatusError, "Failed to update worker status after confirmation fee");
        }

        await logServerActivity(user.id, "payment_completed", "payment", {
            type: paymentType,
            amount,
            source: "confirm-session-route",
            stripe_session_id: session.id,
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
