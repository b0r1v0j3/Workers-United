import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { updateStripePaymentRecordByReference } from "@/lib/stripe-payment-finalization";

type AdminDbClient = Pick<SupabaseClient<Database>, "from">;

export interface StripeCheckoutPendingPaymentRow {
    id: string;
    user_id: string | null;
    profile_id: string | null;
    status: string | null;
    stripe_checkout_session_id: string | null;
    deadline_at: string | null;
    metadata: Record<string, unknown> | null;
}

interface FindReusableStripeCheckoutPaymentOptions {
    admin: AdminDbClient;
    paymentType: "entry_fee" | "confirmation_fee";
    paymentOwnerProfileId?: string | null;
    targetWorkerId?: string | null;
    offerId?: string | null;
}

interface MarkStripeCheckoutCreationFailureOptions {
    admin: AdminDbClient;
    paymentId: string;
    paymentType: "entry_fee" | "confirmation_fee";
    error: unknown;
}

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function extractStringField(value: unknown, key: string): string | null {
    const objectValue = asObject(value);
    if (!objectValue) {
        return null;
    }

    const field = objectValue[key];
    return typeof field === "string" && field.trim() ? field.trim() : null;
}

function parseIsoDate(value: string | null | undefined): Date | null {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCheckoutStartedAt(payment: StripeCheckoutPendingPaymentRow): Date | null {
    const metadataStartedAt = parseIsoDate(extractStringField(payment.metadata, "checkout_started_at"));
    if (metadataStartedAt) {
        return metadataStartedAt;
    }

    const deadlineAt = parseIsoDate(payment.deadline_at);
    if (deadlineAt) {
        return new Date(deadlineAt.getTime() - 72 * 60 * 60 * 1000);
    }

    return null;
}

function sortByNewestCheckoutAttempt(payments: StripeCheckoutPendingPaymentRow[]) {
    return [...payments].sort((left, right) => {
        const leftTime = getCheckoutStartedAt(left)?.getTime() || 0;
        const rightTime = getCheckoutStartedAt(right)?.getTime() || 0;
        return rightTime - leftTime;
    });
}

export async function findReusableStripeCheckoutPayment({
    admin,
    paymentType,
    paymentOwnerProfileId = null,
    targetWorkerId = null,
    offerId = null,
}: FindReusableStripeCheckoutPaymentOptions): Promise<StripeCheckoutPendingPaymentRow | null> {
    if (!paymentOwnerProfileId && !targetWorkerId) {
        return null;
    }

    let query = admin
        .from("payments")
        .select("id, user_id, profile_id, status, stripe_checkout_session_id, deadline_at, metadata")
        .eq("payment_type", paymentType)
        .eq("status", "pending");

    if (targetWorkerId) {
        query = query.contains("metadata", { target_worker_id: targetWorkerId });
    } else if (paymentOwnerProfileId) {
        query = query.or(`user_id.eq.${paymentOwnerProfileId},profile_id.eq.${paymentOwnerProfileId}`);
    }

    query = query.order("deadline_at", { ascending: false }).limit(20);

    const { data, error } = await query;
    if (error) {
        throw error;
    }

    const matchingPayments = ((data || []) as StripeCheckoutPendingPaymentRow[]).filter((payment) => {
        if (!offerId) {
            return true;
        }

        return extractStringField(payment.metadata, "offer_id") === offerId;
    });

    return sortByNewestCheckoutAttempt(matchingPayments)[0] || null;
}

export async function markStripeCheckoutCreationFailed({
    admin,
    paymentId,
    paymentType,
    error,
}: MarkStripeCheckoutCreationFailureOptions): Promise<void> {
    const failedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);

    await updateStripePaymentRecordByReference({
        admin,
        paymentId,
        pendingOnly: true,
        patch: {
            status: "abandoned",
            deadline_at: failedAt,
            metadata: {
                stripe_checkout_session_create_failed_at: failedAt,
                stripe_checkout_session_create_failed_payment_type: paymentType,
                stripe_checkout_session_create_failed_error: errorMessage,
            },
        },
    });
}
