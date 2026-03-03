import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";

// ─── Brain Monitor ──────────────────────────────────────────────────────────
// Autonomous AI that monitors platform health, creates GitHub Issues for bugs,
// and sends email reports. Runs every 6 hours via Vercel Cron.
//
// Replaces n8n Brain workflow — simpler, more reliable, no middleman.
// Uses: OpenAI Responses API (gpt-5.3-codex), GitHub API, Supabase, SMTP
//
// Auth: CRON_SECRET bearer token

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max (Vercel Pro)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = "b0r1v0j3/Workers-United";
const ADMIN_EMAIL = "cvetkovicborivoje@gmail.com";

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startTime = Date.now();
    const supabase = createAdminClient();
    const results = {
        dataCollected: false,
        aiAnalyzed: false,
        issuesCreated: 0,
        emailSent: false,
        reportSaved: false,
        error: null as string | null,
    };

    try {
        // ─── Step 1: Collect Platform Data ───────────────────────────────
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu";
        const collectRes = await fetch(`${baseUrl}/api/brain/collect`, {
            headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        });

        if (!collectRes.ok) {
            throw new Error(`Data collection failed: ${collectRes.status}`);
        }

        const platformData = await collectRes.json();
        results.dataCollected = true;

        // Pre-fetch existing issues for dedup (both open and closed)
        const existingIssues = await getExistingIssueTitles();
        const allResolvedTitles = existingIssues.closed;

        // ─── Step 2: AI Analysis (OpenAI Responses API for Codex) ────────
        if (!OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY not set");
        }

        // Load business facts from centralized config
        const { getBusinessFactsForAI } = await import("@/lib/platform-config");
        const businessFacts = await getBusinessFactsForAI();

        const today = new Date().toISOString().split("T")[0];
        const prompt = buildAnalysisPrompt(platformData, today, allResolvedTitles);

        // Codex models use /v1/responses (not /v1/chat/completions)
        const aiRes = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-5.3-codex",
                instructions: getSystemPrompt(businessFacts),
                input: prompt,
                text: {
                    format: { type: "json_object" },
                },
            }),
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            throw new Error(`OpenAI API failed: ${aiRes.status} - ${errText.substring(0, 300)}`);
        }

        const aiData = await aiRes.json();
        // Responses API returns output_text (not choices[0].message.content)
        const aiContent = aiData.output_text
            || aiData.output?.[0]?.content?.[0]?.text
            || JSON.stringify(aiData.output);

        if (!aiContent) {
            throw new Error("Empty AI response");
        }

        let analysis: BrainAnalysis;
        try {
            analysis = JSON.parse(aiContent);
        } catch {
            throw new Error(`Failed to parse AI response: ${aiContent.substring(0, 300)}`);
        }
        results.aiAnalyzed = true;

        // ─── Step 3: Create GitHub Issues ────────────────────────────────
        if (GITHUB_TOKEN && analysis.issues && analysis.issues.length > 0) {
            // Combine open + closed titles for dedup check
            const allExistingTitles = [...existingIssues.open, ...existingIssues.closed];

            for (const issue of analysis.issues.slice(0, 5)) { // Max 5 issues per run
                // Skip if similar issue already exists (open OR closed)
                const isDuplicate = allExistingTitles.some((t: string) =>
                    t.toLowerCase().includes(issue.title.toLowerCase().split(" ").slice(0, 3).join(" "))
                );
                if (isDuplicate) continue;

                const created = await createGitHubIssue(issue);
                if (created) results.issuesCreated++;
            }
        }

        // ─── Step 4: Send Email Report ───────────────────────────────────
        const emailHtml = buildEmailReport(analysis, platformData, results.issuesCreated, startTime);
        const emailResult = await sendEmail(
            ADMIN_EMAIL,
            `🧠 Brain Report — ${today} — ${analysis.healthScore}/100`,
            emailHtml
        );
        results.emailSent = emailResult.success;

        // ─── Step 5: Save Report to Database ─────────────────────────────
        await supabase.from("brain_reports").insert({
            report_type: "automated_6h",
            model: "gpt-5.3-codex",
            content: JSON.stringify({
                emailSummary: analysis.summary,
                structuredReport: analysis,
            }),
            findings_count: analysis.issues?.length || 0,
        });
        results.reportSaved = true;

        // ─── Step 6: Execute Brain Actions (auto-healing) ─────────────────
        if (analysis.actions && analysis.actions.length > 0) {
            for (const action of analysis.actions) {
                let actionStatus = "logged";

                // Auto-heal: retry failed emails
                if (action.type === "retry_email" && action.params?.email_id) {
                    try {
                        await supabase.from("email_queue")
                            .update({ status: "pending", error_message: null })
                            .eq("id", action.params.email_id);
                        actionStatus = "executed";
                    } catch { actionStatus = "failed"; }
                }

                // Auto-heal: clean stale data
                if (action.type === "clean_stale_data" && action.params?.table) {
                    actionStatus = "logged"; // Log only for safety
                }

                await supabase.from("brain_actions").insert({
                    action_type: action.type,
                    description: action.description,
                    params: action.params || {},
                    status: actionStatus,
                    source: "vercel-cron",
                });
            }
        }

        // ─── Step 7: Write learned facts to brain_memory ─────────────────
        if (analysis.brainFacts && analysis.brainFacts.length > 0) {
            for (const fact of analysis.brainFacts) {
                // Check if similar fact already exists
                const { data: existing } = await supabase
                    .from("brain_memory")
                    .select("id")
                    .eq("content", fact.content)
                    .limit(1);

                if (!existing || existing.length === 0) {
                    await supabase.from("brain_memory").insert({
                        category: fact.category,
                        content: fact.content,
                        confidence: 0.95, // System-analyzed = high confidence
                    });
                }
            }
            console.log(`[Brain] 🧠 Codex learned ${analysis.brainFacts.length} new facts`);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        return NextResponse.json({
            success: true,
            duration: `${duration}s`,
            ...results,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Brain Monitor] Error:", message);
        results.error = message;

        // Try to send error email
        try {
            await sendEmail(
                ADMIN_EMAIL,
                "🧠❌ Brain Monitor Failed",
                `<p>Brain Monitor failed at ${new Date().toISOString()}</p><p><strong>Error:</strong> ${message}</p><pre>${JSON.stringify(results, null, 2)}</pre>`
            );
        } catch { /* ignore email errors */ }

        return NextResponse.json({ errorMessage: message, ...results }, { status: 500 });
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BrainIssue {
    title: string;
    body: string;
    priority: "P0" | "P1" | "P2";
    labels: string[];
}

interface BrainAction {
    type: string;
    description: string;
    params?: Record<string, unknown>;
}

interface BrainAnalysis {
    summary: string;
    healthScore: number;
    operations: { name: string; emoji: string; status: string; findings: string[]; score: number }[];
    issues: BrainIssue[];
    improvements: { title: string; description: string; impact: string; effort: string }[];
    actions: BrainAction[];
    brainFacts: { category: string; content: string }[];
    selfImprovements: string[];
    metrics: {
        totalWorkers: number;
        totalEmployers: number;
        documentsVerified: number;
        emailDeliveryRate: string;
        funnelProgression: string;
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSystemPrompt(businessFacts: string): string {
    return `You are the Workers United Platform Brain — an autonomous AI system that runs 5 organized operations every morning.

Platform context (from live database — ALWAYS use these exact values):
${businessFacts}
- Flow: Signup → Profile → Documents (passport, diploma, photo) → AI Verification → Admin Approval → Payment → Queue → Job Match
- AI: Gemini 3.0 Flash for document verification (with fallback chain)
- WhatsApp: Direct OpenAI GPT-4o chatbot with memory + self-learning (brain_memory table)
- Email: Nodemailer + Google Workspace SMTP

You run 5 OPERATIONS. Analyze each separately:

## Operation 1: 🔧 SYSTEM HEALTH
- API errors, 5xx rates, failed endpoints
- Document verification success rate (Gemini)
- Database connection issues
- Cron job failures
- Status: OK / WARNING / CRITICAL

## Operation 2: 📊 FUNNEL ANALYSIS
- Where are users dropping off? (signup → profile → docs → verification → payment → queue)
- Conversion rates between stages
- Bottlenecks (e.g. 80% stop at document upload)
- Status: OK / WARNING / CRITICAL

## Operation 3: 📨 EMAIL & WHATSAPP
- Email delivery rate (sent vs failed)
- Failed emails that need retry (with email_id)
- WhatsApp response quality
- Status: OK / WARNING / CRITICAL

## Operation 4: 🛡️ CODE QUALITY
- Deprecated APIs still in use
- Security concerns in the data
- Missing or broken features visible from data
- Status: OK / WARNING / CRITICAL

## Operation 5: 💡 GROWTH & REVENUE
- What features/improvements would increase signups?
- What's causing users to NOT pay $9?
- Competitive advantages to build
- Revenue optimization ideas
- Status: SUGGESTIONS

Rules:
1. Only report REAL issues backed by data evidence
2. Don't report "no users yet" as a bug — it's just early stage
3. Each operation MUST have a status and findings
4. Issues: specific, actionable, with fix suggestions
5. De-duplicate across operations
6. healthScore 0-100 weighted: System Health 30%, Funnel 25%, Email/WA 20%, Code 15%, Growth 10%
7. Do NOT create issues for problems listed in RECENTLY_RESOLVED — those are already fixed
8. 0 admin approvals / 0 payments / 0 queued is EXPECTED for an early-stage platform — it is NOT a bug

## Operation 6: 🧠 SELF-IMPROVEMENT
- What capabilities are you MISSING that would make you more effective?
- What data do you WISH you had access to?
- What actions should you be able to EXECUTE (not just report)?
- What facts should the WhatsApp bot know? Generate them as brainFacts.
- Status: SUGGESTIONS

Respond in JSON:
{
  "summary": "2-3 sentence executive summary",
  "healthScore": 0-100,
  "operations": [
    {
      "name": "System Health",
      "emoji": "🔧",
      "status": "OK|WARNING|CRITICAL",
      "findings": ["finding 1", "finding 2"],
      "score": 0-100
    }
  ],
  "issues": [{ "title": "...", "body": "...", "priority": "P0|P1|P2", "labels": ["bug"|"enhancement"|"critical"], "operation": "System Health|Funnel|Email|Code|Growth" }],
  "improvements": [{ "title": "...", "description": "...", "impact": "high|medium|low", "effort": "easy|medium|hard" }],
  "actions": [{ "type": "retry_email|send_alert|clean_stale_data|log_observation", "description": "...", "params": {} }],
  "brainFacts": [{ "category": "pricing|process|documents|eligibility|faq|system_stats", "content": "Verified fact for WhatsApp bot to use" }],
  "selfImprovements": ["Capability I wish I had", "Data I need access to"],
  "metrics": { "totalWorkers": N, "totalEmployers": N, "documentsVerified": N, "emailDeliveryRate": "X%", "funnelProgression": "description" }
}`;
}

function buildAnalysisPrompt(data: Record<string, unknown>, date: string, resolvedTitles: string[]): string {
    const resolvedSection = resolvedTitles.length > 0
        ? `\n\nRECENTLY_RESOLVED (do NOT re-report these):\n${resolvedTitles.map(t => `- ${t}`).join("\n")}`
        : "";
    return `Morning Brain Report — ${date}

Run your 5 operations on this platform data:

${JSON.stringify(data, null, 2)}${resolvedSection}

Execute each operation (System Health, Funnel, Email/WhatsApp, Code Quality, Growth) and report findings.`;
}

async function getExistingIssueTitles(): Promise<{ open: string[]; closed: string[] }> {
    if (!GITHUB_TOKEN) return { open: [], closed: [] };
    const headers = { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" };
    try {
        // Fetch both open AND recently closed issues to prevent duplicates
        const [openRes, closedRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues?state=open&per_page=50&labels=brain-auto`, { headers }),
            fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues?state=closed&per_page=50&labels=brain-auto&sort=updated&direction=desc`, { headers }),
        ]);
        const openIssues = openRes.ok ? await openRes.json() : [];
        const closedIssues = closedRes.ok ? await closedRes.json() : [];
        return {
            open: openIssues.map((i: { title: string }) => i.title),
            closed: closedIssues.map((i: { title: string }) => i.title),
        };
    } catch {
        return { open: [], closed: [] };
    }
}

async function createGitHubIssue(issue: BrainIssue): Promise<boolean> {
    if (!GITHUB_TOKEN) return false;
    try {
        const labels = [
            ...issue.labels,
            `priority:${issue.priority}`,
            "brain-auto",
        ];

        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: issue.title,
                body: `${issue.body}\n\n---\n*🧠 Auto-generated by Brain Monitor (Vercel Cron)*`,
                labels,
            }),
        });

        if (!res.ok) {
            console.warn(`[Brain] GitHub Issue creation failed: ${res.status}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error("[Brain] GitHub Issue error:", err);
        return false;
    }
}

function buildEmailReport(
    analysis: BrainAnalysis,
    _platformData: Record<string, unknown>,
    issuesCreated: number,
    startTime: number
): string {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const scoreColor = analysis.healthScore >= 80 ? "#22c55e" : analysis.healthScore >= 50 ? "#f59e0b" : "#ef4444";

    const statusBadge = (s: string) => {
        const color = s === "OK" ? "#22c55e" : s === "WARNING" ? "#f59e0b" : s === "CRITICAL" ? "#ef4444" : "#3b82f6";
        return `<span style="background:${color};color:white;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold">${s}</span>`;
    };

    const operationsHtml = (analysis.operations || []).map(op => `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:8px 0">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <h3 style="margin:0;color:#1e3a5f">${op.emoji} ${op.name}</h3>
                ${statusBadge(op.status)}
            </div>
            <ul style="margin:8px 0;padding-left:20px;color:#475569">
                ${op.findings.map(f => `<li style="padding:2px 0">${f}</li>`).join("")}
            </ul>
        </div>
    `).join("");

    const issueRows = (analysis.issues || [])
        .map(i => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.priority}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.title}</td></tr>`)
        .join("");

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h1 style="color:#1e3a5f">🧠 Morning Brain Report</h1>
        <table style="width:100%;margin:20px 0"><tr>
            <td style="background:${scoreColor};color:white;padding:20px;border-radius:12px;text-align:center;width:120px">
                <div style="font-size:36px;font-weight:bold">${analysis.healthScore}</div>
                <div style="font-size:12px;opacity:0.8">Health Score</div>
            </td>
            <td style="padding:10px 20px;vertical-align:top">
                <p style="margin:5px 0"><strong>Workers:</strong> ${analysis.metrics?.totalWorkers || "N/A"}</p>
                <p style="margin:5px 0"><strong>Employers:</strong> ${analysis.metrics?.totalEmployers || "N/A"}</p>
                <p style="margin:5px 0"><strong>Email Rate:</strong> ${analysis.metrics?.emailDeliveryRate || "N/A"}</p>
                <p style="margin:5px 0"><strong>Duration:</strong> ${duration}s</p>
            </td>
        </tr></table>
        <p style="background:#f0f9ff;padding:12px;border-radius:8px;border-left:4px solid #3b82f6">${analysis.summary}</p>

        <h2 style="color:#1e3a5f;margin-top:24px">📋 Operations</h2>
        ${operationsHtml}

        ${analysis.issues?.length ? `
        <h2 style="color:#1e3a5f">🚨 Issues (${analysis.issues.length}) — ${issuesCreated} GitHub Issues created</h2>
        <table style="width:100%;border-collapse:collapse">
            <tr style="background:#fef2f2"><th style="padding:8px;text-align:left">Priority</th><th style="padding:8px;text-align:left">Title</th></tr>
            ${issueRows}
        </table>
        ` : "<p>✅ No issues found</p>"}
        ${analysis.improvements?.length ? `
        <h2 style="color:#1e3a5f">💡 Suggestions (${analysis.improvements.length})</h2>
        <table style="width:100%;border-collapse:collapse">
            <tr style="background:#f0fdf4"><th style="padding:8px;text-align:left">Idea</th><th style="padding:8px;text-align:left">Impact</th><th style="padding:8px;text-align:left">Effort</th></tr>
            ${analysis.improvements.map(i => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.title}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.impact}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.effort}</td></tr>`).join("")}
        </table>
        ` : ""}
        <hr style="margin:20px 0;border:1px solid #e2e8f0">
        <p style="font-size:12px;color:#94a3b8">Brain Monitor v2 — GPT-5.3 Codex — Vercel Cron — ${new Date().toISOString()}</p>
    </div>`;
}
