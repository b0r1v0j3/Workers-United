export interface EntryFeeWorkerState {
    entry_fee_paid?: boolean | null;
    profile_completion?: number | null;
    admin_approved?: boolean | null;
}

export interface EntryFeeEligibility {
    allowed: boolean;
    status?: number;
    error?: string;
}

export type EntryFeeUnlockReason =
    | "already_paid"
    | "needs_completion"
    | "pending_admin_review"
    | "ready";

export interface EntryFeeUnlockState {
    allowed: boolean;
    reason: EntryFeeUnlockReason;
    status?: number;
    error?: string;
}

export function getEntryFeeUnlockState(worker: EntryFeeWorkerState | null): EntryFeeUnlockState {
    if (!worker) {
        return { allowed: false, reason: "needs_completion", status: 404, error: "Worker profile not found" };
    }

    if (worker.entry_fee_paid) {
        return { allowed: false, reason: "already_paid", status: 400, error: "Entry fee already paid" };
    }

    if (typeof worker.profile_completion === "number" && worker.profile_completion < 100) {
        return {
            allowed: false,
            reason: "needs_completion",
            status: 400,
            error: "Complete your profile to 100% before unlocking Job Finder payment",
        };
    }

    if (worker.admin_approved === false) {
        return {
            allowed: false,
            reason: "pending_admin_review",
            status: 400,
            error: "Your profile is complete and waiting for admin review before Job Finder payment unlocks",
        };
    }

    return { allowed: true, reason: "ready" };
}

export function getEntryFeeEligibility(worker: EntryFeeWorkerState | null): EntryFeeEligibility {
    const unlockState = getEntryFeeUnlockState(worker);
    return {
        allowed: unlockState.allowed,
        status: unlockState.status,
        error: unlockState.error,
    };
}
