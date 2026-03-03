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

        // ─── Step 6: Execute Brain Actions (auto-healing + auto-remediation) ───
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

                // Self-Improvement #2: Update platform config (bot prompt hotfix)
                if (action.type === "update_config" && action.params?.key && action.params?.value) {
                    try {
                        const { error } = await supabase.from("platform_config")
                            .update({ value: String(action.params.value) })
                            .eq("key", String(action.params.key));
                        actionStatus = error ? "failed" : "executed";
                        if (!error) console.log(`[Brain] ⚙️ Config updated: ${action.params.key}`);
                    } catch { actionStatus = "failed"; }
                }

                // Self-Improvement #2: Send employer verification nudge
                if (action.type === "send_employer_nudge" && action.params?.employer_id) {
                    try {
                        const { data: employer } = await supabase
                            .from("employers")
                            .select("id, status")
                            .eq("id", action.params.employer_id)
                            .single();
                        if (employer && employer.status === "PENDING") {
                            // Log the nudge — admin will see it in brain_actions
                            actionStatus = "executed";
                            console.log(`[Brain] 📧 Employer nudge logged for ${action.params.employer_id}`);
                        } else {
                            actionStatus = "skipped";
                        }
                    } catch { actionStatus = "failed"; }
                }

                // Self-Improvement #2: Update/correct brain_memory facts
                if (action.type === "update_memory" && action.params?.old_content && action.params?.new_content) {
                    try {
                        const { error } = await supabase.from("brain_memory")
                            .update({
                                content: String(action.params.new_content),
                                confidence: 0.95,
                            })
                            .eq("content", String(action.params.old_content));
                        actionStatus = error ? "failed" : "executed";
                        if (!error) console.log(`[Brain] 🧠 Memory corrected: ${String(action.params.old_content).substring(0, 50)}...`);
                    } catch { actionStatus = "failed"; }
                }

                // Self-Improvement #2: Delete outdated brain_memory facts
                if (action.type === "delete_memory" && action.params?.content) {
                    try {
                        const { error } = await supabase.from("brain_memory")
                            .delete()
                            .eq("content", String(action.params.content));
                        actionStatus = error ? "failed" : "executed";
                    } catch { actionStatus = "failed"; }
                }

                // Auto-heal: confirm stuck unconfirmed users (>48h)
                if (action.type === "confirm_stuck_users" && action.params?.user_ids) {
                    try {
                        const userIds = action.params.user_ids as string[];
                        let confirmed = 0;
                        for (const userId of userIds.slice(0, 50)) {
                            const { error } = await supabase.auth.admin.updateUserById(userId, {
                                email_confirm: true,
                            });
                            if (!error) confirmed++;
                        }
                        actionStatus = confirmed > 0 ? "executed" : "failed";
                        console.log(`[Brain] ✅ Auto-confirmed ${confirmed}/${userIds.length} stuck users`);
                    } catch { actionStatus = "failed"; }
                }

                // Auto-heal: create missing profile + candidate records
                if (action.type === "create_missing_records" && action.params?.user_ids) {
                    try {
                        const userIds = action.params.user_ids as string[];
                        let created = 0;
                        for (const userId of userIds.slice(0, 50)) {
                            const { data: authUser } = await supabase.auth.admin.getUserById(userId);
                            if (!authUser?.user) continue;

                            // Ensure profile exists
                            const { data: existingProfile } = await supabase
                                .from("profiles").select("id").eq("id", userId).maybeSingle();
                            if (!existingProfile) {
                                await supabase.from("profiles").upsert({
                                    id: userId,
                                    full_name: authUser.user.user_metadata?.full_name || authUser.user.email?.split("@")[0] || "User",
                                    user_type: "worker",
                                });
                            }

                            // Ensure candidate exists
                            const { data: existingCandidate } = await supabase
                                .from("candidates").select("id").eq("profile_id", userId).maybeSingle();
                            if (!existingCandidate) {
                                await supabase.from("candidates").insert({
                                    profile_id: userId,
                                    status: "NEW",
                                });
                                created++;
                            }
                        }
                        actionStatus = created > 0 ? "executed" : "skipped";
                        console.log(`[Brain] 📋 Created ${created} missing candidate records`);
                    } catch { actionStatus = "failed"; }
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
9. You now have funnelTimestamps data showing per-user stage timing — use it to find WHERE users stall
10. You now have paymentTelemetry showing failed/abandoned checkout attempts — analyze drop-off

## Auto-Remediation powers (actions you can EXECUTE):
- retry_email: Retry a failed email by ID
- update_config: Update platform_config values (e.g., fix bot greeting). Params: { key: "...", value: "..." }
- send_employer_nudge: Flag a pending employer for verification nudge. Params: { employer_id: "..." }
- update_memory: Correct an outdated brain_memory fact. Params: { old_content: "...", new_content: "..." }
- delete_memory: Remove an incorrect brain_memory fact. Params: { content: "..." }
- confirm_stuck_users: Auto-confirm emails for users stuck unconfirmed >48h. Params: { user_ids: ["..."] }
- create_missing_records: Create profile+candidate for auth users missing them. Params: { user_ids: ["..."] }
- log_observation: Log an observation for admin review

## Operation 6: 🧠 SELF-IMPROVEMENT
- What capabilities are you MISSING that would make you more effective?
- What data do you WISH you had access to?
- What actions should you be able to EXECUTE (not just report)?
- What facts should the WhatsApp bot know? Generate them as brainFacts.
- Status: SUGGESTIONS

## Operation 7: 🔐 AUTH HEALTH
- You MUST check authHealth data EVERY run. It contains unconfirmed emails, missing records, and stuck signups.
- CRITICAL: If unconfirmed users exist, your #1 priority is finding the ROOT CAUSE:
  - Is the signup emailRedirectTo URL correct? Check if callback route exists.
  - Is the Supabase Site URL misconfigured?
  - Are users entering invalid emails (typos like gmai.com, yahoo.coms)?
  - Are confirmation links expiring before users click?
  - Is there a code bug preventing session exchange?
- CREATE A P0 ISSUE explaining the root cause and fix, with label "auth-health"
- Auto-confirm (confirm_stuck_users) is a TEMPORARY band-aid — NEVER use it without ALSO creating an issue for the root cause
- If workers have no candidate record, use create_missing_records to fix silently
- Check for users with missing user_type metadata (they fall through the cracks)
- Flag invalid email patterns (typos, disposable domains) — these users can never confirm
- Status: OK / WARNING / CRITICAL

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
  "issues": [{ "title": "...", "body": "...", "priority": "P0|P1|P2", "labels": ["bug"|"enhancement"|"critical"], "operation": "System Health|Funnel|Email|Code|Growth|Auth Health" }],
  "improvements": [{ "title": "...", "description": "...", "impact": "high|medium|low", "effort": "easy|medium|hard" }],
   "actions": [{ "type": "retry_email|send_alert|clean_stale_data|update_config|send_employer_nudge|update_memory|delete_memory|confirm_stuck_users|create_missing_records|log_observation", "description": "...", "params": {} }],
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

    // Apple/Notion color palette
    const colors = {
        bg: "#FAFAFA",
        surface: "#FFFFFF",
        text: "#111827",
        textMuted: "#6B7280",
        border: "#E5E7EB",
        success: { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
        warning: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
        error: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
        brand: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" }
    };

    const getStatusTheme = (s: string | number) => {
        if (s === "OK" || (typeof s === "number" && s >= 80)) return colors.success;
        if (s === "WARNING" || (typeof s === "number" && s >= 50)) return colors.warning;
        if (s === "CRITICAL" || (typeof s === "number" && s < 50)) return colors.error;
        return colors.brand;
    };

    const scoreTheme = getStatusTheme(analysis.healthScore);

    const statusBadge = (s: string) => {
        const t = getStatusTheme(s);
        return `<span style="background:${t.bg};color:${t.text};border:1px solid ${t.border};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;">${s}</span>`;
    };

    const operationsHtml = (analysis.operations || []).map(op => `
        <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:${colors.text};font-size:18px;font-weight:600;display:flex;align-items:center;gap:8px;">
                    <span style="font-size:20px;">${op.emoji}</span> ${op.name}
                </h3>
                ${statusBadge(op.status)}
            </div>
            <ul style="margin:0;padding-left:0;list-style:none;">
                ${op.findings.map(f => `
                    <li style="color:${colors.textMuted};font-size:14px;line-height:1.6;margin-bottom:8px;display:flex;align-items:flex-start;gap:8px;">
                        <span style="color:${colors.border};margin-top:2px;">•</span>
                        <span>${f}</span>
                    </li>
                `).join("")}
            </ul>
        </div>
    `).join("");

    return `
    <div style="background-color:${colors.bg};margin:0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${colors.text};">
        <div style="max-width:600px;margin:0 auto;">
            
            <!-- Header -->
            <div style="text-align:center;margin-bottom:32px;">
                <div style="width:48px;height:48px;background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;box-shadow:0 2px 4px rgba(0,0,0,0.04);">
                    🧠
                </div>
                <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:${colors.text};">Daily Brain Report</h1>
                <p style="margin:0;font-size:14px;color:${colors.textMuted};">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>

            <!-- Health Score Card -->
            <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:16px;padding:32px;margin-bottom:24px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:120px;height:120px;border-radius:50%;background:${scoreTheme.bg};border:4px solid ${scoreTheme.border};margin-bottom:16px;">
                    <span style="font-size:48px;font-weight:700;letter-spacing:-0.04em;color:${scoreTheme.text};">${analysis.healthScore}</span>
                </div>
                <p style="margin:0;font-size:16px;font-weight:600;color:${colors.text};">System Health Score</p>
                <p style="margin:8px 0 0;font-size:14px;color:${colors.textMuted};max-width:400px;margin-left:auto;margin-right:auto;line-height:1.5;">${analysis.summary}</p>
            </div>

            <!-- Metrics Grid -->
            <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px;margin-bottom:32px;">
                <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                    <div style="font-size:12px;font-weight:600;color:${colors.textMuted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Total Workers</div>
                    <div style="font-size:24px;font-weight:700;color:${colors.text};letter-spacing:-0.02em;">${analysis.metrics?.totalWorkers || "N/A"}</div>
                </div>
                <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                    <div style="font-size:12px;font-weight:600;color:${colors.textMuted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Employers</div>
                    <div style="font-size:24px;font-weight:700;color:${colors.text};letter-spacing:-0.02em;">${analysis.metrics?.totalEmployers || "N/A"}</div>
                </div>
                <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                    <div style="font-size:12px;font-weight:600;color:${colors.textMuted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Email Delivery</div>
                    <div style="font-size:24px;font-weight:700;color:${colors.text};letter-spacing:-0.02em;">${analysis.metrics?.emailDeliveryRate || "N/A"}</div>
                </div>
                <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                    <div style="font-size:12px;font-weight:600;color:${colors.textMuted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Analysis Time</div>
                    <div style="font-size:24px;font-weight:700;color:${colors.text};letter-spacing:-0.02em;">${duration}s</div>
                </div>
            </div>

            <!-- Operations -->
            <h2 style="font-size:18px;font-weight:600;color:${colors.text};margin:0 0 16px;letter-spacing:-0.01em;">Operations Analysis</h2>
            ${operationsHtml}

            <!-- Issues & Suggestions -->
            ${analysis.issues?.length ? `
                <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;padding:24px;margin-top:24px;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                    <h3 style="margin:0 0 16px;color:${colors.text};font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px;">
                        🚨 Identified Issues <span style="background:${colors.bg};color:${colors.textMuted};padding:2px 8px;border-radius:99px;font-size:12px;">${issuesCreated} auto-logged</span>
                    </h3>
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        ${analysis.issues.map(i => `
                            <div style="display:flex;align-items:flex-start;gap:12px;padding-bottom:12px;border-bottom:1px solid ${colors.border};">
                                <span style="margin-top:2px;font-size:12px;font-weight:600;color:${i.priority.includes('0') ? colors.error.text : colors.warning.text};background:${i.priority.includes('0') ? colors.error.bg : colors.warning.bg};padding:2px 6px;border-radius:4px;">${i.priority}</span>
                                <span style="font-size:14px;color:${colors.text};line-height:1.5;">${i.title}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            ` : `
                <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;padding:24px;margin-top:24px;text-align:center;">
                    <span style="font-size:24px;display:block;margin-bottom:8px;">✨</span>
                    <h3 style="margin:0 0 4px;color:${colors.text};font-size:16px;font-weight:600;">All Systems Normal</h3>
                    <p style="margin:0;color:${colors.textMuted};font-size:14px;">No critical issues detected during analysis.</p>
                </div>
            `}

            ${analysis.improvements?.length ? `
                <div style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;padding:24px;margin-top:24px;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                    <h3 style="margin:0 0 16px;color:${colors.text};font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px;">
                        💡 Strategic Suggestions
                    </h3>
                    <div style="display:flex;flex-direction:column;gap:16px;">
                        ${analysis.improvements.map(i => `
                            <div>
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                                    <span style="font-size:14px;font-weight:500;color:${colors.text};">${i.title}</span>
                                    <span style="font-size:11px;font-weight:600;color:${colors.brand.text};background:${colors.brand.bg};padding:2px 6px;border-radius:4px;">${i.impact} impact</span>
                                </div>
                                <div style="font-size:13px;color:${colors.textMuted};line-height:1.5;">${i.description}</div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            ` : ""}

            <!-- Footer -->
            <div style="text-align:center;margin-top:40px;padding-top:24px;border-top:1px solid ${colors.border};">
                <p style="margin:0;font-size:12px;color:${colors.textMuted};">Generated autonomously by Codex 5.3 Brain Monitor</p>
                <p style="margin:4px 0 0;font-size:12px;color:${colors.border};">Workers United Platform</p>
            </div>

        </div>
    </div>`;
}
