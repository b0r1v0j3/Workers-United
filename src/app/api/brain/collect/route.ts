import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Brain Data Collector ───────────────────────────────────────────────────
// Collects ALL system data for AI brain analysis (o1-pro / Claude / Gemini)
// Called by n8n weekly workflow to generate system health & improvement reports
//
// Auth: Requires CRON_SECRET bearer token (same as cron jobs)

export async function GET(request: NextRequest) {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ─── PERF-001 fix: All queries run in parallel via Promise.all ──────
    const [
        { data: allProfiles },
        { data: candidates },
        { data: documents },
        { data: payments },
        { data: emails },
        { data: whatsappMsgs },
        { data: employerData },
        { data: jobRequests },
        { data: matches },
        { data: offers },
    ] = await Promise.all([
        supabase.from("profiles").select("id, user_type, full_name, created_at"),
        supabase.from("candidates").select("id, profile_id, status, admin_approved, entry_fee_paid, queue_joined_at, created_at"),
        supabase.from("candidate_documents").select("document_type, status, created_at, verified_at"),
        supabase.from("payments").select("payment_type, status, amount, paid_at, created_at"),
        supabase.from("email_queue").select("email_type, status, error_message, created_at").gte("created_at", monthAgo.toISOString()),
        supabase.from("whatsapp_messages").select("direction, status, content, created_at, phone_number").gte("created_at", monthAgo.toISOString()).order("created_at", { ascending: false }),
        supabase.from("employers").select("id, status, country, industry, created_at"),
        supabase.from("job_requests").select("id, status, industry, country, positions_available, created_at"),
        supabase.from("matches").select("id, status, created_at"),
        supabase.from("offers").select("id, status, created_at"),
    ]);

    // ─── 1. User Statistics ─────────────────────────────────────────────
    const workers = (allProfiles || []).filter(p => p.user_type === "worker");
    const employerProfiles = (allProfiles || []).filter(p => p.user_type === "employer");
    const newUsersThisWeek = (allProfiles || []).filter(p =>
        new Date(p.created_at) >= weekAgo
    );
    // NOTE: totalEmployers uses employers table (not profiles) to match employers.total
    // This prevents the metric inconsistency flagged in Brain report (SEC-001)

    // ─── 2. Candidate Statuses ──────────────────────────────────────────
    const statusBreakdown: Record<string, number> = {};
    (candidates || []).forEach(c => {
        statusBreakdown[c.status] = (statusBreakdown[c.status] || 0) + 1;
    });

    const approvedCount = (candidates || []).filter(c => c.admin_approved).length;
    const paidCount = (candidates || []).filter(c => c.entry_fee_paid).length;
    const inQueueCount = (candidates || []).filter(c => c.status === "IN_QUEUE").length;

    // ─── 3. Document Verification Stats ─────────────────────────────────
    const docStats = {
        total: (documents || []).length,
        verified: (documents || []).filter(d => d.status === "verified").length,
        pending: (documents || []).filter(d => d.status === "pending").length,
        rejected: (documents || []).filter(d => d.status === "rejected").length,
        byType: {} as Record<string, { verified: number; pending: number; rejected: number }>,
    };
    (documents || []).forEach(d => {
        if (!docStats.byType[d.document_type]) {
            docStats.byType[d.document_type] = { verified: 0, pending: 0, rejected: 0 };
        }
        if (d.status === "verified") docStats.byType[d.document_type].verified++;
        if (d.status === "pending") docStats.byType[d.document_type].pending++;
        if (d.status === "rejected") docStats.byType[d.document_type].rejected++;
    });

    // ─── 4. Payment Stats ───────────────────────────────────────────────
    const paymentStats = {
        total: (payments || []).length,
        successful: (payments || []).filter(p => p.status === "completed" || p.status === "paid").length,
        failed: (payments || []).filter(p => p.status === "failed").length,
        totalRevenue: (payments || [])
            .filter(p => p.status === "completed" || p.status === "paid")
            .reduce((sum, p) => sum + (p.amount || 0), 0),
        thisWeek: (payments || []).filter(p => p.paid_at && new Date(p.paid_at) >= weekAgo).length,
    };

    // ─── 5. Email Queue Stats ───────────────────────────────────────────
    const emailStats = {
        totalThisMonth: (emails || []).length,
        sent: (emails || []).filter(e => e.status === "sent").length,
        failed: (emails || []).filter(e => e.error_message).length,
        pending: (emails || []).filter(e => e.status === "pending").length,
        byType: {} as Record<string, number>,
    };
    (emails || []).forEach(e => {
        emailStats.byType[e.email_type] = (emailStats.byType[e.email_type] || 0) + 1;
    });

    // ─── 6. WhatsApp Chatbot Stats ──────────────────────────────────────
    const chatbotStats = {
        totalMessages: (whatsappMsgs || []).length,
        inbound: (whatsappMsgs || []).filter(m => m.direction === "inbound").length,
        outbound: (whatsappMsgs || []).filter(m => m.direction === "outbound").length,
        failed: (whatsappMsgs || []).filter(m => m.status === "failed").length,
        uniqueUsers: new Set((whatsappMsgs || []).map(m => m.phone_number)).size,
        thisWeek: (whatsappMsgs || []).filter(m => new Date(m.created_at) >= weekAgo).length,
        recentConversations: (whatsappMsgs || []).slice(0, 50).map(m => ({
            direction: m.direction,
            content: m.content?.substring(0, 500),
            timestamp: m.created_at,
        })),
    };

    // ─── 7. Employer Stats ──────────────────────────────────────────────
    const employerStats = {
        total: (employerData || []).length,
        verified: (employerData || []).filter(e => e.status === "VERIFIED").length,
        pending: (employerData || []).filter(e => e.status === "PENDING").length,
        byCountry: {} as Record<string, number>,
        byIndustry: {} as Record<string, number>,
    };
    (employerData || []).forEach(e => {
        if (e.country) employerStats.byCountry[e.country] = (employerStats.byCountry[e.country] || 0) + 1;
        if (e.industry) employerStats.byIndustry[e.industry] = (employerStats.byIndustry[e.industry] || 0) + 1;
    });

    // ─── 9. Conversion Funnel ───────────────────────────────────────────
    const funnel = {
        registered: workers.length,
        adminApproved: approvedCount,
        entryFeePaid: paidCount,
        inQueue: inQueueCount,
        matched: (matches || []).length,
        offersSent: (offers || []).length,
        offersAccepted: (offers || []).filter(o => o.status === "accepted").length,
        conversionRate: workers.length > 0
            ? `${Math.round((paidCount / workers.length) * 100)}%`
            : "0%",
    };

    // ─── 10. System Health Indicators ───────────────────────────────────
    const failedEmails = (emails || []).filter(e => e.error_message);
    const failedWhatsApp = (whatsappMsgs || []).filter(m => m.status === "failed");

    const health = {
        emailDeliveryRate: emailStats.totalThisMonth > 0
            ? `${Math.round((emailStats.sent / emailStats.totalThisMonth) * 100)}%`
            : "N/A",
        whatsappDeliveryRate: chatbotStats.totalMessages > 0
            ? `${Math.round(((chatbotStats.totalMessages - chatbotStats.failed) / chatbotStats.totalMessages) * 100)}%`
            : "N/A",
        failedEmailCount: failedEmails.length,
        failedWhatsAppCount: failedWhatsApp.length,
        recentFailedEmails: failedEmails.slice(0, 5).map(e => ({
            type: e.email_type,
            error: e.error_message,
            date: e.created_at,
        })),
    };

    // ─── Compile Report ─────────────────────────────────────────────────
    const report = {
        generatedAt: now.toISOString(),
        period: {
            weekStart: weekAgo.toISOString(),
            monthStart: monthAgo.toISOString(),
        },
        users: {
            totalWorkers: workers.length,
            totalEmployers: (employerData || []).length,
            newThisWeek: newUsersThisWeek.length,
            statusBreakdown,
        },
        documents: docStats,
        payments: paymentStats,
        emails: emailStats,
        chatbot: chatbotStats,
        employers: employerStats,
        jobRequests: {
            total: (jobRequests || []).length,
            open: (jobRequests || []).filter(j => j.status === "open" || j.status === "active").length,
        },
        matches: {
            total: (matches || []).length,
            thisWeek: (matches || []).filter(m => new Date(m.created_at) >= weekAgo).length,
        },
        offers: {
            total: (offers || []).length,
            accepted: (offers || []).filter(o => o.status === "accepted").length,
        },
        funnel,
        health,
        // ─── User Activity (last 24h) ───────────────────────────────
        userActivity: await (async () => {
            try {
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

                // Get all activity in the last 24 hours
                const { data: recentActivity } = await supabase
                    .from("user_activity")
                    .select("action, category, status, details, user_id, created_at")
                    .gte("created_at", dayAgo)
                    .order("created_at", { ascending: false })
                    .limit(500);

                if (!recentActivity || recentActivity.length === 0) {
                    return { total: 0, errors: [], warnings: [], summary: "No activity in last 24h" };
                }

                interface ActivityRow {
                    action: string;
                    category: string;
                    status: string;
                    details: Record<string, unknown>;
                    user_id: string;
                    created_at: string;
                }

                const rows = recentActivity as ActivityRow[];
                const errors = rows.filter((a: ActivityRow) => a.status === "error");
                const warnings = rows.filter((a: ActivityRow) => a.status === "warning" || a.status === "blocked");
                const uniqueUsers = new Set(rows.map((a: ActivityRow) => a.user_id)).size;

                // Group actions by type for summary
                const actionCounts: Record<string, number> = {};
                rows.forEach((a: ActivityRow) => {
                    actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
                });

                // User journey summaries (per unique user)
                const userJourneys: Record<string, string[]> = {};
                rows.forEach((a: ActivityRow) => {
                    if (!userJourneys[a.user_id]) userJourneys[a.user_id] = [];
                    userJourneys[a.user_id].push(`${a.action}(${a.status})`);
                });

                return {
                    total: rows.length,
                    uniqueUsers,
                    actionCounts,
                    errors: errors.slice(0, 20).map((e: ActivityRow) => ({
                        action: e.action,
                        details: e.details,
                        user_id: e.user_id,
                        created_at: e.created_at,
                    })),
                    warnings: warnings.slice(0, 20).map((w: ActivityRow) => ({
                        action: w.action,
                        details: w.details,
                        user_id: w.user_id,
                        created_at: w.created_at,
                    })),
                    userJourneys: Object.fromEntries(
                        Object.entries(userJourneys).slice(0, 20)
                    ),
                };
            } catch {
                return { total: 0, errors: [], warnings: [], summary: "Activity table not yet created" };
            }
        })(),
        // ─── WhatsApp Conversations (last 24h for GPT quality review) ────
        whatsappConversations: await (async () => {
            try {
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

                const { data: messages } = await supabase
                    .from("whatsapp_messages")
                    .select("phone_number, direction, content, message_type, status, created_at")
                    .gte("created_at", dayAgo)
                    .order("created_at", { ascending: true })
                    .limit(200);

                if (!messages || messages.length === 0) {
                    return { total: 0, conversations: [], summary: "No WhatsApp messages in last 24h" };
                }

                interface WaMsg {
                    phone_number: string;
                    direction: string;
                    content: string;
                    message_type: string;
                    status: string;
                    created_at: string;
                }

                const msgs = messages as WaMsg[];

                // Group by phone number for conversation view
                const convos: Record<string, { role: string; content: string; time: string }[]> = {};
                msgs.forEach((m: WaMsg) => {
                    if (!convos[m.phone_number]) convos[m.phone_number] = [];
                    convos[m.phone_number].push({
                        role: m.direction === "inbound" ? "user" : "bot",
                        content: m.content?.substring(0, 300) || "",
                        time: m.created_at,
                    });
                });

                const failed = msgs.filter((m: WaMsg) => m.status === "failed");

                return {
                    total: msgs.length,
                    uniquePhones: Object.keys(convos).length,
                    failedMessages: failed.length,
                    conversations: Object.entries(convos).slice(0, 30).map(([phone, msgs]) => ({
                        phone,
                        messageCount: msgs.length,
                        messages: msgs,
                    })),
                };
            } catch {
                return { total: 0, conversations: [], summary: "whatsapp_messages table not available" };
            }
        })(),
        // Platform info for context
        platform: {
            name: "Workers United",
            url: "https://workersunited.eu",
            entryFee: "$9",
            placementFee: "$190 (Serbia)",
            guarantee: "90-day money-back on entry fee",
        },
    };

    return NextResponse.json(report);
}
