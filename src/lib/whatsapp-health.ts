type WhatsAppHealthState = "ok" | "degraded";

export interface WhatsAppFailedTemplateSample {
    templateName?: string | null;
    errorMessage?: string | null;
}

export interface WhatsAppTemplateHealthSummary {
    state: WhatsAppHealthState;
    details: string;
    totalOutboundTemplates: number;
    failedTemplates: number;
    platformFailures: number;
    recipientFailures: number;
}

const RECIPIENT_SIDE_PATTERNS = [
    /131026/i,
    /message undeliverable/i,
    /130497/i,
    /restricted from messaging users in this country/i,
];

function normalizeErrorMessage(errorMessage?: string | null): string | null {
    if (!errorMessage) return null;
    return errorMessage.trim().replace(/\s+/g, " ");
}

export function isRecipientSideWhatsAppFailure(errorMessage?: string | null): boolean {
    const normalized = normalizeErrorMessage(errorMessage);
    if (!normalized) return false;
    return RECIPIENT_SIDE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function summarizeWhatsAppTemplateHealth({
    totalOutboundTemplates,
    failedMessages,
}: {
    totalOutboundTemplates: number;
    failedMessages: WhatsAppFailedTemplateSample[];
}): WhatsAppTemplateHealthSummary {
    const failedTemplates = failedMessages.length;
    const recipientFailures = failedMessages.filter((message) =>
        isRecipientSideWhatsAppFailure(message.errorMessage)
    );
    const platformFailures = failedMessages.filter((message) =>
        !isRecipientSideWhatsAppFailure(message.errorMessage)
    );
    const successfulOrQueued = Math.max(totalOutboundTemplates - failedTemplates, 0);

    if (failedTemplates === 0) {
        return {
            state: "ok",
            details: totalOutboundTemplates > 0
                ? `Cloud API reachable; ${totalOutboundTemplates} outbound templates sent in the last 24h with no failures`
                : "Cloud API reachable; no outbound template traffic in the last 24h",
            totalOutboundTemplates,
            failedTemplates,
            platformFailures: 0,
            recipientFailures: 0,
        };
    }

    if (platformFailures.length === 0) {
        return {
            state: "ok",
            details: successfulOrQueued > 0
                ? `Cloud API reachable; ${successfulOrQueued}/${totalOutboundTemplates} outbound templates had no platform-side errors in the last 24h. ${recipientFailures.length} recipient-side delivery block(s) were excluded from health degradation`
                : `Cloud API reachable; only recipient-side delivery blocks (${recipientFailures.length}) were detected in the last 24h`,
            totalOutboundTemplates,
            failedTemplates,
            platformFailures: 0,
            recipientFailures: recipientFailures.length,
        };
    }

    const uniquePlatformErrors = Array.from(
        new Set(
            platformFailures
                .map((message) => normalizeErrorMessage(message.errorMessage))
                .filter((message): message is string => !!message)
        )
    ).slice(0, 2);

    const errorSummary = uniquePlatformErrors.length > 0
        ? ` Recent issue: ${uniquePlatformErrors.join(" | ")}`
        : "";
    const recipientSummary = recipientFailures.length > 0
        ? ` Recipient-side delivery blocks: ${recipientFailures.length}.`
        : "";

    return {
        state: "degraded",
        details: `Cloud API reachable, but ${platformFailures.length} platform-side template failure(s) were detected in the last 24h.${recipientSummary}${errorSummary}`.trim(),
        totalOutboundTemplates,
        failedTemplates,
        platformFailures: platformFailures.length,
        recipientFailures: recipientFailures.length,
    };
}
