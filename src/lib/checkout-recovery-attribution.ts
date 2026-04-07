type RecoveryMetadataObject = Record<string, unknown>;

export type CheckoutEntrySource =
    | "worker_dashboard"
    | "worker_queue"
    | "agency_dashboard"
    | "agency_worker_profile"
    | "unknown";

export type CheckoutRecoveryOutcome =
    | "queued"
    | "sent"
    | "suppressed"
    | "failed"
    | "abandoned"
    | "skipped"
    | "unknown";

export type CheckoutFunnelStage =
    | "checkout_opened"
    | "recovery_step_1"
    | "recovery_step_2"
    | "recovery_step_3"
    | "recovery_suppressed"
    | "recovery_failed"
    | "checkout_abandoned"
    | "unknown";

export interface CheckoutRecoveryMetadataSnapshot {
    entrySource: CheckoutEntrySource;
    checkoutOpenedAt: string | null;
    latestRecoveryStep: number | null;
    latestRecoveryOutcome: CheckoutRecoveryOutcome;
    latestRecoveryAt: string | null;
    latestRecoveryReason: string | null;
    latestFunnelStage: CheckoutFunnelStage;
}

function asObject(value: unknown): RecoveryMetadataObject | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as RecoveryMetadataObject;
}

function extractStringField(value: unknown, key: string): string | null {
    const objectValue = asObject(value);
    if (!objectValue) {
        return null;
    }

    const field = objectValue[key];
    return typeof field === "string" && field.trim().length > 0 ? field.trim() : null;
}

function extractStep(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(1, Math.trunc(value));
    }

    if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return Math.max(1, parsed);
        }
    }

    return null;
}

export function normalizeCheckoutEntrySource(value: unknown): CheckoutEntrySource {
    if (typeof value !== "string") {
        return "unknown";
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "worker_dashboard") return "worker_dashboard";
    if (normalized === "worker_queue") return "worker_queue";
    if (normalized === "agency_dashboard") return "agency_dashboard";
    if (normalized === "agency_worker_profile") return "agency_worker_profile";
    return "unknown";
}

export function normalizeCheckoutRecoveryOutcome(value: unknown): CheckoutRecoveryOutcome {
    if (typeof value !== "string") {
        return "unknown";
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "queued") return "queued";
    if (normalized === "sent") return "sent";
    if (normalized === "suppressed") return "suppressed";
    if (normalized === "failed") return "failed";
    if (normalized === "abandoned") return "abandoned";
    if (normalized === "skipped") return "skipped";
    return "unknown";
}

export function normalizeCheckoutFunnelStage(value: unknown): CheckoutFunnelStage {
    if (typeof value !== "string") {
        return "unknown";
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "checkout_opened") return "checkout_opened";
    if (normalized === "recovery_step_1") return "recovery_step_1";
    if (normalized === "recovery_step_2") return "recovery_step_2";
    if (normalized === "recovery_step_3") return "recovery_step_3";
    if (normalized === "recovery_suppressed") return "recovery_suppressed";
    if (normalized === "recovery_failed") return "recovery_failed";
    if (normalized === "checkout_abandoned") return "checkout_abandoned";
    return "unknown";
}

export function deriveCheckoutEntrySource(params: {
    explicitSource?: string | null;
    isAgencyCheckout: boolean;
    successPath?: string | null;
    cancelPath?: string | null;
}): CheckoutEntrySource {
    const explicitSource = normalizeCheckoutEntrySource(params.explicitSource);
    if (explicitSource !== "unknown") {
        return explicitSource;
    }

    const joinedPaths = `${params.successPath || ""} ${params.cancelPath || ""}`;
    if (params.isAgencyCheckout) {
        if (joinedPaths.includes("/profile/agency/workers/")) {
            return "agency_worker_profile";
        }
        return "agency_dashboard";
    }

    if (joinedPaths.includes("/profile/worker/queue")) {
        return "worker_queue";
    }

    return "worker_dashboard";
}

export function buildCheckoutFunnelStage(params: {
    recoveryStep?: number | null;
    recoveryOutcome?: CheckoutRecoveryOutcome | null;
    fallbackStage?: CheckoutFunnelStage | null;
}): CheckoutFunnelStage {
    const outcome = params.recoveryOutcome || "unknown";
    if (outcome === "abandoned") return "checkout_abandoned";
    if (outcome === "suppressed") return "recovery_suppressed";
    if (outcome === "failed") return "recovery_failed";

    if (params.recoveryStep === 1) return "recovery_step_1";
    if (params.recoveryStep === 2) return "recovery_step_2";
    if (params.recoveryStep === 3) return "recovery_step_3";

    if (params.fallbackStage && params.fallbackStage !== "unknown") {
        return params.fallbackStage;
    }

    return "checkout_opened";
}

export function readCheckoutRecoveryMetadata(metadata: unknown): CheckoutRecoveryMetadataSnapshot {
    const metadataObject = asObject(metadata);
    const fallbackEntrySource = metadataObject?.agency_checkout === true
        || metadataObject?.agency_checkout === "true"
        ? "agency_dashboard"
        : "worker_dashboard";
    const entrySource = normalizeCheckoutEntrySource(extractStringField(metadata, "checkout_entry_source"))
        || fallbackEntrySource;
    const normalizedEntrySource = entrySource === "unknown" ? fallbackEntrySource : entrySource;

    const latestRecoveryStep = extractStep(metadataObject?.latest_recovery_step);
    const latestRecoveryOutcome = normalizeCheckoutRecoveryOutcome(metadataObject?.latest_recovery_outcome);
    const fallbackStage = normalizeCheckoutFunnelStage(metadataObject?.latest_funnel_stage);
    const latestFunnelStage = buildCheckoutFunnelStage({
        recoveryStep: latestRecoveryStep,
        recoveryOutcome: latestRecoveryOutcome,
        fallbackStage,
    });

    return {
        entrySource: normalizedEntrySource,
        checkoutOpenedAt:
            extractStringField(metadata, "checkout_opened_at")
            || extractStringField(metadata, "checkout_started_at"),
        latestRecoveryStep,
        latestRecoveryOutcome,
        latestRecoveryAt: extractStringField(metadata, "latest_recovery_at"),
        latestRecoveryReason: extractStringField(metadata, "latest_recovery_reason"),
        latestFunnelStage,
    };
}

export function getCheckoutEntrySourceLabel(source: CheckoutEntrySource): string {
    switch (source) {
        case "worker_queue":
            return "Worker queue";
        case "worker_dashboard":
            return "Worker dashboard";
        case "agency_worker_profile":
            return "Agency worker profile";
        case "agency_dashboard":
            return "Agency dashboard";
        default:
            return "Unknown source";
    }
}

export function getCheckoutRecoveryOutcomeLabel(outcome: CheckoutRecoveryOutcome): string {
    switch (outcome) {
        case "queued":
            return "Recovery queued";
        case "sent":
            return "Recovery sent";
        case "suppressed":
            return "Recovery suppressed";
        case "failed":
            return "Recovery failed";
        case "abandoned":
            return "Checkout abandoned";
        case "skipped":
            return "Recovery skipped";
        default:
            return "No recovery signal yet";
    }
}

export function getCheckoutFunnelStageLabel(stage: CheckoutFunnelStage): string {
    switch (stage) {
        case "checkout_opened":
            return "Checkout opened";
        case "recovery_step_1":
            return "Recovery step 1";
        case "recovery_step_2":
            return "Recovery step 2";
        case "recovery_step_3":
            return "Recovery step 3";
        case "recovery_suppressed":
            return "Recovery suppressed";
        case "recovery_failed":
            return "Recovery failed";
        case "checkout_abandoned":
            return "Checkout abandoned";
        default:
            return "Unknown stage";
    }
}
