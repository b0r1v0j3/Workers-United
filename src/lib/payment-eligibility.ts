import { getWorkerCompletion } from "@/lib/profile-completion";

export interface EntryFeeWorkerState {
    entry_fee_paid?: boolean | null;
    profile_completion?: number | null;
    admin_approved?: boolean | null;
}

export interface EntryFeeEligibilityProfileState {
    full_name?: string | null;
}

export interface EntryFeeEligibilityDocumentState {
    document_type: string;
}

export interface EntryFeeEligibilityWorkerRecord extends EntryFeeWorkerState {
    job_search_active?: boolean | null;
    queue_joined_at?: string | null;
    phone?: string | null;
    nationality?: string | null;
    current_country?: string | null;
    preferred_job?: string | null;
    submitted_full_name?: string | null;
    submitted_email?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    birth_country?: string | null;
    birth_city?: string | null;
    citizenship?: string | null;
    marital_status?: string | null;
    passport_number?: string | null;
    passport_issued_by?: string | null;
    passport_issue_date?: string | null;
    passport_expiry_date?: string | null;
    lives_abroad?: string | boolean | null;
    previous_visas?: string | boolean | null;
    family_data?: unknown;
}

export interface EntryFeeEligibilityResolution {
    profileCompletion: number;
    unlockState: EntryFeeUnlockState;
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
    manualOverride: boolean;
    status?: number;
    error?: string;
}

export function resolveEntryFeeEligibilityForWorker(params: {
    profile: EntryFeeEligibilityProfileState | null;
    worker: EntryFeeEligibilityWorkerRecord | null;
    documents: EntryFeeEligibilityDocumentState[];
    phoneOptional?: boolean;
    fullNameFallback?: string | null;
}): EntryFeeEligibilityResolution {
    if (!params.worker) {
        return {
            profileCompletion: 0,
            unlockState: getEntryFeeUnlockState(null),
        };
    }

    const profileCompletion = getWorkerCompletion({
        profile: params.profile,
        worker: params.worker,
        documents: params.documents,
    }, {
        phoneOptional: params.phoneOptional,
        fullNameFallback: params.fullNameFallback,
    }).completion;

    return {
        profileCompletion,
        unlockState: getEntryFeeUnlockState({
            entry_fee_paid: params.worker.entry_fee_paid,
            profile_completion: profileCompletion,
            admin_approved: params.worker.admin_approved,
        }),
    };
}

export function getEntryFeeUnlockState(worker: EntryFeeWorkerState | null): EntryFeeUnlockState {
    if (!worker) {
        return { allowed: false, reason: "needs_completion", manualOverride: false, status: 404, error: "Worker profile not found" };
    }

    if (worker.entry_fee_paid) {
        return { allowed: false, reason: "already_paid", manualOverride: false, status: 400, error: "Entry fee already paid" };
    }

    const profileComplete = typeof worker.profile_completion === "number" && worker.profile_completion >= 100;

    if (worker.admin_approved === true) {
        return {
            allowed: true,
            reason: "ready",
            manualOverride: !profileComplete,
        };
    }

    if (!profileComplete) {
        return {
            allowed: false,
            reason: "needs_completion",
            manualOverride: false,
            status: 400,
            error: "Complete your profile and required documents before unlocking Job Finder payment",
        };
    }

    return {
        allowed: false,
        reason: "pending_admin_review",
        manualOverride: false,
        status: 400,
        error: "Your profile and required documents are complete and waiting for admin review before Job Finder payment unlocks",
    };
}

export function getEntryFeeEligibility(worker: EntryFeeWorkerState | null): EntryFeeEligibility {
    const unlockState = getEntryFeeUnlockState(worker);
    return {
        allowed: unlockState.allowed,
        status: unlockState.status,
        error: unlockState.error,
    };
}
