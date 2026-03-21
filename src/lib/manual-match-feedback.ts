export type ManualMatchFailurePayload = {
    error?: string | null;
    rollbackFailed?: boolean;
    cleanupErrors?: string[] | null;
};

export type ManualMatchFailureFeedback = {
    message: string;
    detail: string | null;
};

export function getManualMatchFailureFeedback(
    payload: ManualMatchFailurePayload | null | undefined,
    fallbackMessage = "Failed to create match."
): ManualMatchFailureFeedback {
    const message = payload?.error?.trim() || fallbackMessage;

    if (!payload?.rollbackFailed) {
        return {
            message,
            detail: null,
        };
    }

    const cleanupErrors = (payload.cleanupErrors || [])
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .slice(0, 2);

    return {
        message,
        detail: cleanupErrors.length > 0
            ? `Cleanup may be incomplete. Check worker, offer, and match records before retrying. ${cleanupErrors.join(" | ")}`
            : "Cleanup may be incomplete. Check worker, offer, and match records before retrying.",
    };
}
