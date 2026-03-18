export interface EntryFeeWorkerState {
    entry_fee_paid?: boolean | null;
    profile_completion?: number | null;
    admin_approved?: boolean | null;
}

// Keep this list aligned with getWorkerCompletion() so the checkout gate
// evaluates the same readiness fields that the worker workspace/admin use.
export const WORKER_ENTRY_FEE_READINESS_COLUMNS = [
    "id",
    "updated_at",
    "entry_fee_paid",
    "job_search_active",
    "admin_approved",
    "queue_joined_at",
    "status",
    "phone",
    "nationality",
    "current_country",
    "preferred_job",
    "submitted_full_name",
    "submitted_email",
    "gender",
    "date_of_birth",
    "birth_country",
    "birth_city",
    "citizenship",
    "marital_status",
    "passport_number",
    "passport_issued_by",
    "passport_issue_date",
    "passport_expiry_date",
    "lives_abroad",
    "previous_visas",
    "family_data",
    "address",
].join(", ");

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
