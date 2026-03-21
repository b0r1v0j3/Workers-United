const POST_ENTRY_FEE_WORKER_STATUSES = new Set([
    "IN_QUEUE",
    "OFFER_PENDING",
    "OFFER_ACCEPTED",
    "VISA_PROCESS_STARTED",
    "VISA_APPROVED",
    "PLACED",
]);

const MANUAL_ADMIN_WORKER_STATUSES = [
    "NEW",
    "PROFILE_COMPLETE",
    "VERIFIED",
    "PENDING_APPROVAL",
    "REJECTED",
] as const;

const LOCKED_MANUAL_ADMIN_WORKER_STATUSES = new Set([
    ...POST_ENTRY_FEE_WORKER_STATUSES,
    "REFUND_FLAGGED",
]);

const COMPLETION_GATED_MANUAL_ADMIN_WORKER_STATUSES = new Set([
    "PROFILE_COMPLETE",
    "VERIFIED",
    "PENDING_APPROVAL",
]);

export type ManualAdminWorkerStatus = (typeof MANUAL_ADMIN_WORKER_STATUSES)[number];

interface ManualAdminWorkerStatusContext {
    currentStatus?: string | null | undefined;
    entryFeePaid?: boolean | null | undefined;
    jobSearchActive?: boolean | null | undefined;
    adminApproved?: boolean | null | undefined;
    completion?: number;
}

type ManualAdminWorkerStatusUpdateResult =
    | {
        allowed: true;
        nextStatus: ManualAdminWorkerStatus;
        clearsApproval: boolean;
    }
    | {
        allowed: false;
        error: string;
    };

export function assertManualAdminWorkerStatusWriteSucceeded(params: {
    updatedWorkerId?: string | null | undefined;
    updateErrorMessage?: string | null | undefined;
}) {
    if (params.updateErrorMessage) {
        throw new Error(`Failed to update worker status: ${params.updateErrorMessage}`);
    }

    if (!params.updatedWorkerId) {
        throw new Error("Worker status update did not persist.");
    }

    return params.updatedWorkerId;
}

export function isPostEntryFeeWorkerStatus(status: string | null | undefined): boolean {
    if (!status) {
        return false;
    }
    return POST_ENTRY_FEE_WORKER_STATUSES.has(status);
}

export function canUseManualAdminWorkerStatusOverride({
    currentStatus,
    entryFeePaid = false,
    jobSearchActive = false,
}: Pick<ManualAdminWorkerStatusContext, "currentStatus" | "entryFeePaid" | "jobSearchActive">): boolean {
    const normalizedStatus = (currentStatus || "NEW").toUpperCase();
    return !(entryFeePaid || jobSearchActive || LOCKED_MANUAL_ADMIN_WORKER_STATUSES.has(normalizedStatus));
}

export function getAllowedManualAdminWorkerStatuses({
    currentStatus,
    entryFeePaid = false,
    jobSearchActive = false,
    adminApproved = false,
}: Pick<ManualAdminWorkerStatusContext, "currentStatus" | "entryFeePaid" | "jobSearchActive" | "adminApproved">): ManualAdminWorkerStatus[] {
    if (!canUseManualAdminWorkerStatusOverride({ currentStatus, entryFeePaid, jobSearchActive })) {
        return [];
    }

    if (adminApproved) {
        return [];
    }

    return ["NEW", "PROFILE_COMPLETE", "VERIFIED", "PENDING_APPROVAL", "REJECTED"];
}

export function resolveManualAdminWorkerStatusUpdate({
    currentStatus,
    entryFeePaid = false,
    jobSearchActive = false,
    adminApproved = false,
    completion = 0,
    requestedStatus,
}: ManualAdminWorkerStatusContext & { requestedStatus?: string | null | undefined }): ManualAdminWorkerStatusUpdateResult {
    const normalizedStatus = (requestedStatus || "").toUpperCase();

    if (!canUseManualAdminWorkerStatusOverride({ currentStatus, entryFeePaid, jobSearchActive })) {
        return {
            allowed: false,
            error: "Manual status updates are locked after Job Finder is active. Use queue, offer, visa, or refund tools instead.",
        };
    }

    if (adminApproved) {
        return {
            allowed: false,
            error: "Use the revoke approval button before changing worker status manually.",
        };
    }

    if (normalizedStatus === "APPROVED") {
        return {
            allowed: false,
            error: "Use the approval button to approve the worker and set admin approval flags together.",
        };
    }

    if (!MANUAL_ADMIN_WORKER_STATUSES.includes(normalizedStatus as ManualAdminWorkerStatus)) {
        return {
            allowed: false,
            error: "Manual status updates only support pre-payment administrative states.",
        };
    }

    if (completion < 100 && COMPLETION_GATED_MANUAL_ADMIN_WORKER_STATUSES.has(normalizedStatus)) {
        return {
            allowed: false,
            error: "Worker profile must be 100% complete before using Profile Complete, Verified, or Pending Approval.",
        };
    }

    return {
        allowed: true,
        nextStatus: normalizedStatus as ManualAdminWorkerStatus,
        clearsApproval: false,
    };
}

export function resolveWorkerStatusAfterEntryFee(status: string | null | undefined): string {
    if (isPostEntryFeeWorkerStatus(status)) {
        return status as string;
    }
    return "IN_QUEUE";
}
