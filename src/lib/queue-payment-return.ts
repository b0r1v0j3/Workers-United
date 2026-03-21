export type QueuePaymentReturnMode =
    | "ignore"
    | "confirm_session"
    | "verification_pending"
    | "sandbox_success"
    | "cancelled";

export function getQueuePaymentReturnMode(
    payment: string | null | undefined,
    sessionId: string | null | undefined
): QueuePaymentReturnMode {
    if (payment === "sandbox_success") {
        return "sandbox_success";
    }

    if (payment === "cancelled") {
        return "cancelled";
    }

    if (payment !== "success") {
        return "ignore";
    }

    return sessionId ? "confirm_session" : "verification_pending";
}
