import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";

// ─── Brain Monitor ──────────────────────────────────────────────────────────
// Autonomous AI that monitors platform health, creates GitHub Issues for bugs,
// and sends email reports. Runs daily via Vercel Cron.
//
// Brain Monitor — runs via Vercel Cron (configured in vercel.json).
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

        // ─── Step 1b: Self-Test Critical Routes ──────────────────────────
        const criticalRoutes = ["/login", "/signup", "/auth/callback", "/api/health"];
        const routeHealth: Record<string, { status: number | string; ok: boolean; latencyMs: number }> = {};
        for (const route of criticalRoutes) {
            const start = Date.now();
            try {
                const res = await fetch(`${baseUrl}${route}`, {
                    method: "GET",
                    redirect: "manual", // don't follow redirects — just check if route exists
                    signal: AbortSignal.timeout(10000),
                });
                routeHealth[route] = {
                    status: res.status,
                    ok: res.status < 500, // 200, 302 (redirects) are fine, 5xx is bad
                    latencyMs: Date.now() - start,
                };
            } catch (err) {
                routeHealth[route] = {
                    status: err instanceof Error ? err.message : "timeout",
                    ok: false,
                    latencyMs: Date.now() - start,
                };
            }
        }
        platformData.routeHealth = routeHealth;

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
        const brainReportPayload = {
            report_type: "automated_daily",
            email_summary: analysis.summary,
            structured_report: analysis,
        };
        const { error: saveReportError } = await supabase.from("brain_reports").insert({
            report: brainReportPayload,
            model: "gpt-5.3-codex",
            findings_count: analysis.issues?.length || 0,
        });
        if (saveReportError) {
            console.error("[Brain Monitor] Failed to save report:", saveReportError.message);
            results.reportSaved = false;
        } else {
            results.reportSaved = true;
        }

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
        // IMPORTANT: system_stats are NEVER stored — they go stale and mislead the bot.
        // Live stats are served fresh via /api/brain/collect in the system prompt.
        if (analysis.brainFacts && analysis.brainFacts.length > 0) {
            const BLOCKED_CATEGORIES = ["system_stats", "stats"];
            const safeFacts = analysis.brainFacts.filter(
                (f: { category: string }) => !BLOCKED_CATEGORIES.includes(f.category)
            );
            const skipped = analysis.brainFacts.length - safeFacts.length;
            if (skipped > 0) console.log(`[Brain] ⏭️ Skipped ${skipped} system_stats facts (live data only)`);

            for (const fact of safeFacts) {
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
            console.log(`[Brain] 🧠 Codex learned ${safeFacts.length} new facts`);
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
- ⚠️ CHECK routeHealth data: critical routes (/login, /signup, /auth/callback) are self-tested. If ANY route has ok:false, this is P0 CRITICAL
- Document verification success rate (Gemini)
- Database connection issues, cron job failures
- Status: OK / WARNING / CRITICAL

## Operation 2: 📊 FUNNEL ANALYSIS
- Where are users dropping off? (signup → profile → docs → verification → payment → queue)
- ⚠️ CHECK stalls data: shows exact bottleneck counts (no_candidate_record, no_docs_uploaded, docs_pending_verification, approved_not_paid)
- ⚠️ CHECK signup_page_view events in userActivity: compare page views vs actual signups to measure ad conversion
- Conversion rates between stages
- Status: OK / WARNING / CRITICAL

## Operation 3: 📨 EMAIL & WHATSAPP
- Email delivery rate (sent vs failed)
- ⚠️ CHECK bouncePatterns data: domains with high bounce rates may indicate typos that should be added to the signup email validation
- If you find repeated bounce domains, use brainFacts to record them and create an issue to add them to email typo detection
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
  "brainFacts": [{ "category": "pricing|process|documents|eligibility|faq", "content": "Verified fact for WhatsApp bot to use (NEVER use system_stats — live stats come from /api/brain/collect)" }],
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

function escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildEmailReport(
    analysis: BrainAnalysis,
    _platformData: Record<string, unknown>,
    issuesCreated: number,
    startTime: number
): string {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const reportDate = new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });

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
        return `<span style="display:inline-block;background:${t.bg};color:${t.text};border:1px solid ${t.border};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;">${escapeHtml(s)}</span>`;
    };

    const metricCard = (label: string, value: string | number) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;">
            <tr>
                <td style="padding:18px 16px;">
                    <div style="font-size:12px;font-weight:600;color:${colors.textMuted};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">${escapeHtml(label)}</div>
                    <div style="font-size:28px;font-weight:700;line-height:1.2;color:${colors.text};letter-spacing:-0.02em;">${escapeHtml(value)}</div>
                </td>
            </tr>
        </table>
    `;

    const renderFindings = (findings: string[]) => {
        if (!findings || findings.length === 0) {
            return `
                <tr>
                    <td style="font-size:14px;color:${colors.textMuted};line-height:1.6;">No notable findings.</td>
                </tr>
            `;
        }
        return findings.map(finding => `
            <tr>
                <td style="padding:0 0 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td valign="top" width="14" style="font-size:14px;line-height:1.6;color:${colors.textMuted};">•</td>
                            <td style="font-size:14px;line-height:1.6;color:${colors.textMuted};">${escapeHtml(finding)}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        `).join("");
    };

    const operationsHtml = (analysis.operations || []).map(op => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;margin-bottom:16px;">
            <tr>
                <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                        <tr>
                            <td valign="middle" style="font-size:22px;line-height:1.2;color:${colors.text};font-weight:700;">
                                <span style="font-size:20px;vertical-align:middle;">${escapeHtml(op.emoji)}</span>
                                <span style="font-size:22px;vertical-align:middle;"> ${escapeHtml(op.name)}</span>
                            </td>
                            <td valign="middle" align="right">
                                ${statusBadge(op.status)}
                            </td>
                        </tr>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        ${renderFindings(op.findings)}
                    </table>
                </td>
            </tr>
        </table>
    `).join("");

    const issuesHtml = (analysis.issues || []).map((issue, index) => `
        <tr>
            <td style="padding:${index === 0 ? "0" : "12px 0 0"};${index === 0 ? "" : `border-top:1px solid ${colors.border};`}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td valign="top" width="48" style="padding-right:10px;">
                            <span style="display:inline-block;font-size:12px;font-weight:700;line-height:1;color:${issue.priority.includes("0") ? colors.error.text : colors.warning.text};background:${issue.priority.includes("0") ? colors.error.bg : colors.warning.bg};padding:4px 6px;border-radius:4px;">
                                ${escapeHtml(issue.priority)}
                            </span>
                        </td>
                        <td style="font-size:14px;line-height:1.5;color:${colors.text};">${escapeHtml(issue.title)}</td>
                    </tr>
                </table>
            </td>
        </tr>
    `).join("");

    const improvementsHtml = (analysis.improvements || []).map((improvement, index) => `
        <tr>
            <td style="padding:${index === 0 ? "0" : "12px 0 0"};${index === 0 ? "" : `border-top:1px solid ${colors.border};`}">
                <div style="font-size:15px;line-height:1.4;color:${colors.text};font-weight:600;margin-bottom:6px;">
                    ${escapeHtml(improvement.title)}
                    <span style="display:inline-block;margin-left:6px;font-size:11px;font-weight:700;line-height:1;color:${colors.brand.text};background:${colors.brand.bg};padding:4px 6px;border-radius:4px;text-transform:uppercase;">
                        ${escapeHtml(improvement.impact)} impact
                    </span>
                </div>
                <div style="font-size:13px;line-height:1.6;color:${colors.textMuted};">${escapeHtml(improvement.description)}</div>
            </td>
        </tr>
    `).join("");

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.bg};margin:0;padding:0;border-collapse:collapse;">
    <tr>
        <td align="center" style="padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${colors.text};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;">
                <tr>
                    <td align="center" style="padding:0 0 24px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
                            <tr>
                                <td align="center" style="width:48px;height:48px;font-size:24px;line-height:48px;background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;">🧠</td>
                            </tr>
                        </table>
                        <div style="font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${colors.text};margin-bottom:6px;">Daily Brain Report</div>
                        <div style="font-size:14px;line-height:1.4;color:${colors.textMuted};">${escapeHtml(reportDate)}</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 0 20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:16px;">
                            <tr>
                                <td align="center" style="padding:24px 22px;">
                                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                                        <tr>
                                            <td align="center" style="width:112px;height:112px;font-size:52px;line-height:112px;font-weight:700;letter-spacing:-0.04em;color:${scoreTheme.text};background:${scoreTheme.bg};border:4px solid ${scoreTheme.border};border-radius:9999px;">
                                                ${escapeHtml(analysis.healthScore)}
                                            </td>
                                        </tr>
                                    </table>
                                    <div style="font-size:16px;line-height:1.3;font-weight:700;color:${colors.text};margin-bottom:8px;">System Health Score</div>
                                    <div style="font-size:14px;line-height:1.6;color:${colors.textMuted};text-align:left;max-width:480px;margin:0 auto;">
                                        ${escapeHtml(analysis.summary)}
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 0 24px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td width="50%" valign="top" style="padding:0 8px 12px 0;">
                                    ${metricCard("Total Workers", analysis.metrics?.totalWorkers ?? "N/A")}
                                </td>
                                <td width="50%" valign="top" style="padding:0 0 12px 8px;">
                                    ${metricCard("Employers", analysis.metrics?.totalEmployers ?? "N/A")}
                                </td>
                            </tr>
                            <tr>
                                <td width="50%" valign="top" style="padding:0 8px 0 0;">
                                    ${metricCard("Email Delivery", analysis.metrics?.emailDeliveryRate ?? "N/A")}
                                </td>
                                <td width="50%" valign="top" style="padding:0 0 0 8px;">
                                    ${metricCard("Analysis Time", `${duration}s`)}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="font-size:18px;line-height:1.3;font-weight:700;color:${colors.text};letter-spacing:-0.01em;padding:0 0 12px;">
                        Operations Analysis
                    </td>
                </tr>
                <tr>
                    <td style="padding:0;">${operationsHtml}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0 0;">
                        ${analysis.issues?.length ? `
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;">
                                <tr>
                                    <td style="padding:20px;">
                                        <div style="font-size:20px;line-height:1.25;font-weight:700;color:${colors.text};margin-bottom:14px;">
                                            🚨 Identified Issues
                                            <span style="display:inline-block;font-size:12px;line-height:1;color:${colors.textMuted};background:${colors.bg};padding:4px 8px;border-radius:99px;vertical-align:middle;margin-left:6px;">${issuesCreated} auto-logged</span>
                                        </div>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            ${issuesHtml}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        ` : `
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;">
                                <tr>
                                    <td align="center" style="padding:24px 20px;">
                                        <div style="font-size:26px;line-height:1;margin-bottom:8px;">✨</div>
                                        <div style="font-size:16px;line-height:1.3;font-weight:700;color:${colors.text};margin-bottom:4px;">All Systems Normal</div>
                                        <div style="font-size:14px;line-height:1.6;color:${colors.textMuted};">No critical issues detected during analysis.</div>
                                    </td>
                                </tr>
                            </table>
                        `}
                    </td>
                </tr>
                ${analysis.improvements?.length ? `
                    <tr>
                        <td style="padding:16px 0 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;">
                                <tr>
                                    <td style="padding:20px;">
                                        <div style="font-size:20px;line-height:1.25;font-weight:700;color:${colors.text};margin-bottom:14px;">💡 Strategic Suggestions</div>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            ${improvementsHtml}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                ` : ""}
                <tr>
                    <td align="center" style="padding:26px 0 0;border-top:1px solid ${colors.border};">
                        <div style="font-size:12px;line-height:1.6;color:${colors.textMuted};">Generated autonomously by Codex 5.3 Brain Monitor</div>
                        <div style="font-size:12px;line-height:1.6;color:${colors.border};">Workers United Platform</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>`;
}
