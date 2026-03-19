import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { queueEmail } from "@/lib/email-templates";
import { resolveWorkerStatusAfterEntryFee } from "@/lib/worker-status";
import { loadCanonicalWorkerRecord } from "@/lib/workers";

type AdminDbClient = Pick<SupabaseClient<Database>, "from">;

interface PersistCompletedStripeCheckoutPaymentOptions {
    admin: AdminDbClient;
    session: Stripe.Checkout.Session;
    paymentId?: string | null;
    paymentType: string;
    targetProfileId?: string | null;
    paidByProfileId?: string | null;
    targetWorkerId?: string | null;
    metadataPatch?: Record<string, unknown>;
}

interface ActivateEntryFeeWorkerAfterPaymentOptions {
    admin: AdminDbClient;
    targetProfileId?: string | null;
    targetWorkerId?: string | null;
    activatedAt?: string;
}

interface QueueEntryFeePaymentSuccessEmailOptions {
    admin: AdminDbClient;
    targetProfileId?: string | null;
    sessionCustomerEmail?: string | null;
}

interface UpdateStripePaymentRecordByReferenceOptions {
    admin: AdminDbClient;
    paymentId?: string | null;
    stripeSessionId?: string | null;
    patch: Record<string, unknown>;
    pendingOnly?: boolean;
}

interface StripePaymentAmounts {
    amount: number;
    amountCents: number;
}

interface StripePaymentFailedActivityPayloadOptions {
    paymentType: string;
    paymentId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
    targetWorkerId?: string | null;
    failureCode?: string | null;
    declineCode?: string | null;
    outcomeReason?: string | null;
    networkStatus?: string | null;
    riskLevel?: string | null;
    error?: string | null;
    source?: string | null;
}

interface StripePaymentCompletedActivityPayloadOptions {
    paymentType: string;
    amount: number;
    paidByProfileId?: string | null;
    targetWorkerId?: string | null;
    currency?: string | null;
    offerId?: string | null;
    source?: string | null;
    stripeSessionId?: string | null;
}

interface StripeCheckoutExpiredActivityPayloadOptions {
    paymentType: string;
    paymentId?: string | null;
    stripeSessionId?: string | null;
    targetWorkerId?: string | null;
}

type PaymentSuccessEmailResult =
    | { status: "queued"; recipientEmail: string }
    | { status: "already_queued" }
    | { status: "missing_target_profile" }
    | { status: "missing_recipient" };

function assertNoDbError(error: { message: string } | null | undefined, context: string): void {
    if (error) {
        throw new Error(`${context}: ${error.message}`);
    }
}

function isDuplicateKeyError(error: unknown): error is { code: string } {
    return !!error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505";
}

export function getStripePaymentAmounts(paymentType: string): StripePaymentAmounts {
    if (paymentType === "confirmation_fee") {
        return { amount: 190, amountCents: 19000 };
    }

    return { amount: 9, amountCents: 900 };
}

export function mergeStripePaymentMetadata(
    existing: Stripe.MetadataParam | Record<string, unknown> | null | undefined,
    next: Record<string, unknown>
): Record<string, unknown> {
    const base = existing && typeof existing === "object" && !Array.isArray(existing)
        ? existing
        : {};

    return {
        ...base,
        ...next,
    };
}

export function buildStripePaymentFailedActivityPayload({
    paymentType,
    paymentId = null,
    stripePaymentIntentId = null,
    stripeChargeId = null,
    targetWorkerId = null,
    failureCode = null,
    declineCode = null,
    outcomeReason = null,
    networkStatus = null,
    riskLevel = null,
    error = null,
    source = null,
}: StripePaymentFailedActivityPayloadOptions): Record<string, unknown> {
    return {
        type: paymentType,
        payment_id: paymentId,
        stripe_payment_intent_id: stripePaymentIntentId,
        stripe_charge_id: stripeChargeId,
        target_worker_id: targetWorkerId,
        failure_code: failureCode,
        decline_code: declineCode,
        outcome_reason: outcomeReason,
        network_status: networkStatus,
        risk_level: riskLevel,
        error,
        ...(source ? { source } : {}),
    };
}

export function buildStripePaymentCompletedActivityPayload({
    paymentType,
    amount,
    paidByProfileId = null,
    targetWorkerId = null,
    currency = null,
    offerId = null,
    source = null,
    stripeSessionId = null,
}: StripePaymentCompletedActivityPayloadOptions): Record<string, unknown> {
    return {
        type: paymentType,
        amount,
        paid_by_profile_id: paidByProfileId,
        ...(targetWorkerId ? { target_worker_id: targetWorkerId } : {}),
        ...(currency ? { currency } : {}),
        ...(offerId ? { offer_id: offerId } : {}),
        ...(source ? { source } : {}),
        ...(stripeSessionId ? { stripe_session_id: stripeSessionId } : {}),
    };
}

export function buildStripeCheckoutExpiredActivityPayload({
    paymentType,
    paymentId = null,
    stripeSessionId = null,
    targetWorkerId = null,
}: StripeCheckoutExpiredActivityPayloadOptions): Record<string, unknown> {
    return {
        type: paymentType,
        payment_id: paymentId,
        ...(stripeSessionId ? { stripe_session_id: stripeSessionId } : {}),
        ...(targetWorkerId ? { target_worker_id: targetWorkerId } : {}),
    };
}

export async function updateStripePaymentRecordByReference({
    admin,
    paymentId = null,
    stripeSessionId = null,
    patch,
    pendingOnly = false,
}: UpdateStripePaymentRecordByReferenceOptions): Promise<void> {
    const selector = paymentId
        ? admin.from("payments").select("id, metadata").eq("id", paymentId)
        : stripeSessionId
            ? admin.from("payments").select("id, metadata").eq("stripe_checkout_session_id", stripeSessionId)
            : null;

    if (!selector) {
        return;
    }

    const { data: existingRow, error: existingRowError } = await selector.maybeSingle();
    assertNoDbError(existingRowError, "Failed to load payment row by reference");

    if (!existingRow?.id) {
        return;
    }

    const nextPatch = {
        ...patch,
        ...(patch.metadata && typeof patch.metadata === "object"
            ? {
                metadata: mergeStripePaymentMetadata(
                    existingRow.metadata as Record<string, unknown> | null | undefined,
                    patch.metadata as Record<string, unknown>
                ),
            }
            : {}),
    } as Database["public"]["Tables"]["payments"]["Update"];

    let query = admin.from("payments").update(nextPatch).eq("id", existingRow.id);
    if (pendingOnly) {
        query = query.eq("status", "pending");
    }

    const { error } = await query;
    assertNoDbError(error, "Failed to update payment row by reference");
}

export async function persistCompletedStripeCheckoutPayment({
    admin,
    session,
    paymentId = null,
    paymentType,
    targetProfileId = null,
    paidByProfileId = null,
    targetWorkerId = null,
    metadataPatch = {},
}: PersistCompletedStripeCheckoutPaymentOptions): Promise<void> {
    const { amount, amountCents } = getStripePaymentAmounts(paymentType);
    const paymentMetadata = {
        ...(session.metadata || {}),
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        stripe_currency: session.currency?.toUpperCase() || "USD",
        stripe_session_status: session.status,
        stripe_payment_status: session.payment_status,
        stripe_customer_country: session.customer_details?.address?.country || null,
        stripe_customer_postal_code: session.customer_details?.address?.postal_code || null,
        ...metadataPatch,
    };

    const paymentPayload = {
        user_id: targetProfileId,
        profile_id: targetProfileId,
        payment_type: paymentType,
        amount,
        amount_cents: amountCents,
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
        const { error } = await admin
            .from("payments")
            .update(paymentPayload)
            .eq("id", paymentId);
        assertNoDbError(error, "Failed to update payment by payment_id");
        return;
    }

    const { data: existingBySession, error: existingBySessionError } = await admin
        .from("payments")
        .select("id")
        .eq("stripe_checkout_session_id", session.id)
        .maybeSingle();
    assertNoDbError(existingBySessionError, "Failed to load payment by checkout session");

    if (existingBySession?.id) {
        const { error } = await admin
            .from("payments")
            .update(paymentPayload)
            .eq("id", existingBySession.id);
        assertNoDbError(error, "Failed to update payment by session");
        return;
    }

    const { error: paymentInsertError } = await admin
        .from("payments")
        .insert(paymentPayload);

    if (!paymentInsertError) {
        return;
    }

    if (isDuplicateKeyError(paymentInsertError)) {
        const { data: existingAfterConflict, error: existingAfterConflictError } = await admin
            .from("payments")
            .select("id")
            .eq("stripe_checkout_session_id", session.id)
            .maybeSingle();
        assertNoDbError(existingAfterConflictError, "Failed to recover duplicate payment row");

        if (existingAfterConflict?.id) {
            const { error } = await admin
                .from("payments")
                .update(paymentPayload)
                .eq("id", existingAfterConflict.id);
            assertNoDbError(error, "Failed to update duplicate payment row after conflict");
            return;
        }
    }

    assertNoDbError(paymentInsertError, "Failed to insert payment row");
}

export async function activateEntryFeeWorkerAfterPayment({
    admin,
    targetProfileId = null,
    targetWorkerId = null,
    activatedAt = new Date().toISOString(),
}: ActivateEntryFeeWorkerAfterPaymentOptions): Promise<void> {
    if (targetProfileId) {
        const { data: existingWorkerRecord, error: existingWorkerRecordError } = await loadCanonicalWorkerRecord(
            admin,
            targetProfileId,
            "id, status, queue_joined_at, entry_fee_paid, job_search_active"
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
                        queue_joined_at: activatedAt,
                        job_search_active: true,
                        job_search_activated_at: activatedAt,
                    },
                    { onConflict: "profile_id" }
                );
            assertNoDbError(workerRecordUpsertError, "Failed to create missing worker record");
            return;
        }

        const updatePayload: Record<string, unknown> = {
            entry_fee_paid: true,
            job_search_active: true,
            job_search_activated_at: activatedAt,
        };

        if (!existingWorkerRecord.queue_joined_at) {
            updatePayload.queue_joined_at = activatedAt;
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
        return;
    }

    if (!targetWorkerId) {
        throw new Error("Missing target worker for entry fee activation");
    }

    const { data: agencyWorkerRecord, error: agencyWorkerRecordError } = await admin
        .from("worker_onboarding")
        .select("id, status, queue_joined_at")
        .eq("id", targetWorkerId)
        .maybeSingle();
    assertNoDbError(agencyWorkerRecordError, "Failed to load agency worker after payment");

    if (!agencyWorkerRecord) {
        throw new Error("Agency worker not found");
    }

    const updatePayload: Record<string, unknown> = {
        entry_fee_paid: true,
        job_search_active: true,
        job_search_activated_at: activatedAt,
    };

    if (!agencyWorkerRecord.queue_joined_at) {
        updatePayload.queue_joined_at = activatedAt;
    }

    const nextStatus = resolveWorkerStatusAfterEntryFee(agencyWorkerRecord.status);
    if (agencyWorkerRecord.status !== nextStatus) {
        updatePayload.status = nextStatus;
    }

    const { error: agencyWorkerUpdateError } = await admin
        .from("worker_onboarding")
        .update(updatePayload)
        .eq("id", targetWorkerId);
    assertNoDbError(agencyWorkerUpdateError, "Failed to update agency worker after payment");
}

export async function queueEntryFeePaymentSuccessEmail({
    admin,
    targetProfileId = null,
    sessionCustomerEmail = null,
}: QueueEntryFeePaymentSuccessEmailOptions): Promise<PaymentSuccessEmailResult> {
    if (!targetProfileId) {
        return { status: "missing_target_profile" };
    }

    const { data: existingPaymentEmail, error: existingPaymentEmailError } = await admin
        .from("email_queue")
        .select("id")
        .eq("user_id", targetProfileId)
        .eq("email_type", "payment_success")
        .in("status", ["pending", "sent"])
        .maybeSingle();
    assertNoDbError(existingPaymentEmailError, "Failed to load existing payment success email");

    if (existingPaymentEmail?.id) {
        return { status: "already_queued" };
    }

    const [{ data: profile, error: profileError }, { data: workerRecord, error: workerRecordError }] = await Promise.all([
        admin.from("profiles").select("full_name, email").eq("id", targetProfileId).maybeSingle(),
        loadCanonicalWorkerRecord(admin, targetProfileId, "id, phone, updated_at"),
    ]);

    assertNoDbError(profileError, "Failed to load profile for payment success email");
    assertNoDbError(workerRecordError, "Failed to load worker record for payment success email");

    const recipientEmail = profile?.email || sessionCustomerEmail || "";
    if (!recipientEmail) {
        return { status: "missing_recipient" };
    }

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

    return {
        status: "queued",
        recipientEmail,
    };
}
