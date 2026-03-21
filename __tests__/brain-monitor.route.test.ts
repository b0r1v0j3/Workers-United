import { beforeEach, describe, expect, it, vi } from "vitest";

const hasValidCronBearerToken = vi.fn();
const getCronAuthorizationHeader = vi.fn();
const buildOpsMonitorReport = vi.fn();
const getOpsMonitorEmailReasons = vi.fn();
const insertReport = vi.fn();
const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

vi.mock("@/lib/cron-auth", () => ({
    hasValidCronBearerToken,
    getCronAuthorizationHeader,
}));

vi.mock("@/lib/ops-monitor", () => ({
    buildOpsMonitorReport,
    getOpsMonitorEmailReasons,
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
        from: (table: string) => {
            if (table !== "brain_reports") {
                throw new Error(`Unexpected table ${table}`);
            }

            return {
                insert: insertReport,
            };
        },
    }),
}));

describe("GET /api/cron/brain-monitor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_BASE_URL = "https://workersunited.eu";

        hasValidCronBearerToken.mockReturnValue(true);
        getCronAuthorizationHeader.mockReturnValue("Bearer cron-secret");
        buildOpsMonitorReport.mockReturnValue({
            summary: "Ops snapshot summary",
            metrics: {
                totalSignals: 1,
                criticalSignals: 0,
                highSignals: 0,
            },
            signals: [
                { severity: "low", label: "test-signal" },
            ],
        });
        getOpsMonitorEmailReasons.mockReturnValue([]);

        fetchMock.mockImplementation(async (input: string | URL | Request) => {
            const url = typeof input === "string"
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url;

            if (url.endsWith("/api/brain/collect")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        generatedAt: "2026-03-21T12:00:00.000Z",
                        opsSnapshot: {
                            generatedAt: "2026-03-21T12:00:00.000Z",
                            exceptions: [],
                            metrics: {},
                        },
                        health: {
                            whatsappTemplateHealth: null,
                            recentFailedWhatsApp: [],
                        },
                        emails: {
                            recentFailedEmails: [],
                        },
                        whatsappConversations: null,
                        paymentTelemetry: null,
                        authHealth: null,
                        documents: null,
                    }),
                };
            }

            return {
                ok: true,
                status: 200,
            };
        });
    });

    it("returns success only after the ops snapshot is persisted", async () => {
        insertReport.mockResolvedValueOnce({ error: null });

        const { GET } = await import("@/app/api/cron/brain-monitor/route");
        const response = await GET(new Request("http://localhost/api/cron/brain-monitor", {
            headers: {
                authorization: "Bearer cron-secret",
            },
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            reportSaved: true,
            emailSkipped: true,
            emailReason: "No critical or high-priority ops signals — saved to brain_reports only",
            signalCount: 1,
        });
        expect(insertReport).toHaveBeenCalledTimes(1);
    });

    it("fails the route and saves a failure snapshot when success-path report persistence fails", async () => {
        insertReport
            .mockResolvedValueOnce({
                error: {
                    message: "insert blocked",
                },
            })
            .mockResolvedValueOnce({ error: null });

        const { GET } = await import("@/app/api/cron/brain-monitor/route");
        const response = await GET(new Request("http://localhost/api/cron/brain-monitor", {
            headers: {
                authorization: "Bearer cron-secret",
            },
        }));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
            errorMessage: "Failed to save ops report: insert blocked",
            reportSaved: true,
            emailSkipped: true,
            emailReason: "Failure snapshot saved to brain_reports; failure email suppressed",
            opsReportBuilt: true,
        });
        expect(insertReport).toHaveBeenCalledTimes(2);
    });
});
