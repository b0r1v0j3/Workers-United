import { beforeEach, describe, expect, it, vi } from "vitest";

const hasValidCronBearerToken = vi.fn();
const getCronAuthorizationHeader = vi.fn();
const sendEmail = vi.fn();
const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

let recentAlertRows: Array<{ id: string }> = [];
let insertedActivities: Array<Record<string, unknown>> = [];

vi.mock("@/lib/cron-auth", () => ({
    hasValidCronBearerToken,
    getCronAuthorizationHeader,
}));

vi.mock("@/lib/mailer", () => ({
    sendEmail,
}));

vi.mock("@/lib/supabase/admin", () => ({
    createTypedAdminClient: () => ({
        from: (table: string) => {
            if (table !== "user_activity") {
                throw new Error(`Unexpected table ${table}`);
            }

            const selectChain = {
                eq: () => selectChain,
                gte: () => selectChain,
                order: () => selectChain,
                limit: async () => ({ data: recentAlertRows, error: null }),
            };

            return {
                insert: async (payload: Record<string, unknown>) => {
                    insertedActivities.push(payload);
                    return { error: null };
                },
                select: () => selectChain,
            };
        },
    }),
}));

describe("GET /api/cron/system-smoke", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        recentAlertRows = [];
        insertedActivities = [];

        process.env.NEXT_PUBLIC_BASE_URL = "https://workersunited.eu";
        process.env.OWNER_EMAIL = "";
        process.env.SMTP_USER = "";

        hasValidCronBearerToken.mockReturnValue(true);
        getCronAuthorizationHeader.mockReturnValue("Bearer cron-secret");
        sendEmail.mockResolvedValue({ success: true });

        fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
            const url = typeof input === "string"
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url;
            const authHeader = init?.headers && !Array.isArray(init.headers)
                ? (init.headers as Record<string, string>).Authorization || (init.headers as Record<string, string>).authorization
                : undefined;

            if (url.endsWith("/api/health") && authHeader) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        status: "degraded",
                        checks: {
                            supabase: { state: "down" },
                            stripe: { state: "ok" },
                            smtp: { state: "ok" },
                            whatsapp: { state: "ok" },
                        },
                    }),
                };
            }

            return {
                ok: true,
                status: 200,
            };
        });
    });

    it("skips sending a critical alert when no recipient is configured", async () => {
        const { GET } = await import("@/app/api/cron/system-smoke/route");
        const response = await GET(new Request("http://localhost/api/cron/system-smoke", {
            headers: {
                authorization: "Bearer cron-secret",
            },
        }));

        expect(response.status).toBe(200);
        expect(sendEmail).not.toHaveBeenCalled();
        expect(insertedActivities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: "system_smoke_alert_not_configured",
                    status: "error",
                }),
            ])
        );
    });

    it("falls back to SMTP_USER when OWNER_EMAIL is not set", async () => {
        process.env.SMTP_USER = "workers.united.eu@gmail.com";

        const { GET } = await import("@/app/api/cron/system-smoke/route");
        const response = await GET(new Request("http://localhost/api/cron/system-smoke", {
            headers: {
                authorization: "Bearer cron-secret",
            },
        }));

        expect(response.status).toBe(200);
        expect(sendEmail).toHaveBeenCalledWith(
            "workers.united.eu@gmail.com",
            "System Smoke Check CRITICAL",
            expect.stringContaining("Workers United Smoke Check Alert")
        );
        expect(insertedActivities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    action: "system_smoke_critical_alert",
                }),
            ])
        );
    });
});
