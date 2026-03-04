import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveBrainFactsDedup } from "@/lib/brain-memory";

// ─── Brain Self-Improvement Engine ──────────────────────────────────────────
// Runs daily via Vercel Cron. Analyzes recent conversations and errors,
// generates new learnings, and saves them to brain_memory.
// The bot gets smarter every day with ZERO human intervention.
//
// Auth: Requires CRON_SECRET bearer token

export async function GET(request: NextRequest) {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
        // ─── 1. Gather recent conversations ──────────────────────────────
        const { data: recentMessages } = await supabase
            .from("whatsapp_messages")
            .select("phone_number, direction, content, created_at")
            .gte("created_at", dayAgo.toISOString())
            .order("created_at", { ascending: true })
            .limit(200);

        // Group messages by phone number into conversations
        const conversations: Record<string, { role: string; text: string }[]> = {};
        for (const msg of recentMessages || []) {
            if (!conversations[msg.phone_number]) conversations[msg.phone_number] = [];
            conversations[msg.phone_number].push({
                role: msg.direction === "inbound" ? "user" : "assistant",
                text: msg.content || "",
            });
        }

        const conversationSummaries = Object.entries(conversations).map(([phone, msgs]) => {
            return `--- Conversation with ${phone} ---\n${msgs.map(m => `${m.role}: ${m.text}`).join("\n")}`;
        }).join("\n\n");

        // ─── 2. Gather recent errors ─────────────────────────────────────
        const { data: recentErrors } = await supabase
            .from("activity_log")
            .select("action, category, details, created_at")
            .eq("status", "error")
            .gte("created_at", dayAgo.toISOString())
            .order("created_at", { ascending: false })
            .limit(50);

        const errorSummary = (recentErrors || []).map(e =>
            `[${e.action}] ${JSON.stringify(e.details)}`
        ).join("\n") || "(No errors in the last 24 hours)";

        // ─── 3. Scan FULL system data (candidates, docs, payments, config) ─
        const [
            { data: candidates },
            { data: documents },
            { data: payments },
            { data: platformConfig },
            { data: employers },
            { data: jobRequests },
        ] = await Promise.all([
            supabase.from("candidates").select("status, admin_approved, entry_fee_paid, queue_joined_at, created_at").limit(500),
            supabase.from("candidate_documents").select("document_type, status, reject_reason").limit(500),
            supabase.from("payments").select("payment_type, status, amount").limit(500),
            supabase.from("platform_config").select("key, value, description"),
            supabase.from("employers").select("status, country, industry").limit(100),
            supabase.from("job_requests").select("status, industry, country, positions_available").limit(100),
        ]);

        // Build system snapshot
        const statusCounts: Record<string, number> = {};
        (candidates || []).forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

        const docStatusCounts: Record<string, number> = {};
        (documents || []).forEach(d => { docStatusCounts[d.status] = (docStatusCounts[d.status] || 0) + 1; });

        const paymentInfo = (payments || []).reduce((acc, p) => {
            if (!acc[p.payment_type]) acc[p.payment_type] = { count: 0, amounts: new Set<number>() };
            acc[p.payment_type].count++;
            if (p.amount) acc[p.payment_type].amounts.add(p.amount);
            return acc;
        }, {} as Record<string, { count: number; amounts: Set<number> }>);

        const configFacts = (platformConfig || []).map(c => `${c.key}: ${c.value} (${c.description || "no description"})`).join("\n");

        const systemSnapshot = `
CANDIDATE STATUSES: ${JSON.stringify(statusCounts)}
Total candidates: ${(candidates || []).length}
Approved: ${(candidates || []).filter(c => c.admin_approved).length}
Paid entry fee: ${(candidates || []).filter(c => c.entry_fee_paid).length}

DOCUMENTS: ${JSON.stringify(docStatusCounts)}
Document types: ${[...new Set((documents || []).map(d => d.document_type))].join(", ")}
Common reject reasons: ${[...new Set((documents || []).filter(d => d.reject_reason).map(d => d.reject_reason))].slice(0, 5).join("; ")}

PAYMENTS: ${Object.entries(paymentInfo).map(([type, info]) => `${type}: ${info.count} payments, amounts: ${[...info.amounts].join("/")}`).join("; ")}

PLATFORM CONFIG:
${configFacts || "(No config found)"}

EMPLOYERS: ${(employers || []).length} total, countries: ${[...new Set((employers || []).map(e => e.country))].join(", ")}
JOB REQUESTS: ${(jobRequests || []).length} total, industries: ${[...new Set((jobRequests || []).map(j => j.industry))].join(", ")}
Available positions: ${(jobRequests || []).reduce((sum, j) => sum + (j.positions_available || 0), 0)}`;

        // ─── 4. Get existing brain memory ────────────────────────────────
        const { data: existingMemory } = await supabase
            .from("brain_memory")
            .select("category, content")
            .order("created_at", { ascending: false })
            .limit(50);

        const existingFacts = (existingMemory || []).map(m =>
            `[${m.category}] ${m.content}`
        ).join("\n") || "(Empty brain)";

        // ─── 5. Ask Codex to analyze system + conversations and learn ─────
        // Uses GPT-5.3 Codex (Responses API) — same model as Brain Monitor
        const analysisPrompt = `You are the Brain Improvement Engine for Workers United, a legal international hiring platform.

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

        // Call Codex via Responses API (not chat/completions)
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

        // ─── 6. Parse and save learnings ─────────────────────────────────
        const newLearnings: { category: string; content: string }[] = [];
        let saveStats = { inserted: 0, updated: 0, skipped: 0 };

        if (!response.includes("NO_NEW_LEARNINGS")) {
            const lines = response.split("\n").filter((l: string) => l.startsWith("LEARN|"));
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
                        confidence: 0.7, // Auto-learned facts start with lower confidence
                    }))
                );
                console.log(
                    `[Brain] 🧠 Learning save stats — inserted: ${saveStats.inserted}, updated: ${saveStats.updated}, skipped: ${saveStats.skipped}`
                );
            }
        }

        // ─── 7. Log the improvement run ──────────────────────────────────
        await supabase.from("activity_log").insert({
            user_id: "system",
            action: "brain_self_improvement",
            category: "system",
            status: "success",
            details: {
                conversations_analyzed: Object.keys(conversations).length,
                messages_analyzed: recentMessages?.length || 0,
                errors_analyzed: recentErrors?.length || 0,
                new_learnings: newLearnings.length,
                learning_save_stats: saveStats,
                learnings: newLearnings,
            },
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
        return NextResponse.json({
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
