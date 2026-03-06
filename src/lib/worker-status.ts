const POST_ENTRY_FEE_WORKER_STATUSES = new Set([
    "IN_QUEUE",
    "OFFER_PENDING",
    "OFFER_ACCEPTED",
    "VISA_PROCESS_STARTED",
    "VISA_APPROVED",
    "PLACED",
]);

export function isPostEntryFeeWorkerStatus(status: string | null | undefined): boolean {
    if (!status) {
        return false;
    }
    return POST_ENTRY_FEE_WORKER_STATUSES.has(status);
}

export function resolveWorkerStatusAfterEntryFee(status: string | null | undefined): string {
    if (isPostEntryFeeWorkerStatus(status)) {
        return status as string;
    }
    return "IN_QUEUE";
}
