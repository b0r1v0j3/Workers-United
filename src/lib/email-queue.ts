import { sendEmail } from "@/lib/mailer";

const DEFAULT_EMAIL_RETRY_DELAY_MINUTES = 15;
const DEFAULT_EMAIL_MAX_ATTEMPTS = 3;

type QueueMeta = {
    attempts: number;
    maxAttempts: number;
    lastAttemptAt?: string | null;
    lastError?: string | null;
    retryScheduledFor?: string | null;
};

type EmailQueueRecord = {
    id: string;
    recipient_email: string;
    subject: string;
    template_data: unknown;
    scheduled_for?: string | null;
};

export type EmailQueueDeliveryStatus = "sent" | "queued_retry" | "failed" | "scheduled";

export type EmailQueueDeliveryResult = {
    id: string | null;
    sent: boolean;
    queued: boolean;
    status: EmailQueueDeliveryStatus;
    error?: string | null;
    retryScheduledFor?: string | null;
    attempts?: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function getQueueMeta(templateData: unknown): QueueMeta {
    const objectValue = asObject(templateData);
    const queueMeta = asObject(objectValue?.__queue);
    const attempts = typeof queueMeta?.attempts === "number" && Number.isFinite(queueMeta.attempts)
        ? queueMeta.attempts
        : 0;
    const maxAttempts = typeof queueMeta?.maxAttempts === "number" && Number.isFinite(queueMeta.maxAttempts)
        ? queueMeta.maxAttempts
        : DEFAULT_EMAIL_MAX_ATTEMPTS;

    return {
        attempts,
        maxAttempts,
        lastAttemptAt: typeof queueMeta?.lastAttemptAt === "string" ? queueMeta.lastAttemptAt : null,
        lastError: typeof queueMeta?.lastError === "string" ? queueMeta.lastError : null,
        retryScheduledFor: typeof queueMeta?.retryScheduledFor === "string" ? queueMeta.retryScheduledFor : null,
    };
}

export function attachEmailQueueMeta(
    templateData: Record<string, unknown>,
    overrides?: Partial<QueueMeta>
): Record<string, unknown> {
    const current = getQueueMeta(templateData);
    return {
        ...templateData,
        __queue: {
            attempts: overrides?.attempts ?? current.attempts,
            maxAttempts: overrides?.maxAttempts ?? current.maxAttempts,
            lastAttemptAt: overrides?.lastAttemptAt ?? current.lastAttemptAt ?? null,
            lastError: overrides?.lastError ?? current.lastError ?? null,
            retryScheduledFor: overrides?.retryScheduledFor ?? current.retryScheduledFor ?? null,
        },
    };
}

export function isRetryableEmailError(error: string | null | undefined) {
    if (!error) {
        return false;
    }

    const normalized = error.toLowerCase();
    return [
        "timed out",
        "timeout",
        "temporarily unavailable",
        "temporary failure",
        "rate limit",
        "too many connections",
        "421",
        "450",
        "451",
        "452",
        "454",
        "econnreset",
        "econnection",
        "esocket",
        "eai_again",
        "enetunreach",
        "socket closed",
    ].some((pattern) => normalized.includes(pattern));
}

export function isEmailDeliveryAccepted(result: Pick<EmailQueueDeliveryResult, "sent" | "queued"> | null | undefined) {
    return !!result && (result.sent || result.queued);
}

async function updateEmailQueueRecord(
    supabase: any,
    emailId: string,
    payload: Record<string, unknown>,
    context: string
) {
    const { error } = await supabase
        .from("email_queue")
        .update(payload)
        .eq("id", emailId);

    if (error) {
        throw new Error(`${context}: ${error.message}`);
    }
}

export async function processQueuedEmailRecord(
    supabase: any,
    record: EmailQueueRecord
): Promise<EmailQueueDeliveryResult> {
    const nowIso = new Date().toISOString();
    const templateData = asObject(record.template_data) || {};
    const html = typeof templateData.html === "string" && templateData.html.trim()
        ? templateData.html
        : null;
    const replyTo = typeof templateData.replyTo === "string" && templateData.replyTo.trim()
        ? templateData.replyTo.trim()
        : undefined;

    const currentMeta = getQueueMeta(templateData);
    const attempts = currentMeta.attempts + 1;

    if (!html) {
        const nextTemplateData = attachEmailQueueMeta(templateData, {
            attempts,
            lastAttemptAt: nowIso,
            lastError: "Missing HTML template data",
            retryScheduledFor: null,
        });
        await updateEmailQueueRecord(
            supabase,
            record.id,
            {
                status: "failed",
                sent_at: null,
                error_message: "Missing HTML template data",
                template_data: nextTemplateData,
            },
            "Failed to mark email as failed for missing HTML template data"
        );

        return {
            id: record.id,
            sent: false,
            queued: false,
            status: "failed",
            error: "Missing HTML template data",
            attempts,
        };
    }

    const result = await sendEmail(record.recipient_email, record.subject, html, replyTo);

    if (result.success) {
        const nextTemplateData = attachEmailQueueMeta(templateData, {
            attempts,
            lastAttemptAt: nowIso,
            lastError: null,
            retryScheduledFor: null,
        });
        await updateEmailQueueRecord(
            supabase,
            record.id,
            {
                status: "sent",
                sent_at: nowIso,
                error_message: null,
                template_data: nextTemplateData,
            },
            "Failed to mark email as sent"
        );

        return {
            id: record.id,
            sent: true,
            queued: false,
            status: "sent",
            error: null,
            attempts,
        };
    }

    const errorMessage = result.error || "Unknown SMTP error";
    const retryable = isRetryableEmailError(errorMessage);
    const canRetry = retryable && attempts < currentMeta.maxAttempts;

    if (canRetry) {
        const retryScheduledFor = new Date(Date.now() + DEFAULT_EMAIL_RETRY_DELAY_MINUTES * 60 * 1000).toISOString();
        const nextTemplateData = attachEmailQueueMeta(templateData, {
            attempts,
            lastAttemptAt: nowIso,
            lastError: errorMessage,
            retryScheduledFor,
        });
        await updateEmailQueueRecord(
            supabase,
            record.id,
            {
                status: "pending",
                sent_at: null,
                error_message: errorMessage,
                scheduled_for: retryScheduledFor,
                template_data: nextTemplateData,
            },
            "Failed to requeue retryable email"
        );

        return {
            id: record.id,
            sent: false,
            queued: true,
            status: "queued_retry",
            error: errorMessage,
            retryScheduledFor,
            attempts,
        };
    }

    const nextTemplateData = attachEmailQueueMeta(templateData, {
        attempts,
        lastAttemptAt: nowIso,
        lastError: errorMessage,
        retryScheduledFor: null,
    });
    await updateEmailQueueRecord(
        supabase,
        record.id,
        {
            status: "failed",
            sent_at: null,
            error_message: errorMessage,
            template_data: nextTemplateData,
        },
        "Failed to mark email as failed"
    );

    return {
        id: record.id,
        sent: false,
        queued: false,
        status: "failed",
        error: errorMessage,
        attempts,
    };
}

export async function processPendingEmailQueue(
    supabase: any,
    limit = 100
) {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from("email_queue")
        .select("id, recipient_email, subject, template_data, scheduled_for")
        .eq("status", "pending")
        .lte("scheduled_for", nowIso)
        .order("scheduled_for", { ascending: true })
        .limit(limit);

    if (error) {
        throw error;
    }

    let sent = 0;
    let retried = 0;
    let failed = 0;

    for (const record of data || []) {
        const result = await processQueuedEmailRecord(supabase, record);
        if (result.status === "sent") {
            sent += 1;
        } else if (result.status === "queued_retry") {
            retried += 1;
        } else if (result.status === "failed") {
            failed += 1;
        }
    }

    return {
        processed: (data || []).length,
        sent,
        retried,
        failed,
    };
}
