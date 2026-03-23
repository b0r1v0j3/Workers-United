import { NextRequest, NextResponse } from "next/server";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { getAdminExceptionSnapshot } from "@/lib/admin-exceptions";
import { normalizePlatformWebsiteUrl } from "@/lib/platform-contact";
import { isInternalOrTestEmail } from "@/lib/reporting";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { summarizeWhatsAppTemplateHealth } from "@/lib/whatsapp-health";

// ─── Brain Data Collector ───────────────────────────────────────────────────
// Collects ALL system data for AI brain analysis (o1-pro / Claude / Gemini)
// Called by Brain Monitor cron to generate system health & improvement reports
//
// Auth: Requires CRON_SECRET bearer token (same as cron jobs)

const approvedLikeStatuses = new Set([
    "APPROVED",
    "IN_QUEUE",
    "OFFER_PENDING",
    "OFFER_ACCEPTED",
    "VISA_PROCESS_STARTED",
    "VISA_APPROVED",
    "PLACED",
]);

const successfulPaymentStatuses = new Set(["completed", "paid"]);
const paymentTrackingActions = [
    "payment_click",
    "checkout_session_create_attempt",
    "checkout_session_created",
    "payment_completed",
    "payment_failed",
];

function normalizePhone(value: string | null | undefined): string {
    return value ? value.replace(/\D/g, "") : "";
}

function toTimestamp(value: string | null | undefined): number {
    return value ? new Date(value).getTime() : 0;
}

export async function GET(request: NextRequest) {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createTypedAdminClient();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ─── PERF-001 fix: All queries run in parallel via Promise.all ──────
    const [
        profilesResult,
        workerRowsResult,
        documentsResult,
        paymentsResult,
        emailsResult,
        whatsappResult,
        employersResult,
        jobRequestsResult,
        matchesResult,
        offersResult,
        opsSnapshot,
    ] = await Promise.all([
        supabase.from("profiles").select("id, user_type, full_name, created_at"),
        supabase.from("worker_onboarding").select("id, profile_id, status, entry_fee_paid, queue_joined_at, phone"),
        supabase.from("worker_documents").select("user_id, document_type, status, created_at, verified_at"),
        supabase.from("payments").select("user_id, payment_type, status, amount, amount_cents, paid_at"),
        supabase.from("email_queue").select("id, email_type, status, error_message, recipient_email, created_at").gte("created_at", monthAgo.toISOString()),
        supabase.from("whatsapp_messages").select("direction, status, content, created_at, phone_number, message_type, template_name, error_message").gte("created_at", monthAgo.toISOString()).order("created_at", { ascending: false }),
        supabase.from("employers").select("id, status, country, industry, created_at"),
        supabase.from("job_requests").select("id, status, industry, destination_country, positions_count, created_at"),
        supabase.from("matches").select("id, status, worker_id, employer_id"),
        supabase.from("offers").select("id, status, worker_id, job_request_id"),
        getAdminExceptionSnapshot(),
    ]);

    const queryErrors = [
        ["profiles", profilesResult.error],
        ["worker_onboarding", workerRowsResult.error],
        ["worker_documents", documentsResult.error],
        ["payments", paymentsResult.error],
        ["email_queue", emailsResult.error],
        ["whatsapp_messages", whatsappResult.error],
        ["employers", employersResult.error],
        ["job_requests", jobRequestsResult.error],
        ["matches", matchesResult.error],
        ["offers", offersResult.error],
    ]
        .filter(([, error]) => Boolean(error))
        .map(([label, error]) => {
            const detail = typeof error === "string" ? error : error?.message;
            return `${label}: ${detail || "unknown error"}`;
        });

    if (queryErrors.length > 0) {
        console.error("[Brain Collect] Query errors:", queryErrors.join("; "));
        return NextResponse.json(
            {
                error: "Brain collect query failed",
                details: queryErrors,
            },
            { status: 500 }
        );
    }

    const allProfiles = profilesResult.data || [];
    const workerRows = workerRowsResult.data || [];
    const documents = documentsResult.data || [];
    const payments = paymentsResult.data || [];
    const emails = emailsResult.data || [];
    const whatsappMsgs = whatsappResult.data || [];
    const recentWhatsAppMsgs = whatsappMsgs.filter((message) =>
        toTimestamp(message.created_at) >= dayAgo.getTime()
    );
    const employerData = employersResult.data || [];
    const jobRequests = jobRequestsResult.data || [];
    const matches = matchesResult.data || [];
    const offers = offersResult.data || [];

    // ─── 1. User Statistics ─────────────────────────────────────────────
    const workers = allProfiles.filter(p => p.user_type === "worker");
    const newUsersThisWeek = allProfiles.filter(p =>
        p.created_at && new Date(p.created_at) >= weekAgo
    );
    // NOTE: totalEmployers uses employers table (not profiles) to match employers.total
    // This prevents the metric inconsistency flagged in Brain report (SEC-001)
    const profileCreatedAtById = new Map(
        workers.map(worker => [worker.id, worker.created_at || null])
    );
    const workerRecordProfileIds = new Set(
        workerRows.map(workerRecord => workerRecord.profile_id).filter(Boolean)
    );

    // ─── 2. Worker Onboarding Statuses ──────────────────────────────────
    const statusBreakdown: Record<string, number> = {};
    workerRows.forEach(workerRecord => {
        const statusKey = workerRecord.status || "UNKNOWN";
        statusBreakdown[statusKey] = (statusBreakdown[statusKey] || 0) + 1;
    });

    const progressedCount = workerRows.filter(workerRecord => workerRecord.status && workerRecord.status !== "NEW").length;
    const paidCount = workerRows.filter(workerRecord => workerRecord.entry_fee_paid).length;
    const inQueueCount = workerRows.filter(workerRecord => workerRecord.status === "IN_QUEUE").length;

    // ─── 3. Document Verification Stats ─────────────────────────────────
    const docStats = {
        total: documents.length,
        verified: documents.filter(d => d.status === "verified").length,
        pending: documents.filter(d => d.status === "pending").length,
        rejected: documents.filter(d => d.status === "rejected").length,
        byType: {} as Record<string, { verified: number; pending: number; rejected: number }>,
    };
    documents.forEach(d => {
        const documentType = d.document_type || "unknown";
        if (!docStats.byType[documentType]) {
            docStats.byType[documentType] = { verified: 0, pending: 0, rejected: 0 };
        }
        if (d.status === "verified") docStats.byType[documentType].verified++;
        if (d.status === "pending") docStats.byType[documentType].pending++;
        if (d.status === "rejected") docStats.byType[documentType].rejected++;
    });

    const documentsByUserId = new Map<string, typeof documents>();
    documents.forEach(document => {
        const userId = document.user_id;
        if (!userId) return;
        if (!documentsByUserId.has(userId)) {
            documentsByUserId.set(userId, []);
        }
        documentsByUserId.get(userId)?.push(document);
    });

    // ─── 4. Payment Stats ───────────────────────────────────────────────
    const paymentStats = {
        total: payments.length,
        successful: payments.filter(p => successfulPaymentStatuses.has(p.status || "")).length,
        failed: payments.filter(p => p.status === "failed").length,
        totalRevenue: payments
            .filter(p => successfulPaymentStatuses.has(p.status || ""))
            .reduce((sum, p) => {
                const amount = typeof p.amount === "number"
                    ? p.amount
                    : (p.amount_cents || 0) / 100;
                return sum + amount;
            }, 0),
        thisWeek: payments.filter(p => p.paid_at && new Date(p.paid_at) >= weekAgo).length,
    };

    const paymentEvents = await (async () => {
        try {
            const { data, error } = await supabase
                .from("user_activity")
                .select("action, status, details, user_id, created_at")
                .gte("created_at", monthAgo.toISOString())
                .in("action", paymentTrackingActions)
                .order("created_at", { ascending: false })
                .limit(1000);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.warn("[Brain Collect] Payment activity unavailable:", error);
            return [];
        }
    })();

    const paymentsByUserId = new Map<string, typeof payments>();
    payments.forEach(payment => {
        const userId = payment.user_id;
        if (!userId) return;
        if (!paymentsByUserId.has(userId)) {
            paymentsByUserId.set(userId, []);
        }
        paymentsByUserId.get(userId)?.push(payment);
    });

    // ─── 5. Email Queue Stats ───────────────────────────────────────────
    const failedEmails = emails.filter(e => e.status === "failed" || e.error_message);
    const emailStats = {
        totalThisMonth: emails.length,
        sent: emails.filter(e => e.status === "sent").length,
        failed: failedEmails.length,
        pending: emails.filter(e => e.status === "pending").length,
        byType: {} as Record<string, number>,
        // Individual failed emails with IDs for targeted retry (Brain Issues #8/#12/#14)
        recentFailedEmails: failedEmails.slice(0, 20).map(e => ({
            email_id: e.id,
            email_type: e.email_type,
            recipient: e.recipient_email,
            error_message: e.error_message?.substring(0, 200),
            created_at: e.created_at,
            retryable: !e.error_message?.includes("invalid") && !e.error_message?.includes("bounce"),
        })),
    };
    emails.forEach(e => {
        emailStats.byType[e.email_type] = (emailStats.byType[e.email_type] || 0) + 1;
    });

    // ─── 6. WhatsApp Chatbot Stats ──────────────────────────────────────
    const chatbotStats = {
        totalMessages: whatsappMsgs.length,
        inbound: whatsappMsgs.filter(m => m.direction === "inbound").length,
        outbound: whatsappMsgs.filter(m => m.direction === "outbound").length,
        failed: whatsappMsgs.filter(m => m.status === "failed").length,
        uniqueUsers: new Set(whatsappMsgs.map(m => m.phone_number)).size,
        thisWeek: whatsappMsgs.filter(m => toTimestamp(m.created_at) >= weekAgo.getTime()).length,
        totalOutboundTemplates: whatsappMsgs.filter(m => m.direction === "outbound" && m.message_type === "template").length,
        recentConversations: whatsappMsgs.slice(0, 50).map(m => ({
            direction: m.direction,
            content: m.content?.substring(0, 500),
            timestamp: m.created_at,
        })),
    };

    // ─── 7. Employer Stats ──────────────────────────────────────────────
    const employerStats = {
        total: employerData.length,
        verified: employerData.filter(e => e.status === "VERIFIED").length,
        pending: employerData.filter(e => e.status === "PENDING").length,
        byCountry: {} as Record<string, number>,
        byIndustry: {} as Record<string, number>,
    };
    employerData.forEach(e => {
        if (e.country) employerStats.byCountry[e.country] = (employerStats.byCountry[e.country] || 0) + 1;
        if (e.industry) employerStats.byIndustry[e.industry] = (employerStats.byIndustry[e.industry] || 0) + 1;
    });

    // ─── 9. Conversion Funnel ───────────────────────────────────────────
    const funnel = {
        registered: workers.length,
        // Kept field name for backward compatibility in existing AI prompts/reports.
        adminApproved: progressedCount,
        entryFeePaid: paidCount,
        inQueue: inQueueCount,
        matched: matches.length,
        offersSent: offers.length,
        offersAccepted: offers.filter(o => o.status === "accepted").length,
        conversionRate: workers.length > 0
            ? `${Math.round((paidCount / workers.length) * 100)}%`
            : "0%",
    };

    // ─── 9b. Per-User Funnel Stage Timestamps (Self-Improvement #1) ─────
    // Codex requested event-level funnel timestamps to diagnose WHERE users stall
    const funnelTimestamps = workerRows.slice(0, 50).map(workerRecord => {
        const registeredAt = workerRecord.profile_id ? profileCreatedAtById.get(workerRecord.profile_id) || null : null;
        const workerDocs = [...(documentsByUserId.get(workerRecord.profile_id || "") || [])]
            .sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at));
        const verifiedDocs = workerDocs.filter(d => d.status === "verified");
        const workerPayments = (paymentsByUserId.get(workerRecord.profile_id || "") || []).filter(p =>
            p.user_id === workerRecord.profile_id &&
            p.payment_type === "entry_fee" &&
            successfulPaymentStatuses.has(p.status || "") &&
            p.paid_at
        );

        return {
            worker_record_id: workerRecord.id,
            registered_at: registeredAt,
            first_doc_uploaded: workerDocs.length > 0 ? workerDocs[0]?.created_at : null,
            docs_verified_at: verifiedDocs.length > 0 ? verifiedDocs[verifiedDocs.length - 1]?.verified_at : null,
            admin_approved: approvedLikeStatuses.has(workerRecord.status || ""),
            payment_at: workerRecord.entry_fee_paid ? workerPayments[0]?.paid_at || "paid (date unknown)" : null,
            queue_joined_at: workerRecord.queue_joined_at,
            current_status: workerRecord.status,
            days_since_registration: registeredAt
                ? Math.floor((now.getTime() - new Date(registeredAt).getTime()) / (1000 * 60 * 60 * 24))
                : null,
        };
    });

    // ─── 9c. Payment Attempt Telemetry (Self-Improvement #1) ─────────────
    // Track ALL payment attempts (not just successful) to diagnose checkout drop-off
    const recentPaymentEvents = paymentEvents.filter(event => toTimestamp(event.created_at) >= dayAgo.getTime());
    const checkoutCreateAttempts = recentPaymentEvents.filter(event => event.action === "checkout_session_create_attempt").length;
    const checkoutSessionsCreated = recentPaymentEvents.filter(event => event.action === "checkout_session_created").length;
    const paymentClicks = recentPaymentEvents.filter(event => event.action === "payment_click").length;
    const paymentCompletedEvents = recentPaymentEvents.filter(event => event.action === "payment_completed").length;
    const paymentFailedEvents = recentPaymentEvents.filter(event => event.action === "payment_failed").length;
    const totalPaymentAttempts = Math.max(
        checkoutCreateAttempts,
        checkoutSessionsCreated,
        paymentClicks,
        recentPaymentEvents.length
    );
    const completedPayments = paymentCompletedEvents;
    const failedPayments = paymentFailedEvents;
    const paymentTelemetry = {
        totalAttempts: totalPaymentAttempts,
        checkoutCreateAttempts,
        checkoutSessionsCreated,
        paymentClicks,
        successful: completedPayments,
        failed: failedPayments,
        pending: payments.filter(p => p.status === "pending" || p.status === "created").length,
        abandoned: payments.filter(p => p.status === "abandoned" || p.status === "expired").length,
        dataSource: recentPaymentEvents.length > 0 ? "payments + user_activity (last 24h attempts/failures)" : "payments",
        conversionRate: totalPaymentAttempts > 0
            ? `${Math.round((completedPayments / totalPaymentAttempts) * 100)}%`
            : "No attempts",
        recentAttempts: recentPaymentEvents.length > 0
            ? recentPaymentEvents.slice(0, 20).map(event => ({
                action: event.action,
                status: event.status,
                created_at: event.created_at,
                user_id: event.user_id,
                details: event.details,
            }))
            : payments.slice(0, 20).map(payment => ({
                action: "payment_record",
                status: payment.status,
                user_id: payment.user_id,
                amount: typeof payment.amount === "number" ? payment.amount : (payment.amount_cents || 0) / 100,
                paid_at: payment.paid_at,
            })),
    };

    // ─── 9d. User Stall Detection — WHERE is each user stuck? ────────────
    const stalls = {
        no_worker_record: workers.filter(workerProfile => !workerRecordProfileIds.has(workerProfile.id)).length,
        no_docs_uploaded: workerRows.filter(workerRecord => {
            const userDocs = documentsByUserId.get(workerRecord.profile_id || "") || [];
            return workerRecord.status === "NEW" && userDocs.length === 0;
        }).length,
        docs_pending_verification: documents.filter(d => d.status === "pending" || d.status === "verifying").length,
        not_admin_approved: workerRows.filter(workerRecord => workerRecord.status !== "NEW" && !approvedLikeStatuses.has(workerRecord.status || "") && !workerRecord.entry_fee_paid).length,
        approved_not_paid: workerRows.filter(workerRecord => approvedLikeStatuses.has(workerRecord.status || "") && !workerRecord.entry_fee_paid).length,
        summary: "",
    };
    const topBottleneck = Object.entries(stalls)
        .filter(([k]) => k !== "summary")
        .sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    stalls.summary = topBottleneck ? `Biggest bottleneck: ${topBottleneck[0]} (${topBottleneck[1]} users)` : "No stalls detected";

    // ─── 9e. Email Bounce Patterns — learn from delivery failures ────────
    const bouncePatterns: Record<string, number> = {};
    emails.filter(e => e.status === "failed" && e.error_message).forEach(e => {
        const domain = (e.recipient_email || "")?.split("@")[1]?.toLowerCase();
        if (domain) bouncePatterns[domain] = (bouncePatterns[domain] || 0) + 1;
    });

    // ─── 10. System Health Indicators ───────────────────────────────────
    const failedWhatsApp = whatsappMsgs.filter(m => m.status === "failed");
    const recentFailedWhatsApp = recentWhatsAppMsgs.filter(m => m.status === "failed");
    const whatsappTemplateHealth = summarizeWhatsAppTemplateHealth({
        totalOutboundTemplates: recentWhatsAppMsgs.filter(
            (message) => message.direction === "outbound" && message.message_type === "template"
        ).length,
        failedMessages: recentFailedWhatsApp
            .filter((message) => message.direction === "outbound" && message.message_type === "template")
            .map((message) => ({
                templateName: message.template_name,
                errorMessage: message.error_message,
            })),
    });

    const health = {
        emailDeliveryRate: emailStats.totalThisMonth > 0
            ? `${Math.round((emailStats.sent / emailStats.totalThisMonth) * 100)}%`
            : "N/A",
        whatsappDeliveryRate: chatbotStats.totalMessages > 0
            ? `${Math.round(((chatbotStats.totalMessages - chatbotStats.failed) / chatbotStats.totalMessages) * 100)}%`
            : "N/A",
        failedEmailCount: failedEmails.length,
        failedWhatsAppCount: recentFailedWhatsApp.length,
        whatsappTemplateHealth,
        recentFailedEmails: failedEmails.slice(0, 5).map(e => ({
            type: e.email_type,
            error: e.error_message,
            date: e.created_at,
        })),
        recentFailedWhatsApp: recentFailedWhatsApp.slice(0, 5).map(message => ({
            template_name: message.template_name,
            error_message: message.error_message,
            status: message.status,
            date: message.created_at,
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
            totalEmployers: employerData.length,
            newThisWeek: newUsersThisWeek.length,
            statusBreakdown,
        },
        documents: docStats,
        payments: paymentStats,
        emails: emailStats,
        chatbot: chatbotStats,
        employers: employerStats,
        jobRequests: {
            total: jobRequests.length,
            open: jobRequests.filter(j => j.status === "open" || j.status === "active").length,
        },
        matches: {
            total: matches.length,
            thisWeek: null,
            timeTrackingAvailable: false,
        },
        offers: {
            total: offers.length,
            accepted: offers.filter(o => o.status === "accepted").length,
        },
        funnel,
        funnelTimestamps,
        paymentTelemetry,
        stalls,
        bouncePatterns,
        health,
        opsSnapshot,
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
        // ─── 11. Auth Health (detect email confirmation / record issues) ────
        authHealth: await (async () => {
            try {
                const { getAllAuthUsers } = await import("@/lib/supabase/admin");
                const allAuthUsers = await getAllAuthUsers(supabase);
                const reportableAuthUsers = allAuthUsers.filter((user) =>
                    !isInternalOrTestEmail(user.email || null)
                );
                const profileIds = new Set(allProfiles.map(p => p.id));
                const signupWindowHours = 72;
                const recentSignupWindowStartMs = now.getTime() - signupWindowHours * 60 * 60 * 1000;
                const previousSignupWindowStartMs = recentSignupWindowStartMs - signupWindowHours * 60 * 60 * 1000;

                const { data: signupActivityRows, error: signupActivityError } = await supabase
                    .from("user_activity")
                    .select("action, created_at, details")
                    .in("action", ["signup_page_view", "signup_submit_attempt"])
                    .gte("created_at", new Date(previousSignupWindowStartMs).toISOString());

                if (signupActivityError) {
                    throw signupActivityError;
                }

                const isAnonymousSignupEvent = (details: unknown) => {
                    if (!details || typeof details !== "object" || Array.isArray(details)) {
                        return false;
                    }

                    return (details as Record<string, unknown>).anonymous === true;
                };

                const countRowsInWindow = (
                    rows: Array<{ created_at?: string | null }>,
                    startMs: number,
                    endMs = Number.POSITIVE_INFINITY
                ) => rows.filter((row) => {
                    const timestamp = toTimestamp(row.created_at);
                    return timestamp >= startMs && timestamp < endMs;
                }).length;

                const latestTimestampForRows = (rows: Array<{ created_at?: string | null }>) =>
                    rows.reduce<string | null>((latest, row) => {
                        const currentTime = toTimestamp(row.created_at);
                        const latestTime = toTimestamp(latest);
                        return currentTime > latestTime ? row.created_at || latest : latest;
                    }, null);

                const unconfirmedUsers = reportableAuthUsers.filter((u: SupabaseAuthUser) => !u.email_confirmed_at);
                const noUserType = reportableAuthUsers.filter((u: SupabaseAuthUser) => !u.user_metadata?.user_type);
                const workersWithoutProfile = reportableAuthUsers.filter((u: SupabaseAuthUser) =>
                    u.user_metadata?.user_type === "worker" && !profileIds.has(u.id)
                );
                const workersWithoutWorkerOnboarding = reportableAuthUsers.filter((u: SupabaseAuthUser) =>
                    u.user_metadata?.user_type === "worker" && !workerRecordProfileIds.has(u.id)
                );

                // Users registered in last 7 days who never completed profile
                const recentStuckUsers = reportableAuthUsers.filter((u: SupabaseAuthUser) => {
                    const createdAt = new Date(u.created_at);
                    const isRecent = createdAt >= weekAgo;
                    const isWorker = u.user_metadata?.user_type === "worker";
                    const hasNoWorkerOnboarding = !workerRecordProfileIds.has(u.id);
                    return isRecent && isWorker && hasNoWorkerOnboarding;
                });

                const anonymousSignupEvents = (signupActivityRows || []).filter((row) =>
                    isAnonymousSignupEvent(row.details)
                );
                const anonymousSignupPageViews = anonymousSignupEvents.filter((row) => row.action === "signup_page_view");
                const anonymousSignupSubmitAttempts = anonymousSignupEvents.filter((row) => row.action === "signup_submit_attempt");
                const recentAnonymousPageViews = countRowsInWindow(
                    anonymousSignupPageViews,
                    recentSignupWindowStartMs
                );
                const previousAnonymousPageViews = countRowsInWindow(
                    anonymousSignupPageViews,
                    previousSignupWindowStartMs,
                    recentSignupWindowStartMs
                );
                const recentAnonymousSubmitAttempts = countRowsInWindow(
                    anonymousSignupSubmitAttempts,
                    recentSignupWindowStartMs
                );
                const previousAnonymousSubmitAttempts = countRowsInWindow(
                    anonymousSignupSubmitAttempts,
                    previousSignupWindowStartMs,
                    recentSignupWindowStartMs
                );
                const recentNewAuthUsers = reportableAuthUsers.filter((user) => {
                    const createdAtTs = toTimestamp(user.created_at);
                    return createdAtTs >= recentSignupWindowStartMs;
                });
                const previousNewAuthUsers = reportableAuthUsers.filter((user) => {
                    const createdAtTs = toTimestamp(user.created_at);
                    return createdAtTs >= previousSignupWindowStartMs && createdAtTs < recentSignupWindowStartMs;
                });

                const signupTrafficTriggers: string[] = [];
                if (
                    previousAnonymousPageViews >= 8
                    && recentAnonymousPageViews <= Math.max(2, Math.floor(previousAnonymousPageViews * 0.35))
                ) {
                    signupTrafficTriggers.push("page_views");
                }
                if (previousAnonymousSubmitAttempts >= 3 && recentAnonymousSubmitAttempts === 0) {
                    signupTrafficTriggers.push("submit_attempts");
                }
                if (previousNewAuthUsers.length >= 2 && recentNewAuthUsers.length === 0) {
                    signupTrafficTriggers.push("new_auth_users");
                }

                const signupFunnelStatus = signupTrafficTriggers.length >= 2 ? "WARNING" : "OK";
                const signupFunnelSummary = signupFunnelStatus === "WARNING"
                    ? `Anonymous signup funnel activity fell in the last ${signupWindowHours}h: ${recentAnonymousPageViews} page view(s), ${recentAnonymousSubmitAttempts} submit attempt(s), and ${recentNewAuthUsers.length} new auth user(s) vs ${previousAnonymousPageViews}/${previousAnonymousSubmitAttempts}/${previousNewAuthUsers.length} in the previous ${signupWindowHours}h.`
                    : "Signup traffic is within the recent baseline.";

                return {
                    totalAuthUsers: reportableAuthUsers.length,
                    unconfirmedEmails: {
                        count: unconfirmedUsers.length,
                        users: unconfirmedUsers.slice(0, 20).map((u: SupabaseAuthUser) => ({
                            id: u.id,
                            email: u.email,
                            created_at: u.created_at,
                            days_unconfirmed: Math.floor((now.getTime() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                        })),
                    },
                    missingUserType: {
                        count: noUserType.length,
                        users: noUserType.slice(0, 10).map((u: SupabaseAuthUser) => ({ id: u.id, email: u.email })),
                    },
                    workersWithoutProfile: {
                        count: workersWithoutProfile.length,
                        users: workersWithoutProfile.slice(0, 10).map((u: SupabaseAuthUser) => ({ id: u.id, email: u.email })),
                    },
                    workersWithoutWorkerOnboarding: {
                        count: workersWithoutWorkerOnboarding.length,
                        users: workersWithoutWorkerOnboarding.slice(0, 10).map((u: SupabaseAuthUser) => ({ id: u.id, email: u.email })),
                    },
                    recentStuckSignups: {
                        count: recentStuckUsers.length,
                        users: recentStuckUsers.slice(0, 10).map((u: SupabaseAuthUser) => ({
                            id: u.id,
                            email: u.email,
                            created_at: u.created_at,
                        })),
                    },
                    signupFunnel: {
                        status: signupFunnelStatus,
                        summary: signupFunnelSummary,
                        triggeredSignals: signupTrafficTriggers,
                        pageViews: {
                            count: recentAnonymousPageViews,
                            previousCount: previousAnonymousPageViews,
                            windowHours: signupWindowHours,
                            previousWindowHours: signupWindowHours,
                            lastSeenAt: latestTimestampForRows(anonymousSignupPageViews),
                        },
                        submitAttempts: {
                            count: recentAnonymousSubmitAttempts,
                            previousCount: previousAnonymousSubmitAttempts,
                            windowHours: signupWindowHours,
                            previousWindowHours: signupWindowHours,
                            lastSeenAt: latestTimestampForRows(anonymousSignupSubmitAttempts),
                        },
                        newAuthUsers: {
                            count: recentNewAuthUsers.length,
                            previousCount: previousNewAuthUsers.length,
                            windowHours: signupWindowHours,
                            previousWindowHours: signupWindowHours,
                            lastSeenAt: latestTimestampForRows(reportableAuthUsers),
                        },
                    },
                    status: unconfirmedUsers.length > 5 ? "CRITICAL"
                        : unconfirmedUsers.length > 0 ? "WARNING"
                            : workersWithoutWorkerOnboarding.length > 3 ? "WARNING"
                                : "OK",
                };
            } catch (err) {
                return { status: "ERROR", error: String(err) };
            }
        })(),
        // Platform info for context
        platform: {
            name: "Workers United",
            url: normalizePlatformWebsiteUrl(process.env.NEXT_PUBLIC_BASE_URL),
            entryFee: "$9",
            placementFee: "$190 (current market)",
            guarantee: "90-day money-back on entry fee",
        },
        // WhatsApp → $9 conversion tracking
        whatsappConversion: await (async () => {
            try {
                // Unique phone numbers that have chatted with us
                const { data: waPhones } = await supabase
                    .from("whatsapp_messages")
                    .select("phone_number")
                    .eq("direction", "inbound");
                const uniqueWaPhones = new Set(
                    (waPhones || [])
                        .map(p => normalizePhone(p.phone_number))
                        .filter(Boolean)
                );

                const paidWorkers = workerRows.filter(workerRecord => workerRecord.entry_fee_paid && Boolean(workerRecord.phone));
                const paidPhones = paidWorkers
                    .map(workerRecord => normalizePhone(workerRecord.phone))
                    .filter(Boolean);

                // How many WhatsApp users converted to paying
                const convertedFromWa = paidPhones.filter(phone =>
                    uniqueWaPhones.has(phone)
                ).length;

                return {
                    totalWhatsAppContacts: uniqueWaPhones.size,
                    totalPaidUsers: paidWorkers.length,
                    convertedFromWhatsApp: convertedFromWa,
                    conversionRate: uniqueWaPhones.size > 0
                        ? `${((convertedFromWa / uniqueWaPhones.size) * 100).toFixed(1)}%`
                        : "N/A",
                };
            } catch { return { error: "Failed to calculate" }; }
        })(),
    };

    return NextResponse.json(report);
}
