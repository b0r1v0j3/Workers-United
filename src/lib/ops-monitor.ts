import type { AdminExceptionSnapshot } from "@/lib/admin-exceptions";
import { isRecipientSideWhatsAppFailure } from "@/lib/whatsapp-health";
import { detectWhatsAppConfusionCases, humanizeWhatsAppHandoffReason } from "@/lib/whatsapp-quality";

export type OpsSignalSeverity = "critical" | "high" | "medium";
export type OpsSectionStatus = "OK" | "WARNING" | "CRITICAL";
export type OpsSignalCategory =
    | "system"
    | "whatsapp"
    | "documents"
    | "email"
    | "payments"
    | "admin-review"
    | "auth";

export interface OpsSignalLink {
    label: string;
    href: string;
}

export interface OpsMonitorSignal {
    key: string;
    category: OpsSignalCategory;
    severity: OpsSignalSeverity;
    title: string;
    count: number;
    summary: string;
    evidence: string[];
    links: OpsSignalLink[];
}

export interface OpsMonitorSection {
    name: string;
    status: OpsSectionStatus;
    summary: string;
    count: number;
}

export interface OpsMonitorMetrics {
    totalSignals: number;
    criticalSignals: number;
    highSignals: number;
    manualReviewWorkers: number;
    pendingAdminApprovalWorkers: number;
    invalidEmailProfiles: number;
    failedPaymentAttempts: number;
    whatsappConfusionCases: number;
}

export interface OpsMonitorReport {
    generatedAt: string;
    summary: string;
    healthScore: number;
    sections: OpsMonitorSection[];
    signals: OpsMonitorSignal[];
    metrics: OpsMonitorMetrics;
}

interface RouteHealthEntry {
    status: number | string;
    ok: boolean;
    latencyMs: number;
}

interface WhatsAppConversationMessage {
    role?: string;
    content?: string | null;
    time?: string | null;
}

interface WhatsAppConversation {
    phone?: string;
    messageCount?: number;
    messages?: WhatsAppConversationMessage[];
}

interface FailedWhatsAppSample {
    template_name?: string | null;
    error_message?: string | null;
    status?: string | null;
    date?: string | null;
}

interface FailedEmailSample {
    type?: string | null;
    error?: string | null;
    date?: string | null;
}

interface PaymentAttemptSample {
    action?: string | null;
    status?: string | null;
    created_at?: string | null;
    user_id?: string | null;
}

interface AuthHealthData {
    status?: string | null;
    unconfirmedEmails?: { count?: number | null };
    workersWithoutWorkerOnboarding?: { count?: number | null };
    recentStuckSignups?: { count?: number | null };
}

interface DocumentStats {
    rejected?: number | null;
    pending?: number | null;
}

interface WhatsAppTemplateHealth {
    state?: string | null;
    details?: string | null;
    totalOutboundTemplates?: number | null;
    failedTemplates?: number | null;
    platformFailures?: number | null;
    recipientFailures?: number | null;
}

interface PaymentTelemetry {
    failed?: number | null;
    abandoned?: number | null;
    pending?: number | null;
    successful?: number | null;
    totalAttempts?: number | null;
    recentAttempts?: PaymentAttemptSample[];
}

export interface BuildOpsMonitorReportInput {
    generatedAt: string;
    opsSnapshot: AdminExceptionSnapshot;
    routeHealth?: Record<string, RouteHealthEntry>;
    whatsappTemplateHealth?: WhatsAppTemplateHealth | null;
    recentFailedWhatsApp?: FailedWhatsAppSample[];
    recentFailedEmails?: FailedEmailSample[];
    whatsappConversations?: {
        conversations?: WhatsAppConversation[];
    } | null;
    paymentTelemetry?: PaymentTelemetry | null;
    authHealth?: AuthHealthData | null;
    documents?: DocumentStats | null;
}

function getCount(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function daysOrHoursLabel(hours: number) {
    if (hours >= 48) {
        const days = Math.floor(hours / 24);
        return `${days}d`;
    }

    return `${hours}h`;
}

function escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function absoluteHref(href: string, baseUrl?: string) {
    if (!href) {
        return href;
    }

    if (/^https?:\/\//i.test(href)) {
        return href;
    }

    if (!baseUrl) {
        return href;
    }

    return `${baseUrl.replace(/\/$/, "")}${href.startsWith("/") ? href : `/${href}`}`;
}

function sectionStatus(signals: OpsMonitorSignal[]): OpsSectionStatus {
    if (signals.some((signal) => signal.severity === "critical")) {
        return "CRITICAL";
    }

    if (signals.length > 0) {
        return "WARNING";
    }

    return "OK";
}

function pushSignal(signals: OpsMonitorSignal[], signal: OpsMonitorSignal | null) {
    if (!signal || signal.count <= 0) {
        return;
    }

    signals.push(signal);
}

export function buildOpsMonitorReport(input: BuildOpsMonitorReportInput): OpsMonitorReport {
    const signals: OpsMonitorSignal[] = [];
    const routeFailures = Object.entries(input.routeHealth || {}).filter(([, health]) => !health.ok);
    const confusionCases = detectWhatsAppConfusionCases(input.whatsappConversations?.conversations);
    const whatsappTemplateHealth = input.whatsappTemplateHealth;
    const platformWhatsAppFailures = getCount(whatsappTemplateHealth?.platformFailures);
    const replyDeliveryFailures = getCount(input.opsSnapshot.whatsappQuality.replyDeliveryFailures);
    const retryableReplyDeliveryFailures = getCount(input.opsSnapshot.whatsappQuality.retryableReplyFailures);
    const invalidEmailProfiles = input.opsSnapshot.invalidEmailProfiles.length;
    const paymentFailures = Math.max(
        getCount(input.paymentTelemetry?.failed),
        (input.paymentTelemetry?.recentAttempts || []).filter((attempt) =>
            attempt.status === "failed" || attempt.action === "payment_failed"
        ).length
    );
    const checkoutDriftCount =
        input.opsSnapshot.openedCheckoutButUnpaid.length + input.opsSnapshot.stalePendingPayments.length;
    const manualReviewWorkers = input.opsSnapshot.manualReviewProfiles.length;
    const pendingAdminApprovalWorkers = input.opsSnapshot.pendingAdminApproval.length;
    const authUnconfirmedCount = getCount(input.authHealth?.unconfirmedEmails?.count);
    const authMissingWorkerCount = getCount(input.authHealth?.workersWithoutWorkerOnboarding?.count);
    const authStuckSignupCount = getCount(input.authHealth?.recentStuckSignups?.count);
    const recentRejectedDocuments = getCount(input.documents?.rejected);
    const recentPendingDocuments = getCount(input.documents?.pending);

    pushSignal(signals, routeFailures.length > 0 ? {
        key: "route-failures",
        category: "system",
        severity: "critical",
        title: "Critical route self-test failures",
        count: routeFailures.length,
        summary: `${routeFailures.length} critical route${routeFailures.length === 1 ? "" : "s"} returned a failed health signal during the daily sweep.`,
        evidence: routeFailures.map(([route, health]) => `${route} → ${health.status} in ${health.latencyMs}ms`),
        links: [{ label: "Open admin dashboard", href: "/admin" }],
    } : null);

    pushSignal(signals, platformWhatsAppFailures > 0 ? {
        key: "whatsapp-platform-failures",
        category: "whatsapp",
        severity: platformWhatsAppFailures >= 3 ? "critical" : "high",
        title: "Platform-side WhatsApp template failures",
        count: platformWhatsAppFailures,
        summary: whatsappTemplateHealth?.details || `${platformWhatsAppFailures} platform-side template failure(s) were detected in recent WhatsApp sends.`,
        evidence: (input.recentFailedWhatsApp || [])
            .filter((message) => !isRecipientSideWhatsAppFailure(message.error_message))
            .slice(0, 3)
            .map((message) => `${message.template_name || "unknown template"} → ${message.error_message || "unknown error"}`),
        links: [{ label: "Open WhatsApp blast", href: "/admin/whatsapp-blast" }],
    } : null);

    pushSignal(signals, confusionCases.length > 0 ? {
        key: "whatsapp-confusion",
        category: "whatsapp",
        severity: confusionCases.length >= 3 ? "high" : "medium",
        title: "Recent WhatsApp confusion cases",
        count: confusionCases.length,
        summary: `${confusionCases.length} recent WhatsApp conversation${confusionCases.length === 1 ? "" : "s"} show repeated user confusion or unanswered bursts.`,
        evidence: confusionCases.slice(0, 3).map((entry) => {
            const snippets = entry.sample.join(" | ") || "Repeated inbound burst without a clear resolution";
            return `${entry.phone} • ${entry.inboundCount} inbound • burst ${entry.unansweredBurst} • ${humanizeWhatsAppHandoffReason(entry.reason)} • ${snippets}`;
        }),
        links: [{ label: "Open admin inbox", href: "/admin/inbox" }],
    } : null);

    pushSignal(signals, replyDeliveryFailures > 0 ? {
        key: "whatsapp-reply-delivery-failures",
        category: "whatsapp",
        severity: retryableReplyDeliveryFailures >= 2 ? "high" : "medium",
        title: "WhatsApp reply delivery failures",
        count: replyDeliveryFailures,
        summary: retryableReplyDeliveryFailures > 0
            ? `${replyDeliveryFailures} WhatsApp reply delivery failure(s) were logged in the last 24 hours, including ${retryableReplyDeliveryFailures} retryable platform-side failure(s).`
            : `${replyDeliveryFailures} WhatsApp reply delivery failure(s) were logged in the last 24 hours.`,
        evidence: input.opsSnapshot.whatsappQuality.recentReplyDeliveryFailures
            .slice(0, 3)
            .map((entry) => `${entry.phone} • ${entry.failureCategory}${entry.retryable ? " • retryable" : ""} • ${entry.preview}`),
        links: [{ label: "Open admin inbox", href: "/admin/inbox" }],
    } : null);

    pushSignal(signals, manualReviewWorkers > 0 ? {
        key: "document-review-backlog",
        category: "documents",
        severity: manualReviewWorkers >= 5 ? "high" : "medium",
        title: "Document review backlog",
        count: manualReviewWorkers,
        summary: `${manualReviewWorkers} worker case${manualReviewWorkers === 1 ? "" : "s"} currently have documents waiting in manual review.${recentRejectedDocuments > 0 ? ` ${recentRejectedDocuments} rejected doc row(s) are also present in the recent dataset.` : ""}`,
        evidence: input.opsSnapshot.manualReviewProfiles.slice(0, 3).map((entry) =>
            `${entry.fullName} • ${entry.manualReviewCount} doc(s) • latest ${entry.latestReviewAt || "unknown"}`
        ),
        links: [{ label: "Open admin review", href: "/admin/review" }],
    } : null);

    pushSignal(signals, recentRejectedDocuments >= 3 ? {
        key: "rejected-documents",
        category: "documents",
        severity: recentRejectedDocuments >= 8 ? "high" : "medium",
        title: "Rejected document volume is climbing",
        count: recentRejectedDocuments,
        summary: `${recentRejectedDocuments} document row(s) are currently rejected and likely need better worker guidance or tighter upload validation.`,
        evidence: [
            `${recentPendingDocuments} document row(s) are still pending/verifying in the current dataset.`,
            `${manualReviewWorkers} worker case(s) are sitting in manual review right now.`,
            `${pendingAdminApprovalWorkers} fully-ready case(s) are already waiting on approval.`,
        ],
        links: [{ label: "Open admin review", href: "/admin/review" }],
    } : null);

    pushSignal(signals, pendingAdminApprovalWorkers > 0 ? {
        key: "admin-approval-backlog",
        category: "admin-review",
        severity: pendingAdminApprovalWorkers >= 5 ? "high" : "medium",
        title: "Workers waiting on admin approval",
        count: pendingAdminApprovalWorkers,
        summary: `${pendingAdminApprovalWorkers} fully-ready worker case${pendingAdminApprovalWorkers === 1 ? "" : "s"} are still waiting on admin approval before payment unlocks.`,
        evidence: input.opsSnapshot.pendingAdminApproval.slice(0, 3).map((entry) =>
            `${entry.fullName} • ${entry.verifiedDocs}/3 verified • waiting ${daysOrHoursLabel(entry.waitingHours)}`
        ),
        links: [{ label: "Open worker registry", href: "/admin/workers?filter=needs_approval" }],
    } : null);

    pushSignal(signals, invalidEmailProfiles > 0 ? {
        key: "email-hygiene",
        category: "email",
        severity: invalidEmailProfiles >= 5 ? "high" : "medium",
        title: "Invalid or bounced profile emails",
        count: invalidEmailProfiles,
        summary: `${invalidEmailProfiles} profile email${invalidEmailProfiles === 1 ? "" : "s"} are currently flagged as invalid or recently bounced.`,
        evidence: input.opsSnapshot.invalidEmailProfiles.slice(0, 3).map((entry) =>
            `${entry.fullName} • ${entry.email} • ${entry.reason}`
        ),
        links: [{ label: "Open email health", href: "/internal/email-health" }],
    } : null);

    pushSignal(signals, paymentFailures > 0 ? {
        key: "payment-failures",
        category: "payments",
        severity: paymentFailures >= 3 ? "high" : "medium",
        title: "Recent failed payment attempts",
        count: paymentFailures,
        summary: `${paymentFailures} recent payment attempt${paymentFailures === 1 ? "" : "s"} failed before completion.`,
        evidence: (input.paymentTelemetry?.recentAttempts || [])
            .filter((attempt) => attempt.status === "failed" || attempt.action === "payment_failed")
            .slice(0, 3)
            .map((attempt) => `${attempt.user_id || "unknown user"} • ${attempt.action || "payment_failed"} • ${attempt.created_at || "unknown time"}`),
        links: [{ label: "Open analytics", href: "/admin/analytics" }],
    } : null);

    pushSignal(signals, checkoutDriftCount > 0 ? {
        key: "checkout-drift",
        category: "payments",
        severity: input.opsSnapshot.stalePendingPayments.length > 0 ? "high" : "medium",
        title: "Checkout drift and unpaid recovery cases",
        count: checkoutDriftCount,
        summary: `${input.opsSnapshot.openedCheckoutButUnpaid.length} opened-but-unpaid checkout case(s) and ${input.opsSnapshot.stalePendingPayments.length} stale pending payment row(s) need ops attention.`,
        evidence: [
            ...input.opsSnapshot.openedCheckoutButUnpaid.slice(0, 2).map((entry) =>
                `${entry.fullName} • ${entry.hoursSinceCheckout}h since checkout • ${entry.nextStepLabel}`
            ),
            ...input.opsSnapshot.stalePendingPayments.slice(0, 2).map((entry) =>
                `${entry.fullName} • stale pending row • ${entry.hoursSinceCheckout}h old`
            ),
        ],
        links: [{ label: "Open analytics", href: "/admin/analytics" }],
    } : null);

    pushSignal(signals, input.opsSnapshot.paidButNotInQueue.length > 0 ? {
        key: "queue-drift",
        category: "payments",
        severity: "critical",
        title: "Paid workers not advanced into queue",
        count: input.opsSnapshot.paidButNotInQueue.length,
        summary: `${input.opsSnapshot.paidButNotInQueue.length} paid worker case${input.opsSnapshot.paidButNotInQueue.length === 1 ? "" : "s"} are still not in a post-payment queue status.`,
        evidence: input.opsSnapshot.paidButNotInQueue.slice(0, 3).map((entry) =>
            `${entry.fullName} • ${entry.workerStatus} • paid ${entry.paidAt || "date unknown"}`
        ),
        links: [{ label: "Open queue", href: "/admin/queue" }],
    } : null);

    const authSignalCount = authUnconfirmedCount + authMissingWorkerCount + authStuckSignupCount;
    pushSignal(signals, authSignalCount > 0 ? {
        key: "auth-health",
        category: "auth",
        severity: input.authHealth?.status === "CRITICAL" || authMissingWorkerCount > 0 ? "critical" : "high",
        title: "Auth and signup drift detected",
        count: authSignalCount,
        summary: `${authUnconfirmedCount} unconfirmed email(s), ${authMissingWorkerCount} missing worker onboarding record(s), and ${authStuckSignupCount} recent stuck signup(s) were detected.`,
        evidence: [
            authUnconfirmedCount > 0 ? `${authUnconfirmedCount} unconfirmed auth users` : null,
            authMissingWorkerCount > 0 ? `${authMissingWorkerCount} workers missing onboarding rows` : null,
            authStuckSignupCount > 0 ? `${authStuckSignupCount} recent worker signups with no worker row` : null,
        ].filter((value): value is string => Boolean(value)),
        links: [{ label: "Open admin dashboard", href: "/admin" }],
    } : null);

    const sections: OpsMonitorSection[] = [
        {
            name: "System",
            status: sectionStatus(signals.filter((signal) => signal.category === "system" || signal.category === "auth")),
            summary: routeFailures.length > 0
                ? `${routeFailures.length} route failure(s) and ${authSignalCount} auth signal(s) need attention.`
                : authSignalCount > 0
                    ? `${authSignalCount} auth/signup signal(s) need attention.`
                    : "No critical route or auth drift detected.",
            count: routeFailures.length + authSignalCount,
        },
        {
            name: "WhatsApp",
            status: sectionStatus(signals.filter((signal) => signal.category === "whatsapp")),
            summary: platformWhatsAppFailures > 0 || confusionCases.length > 0
                ? `${platformWhatsAppFailures} platform failure(s), ${confusionCases.length} confusion case(s).`
                : "Recent WhatsApp traffic looks operationally healthy.",
            count: platformWhatsAppFailures + confusionCases.length,
        },
        {
            name: "Documents",
            status: sectionStatus(signals.filter((signal) => signal.category === "documents" || signal.category === "admin-review")),
            summary: manualReviewWorkers > 0 || pendingAdminApprovalWorkers > 0
                ? `${manualReviewWorkers} manual-review case(s), ${pendingAdminApprovalWorkers} approval backlog case(s), ${recentRejectedDocuments} rejected doc row(s).`
                : `No document/admin-review backlog. ${recentPendingDocuments} pending doc row(s), ${recentRejectedDocuments} rejected row(s) in the current dataset.`,
            count: manualReviewWorkers + pendingAdminApprovalWorkers + recentRejectedDocuments,
        },
        {
            name: "Email",
            status: sectionStatus(signals.filter((signal) => signal.category === "email")),
            summary: invalidEmailProfiles > 0
                ? `${invalidEmailProfiles} invalid or bounced profile email(s) are active.`
                : `${(input.recentFailedEmails || []).length} recent failed email sample(s), but no profile email hygiene signal crossed threshold.`,
            count: invalidEmailProfiles,
        },
        {
            name: "Payments",
            status: sectionStatus(signals.filter((signal) => signal.category === "payments")),
            summary: paymentFailures > 0 || checkoutDriftCount > 0 || input.opsSnapshot.paidButNotInQueue.length > 0
                ? `${paymentFailures} failed payment attempt(s), ${checkoutDriftCount} checkout drift case(s), ${input.opsSnapshot.paidButNotInQueue.length} queue drift case(s).`
                : "No payment or queue drift signal detected.",
            count: paymentFailures + checkoutDriftCount + input.opsSnapshot.paidButNotInQueue.length,
        },
    ];

    let healthScore = 100;
    healthScore -= routeFailures.length > 0 ? 35 : 0;
    healthScore -= platformWhatsAppFailures > 0 ? Math.min(20, platformWhatsAppFailures * 6) : 0;
    healthScore -= retryableReplyDeliveryFailures > 0 ? Math.min(12, retryableReplyDeliveryFailures * 4) : 0;
    healthScore -= confusionCases.length > 0 ? Math.min(12, confusionCases.length * 4) : 0;
    healthScore -= manualReviewWorkers > 0 ? Math.min(12, manualReviewWorkers * 3) : 0;
    healthScore -= pendingAdminApprovalWorkers > 0 ? Math.min(12, pendingAdminApprovalWorkers * 3) : 0;
    healthScore -= invalidEmailProfiles > 0 ? Math.min(10, invalidEmailProfiles * 2) : 0;
    healthScore -= paymentFailures > 0 ? Math.min(12, paymentFailures * 3) : 0;
    healthScore -= checkoutDriftCount > 0 ? Math.min(10, checkoutDriftCount * 2) : 0;
    healthScore -= input.opsSnapshot.paidButNotInQueue.length > 0 ? Math.min(20, input.opsSnapshot.paidButNotInQueue.length * 5) : 0;
    healthScore -= authSignalCount > 0 ? Math.min(20, authSignalCount * 4) : 0;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const criticalSignals = signals.filter((signal) => signal.severity === "critical").length;
    const highSignals = signals.filter((signal) => signal.severity === "high").length;
    const topTitles = signals.slice(0, 3).map((signal) => signal.title);
    const summary = signals.length === 0
        ? "Ops-first daily sweep found no active operational signals across WhatsApp, documents, email, payments, or admin review."
        : `Ops-first daily sweep found ${signals.length} active signal${signals.length === 1 ? "" : "s"} (${criticalSignals} critical, ${highSignals} high). Top focus: ${topTitles.join("; ")}.`;

    return {
        generatedAt: input.generatedAt,
        summary,
        healthScore,
        sections,
        signals,
        metrics: {
            totalSignals: signals.length,
            criticalSignals,
            highSignals,
            manualReviewWorkers,
            pendingAdminApprovalWorkers,
            invalidEmailProfiles,
            failedPaymentAttempts: paymentFailures,
            whatsappConfusionCases: confusionCases.length,
        },
    };
}

export function getOpsMonitorEmailReasons(report: OpsMonitorReport): string[] {
    const reasons: string[] = [];

    if (report.metrics.criticalSignals > 0) {
        reasons.push(`${report.metrics.criticalSignals} critical signal(s)`);
    }

    if (report.metrics.highSignals > 0) {
        reasons.push(`${report.metrics.highSignals} high-priority signal(s)`);
    }

    if (report.healthScore < 90 && reasons.length === 0 && report.metrics.totalSignals > 0) {
        reasons.push(`health score below 90 (${report.healthScore})`);
    }

    return reasons;
}

export function buildOpsMonitorEmailReport(report: OpsMonitorReport, baseUrl?: string): string {
    const colors = {
        bg: "#FAFAFA",
        surface: "#FFFFFF",
        text: "#111827",
        muted: "#6B7280",
        border: "#E5E7EB",
        critical: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
        high: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
        medium: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
        ok: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
    };

    const toneForSeverity = (severity: OpsSignalSeverity) => {
        if (severity === "critical") return colors.critical;
        if (severity === "high") return colors.high;
        return colors.medium;
    };

    const toneForSection = (status: OpsSectionStatus) => {
        if (status === "CRITICAL") return colors.critical;
        if (status === "WARNING") return colors.medium;
        return colors.ok;
    };

    const sectionHtml = report.sections.map((section) => {
        const tone = toneForSection(section.status);
        return `
            <td width="20%" valign="top" style="padding:0 6px 12px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;">
                    <tr>
                        <td style="padding:16px 14px;">
                            <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${colors.muted};margin-bottom:6px;">${escapeHtml(section.name)}</div>
                            <div style="display:inline-block;border:1px solid ${tone.border};background:${tone.bg};color:${tone.text};border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;text-transform:uppercase;">${escapeHtml(section.status)}</div>
                            <div style="margin-top:10px;font-size:22px;font-weight:700;color:${colors.text};">${section.count}</div>
                            <div style="margin-top:8px;font-size:12px;line-height:1.6;color:${colors.muted};">${escapeHtml(section.summary)}</div>
                        </td>
                    </tr>
                </table>
            </td>
        `;
    }).join("");

    const signalsHtml = report.signals.length === 0
        ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:14px;">
                <tr>
                    <td align="center" style="padding:24px 20px;">
                        <div style="font-size:26px;line-height:1;margin-bottom:8px;">✅</div>
                        <div style="font-size:16px;font-weight:700;color:${colors.text};margin-bottom:4px;">No active ops signals</div>
                        <div style="font-size:14px;line-height:1.6;color:${colors.muted};">The daily sweep did not find active WhatsApp, document, email, payment, or review incidents.</div>
                    </td>
                </tr>
            </table>
        `
        : report.signals.map((signal) => {
            const tone = toneForSeverity(signal.severity);
            const evidenceHtml = signal.evidence.length > 0
                ? `<ul style="margin:10px 0 0 18px;padding:0;color:${colors.muted};font-size:13px;line-height:1.6;">${signal.evidence.map((item) => `<li style="margin-bottom:6px;">${escapeHtml(item)}</li>`).join("")}</ul>`
                : "";
            const linksHtml = signal.links.length > 0
                ? `<div style="margin-top:12px;">${signal.links.map((link) => `<a href="${escapeHtml(absoluteHref(link.href, baseUrl))}" style="display:inline-block;margin-right:8px;margin-bottom:6px;padding:8px 12px;border-radius:10px;border:1px solid ${colors.border};background:${colors.surface};color:${colors.text};font-size:12px;font-weight:700;text-decoration:none;">${escapeHtml(link.label)}</a>`).join("")}</div>`
                : "";

            return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:14px;margin-bottom:14px;">
                    <tr>
                        <td style="padding:18px 18px 16px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
                                <div style="font-size:17px;font-weight:700;color:${colors.text};">${escapeHtml(signal.title)}</div>
                                <span style="display:inline-block;border:1px solid ${tone.border};background:${tone.bg};color:${tone.text};border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;text-transform:uppercase;">${escapeHtml(signal.severity)} · ${signal.count}</span>
                            </div>
                            <div style="font-size:14px;line-height:1.6;color:${colors.muted};">${escapeHtml(signal.summary)}</div>
                            ${evidenceHtml}
                            ${linksHtml}
                        </td>
                    </tr>
                </table>
            `;
        }).join("");

    return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.bg};margin:0;padding:0;border-collapse:collapse;">
            <tr>
                <td align="center" style="padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${colors.text};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:720px;border-collapse:separate;">
                        <tr>
                            <td align="center" style="padding:0 0 18px;">
                                <div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;color:${colors.text};">Ops-First Daily Monitor</div>
                                <div style="font-size:14px;line-height:1.5;color:${colors.muted};margin-top:6px;">${escapeHtml(report.summary)}</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 0 18px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.surface};border:1px solid ${colors.border};border-radius:16px;">
                                    <tr>
                                        <td style="padding:22px;">
                                            <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${colors.muted};margin-bottom:8px;">Health score</div>
                                            <div style="font-size:42px;font-weight:700;line-height:1;color:${colors.text};">${report.healthScore}</div>
                                            <div style="margin-top:10px;font-size:14px;line-height:1.6;color:${colors.muted};">
                                                ${report.metrics.totalSignals} active signal(s) · ${report.metrics.criticalSignals} critical · ${report.metrics.highSignals} high
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            ${sectionHtml}
                        </tr>
                        <tr>
                            <td colspan="5" style="padding:6px 0 0;">
                                ${signalsHtml}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `;
}
