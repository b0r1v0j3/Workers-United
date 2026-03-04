export interface EntryFeeCandidateState {
    entry_fee_paid?: boolean | null;
}

export interface EntryFeeEligibility {
    allowed: boolean;
    status?: number;
    error?: string;
}

export function getEntryFeeEligibility(candidate: EntryFeeCandidateState | null): EntryFeeEligibility {
    if (!candidate) {
        return { allowed: false, status: 404, error: "Candidate profile not found" };
    }

    if (candidate.entry_fee_paid) {
        return { allowed: false, status: 400, error: "Entry fee already paid" };
    }

    return { allowed: true };
}

