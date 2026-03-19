import type { Json } from "@/lib/database.types";

export interface WhatsAppQualityMessage {
    direction?: string | null;
    role?: string | null;
    content?: string | null;
    created_at?: string | null;
    status?: string | null;
}

export interface WhatsAppConversationLike {
    phone?: string;
    messageCount?: number;
    messages?: WhatsAppQualityMessage[];
}

export type WhatsAppHandoffReason =
    | "payment_loop"
    | "frustration_loop"
    | "support_loop"
    | "unanswered_burst";

export interface WhatsAppConfusionAnalysis {
    triggered: boolean;
    reason: WhatsAppHandoffReason | null;
    score: number;
    inboundBurst: number;
    issueCount: number;
    frustratedCount: number;
    paymentIssueCount: number;
    snippets: string[];
}

export interface WhatsAppConfusionCase {
    phone: string;
    inboundCount: number;
    complaintCount: number;
    unansweredBurst: number;
    reason: WhatsAppHandoffReason | null;
    score: number;
    sample: string[];
}

export interface WhatsAppQualityActivityRow {
    action: string;
    created_at: string | null;
    details?: Json | Record<string, unknown> | null;
    user_id?: string | null;
}

export interface WhatsAppAutoHandoffSample {
    phone: string;
    reason: string;
    createdAt: string | null;
    preview: string;
    conversationId: string | null;
    profileId: string | null;
}

export interface WhatsAppQualitySnapshot {
    deterministicReplies: number;
    guardedReplies: number;
    languageFallbacks: number;
    autoHandoffs: number;
    openAIFailures: number;
    mediaFallbacks: number;
    recentAutoHandoffs: WhatsAppAutoHandoffSample[];
}

const ISSUE_PATTERNS = [
    /not working/i,
    /\bproblem\b/i,
    /\bissue\b/i,
    /\berror\b/i,
    /\bstuck\b/i,
    /\bcannot\b/i,
    /\bcan'?t\b/i,
    /\bhow\b/i,
    /\bwhy\b/i,
    /\bwhere\b/i,
    /\bwhat\b/i,
    /\blogin\b/i,
    /\bsign[\s-]?in\b/i,
    /\bsign[\s-]?up\b/i,
    /\bregister\b/i,
    /\bupload\b/i,
    /\bdocument\b/i,
    /\bpassport\b/i,
    /\bdiploma\b/i,
    /\bphoto\b/i,
    /\bpayment\b/i,
    /\bpay\b/i,
    /\bpaid\b/i,
    /\bcard\b/i,
    /\bcheckout\b/i,
    /\bapprove/i,
    /\bverification\b/i,
    /\bverify\b/i,
    /\bqueue\b/i,
    /\bsupport\b/i,
    /\bbug\b/i,
    /\bne radi\b/i,
    /\bproblem\b/i,
    /\buplata\b/i,
    /\bplacanje\b/i,
    /\bpla[ćc]anje\b/i,
    /\blogin\b/i,
    /\bprijava\b/i,
    /\bodobren/i,
    /\bverifik/i,
];

const FRUSTRATION_PATTERNS = [
    /\bstill\b/i,
    /\bagain\b/i,
    /\bagain and again\b/i,
    /\balready tried\b/i,
    /\bi tried\b/i,
    /\btried all\b/i,
    /\bpersists?\b/i,
    /\bsame problem\b/i,
    /\bdoesn'?t work\b/i,
    /\bnever works\b/i,
    /\burgent\b/i,
    /\bplease fix\b/i,
    /\bnot solved\b/i,
    /\bjo[sš] uvek\b/i,
    /\bopet\b/i,
    /\bisti problem\b/i,
    /\bne poma[zž]e\b/i,
    /\bne uspeva\b/i,
    /\bne radi\b/i,
    /\bjo[sš] nije\b/i,
];

const PAYMENT_PATTERNS = [
    /\bpayment\b/i,
    /\bpay\b/i,
    /\bpaid\b/i,
    /\bfee\b/i,
    /\bcard\b/i,
    /\bcheckout\b/i,
    /\bactivate\b/i,
    /\bactivation\b/i,
    /\buplata\b/i,
    /\bplat/i,
    /\bcheckout\b/i,
    /\bjob finder\b/i,
];

function normalizeMessageText(value: string | null | undefined): string | null {
    const normalized = (value || "").replace(/\s+/g, " ").trim();
    return normalized || null;
}

function isInboundMessage(message: WhatsAppQualityMessage): boolean {
    return message.direction === "inbound" || message.role === "user";
}

function isOutboundMessage(message: WhatsAppQualityMessage): boolean {
    return (message.direction === "outbound" || message.role === "assistant")
        && message.status !== "failed";
}

function asObject(value: Json | Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function extractString(details: Json | Record<string, unknown> | null | undefined, key: string): string | null {
    const objectValue = asObject(details);
    if (!objectValue) {
        return null;
    }

    const field = objectValue[key];
    return typeof field === "string" && field.trim() ? field.trim() : null;
}

function extractBoolean(details: Json | Record<string, unknown> | null | undefined, key: string): boolean {
    const objectValue = asObject(details);
    if (!objectValue) {
        return false;
    }

    return objectValue[key] === true;
}

export function humanizeWhatsAppHandoffReason(reason: WhatsAppHandoffReason | string | null | undefined): string {
    switch (reason) {
        case "payment_loop":
            return "Repeated payment problem";
        case "frustration_loop":
            return "Repeated unresolved issue";
        case "support_loop":
            return "Repeated support confusion";
        case "unanswered_burst":
            return "Unanswered inbound burst";
        default:
            return "WhatsApp quality handoff";
    }
}

export function analyzeWhatsAppConfusion(messages: WhatsAppQualityMessage[]): WhatsAppConfusionAnalysis {
    const normalizedMessages = messages
        .map((message) => ({
            ...message,
            content: normalizeMessageText(message.content),
        }))
        .filter((message) => message.content);

    if (normalizedMessages.length === 0) {
        return {
            triggered: false,
            reason: null,
            score: 0,
            inboundBurst: 0,
            issueCount: 0,
            frustratedCount: 0,
            paymentIssueCount: 0,
            snippets: [],
        };
    }

    const recentMessages = normalizedMessages.slice(-8);
    const inboundMessages = recentMessages.filter(isInboundMessage);
    const issueMessages = inboundMessages.filter((message) =>
        ISSUE_PATTERNS.some((pattern) => pattern.test(message.content || ""))
    );
    const frustratedMessages = inboundMessages.filter((message) =>
        FRUSTRATION_PATTERNS.some((pattern) => pattern.test(message.content || ""))
    );
    const paymentMessages = inboundMessages.filter((message) =>
        PAYMENT_PATTERNS.some((pattern) => pattern.test(message.content || ""))
    );

    let currentInboundBurst = 0;
    let maxInboundBurst = 0;
    for (const message of recentMessages) {
        if (isInboundMessage(message)) {
            currentInboundBurst += 1;
            if (currentInboundBurst > maxInboundBurst) {
                maxInboundBurst = currentInboundBurst;
            }
            continue;
        }

        if (isOutboundMessage(message)) {
            currentInboundBurst = 0;
        }
    }

    const score =
        issueMessages.length * 2
        + frustratedMessages.length * 2
        + (paymentMessages.length >= 2 ? 2 : 0)
        + (maxInboundBurst >= 2 ? 2 : 0);

    const triggered =
        score >= 6
        || (paymentMessages.length >= 2 && frustratedMessages.length >= 1)
        || (issueMessages.length >= 3 && maxInboundBurst >= 2);

    let reason: WhatsAppHandoffReason | null = null;
    if (triggered) {
        if (paymentMessages.length >= 2) {
            reason = "payment_loop";
        } else if (frustratedMessages.length >= 2) {
            reason = "frustration_loop";
        } else if (maxInboundBurst >= 2) {
            reason = "unanswered_burst";
        } else if (issueMessages.length >= 2) {
            reason = "support_loop";
        }
    }

    return {
        triggered,
        reason,
        score,
        inboundBurst: maxInboundBurst,
        issueCount: issueMessages.length,
        frustratedCount: frustratedMessages.length,
        paymentIssueCount: paymentMessages.length,
        snippets: issueMessages.slice(-2).map((message) => message.content || ""),
    };
}

export function detectWhatsAppConfusionCases(conversations: WhatsAppConversationLike[] | undefined): WhatsAppConfusionCase[] {
    if (!conversations?.length) {
        return [];
    }

    return conversations
        .map((conversation) => {
            const messages = conversation.messages || [];
            const analysis = analyzeWhatsAppConfusion(messages);
            if (!analysis.triggered) {
                return null;
            }

            const inboundCount = messages.filter(isInboundMessage).length;

            return {
                phone: conversation.phone || "unknown",
                inboundCount,
                complaintCount: analysis.issueCount,
                unansweredBurst: analysis.inboundBurst,
                reason: analysis.reason,
                score: analysis.score,
                sample: analysis.snippets,
            } satisfies WhatsAppConfusionCase;
        })
        .filter((entry): entry is WhatsAppConfusionCase => Boolean(entry))
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }
            if (right.unansweredBurst !== left.unansweredBurst) {
                return right.unansweredBurst - left.unansweredBurst;
            }
            return right.inboundCount - left.inboundCount;
        });
}

export function buildWhatsAppQualitySnapshot(activities: WhatsAppQualityActivityRow[]): WhatsAppQualitySnapshot {
    const guardedReplies = activities.filter((entry) =>
        entry.action === "whatsapp_gpt_response" && extractString(entry.details, "response_type") === "gpt_guarded"
    ).length;
    const languageFallbacks = activities.filter((entry) =>
        entry.action === "whatsapp_gpt_response" && extractBoolean(entry.details, "language_forced_to_fallback")
    ).length;
    const deterministicReplies = activities.filter((entry) => entry.action === "whatsapp_deterministic_response").length;
    const autoHandoffs = activities.filter((entry) => entry.action === "whatsapp_auto_handoff_created").length;
    const openAIFailures = activities.filter((entry) => entry.action === "whatsapp_openai_failed").length;
    const mediaFallbacks = activities.filter((entry) => entry.action === "whatsapp_media_fallback").length;

    const recentAutoHandoffs = activities
        .filter((entry) => entry.action === "whatsapp_auto_handoff_created")
        .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
        .slice(0, 5)
        .map((entry) => ({
            phone: extractString(entry.details, "phone") || "unknown",
            reason: humanizeWhatsAppHandoffReason(extractString(entry.details, "reason")),
            createdAt: entry.created_at,
            preview: extractString(entry.details, "preview") || "No preview captured",
            conversationId: extractString(entry.details, "conversation_id"),
            profileId: entry.user_id || null,
        }));

    return {
        deterministicReplies,
        guardedReplies,
        languageFallbacks,
        autoHandoffs,
        openAIFailures,
        mediaFallbacks,
        recentAutoHandoffs,
    };
}
