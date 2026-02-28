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

    // ─── 1. User Statistics ─────────────────────────────────────────────
    const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, user_type, full_name, created_at");

    const workers = (allProfiles || []).filter(p => p.user_type === "worker");
    const employers = (allProfiles || []).filter(p => p.user_type === "employer");
    const newUsersThisWeek = (allProfiles || []).filter(p =>
        new Date(p.created_at) >= weekAgo
    );

    // ─── 2. Candidate Statuses ──────────────────────────────────────────
    const { data: candidates } = await supabase
        .from("candidates")
        .select("id, profile_id, status, admin_approved, entry_fee_paid, queue_joined_at, created_at");

    const statusBreakdown: Record<string, number> = {};
    (candidates || []).forEach(c => {
        statusBreakdown[c.status] = (statusBreakdown[c.status] || 0) + 1;
    });

    const approvedCount = (candidates || []).filter(c => c.admin_approved).length;
    const paidCount = (candidates || []).filter(c => c.entry_fee_paid).length;
    const inQueueCount = (candidates || []).filter(c => c.status === "IN_QUEUE").length;

    // ─── 3. Document Verification Stats ─────────────────────────────────
    const { data: documents } = await supabase
        .from("candidate_documents")
        .select("document_type, status, created_at, verified_at");

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
    const { data: payments } = await supabase
        .from("payments")
        .select("fee_type, status, amount, paid_at, created_at");

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
    const { data: emails } = await supabase
        .from("email_queue")
        .select("type, sent, error, created_at")
        .gte("created_at", monthAgo.toISOString());

    const emailStats = {
        totalThisMonth: (emails || []).length,
        sent: (emails || []).filter(e => e.sent).length,
        failed: (emails || []).filter(e => e.error).length,
        pending: (emails || []).filter(e => !e.sent && !e.error).length,
        byType: {} as Record<string, number>,
    };
    (emails || []).forEach(e => {
        emailStats.byType[e.type] = (emailStats.byType[e.type] || 0) + 1;
    });

    // ─── 6. WhatsApp Chatbot Stats ──────────────────────────────────────
    const { data: whatsappMsgs } = await supabase
        .from("whatsapp_messages")
        .select("direction, status, content, created_at, phone_number")
        .gte("created_at", monthAgo.toISOString())
        .order("created_at", { ascending: false });

    const chatbotStats = {
        totalMessages: (whatsappMsgs || []).length,
        inbound: (whatsappMsgs || []).filter(m => m.direction === "inbound").length,
        outbound: (whatsappMsgs || []).filter(m => m.direction === "outbound").length,
        failed: (whatsappMsgs || []).filter(m => m.status === "failed").length,
        uniqueUsers: new Set((whatsappMsgs || []).map(m => m.phone_number)).size,
        thisWeek: (whatsappMsgs || []).filter(m => new Date(m.created_at) >= weekAgo).length,
        // Last 20 conversations for quality review
        recentConversations: (whatsappMsgs || []).slice(0, 50).map(m => ({
            direction: m.direction,
            content: m.content?.substring(0, 500), // Truncate long messages
            timestamp: m.created_at,
        })),
    };

    // ─── 7. Employer Stats ──────────────────────────────────────────────
    const { data: employerData } = await supabase
        .from("employers")
        .select("id, status, country, industry, created_at");

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

    // ─── 8. Job Requests & Matches ──────────────────────────────────────
    const { data: jobRequests } = await supabase
        .from("job_requests")
        .select("id, status, industry, country, positions_available, created_at");

    const { data: matches } = await supabase
        .from("matches")
        .select("id, status, created_at");

    const { data: offers } = await supabase
        .from("offers")
        .select("id, status, created_at");

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
    const failedEmails = (emails || []).filter(e => e.error);
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
            type: e.type,
            error: e.error,
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
            totalEmployers: employers.length,
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
