export type ReviewNotificationStatus = {
    status?: "sent" | "queued" | "failed" | "skipped";
    error?: string | null;
};

export type ReviewNotificationToast = {
    variant: "success" | "warning";
    message: string;
};

export function getAdminReviewNotificationToast(
    action: "approve" | "reject",
    notification?: ReviewNotificationStatus | null
): ReviewNotificationToast {
    const baseMessage = action === "approve"
        ? "Document approved."
        : "Rejected with feedback.";

    switch (notification?.status) {
        case "sent":
            return {
                variant: "success",
                message: `${baseMessage} Email sent to user.`,
            };
        case "queued":
            return {
                variant: "warning",
                message: `${baseMessage} Email queued for retry${notification.error ? `: ${notification.error}` : "."}`,
            };
        case "failed":
            return {
                variant: "warning",
                message: `${baseMessage} Email failed${notification.error ? `: ${notification.error}` : "."}`,
            };
        default:
            return {
                variant: "success",
                message: `${baseMessage} No email was sent.`,
            };
    }
}
