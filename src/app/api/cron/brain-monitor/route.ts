import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";

// ─── Brain Monitor ──────────────────────────────────────────────────────────
// Autonomous AI that monitors platform health, creates GitHub Issues for bugs,
// and sends email reports. Runs every 6 hours via Vercel Cron.
//
// Replaces n8n Brain workflow — simpler, more reliable, no middleman.
// Uses: OpenAI API (GPT-4o), GitHub API, Supabase, SMTP
//
// Auth: CRON_SECRET bearer token

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max (Vercel Pro)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = "b0r1v0j3/Workers-United";
const ADMIN_EMAIL = "contact@workersunited.eu";

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

        // ─── Step 2: AI Analysis ─────────────────────────────────────────
        if (!OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY not set");
        }

        const today = new Date().toISOString().split("T")[0];
        const prompt = buildAnalysisPrompt(platformData, today);

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: getSystemPrompt() },
                    { role: "user", content: prompt },
                ],
                temperature: 0.3,
                response_format: { type: "json_object" },
            }),
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            throw new Error(`OpenAI API failed: ${aiRes.status} - ${errText.substring(0, 200)}`);
        }

        const aiData = await aiRes.json();
        const aiContent = aiData.choices?.[0]?.message?.content;

        if (!aiContent) {
            throw new Error("Empty AI response");
        }

        let analysis: BrainAnalysis;
        try {
            analysis = JSON.parse(aiContent);
        } catch {
            throw new Error(`Failed to parse AI response: ${aiContent.substring(0, 200)}`);
        }
        results.aiAnalyzed = true;

        // ─── Step 3: Create GitHub Issues ────────────────────────────────
        if (GITHUB_TOKEN && analysis.issues && analysis.issues.length > 0) {
            // Fetch existing open issues to avoid duplicates
            const existingTitles = await getExistingIssueTitles();

            for (const issue of analysis.issues.slice(0, 5)) { // Max 5 issues per run
                // Skip if similar issue already exists
                const isDuplicate = existingTitles.some(t =>
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
            model: "gpt-4o",
            content: JSON.stringify({
                emailSummary: analysis.summary,
                structuredReport: analysis,
            }),
            findings_count: analysis.issues?.length || 0,
        });
        results.reportSaved = true;

        // ─── Step 6: Log Brain Actions ───────────────────────────────────
        if (analysis.actions && analysis.actions.length > 0) {
            for (const action of analysis.actions) {
                await supabase.from("brain_actions").insert({
                    action_type: action.type,
                    description: action.description,
                    params: action.params || {},
                    status: "logged",
                    source: "vercel-cron",
                });
            }
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
    issues: BrainIssue[];
    actions: BrainAction[];
    metrics: {
        totalWorkers: number;
        totalEmployers: number;
        documentsVerified: number;
        emailDeliveryRate: string;
        funnelProgression: string;
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSystemPrompt(): string {
    return `You are the Workers United Platform Brain — an autonomous AI monitoring system.

Your job: Analyze platform telemetry data and identify ACTIONABLE issues, bugs, and improvements.

Platform context:
- Workers United connects international workers with European employers for work visas
- Entry fee: $9 (€9) with 100% refund guarantee within 30 days
- Flow: Signup → Profile → Documents (passport, diploma, photo) → AI Verification → Admin Approval → Payment → Queue → Job Match
- AI: Gemini 3.0 Flash for document verification (with fallback chain: 3.0-flash → 2.5-pro → 2.5-flash)
- WhatsApp: n8n + GPT-4o chatbot
- Email: Nodemailer + Google Workspace SMTP

Rules:
1. Only report REAL issues backed by data evidence
2. Don't create issues for things that are obviously just "no users yet"
3. Prioritize: P0 (blocks revenue), P1 (degraded experience), P2 (improvement)
4. Each issue must have specific, actionable fix suggestions
5. Include specific data points as evidence
6. De-duplicate: don't report the same issue multiple ways
7. Keep healthScore between 0-100 (100 = perfect)

Respond in JSON format matching the BrainAnalysis schema:
{
  "summary": "2-3 sentence executive summary",
  "healthScore": 0-100,
  "issues": [{ "title": "...", "body": "...", "priority": "P0|P1|P2", "labels": ["bug"|"enhancement"|"critical"] }],
  "actions": [{ "type": "retry_email|send_alert|log_observation", "description": "...", "params": {} }],
  "metrics": { "totalWorkers": N, "totalEmployers": N, "documentsVerified": N, "emailDeliveryRate": "X%", "funnelProgression": "description" }
}`;
}

function buildAnalysisPrompt(data: Record<string, unknown>, date: string): string {
    return `Analyze this platform telemetry data from ${date}:

${JSON.stringify(data, null, 2)}

Identify critical issues, bugs, performance problems, and improvement opportunities.
Focus on what's BROKEN or DEGRADED, not what's missing because we're in early stage.`;
}

async function getExistingIssueTitles(): Promise<string[]> {
    if (!GITHUB_TOKEN) return [];
    try {
        const res = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/issues?state=open&per_page=30`,
            { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" } }
        );
        if (!res.ok) return [];
        const issues = await res.json();
        return issues.map((i: { title: string }) => i.title);
    } catch {
        return [];
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
    const issueRows = (analysis.issues || [])
        .map(i => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.priority}</td><td style="padding:8px;border-bottom:1px solid #eee">${i.title}</td></tr>`)
        .join("");

    return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h1 style="color:#1e3a5f">🧠 Brain Report</h1>
        <div style="display:flex;gap:20px;margin:20px 0">
            <div style="background:${scoreColor};color:white;padding:20px;border-radius:12px;text-align:center;min-width:100px">
                <div style="font-size:36px;font-weight:bold">${analysis.healthScore}</div>
                <div style="font-size:12px;opacity:0.8">Health Score</div>
            </div>
            <div style="padding:10px">
                <p style="margin:5px 0"><strong>Workers:</strong> ${analysis.metrics?.totalWorkers || "N/A"}</p>
                <p style="margin:5px 0"><strong>Employers:</strong> ${analysis.metrics?.totalEmployers || "N/A"}</p>
                <p style="margin:5px 0"><strong>Email Delivery:</strong> ${analysis.metrics?.emailDeliveryRate || "N/A"}</p>
                <p style="margin:5px 0"><strong>Duration:</strong> ${duration}s</p>
            </div>
        </div>
        <h2 style="color:#1e3a5f">Summary</h2>
        <p>${analysis.summary}</p>
        ${analysis.issues?.length ? `
        <h2 style="color:#1e3a5f">Issues Found (${analysis.issues.length})</h2>
        <p>${issuesCreated} new GitHub Issues created</p>
        <table style="width:100%;border-collapse:collapse">
            <tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Priority</th><th style="padding:8px;text-align:left">Title</th></tr>
            ${issueRows}
        </table>
        ` : "<p>✅ No issues found</p>"}
        <hr style="margin:20px 0;border:1px solid #e2e8f0">
        <p style="font-size:12px;color:#94a3b8">Brain Monitor v2 — Vercel Cron — ${new Date().toISOString()}</p>
    </div>`;
}
