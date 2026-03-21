const PAYMENT_PENDING_ACTIVATION_STATUSES = new Set([
    "NEW",
    "PROFILE_COMPLETE",
    "VERIFIED",
    "PENDING_APPROVAL",
]);

export type WorkerQueueStage =
    | "none"
    | "in_queue"
    | "payment_pending_activation"
    | "post_payment_case_active";

export function getWorkerQueueStage(params: {
    activeOfferCount?: number;
    hasPaidEntryFee?: boolean;
    inQueue?: boolean;
    queueJoinedAt?: string | null | undefined;
    workerStatus?: string | null | undefined;
}): WorkerQueueStage {
    if ((params.activeOfferCount || 0) > 0) {
        return "none";
    }

    if (params.inQueue) {
        return "in_queue";
    }

    if (!params.hasPaidEntryFee) {
        return "none";
    }

    if (params.queueJoinedAt) {
        return "post_payment_case_active";
    }

    const normalizedStatus = (params.workerStatus || "").trim().toUpperCase();
    if (!normalizedStatus || PAYMENT_PENDING_ACTIVATION_STATUSES.has(normalizedStatus)) {
        return "payment_pending_activation";
    }

    return "post_payment_case_active";
}
