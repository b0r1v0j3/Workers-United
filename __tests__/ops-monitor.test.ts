import { describe, expect, it } from "vitest";
import type { AdminExceptionSnapshot } from "@/lib/admin-exceptions";
import {
    buildOpsMonitorEmailReport,
    buildOpsMonitorReport,
    getOpsMonitorEmailReasons,
} from "@/lib/ops-monitor";

const baseSnapshot: AdminExceptionSnapshot = {
    generatedAt: "2026-03-17T08:00:00.000Z",
    totalSignals: 0,
    invalidEmailProfiles: [],
    openedCheckoutButUnpaid: [],
    stalePendingPayments: [],
    manualReviewProfiles: [],
    pendingAdminApproval: [],
    verifiedButUnpaid: [],
    paidButNotInQueue: [],
    openJobRequestsWithoutOffers: [],
    whatsappQuality: {
        deterministicReplies: 0,
        guardedReplies: 0,
        languageFallbacks: 0,
        autoHandoffs: 0,
        openAIFailures: 0,
        mediaFallbacks: 0,
        recentAutoHandoffs: [],
    },
};

describe("ops monitor helpers", () => {
    it("builds an ops-first report from concrete operational signals", () => {
        const report = buildOpsMonitorReport({
            generatedAt: "2026-03-17T08:00:00.000Z",
            opsSnapshot: {
                ...baseSnapshot,
                invalidEmailProfiles: [
                    {
                        profileId: "worker-1",
                        fullName: "Worker One",
                        email: "worker@gmai.com",
                        workerStatus: "NEW",
                        workspaceHref: "/profile/worker?inspect=worker-1",
                        caseHref: "/admin/workers/worker-1",
                        role: "worker",
                        reason: "Known typo domain",
                        bounceCount: 1,
                        lastBounceAt: "2026-03-17T07:00:00.000Z",
                        emailHealthHref: "/admin/email-health",
                    },
                ],
                openedCheckoutButUnpaid: [
                    {
                        profileId: "worker-2",
                        fullName: "Worker Two",
                        email: "worker2@example.com",
                        workerStatus: "APPROVED",
                        workspaceHref: "/profile/worker?inspect=worker-2",
                        caseHref: "/admin/workers/worker-2",
                        paymentId: "pay-1",
                        checkoutStartedAt: "2026-03-17T05:00:00.000Z",
                        hoursSinceCheckout: 3,
                        nextStepLabel: "1h recovery window",
                        deadlineAt: null,
                    },
                ],
                manualReviewProfiles: [
                    {
                        profileId: "worker-3",
                        fullName: "Worker Three",
                        email: "worker3@example.com",
                        workerStatus: "PENDING_APPROVAL",
                        workspaceHref: "/profile/worker?inspect=worker-3",
                        caseHref: "/admin/workers/worker-3",
                        manualReviewCount: 1,
                        latestReviewAt: "2026-03-17T06:00:00.000Z",
                        reviewHref: "/admin/review",
                        documentsHref: "/profile/worker/documents?inspect=worker-3",
                    },
                ],
                pendingAdminApproval: [
                    {
                        profileId: "worker-4",
                        fullName: "Worker Four",
                        email: "worker4@example.com",
                        workerStatus: "PENDING_APPROVAL",
                        workspaceHref: "/profile/worker?inspect=worker-4",
                        caseHref: "/admin/workers/worker-4",
                        completion: 100,
                        verifiedDocs: 3,
                        waitingHours: 26,
                        latestReadyAt: "2026-03-16T06:00:00.000Z",
                        reviewHref: "/admin/workers/worker-4",
                    },
                ],
                paidButNotInQueue: [
                    {
                        profileId: "worker-5",
                        fullName: "Worker Five",
                        email: "worker5@example.com",
                        workerStatus: "APPROVED",
                        workspaceHref: "/profile/worker?inspect=worker-5",
                        caseHref: "/admin/workers/worker-5",
                        paidAt: "2026-03-17T04:00:00.000Z",
                        queueHref: "/profile/worker/queue?inspect=worker-5",
                    },
                ],
            },
            routeHealth: {
                "/login": { ok: false, status: 500, latencyMs: 322 },
                "/signup": { ok: true, status: 200, latencyMs: 118 },
            },
            whatsappTemplateHealth: {
                state: "warning",
                details: "2 platform-side template failures detected.",
                platformFailures: 2,
                recipientFailures: 0,
                failedTemplates: 2,
                totalOutboundTemplates: 12,
            },
            recentFailedWhatsApp: [
                {
                    template_name: "profile_incomplete",
                    error_message: "Template send failed: rate limit",
                    status: "failed",
                    date: "2026-03-17T07:30:00.000Z",
                },
            ],
            recentFailedEmails: [
                {
                    type: "welcome",
                    error: "Address rejected",
                    date: "2026-03-17T07:10:00.000Z",
                },
            ],
            whatsappConversations: {
                conversations: [
                    {
                        phone: "+381600000001",
                        messageCount: 3,
                        messages: [
                            { role: "user", content: "payment not working", time: "2026-03-17T07:00:00.000Z" },
                            { role: "user", content: "why can not upload passport", time: "2026-03-17T07:01:00.000Z" },
                            { role: "bot", content: "Please try again.", time: "2026-03-17T07:02:00.000Z" },
                        ],
                    },
                ],
            },
            paymentTelemetry: {
                failed: 1,
                recentAttempts: [
                    {
                        action: "payment_failed",
                        status: "failed",
                        created_at: "2026-03-17T07:20:00.000Z",
                        user_id: "worker-2",
                    },
                ],
            },
            authHealth: {
                status: "CRITICAL",
                unconfirmedEmails: { count: 2 },
                workersWithoutWorkerOnboarding: { count: 1 },
                recentStuckSignups: { count: 1 },
            },
            documents: {
                rejected: 4,
                pending: 2,
            },
        });

        expect(report.healthScore).toBeLessThan(90);
        expect(report.signals.map((signal) => signal.key)).toEqual(expect.arrayContaining([
            "route-failures",
            "whatsapp-platform-failures",
            "whatsapp-confusion",
            "document-review-backlog",
            "rejected-documents",
            "admin-approval-backlog",
            "email-hygiene",
            "payment-failures",
            "checkout-drift",
            "queue-drift",
            "auth-health",
        ]));
        expect(report.metrics.criticalSignals).toBeGreaterThan(0);
        expect(report.metrics.highSignals).toBeGreaterThan(0);
        expect(report.sections.find((section) => section.name === "Documents")?.count).toBe(6);
        expect(getOpsMonitorEmailReasons(report)).toEqual([
            expect.stringContaining("critical signal"),
            expect.stringContaining("high-priority signal"),
        ]);
    });

    it("renders absolute links in the ops email report", () => {
        const report = buildOpsMonitorReport({
            generatedAt: "2026-03-17T08:00:00.000Z",
            opsSnapshot: {
                ...baseSnapshot,
                manualReviewProfiles: [
                    {
                        profileId: "worker-9",
                        fullName: "Worker Nine",
                        email: "worker9@example.com",
                        workerStatus: "PENDING_APPROVAL",
                        workspaceHref: "/profile/worker?inspect=worker-9",
                        caseHref: "/admin/workers/worker-9",
                        manualReviewCount: 1,
                        latestReviewAt: "2026-03-17T06:00:00.000Z",
                        reviewHref: "/admin/review",
                        documentsHref: "/profile/worker/documents?inspect=worker-9",
                    },
                ],
            },
        });

        const html = buildOpsMonitorEmailReport(report, "https://workersunited.eu");
        expect(html).toContain("https://workersunited.eu/admin/review");
    });

    it("does not request an email when the sweep is clean", () => {
        const report = buildOpsMonitorReport({
            generatedAt: "2026-03-17T08:00:00.000Z",
            opsSnapshot: baseSnapshot,
        });

        expect(report.metrics.totalSignals).toBe(0);
        expect(report.healthScore).toBe(100);
        expect(getOpsMonitorEmailReasons(report)).toEqual([]);
    });
});
