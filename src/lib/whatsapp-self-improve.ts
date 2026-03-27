import { callClaudeResponseText } from "@/lib/claude-response-text";

// ─── WhatsApp Conversation Self-Improvement ─────────────────────────────────
// Analyzes recent conversations to discover patterns the bot can learn from.
// Runs as a daily cron — NOT triggered by individual users.
//
// What it detects:
// - Repeated questions across users → FAQ gaps
// - Questions where bot had no good answer → knowledge gaps
// - User re-asks after bot reply → poor response quality
// - Common first messages → greeting optimization

export interface ConversationThread {
    phone: string;
    messages: Array<{
        direction: string;
        content: string;
        created_at: string;
    }>;
}

export interface SelfImprovementInsight {
    type: "faq_gap" | "knowledge_gap" | "poor_response" | "common_question" | "process_clarification";
    category: string;
    content: string;
    confidence: number;
    evidence: string;
}

export interface SelfImprovementReport {
    analyzed_threads: number;
    analyzed_messages: number;
    insights: SelfImprovementInsight[];
    summary: string;
}

const ANALYSIS_MODEL = "claude-sonnet-4-6";
const MAX_THREADS_PER_ANALYSIS = 30;
const MAX_MESSAGES_PER_THREAD = 20;

interface ConversationQueryRow {
    phone_number?: string | null;
    direction?: string | null;
    content?: string | null;
    created_at?: string | null;
}

type ConversationQueryResult = PromiseLike<{
    data?: ConversationQueryRow[] | null;
    error?: { message?: string | null } | null;
}>;

type DbClient = {
    from: (table: string) => unknown;
};

export async function loadRecentConversations(
    admin: DbClient,
    hoursBack: number = 48
): Promise<ConversationThread[]> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const messagesTable = admin.from("whatsapp_messages") as {
        select: (columns: string) => {
            gte: (column: string, value: string) => {
                in: (column: string, values: string[]) => {
                    not: (column: string, operator: string, value: null) => {
                        order: (column: string, options: { ascending: boolean }) => {
                            limit: (count: number) => ConversationQueryResult;
                        };
                    };
                };
            };
        };
    };

    const { data, error } = await messagesTable
        .select("phone_number, direction, content, created_at")
        .gte("created_at", since)
        .in("direction", ["inbound", "outbound"])
        .not("content", "is", null)
        .order("created_at", { ascending: true })
        .limit(500);

    if (error) {
        throw new Error(`Failed to load conversations: ${error.message}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // Group by phone number into threads
    const threadMap = new Map<string, ConversationThread>();

    for (const row of data) {
        const phone = typeof row.phone_number === "string" ? row.phone_number : "";
        const content = typeof row.content === "string" ? row.content : "";
        const direction = typeof row.direction === "string" ? row.direction : "";
        const createdAt = typeof row.created_at === "string" ? row.created_at : "";
        if (!phone || !content) continue;

        // Skip template messages
        if (content.startsWith("[Template:")) continue;

        if (!threadMap.has(phone)) {
            threadMap.set(phone, { phone, messages: [] });
        }
        const thread = threadMap.get(phone)!;

        if (thread.messages.length < MAX_MESSAGES_PER_THREAD) {
            thread.messages.push({
                direction,
                content,
                created_at: createdAt,
            });
        }
    }

    // Only include threads with at least 1 inbound message
    const threads = Array.from(threadMap.values()).filter(
        (t) => t.messages.some((m) => m.direction === "inbound")
    );

    // Limit total threads analyzed
    return threads.slice(0, MAX_THREADS_PER_ANALYSIS);
}

function formatThreadsForAnalysis(threads: ConversationThread[]): string {
    return threads
        .map((thread, i) => {
            const msgs = thread.messages
                .map((m) => `  [${m.direction}] ${m.content}`)
                .join("\n");
            return `--- Thread ${i + 1} (${thread.phone.slice(0, 4)}***) ---\n${msgs}`;
        })
        .join("\n\n");
}

export async function analyzeConversations(
    apiKey: string,
    threads: ConversationThread[],
    existingFacts: string[]
): Promise<SelfImprovementReport> {
    if (threads.length === 0) {
        return {
            analyzed_threads: 0,
            analyzed_messages: 0,
            insights: [],
            summary: "No conversations to analyze.",
        };
    }

    const totalMessages = threads.reduce((sum, t) => sum + t.messages.length, 0);
    const formattedThreads = formatThreadsForAnalysis(threads);

    const existingFactsList = existingFacts.length > 0
        ? existingFacts.map((f) => `- ${f}`).join("\n")
        : "(none)";

    const instructions = `You analyze WhatsApp conversation threads for Workers United to find patterns that improve the bot's knowledge.

Workers United is a real job placement platform connecting workers with European employers. The bot answers questions via WhatsApp.

## Your task
Look at recent conversations and identify:

1. **FAQ gaps** — multiple users asked the same type of question. The bot should have a better prepared answer.
2. **Knowledge gaps** — a user asked something the bot couldn't answer well, and it's a reasonable question about the platform.
3. **Poor responses** — the user had to re-ask or seemed confused after the bot's reply. The bot's answer was unclear or unhelpful.
4. **Common questions** — frequently asked questions that should be part of the bot's core knowledge.
5. **Process clarifications** — things the bot explained in a confusing way that should be clearer.

## Rules
- Only report genuinely useful, reusable insights. Not obvious stuff.
- Each insight must be a concrete, factual statement the bot can use in future conversations.
- Do NOT include personal info (names, phone numbers, specific user details).
- Do NOT invent facts about Workers United. Only report what you can infer from conversations.
- Max 5 insights. Quality over quantity. If nothing useful, return empty.
- Confidence: 0.7-0.9 (higher = more evidence from multiple conversations)

## Already known facts
${existingFactsList}

## Output format (JSON only)
{
  "insights": [
    {
      "type": "faq_gap|knowledge_gap|poor_response|common_question|process_clarification",
      "category": "faq|process|documents|eligibility|common_question|pricing",
      "content": "The factual statement to add to bot knowledge",
      "confidence": 0.7,
      "evidence": "Brief description of which conversations showed this pattern"
    }
  ],
  "summary": "1-2 sentence summary of what was found"
}`;

    const input = `Analyze these ${threads.length} conversation threads (${totalMessages} messages) from the last 48 hours:\n\n${formattedThreads}`;

    const raw = await callClaudeResponseText(apiKey, {
        model: ANALYSIS_MODEL,
        instructions,
        input,
        maxOutputTokens: 2048,
    });

    try {
        const parsed = JSON.parse(raw);
        const insights: SelfImprovementInsight[] = [];

        if (Array.isArray(parsed.insights)) {
            for (const insight of parsed.insights) {
                if (
                    typeof insight.content === "string" &&
                    insight.content.trim() &&
                    typeof insight.category === "string" &&
                    typeof insight.type === "string"
                ) {
                    insights.push({
                        type: insight.type,
                        category: insight.category,
                        content: insight.content.trim(),
                        confidence: Math.min(0.85, Math.max(0.6, Number(insight.confidence) || 0.7)),
                        evidence: typeof insight.evidence === "string" ? insight.evidence.trim() : "",
                    });
                }
            }
        }

        return {
            analyzed_threads: threads.length,
            analyzed_messages: totalMessages,
            insights,
            summary: typeof parsed.summary === "string" ? parsed.summary : "Analysis complete.",
        };
    } catch {
        return {
            analyzed_threads: threads.length,
            analyzed_messages: totalMessages,
            insights: [],
            summary: `Analysis returned unparseable response: ${raw.substring(0, 200)}`,
        };
    }
}
