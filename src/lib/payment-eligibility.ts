export interface EntryFeeWorkerState {
    entry_fee_paid?: boolean | null;
    profile_completion?: number | null;
}

export interface EntryFeeEligibility {
    allowed: boolean;
    status?: number;
    error?: string;
}

export function getEntryFeeEligibility(worker: EntryFeeWorkerState | null): EntryFeeEligibility {
    if (!worker) {
        return { allowed: false, status: 404, error: "Worker profile not found" };
    }

    if (worker.entry_fee_paid) {
        return { allowed: false, status: 400, error: "Entry fee already paid" };
    }

    if (typeof worker.profile_completion === "number" && worker.profile_completion < 100) {
        return {
            allowed: false,
            status: 400,
            error: "Complete your profile to 100% before unlocking Job Finder payment",
        };
    }

    return { allowed: true };
}
