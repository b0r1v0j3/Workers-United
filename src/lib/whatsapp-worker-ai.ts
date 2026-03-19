import {
    buildCanonicalWhatsAppFacts,
    buildWorkerWhatsAppRules,
    resolveWhatsAppLanguageName,
} from "@/lib/whatsapp-brain";
import { formatWhatsAppHistory } from "@/lib/whatsapp-conversation-helpers";
import { buildWorkerPaymentSnapshot } from "@/lib/whatsapp-reply-guardrails";

export type WhatsAppIntent =
    | "job_intent"
    | "price"
    | "documents"
    | "support"
    | "status"
    | "general"
    | "off_topic"
    | "employer_inquiry"
    | "employer_hiring"
    | "employer_support";

export interface WhatsAppRouterDecision {
    intent: WhatsAppIntent;
    language: string;
    confidence: "high" | "medium" | "low";
    reason: string;
}

export interface WhatsAppConversationEntry {
    direction: string;
    content: string | null;
    created_at?: string | null;
}

export interface WhatsAppBrainMemoryEntry {
    category: string;
    content: string;
    confidence: number;
}

export interface WhatsAppWorkerSnapshotLike {
    status?: string | null;
    entry_fee_paid?: boolean | null;
    admin_approved?: boolean | null;
    queue_joined_at?: string | null;
    preferred_job?: string | null;
    nationality?: string | null;
    current_country?: string | null;
}

export interface WhatsAppProfileLike {
    email?: string | null;
    full_name?: string | null;
}

export interface WhatsAppOpenAITextCallOptions {
    model: string;
    instructions: string;
    input: string;
    json?: boolean;
    maxOutputTokens?: number;
}

interface ClassifyIntentParams {
    callResponseText: (options: WhatsAppOpenAITextCallOptions) => Promise<string>;
    model: string;
    message: string;
    normalizedPhone: string;
    workerRecord: WhatsAppWorkerSnapshotLike | null;
    profile: WhatsAppProfileLike | null;
    historyMessages: WhatsAppConversationEntry[];
    historyLimit?: number;
}

interface GenerateWorkerReplyParams {
    callResponseText: (options: WhatsAppOpenAITextCallOptions) => Promise<string>;
    model: string;
    message: string;
    normalizedPhone: string;
    workerRecord: WhatsAppWorkerSnapshotLike | null;
    profile: WhatsAppProfileLike | null;
    isAdmin: boolean;
    businessFacts: string;
    brainMemory: WhatsAppBrainMemoryEntry[];
    historyMessages: WhatsAppConversationEntry[];
    routerDecision: WhatsAppRouterDecision;
    historyLimit?: number;
}

const DEFAULT_ROUTER_HISTORY_LIMIT = 8;
const DEFAULT_RESPONSE_HISTORY_LIMIT = 12;

export function buildWorkerSnapshot(
    workerRecord: WhatsAppWorkerSnapshotLike | null,
    profile: WhatsAppProfileLike | null
): string {
    if (!workerRecord) {
        return [
            "Registered: no",
            "Worker status: not registered yet",
            buildWorkerPaymentSnapshot(null),
        ].join("\n");
    }

    return [
        "Registered: yes",
        `Worker status: ${workerRecord.status || "unknown"}`,
        `Entry fee paid: ${workerRecord.entry_fee_paid ? "yes" : "no"}`,
        `Admin approved: ${workerRecord.admin_approved ? "yes" : "no"}`,
        `Queue joined: ${workerRecord.queue_joined_at ? "yes" : "no"}`,
        buildWorkerPaymentSnapshot(workerRecord),
        `Preferred job: ${workerRecord.preferred_job || "not set"}`,
        `Nationality: ${workerRecord.nationality || "not set"}`,
        `Current country: ${workerRecord.current_country || "not set"}`,
        `Email: ${profile?.email || "not set"}`,
    ].join("\n");
}

export async function classifyWhatsAppIntent({
    callResponseText,
    model,
    message,
    normalizedPhone,
    workerRecord,
    profile,
    historyMessages,
    historyLimit = DEFAULT_ROUTER_HISTORY_LIMIT,
}: ClassifyIntentParams): Promise<WhatsAppRouterDecision> {
    const instructions = `You classify inbound WhatsApp messages for Workers United.

Return JSON only:
{
  "intent": "job_intent|price|documents|support|status|general|off_topic",
  "language": "short language name in English",
  "confidence": "high|medium|low",
  "reason": "short explanation"
}

Intent rules:
- job_intent: wants a job, asks how to start, how to register, or expresses interest in working in Europe
- price: asks about cost, payment, fee, refund
- documents: asks about passport, diploma, photo, upload, verification
- support: asks for help with a Workers United problem, complaint, support channel, or human assistance related to the platform
- status: asks about profile, approval, payment status, queue, verification, offer status
- general: greeting or vague first contact that is still about Workers United
- off_topic: unrelated civic issue, wrong number, spam, local complaint, or anything not actually about Workers United jobs/visa support

Important:
- If the user is talking about a local utility issue, accident, flooding, municipality, or unrelated complaint, classify as off_topic.
- Detect the actual language from the latest user message, not the phone country code.
- Registered worker context matters for status/support classification.
- A plain greeting like "hello", "hi", "pozdrav", or "dobar dan" without a clear role or request stays general.
- Keep reason short.`;

    const input = `Latest user message:
${message}

Phone: ${normalizedPhone}
Registered worker: ${workerRecord ? "yes" : "no"}
Worker snapshot:
${buildWorkerSnapshot(workerRecord, profile)}

Recent history:
${formatWhatsAppHistory(historyMessages, historyLimit)}`;

    try {
        const raw = await callResponseText({
            model,
            instructions,
            input,
            json: true,
            maxOutputTokens: 1024,
        });

        const parsed = JSON.parse(raw) as Partial<WhatsAppRouterDecision>;
        const intent: WhatsAppIntent = parsed.intent && [
            "job_intent",
            "price",
            "documents",
            "support",
            "status",
            "general",
            "off_topic",
        ].includes(parsed.intent) ? parsed.intent as WhatsAppIntent : "general";

        return {
            intent,
            language: parsed.language?.trim() || "English",
            confidence: parsed.confidence === "high" || parsed.confidence === "low" ? parsed.confidence : "medium",
            reason: parsed.reason?.trim() || "No reason returned",
        };
    } catch {
        return {
            intent: "general",
            language: resolveWhatsAppLanguageName(message),
            confidence: "low",
            reason: "Router fallback",
        };
    }
}

export async function generateWorkerWhatsAppReply({
    callResponseText,
    model,
    message,
    normalizedPhone,
    workerRecord,
    profile,
    isAdmin,
    businessFacts,
    brainMemory,
    historyMessages,
    routerDecision,
    historyLimit = DEFAULT_RESPONSE_HISTORY_LIMIT,
}: GenerateWorkerReplyParams): Promise<string> {
    const userName = profile?.full_name?.split(" ")[0] || "there";
    const workerSnapshot = buildWorkerSnapshot(workerRecord, profile);
    const memoryText = brainMemory.length > 0
        ? brainMemory.map((entry) => `- [${entry.category}] ${entry.content}`).join("\n")
        : "(No stored facts)";
    const canonicalFacts = buildCanonicalWhatsAppFacts();
    const instructions = `You are the official WhatsApp assistant for Workers United.

Personality:
- Friendly, warm, practical, and calm.
- Treat the person with respect and keep things easy to understand.
- If something is not available, say it simply and move them to the next safe step.

Canonical facts (never contradict these):
${canonicalFacts}

Platform config facts (secondary; if they conflict with canonical facts, follow canonical facts):
${businessFacts || "(No additional platform facts available)"}

Worker snapshot:
${workerSnapshot}

Useful stored facts:
${memoryText}

${buildWorkerWhatsAppRules({
        language: routerDecision.language,
        intent: routerDecision.intent,
        confidence: routerDecision.confidence,
        reason: routerDecision.reason,
        isAdmin,
    })}`;

    return callResponseText({
        model,
        instructions,
        input: `Phone: ${normalizedPhone}\nUser name: ${userName}\nLatest message:\n${message}\n\nRecent conversation:\n${formatWhatsAppHistory(historyMessages, historyLimit)}`,
        maxOutputTokens: 4096,
    });
}
