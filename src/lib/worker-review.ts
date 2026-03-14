interface WorkerReviewInput {
    completion: number;
    entryFeePaid?: boolean | null;
    adminApproved?: boolean | null;
    currentStatus?: string | null;
}

const POST_PAYMENT_STATUSES = new Set([
    "IN_QUEUE",
    "OFFER_PENDING",
    "OFFER_ACCEPTED",
    "VISA_PROCESS_STARTED",
    "VISA_APPROVED",
    "PLACED",
    "REFUND_FLAGGED",
]);

export function getPendingApprovalTargetStatus({
    completion,
    entryFeePaid = false,
    adminApproved = false,
    currentStatus,
}: WorkerReviewInput): string | null {
    const normalizedStatus = (currentStatus || "NEW").toUpperCase();

    if (entryFeePaid || POST_PAYMENT_STATUSES.has(normalizedStatus)) {
        return null;
    }

    if (completion >= 100 && !adminApproved) {
        return normalizedStatus === "PENDING_APPROVAL" ? null : "PENDING_APPROVAL";
    }

    if (completion < 100 && !adminApproved && normalizedStatus === "PENDING_APPROVAL") {
        return "NEW";
    }

    return null;
}

export function canApproveWorkerProfile(completion: number) {
    return completion >= 100;
}
