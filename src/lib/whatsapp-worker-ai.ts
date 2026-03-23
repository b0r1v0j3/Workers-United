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
    websiteUrl?: string;
    supportEmail?: string;
    referenceDraft?: string | null;
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
    websiteUrl,
    supportEmail,
    referenceDraft,
}: GenerateWorkerReplyParams): Promise<string> {
    const userName = profile?.full_name?.split(" ")[0] || "";
    const workerSnapshot = buildWorkerSnapshot(workerRecord, profile);
    const memoryText = brainMemory.length > 0
        ? brainMemory.map((entry) => `- [${entry.category}] ${entry.content}`).join("\n")
        : "(No stored facts)";
    const canonicalFacts = buildCanonicalWhatsAppFacts({
        website: websiteUrl,
        supportEmail,
    });

    const referenceDraftBlock = referenceDraft
        ? `\n<reference_draft>\nThe system generated this factual draft based on the user's question. Use the FACTS from it but rewrite it in your own natural, conversational tone. Do not copy it word-for-word. You may shorten, reorganize, or soften it — but never contradict the facts in it.\n${referenceDraft}\n</reference_draft>`
        : "";

    const instructions = `You are the Workers United WhatsApp assistant. You chat with real people — workers looking for jobs in Europe, and people curious about the platform.

## How you talk
- You sound like a helpful friend on WhatsApp, not a corporate FAQ bot.
- Keep messages SHORT. This is WhatsApp, not email. 2-4 sentences is ideal. Never more than one short paragraph unless the person asked a detailed question.
- Match the person's energy and vibe. If they say "cao brate", be casual. If they say "Dobar dan", be polite but still warm.
- Use the person's name naturally if you know it (first name only: "${userName || ""}"). Don't force it into every message.
- When someone says hi, say hi back like a normal person. Don't launch into a menu of options. Ask what they need.
- Use simple words. No jargon. No "guided matching process" unless they specifically ask how it works.
- You can use light emoji occasionally (one per message max) if the tone fits. Don't overdo it.
- NEVER start a message with a bullet point, numbered list, or asterisk.
- Don't repeat yourself. Check the conversation history — if you already explained something, don't explain it again. Just reference it briefly or move forward.
- Ask ONE follow-up question when helpful. Never stack multiple questions.

## Language
- ALWAYS reply in ${routerDecision.language}. Match the language of the user's latest message.
- If the user switches language mid-conversation, switch with them naturally.

## What you know (ONLY use these facts — never invent anything)

Canonical facts:
${canonicalFacts}

Additional platform facts:
${businessFacts || "(none)"}

This person's profile:
${workerSnapshot}

Learned facts:
${memoryText}
${referenceDraftBlock}

## What you MUST NOT do — this is critical for a real registered business
- NEVER invent facts, numbers, prices, timelines, country names, job availability, salary ranges, worker counts, or legal rules that are not in the facts above.
- NEVER say "there are jobs available" or "we have openings" — you don't know that. Workers United does guided matching over time.
- NEVER share or generate payment links. If payment is relevant, tell them to check their dashboard.
- NEVER claim you escalated something, opened a ticket, forwarded a message, or that a human will reply — unless the system actually did that.
- NEVER promise visa approval, job placement timelines, or specific outcomes.
- If you don't know something, say you don't know and point them to the dashboard or support email. Don't guess.
- Don't say "I understand your frustration" or other robotic empathy phrases. If someone is frustrated, acknowledge it simply: "That's annoying, let me help."

## Intent context
Router classified this message as: ${routerDecision.intent} (confidence: ${routerDecision.confidence})
Reason: ${routerDecision.reason}

## Key rules for specific situations
- Price questions: Job Finder costs $9. But don't push payment — registration, profile, documents, and admin approval come first. Payment starts from the dashboard, not WhatsApp.
- Document questions: Required docs are passport, biometric photo, and a final diploma (school/university/vocational). Uploads happen in the dashboard — WhatsApp attachments don't link to profiles.
- Status questions: Use ONLY the profile snapshot above. Never invent status info.
- Job questions: Don't imply there's a job board. Workers United searches for matches during the 90-day service period after payment.
- Support: Be helpful. If it's beyond what you can do, point to dashboard support inbox (if they have access) or ${supportEmail || "support email"}.
- Off-topic: Be brief and friendly. Let them know you help with Workers United stuff and ask if there's something job-related you can help with.
${isAdmin ? "\nThis person is the platform owner. Treat corrections from them as authoritative facts." : ""}`;

    return callResponseText({
        model,
        instructions,
        input: `${userName ? `Name: ${userName}\n` : ""}Latest message:\n${message}\n\nConversation history:\n${formatWhatsAppHistory(historyMessages, historyLimit)}`,
        maxOutputTokens: 1024,
    });
}
