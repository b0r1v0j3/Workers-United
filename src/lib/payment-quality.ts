type PaymentQualitySeverity = "success" | "warning" | "danger" | "neutral";

export type PaymentQualityOutcome =
    | "completed"
    | "active"
    | "expired"
    | "abandoned"
    | "issuer_declined"
    | "stripe_blocked"
    | "unknown";

export interface PaymentQualityClassification {
    outcome: PaymentQualityOutcome;
    label: string;
    detail: string;
    severity: PaymentQualitySeverity;
}

export interface PaymentQualityMarketSignals {
    workerCountry: string | null;
    billingCountry: string | null;
    cardCountry: string | null;
}

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function extractStringField(value: unknown, key: string): string | null {
    const objectValue = asObject(value);
    if (!objectValue) {
        return null;
    }

    const field = objectValue[key];
    return typeof field === "string" && field.trim() ? field.trim() : null;
}

function humanizeCode(value: string | null) {
    if (!value) {
        return null;
    }

    return value
        .replace(/_/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^\w/, (char) => char.toUpperCase());
}

function normalizeCountrySignal(value: string | null) {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function readPaymentQualityMarketSignals(metadata: unknown): PaymentQualityMarketSignals {
    return {
        workerCountry: normalizeCountrySignal(extractStringField(metadata, "worker_country")),
        billingCountry: normalizeCountrySignal(
            extractStringField(metadata, "stripe_billing_country")
            || extractStringField(metadata, "stripe_customer_country")
        ),
        cardCountry: normalizeCountrySignal(extractStringField(metadata, "stripe_card_country")),
    };
}

export function classifyEntryFeePaymentQuality(params: {
    status: string | null | undefined;
    metadata: unknown;
    hoursSinceCheckout?: number | null;
}): PaymentQualityClassification {
    const normalizedStatus = (params.status || "").trim().toLowerCase();
    const outcomeType = extractStringField(params.metadata, "stripe_outcome_type");
    const outcomeReason = extractStringField(params.metadata, "stripe_outcome_reason");
    const riskLevel = extractStringField(params.metadata, "stripe_risk_level");
    const failureCode = extractStringField(params.metadata, "stripe_failure_code");
    const declineCode = extractStringField(params.metadata, "stripe_decline_code");
    const failureMessage = extractStringField(params.metadata, "stripe_failure_message");
    const networkStatus = extractStringField(params.metadata, "stripe_network_status");
    const sessionStatus = extractStringField(params.metadata, "stripe_session_status");
    const expiredAt = extractStringField(params.metadata, "stripe_session_expired_at");

    if (normalizedStatus === "paid" || normalizedStatus === "completed") {
        return {
            outcome: "completed",
            label: "Paid",
            detail: "Entry fee was paid successfully.",
            severity: "success",
        };
    }

    if (
        outcomeType === "blocked"
        || outcomeReason === "highest_risk_level"
        || riskLevel === "highest"
    ) {
        const reason = humanizeCode(outcomeReason || riskLevel || failureCode) || "Highest risk level";
        return {
            outcome: "stripe_blocked",
            label: "Stripe blocked",
            detail: `Stripe risk controls blocked this attempt before authorization reached the bank (${reason}).`,
            severity: "danger",
        };
    }

    if (
        failureCode === "card_declined"
        || outcomeType === "issuer_declined"
        || networkStatus === "declined_by_network"
        || !!declineCode
    ) {
        const reason = humanizeCode(declineCode || outcomeReason || failureCode) || "Issuer declined";
        return {
            outcome: "issuer_declined",
            label: "Bank declined",
            detail: `The card issuer declined this payment attempt (${reason}).`,
            severity: "warning",
        };
    }

    if (expiredAt || sessionStatus === "expired") {
        return {
            outcome: "expired",
            label: "Checkout expired",
            detail: "Checkout was opened, but the Stripe session expired before payment completed.",
            severity: "warning",
        };
    }

    if (normalizedStatus === "abandoned") {
        return {
            outcome: "abandoned",
            label: "Abandoned checkout",
            detail: "Checkout was opened, but the worker never completed payment.",
            severity: "warning",
        };
    }

    if (normalizedStatus === "pending") {
        if (typeof params.hoursSinceCheckout === "number" && params.hoursSinceCheckout >= 72) {
            return {
                outcome: "abandoned",
                label: "Abandoned checkout",
                detail: "Checkout stayed unpaid long enough to fall outside the active recovery window.",
                severity: "warning",
            };
        }

        return {
            outcome: "active",
            label: "Active checkout",
            detail: "Checkout is still inside the active recovery window and can still complete.",
            severity: "neutral",
        };
    }

    return {
        outcome: "unknown",
        label: "Unknown payment state",
        detail: failureMessage || "Payment attempt exists, but it does not yet match a known quality bucket.",
        severity: "neutral",
    };
}
