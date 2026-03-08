import { NextRequest, NextResponse } from "next/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { saveBrainFactsDedup } from "@/lib/brain-memory";
import type { Json } from "@/lib/database.types";

function assertNoError(error: { message: string } | null, context: string): void {
    if (error) {
        throw new Error(`${context}: ${error.message}`);
    }
}

async function logBrainRun(
    supabase: ReturnType<typeof createTypedAdminClient>,
    status: "ok" | "error",
    details: Record<string, unknown>
): Promise<void> {
    const { error } = await supabase.from("user_activity").insert({
        user_id: null,
        action: "brain_self_improvement",
        category: "system",
        status,
        details: details as Json,
    });

    assertNoError(error, "Failed to log brain self-improvement run");
}

// ─── Brain Self-Improvement Engine ──────────────────────────────────────────
// Runs daily via Vercel Cron. Analyzes recent conversations and errors,
// generates new learnings, and saves them to brain_memory.
//
// Auth: Requires CRON_SECRET bearer token

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const supabase = createTypedAdminClient();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
        const { data: recentMessages, error: recentMessagesError } = await supabase
            .from("whatsapp_messages")
            .select("phone_number, direction, content, created_at")
            .gte("created_at", dayAgo.toISOString())
            .order("created_at", { ascending: true })
            .limit(200);

        assertNoError(recentMessagesError, "Failed to load recent WhatsApp messages");

        const conversations: Record<string, { role: string; text: string }[]> = {};
        for (const msg of recentMessages || []) {
            if (!conversations[msg.phone_number]) {
                conversations[msg.phone_number] = [];
            }
            conversations[msg.phone_number].push({
                role: msg.direction === "inbound" ? "user" : "assistant",
                text: msg.content || "",
            });
        }

        const conversationSummaries = Object.entries(conversations)
            .map(([phone, msgs]) => `--- Conversation with ${phone} ---\n${msgs.map((msg) => `${msg.role}: ${msg.text}`).join("\n")}`)
            .join("\n\n");

        const { data: recentErrors, error: recentErrorsError } = await supabase
            .from("user_activity")
            .select("action, category, details, created_at")
            .eq("status", "error")
            .gte("created_at", dayAgo.toISOString())
            .order("created_at", { ascending: false })
            .limit(50);

        assertNoError(recentErrorsError, "Failed to load recent error telemetry");

        const errorSummary = (recentErrors || [])
            .map((entry) => `[${entry.action}] ${JSON.stringify(entry.details)}`)
            .join("\n") || "(No errors in the last 24 hours)";

        const [
            workerResult,
            documentResult,
            paymentResult,
            platformConfigResult,
            employerResult,
            jobRequestResult,
            existingMemoryResult,
        ] = await Promise.all([
            supabase
                .from("worker_onboarding")
                .select("status, admin_approved, entry_fee_paid, queue_joined_at, job_search_active")
                .limit(500),
            supabase
                .from("worker_documents")
                .select("document_type, status, reject_reason")
                .limit(500),
            supabase
                .from("payments")
                .select("payment_type, status, amount, amount_cents")
                .limit(500),
            supabase
                .from("platform_config")
                .select("key, value, description"),
            supabase
                .from("employers")
                .select("status, country, industry")
                .limit(100),
            supabase
                .from("job_requests")
                .select("status, industry, destination_country, positions_count, positions_filled")
                .limit(100),
            supabase
                .from("brain_memory")
                .select("category, content")
                .order("created_at", { ascending: false })
                .limit(50),
        ]);

        assertNoError(workerResult.error, "Failed to load workers for brain improve");
        assertNoError(documentResult.error, "Failed to load documents for brain improve");
        assertNoError(paymentResult.error, "Failed to load payments for brain improve");
        assertNoError(platformConfigResult.error, "Failed to load platform config for brain improve");
        assertNoError(employerResult.error, "Failed to load employers for brain improve");
        assertNoError(jobRequestResult.error, "Failed to load job requests for brain improve");
        assertNoError(existingMemoryResult.error, "Failed to load existing brain memory");

        const workerRows = workerResult.data || [];
        const documents = documentResult.data || [];
        const payments = paymentResult.data || [];
        const platformConfig = platformConfigResult.data || [];
        const employers = employerResult.data || [];
        const jobRequests = jobRequestResult.data || [];
        const existingMemory = existingMemoryResult.data || [];

        const statusCounts: Record<string, number> = {};
        for (const workerRecord of workerRows) {
            const status = workerRecord.status || "unknown";
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }

        const docStatusCounts: Record<string, number> = {};
        for (const document of documents) {
            const status = document.status || "unknown";
            docStatusCounts[status] = (docStatusCounts[status] || 0) + 1;
        }

        const paymentInfo = payments.reduce((acc, payment) => {
            if (!acc[payment.payment_type]) {
                acc[payment.payment_type] = { count: 0, amounts: new Set<number>() };
            }
            acc[payment.payment_type].count++;
            const amount = payment.amount ?? (typeof payment.amount_cents === "number" ? payment.amount_cents / 100 : null);
            if (typeof amount === "number") {
                acc[payment.payment_type].amounts.add(amount);
            }
            return acc;
        }, {} as Record<string, { count: number; amounts: Set<number> }>);

        const configFacts = platformConfig
            .map((entry) => `${entry.key}: ${entry.value} (${entry.description || "no description"})`)
            .join("\n");

        const openPositions = jobRequests.reduce((sum, job) => {
            const positionsCount = typeof job.positions_count === "number" ? job.positions_count : 0;
            const positionsFilled = typeof job.positions_filled === "number" ? job.positions_filled : 0;
            return sum + Math.max(positionsCount - positionsFilled, 0);
        }, 0);

        const systemSnapshot = `
WORKER ONBOARDING STATUSES: ${JSON.stringify(statusCounts)}
Total worker onboarding records: ${workerRows.length}
Approved: ${workerRows.filter((workerRecord) => workerRecord.admin_approved).length}
Paid entry fee: ${workerRows.filter((workerRecord) => workerRecord.entry_fee_paid).length}
Job search active: ${workerRows.filter((workerRecord) => workerRecord.job_search_active).length}

DOCUMENTS: ${JSON.stringify(docStatusCounts)}
Document types: ${[...new Set(documents.map((document) => document.document_type))].join(", ")}
Common reject reasons: ${[...new Set(documents.filter((document) => document.reject_reason).map((document) => document.reject_reason))].slice(0, 5).join("; ")}

PAYMENTS: ${Object.entries(paymentInfo).map(([type, info]) => `${type}: ${info.count} payments, amounts: ${[...info.amounts].join("/")}`).join("; ")}

PLATFORM CONFIG:
${configFacts || "(No config found)"}

EMPLOYERS: ${employers.length} total, countries: ${[...new Set(employers.map((employer) => employer.country).filter(Boolean))].join(", ")}
JOB REQUESTS: ${jobRequests.length} total, industries: ${[...new Set(jobRequests.map((job) => job.industry).filter(Boolean))].join(", ")}
Open positions remaining: ${openPositions}`;

        const existingFacts = existingMemory
            .map((entry) => `[${entry.category}] ${entry.content}`)
            .join("\n") || "(Empty brain)";

        const analysisPrompt = `You are the Brain Improvement Engine for Workers United, a legal international hiring platform.
Terminology rule: In generated facts, use only the canonical platform terms "worker" and "employer".

Your job is to analyze the FULL SYSTEM DATA and recent conversations, then generate NEW facts to remember. The system data contains the TRUTH — use it to generate accurate facts.

EXISTING KNOWLEDGE (what you already know — do NOT repeat these):
${existingFacts}

FULL SYSTEM DATA (this is the source of truth):
${systemSnapshot}

RECENT CONVERSATIONS (last 24 hours):
${conversationSummaries || "(No conversations)"}

RECENT ERRORS (last 24 hours):
${errorSummary}

TASKS:
1. Analyze the SYSTEM DATA — extract key business facts (prices, statuses, processes, document types, available jobs)
2. Analyze conversations — what questions did users ask? What did you answer wrong?
3. What common questions keep coming up?
4. What errors occurred and how could they be prevented?
5. Are any existing memories OUTDATED based on current system data? If so, generate a corrected version.

OUTPUT FORMAT:
For each new learning, output one line in this EXACT format:
LEARN|category|fact

Categories: pricing, process, documents, eligibility, faq, company_info, legal, error_fix, common_question, system_stats

RULES:
- PRIORITIZE facts from system data — these are verified and accurate
- Only output GENUINELY NEW facts not already in your existing knowledge
- Generate facts that would help answer user questions correctly
- If system data contradicts existing knowledge, output the corrected fact
- If users frequently ask the same question, summarize it as a common_question
- For errors, suggest preventions as error_fix
- Output NO_NEW_LEARNINGS if nothing is new
- Maximum 15 learnings per analysis`;

        const aiRes = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-5.3-codex",
                instructions: analysisPrompt,
                input: "Analyze the data above and generate new learnings.",
            }),
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            throw new Error(`Codex API failed: ${aiRes.status} - ${errText.substring(0, 300)}`);
        }

        const aiData = await aiRes.json();
        const response = aiData.output_text
            || aiData.output?.[0]?.content?.[0]?.text
            || "";

        console.log("[Brain] 🧠 Codex self-improvement analysis:", response);

        const newLearnings: { category: string; content: string }[] = [];
        let saveStats = { inserted: 0, updated: 0, skipped: 0 };

        if (!response.includes("NO_NEW_LEARNINGS")) {
            const lines = response.split("\n").filter((line: string) => line.startsWith("LEARN|"));
            for (const line of lines) {
                const parts = line.split("|");
                if (parts.length >= 3) {
                    newLearnings.push({
                        category: parts[1].trim(),
                        content: parts.slice(2).join("|").trim(),
                    });
                }
            }

            if (newLearnings.length > 0) {
                saveStats = await saveBrainFactsDedup(
                    supabase,
                    newLearnings.map((learning) => ({
                        category: learning.category,
                        content: learning.content,
                        confidence: 0.7,
                    }))
                );
            }
        }

        await logBrainRun(supabase, "ok", {
            conversations_analyzed: Object.keys(conversations).length,
            messages_analyzed: recentMessages?.length || 0,
            errors_analyzed: recentErrors?.length || 0,
            new_learnings: newLearnings.length,
            learning_save_stats: saveStats,
            learnings: newLearnings,
        });

        return NextResponse.json({
            status: "success",
            analyzed: {
                conversations: Object.keys(conversations).length,
                messages: recentMessages?.length || 0,
                errors: recentErrors?.length || 0,
            },
            newLearnings: newLearnings.length,
            saved: saveStats,
            learnings: newLearnings,
        });
    } catch (error) {
        console.error("[Brain] Self-improvement error:", error);

        try {
            await logBrainRun(supabase, "error", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
        } catch (logError) {
            console.error("[Brain] Failed to log self-improvement error:", logError);
        }

        return NextResponse.json({
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
