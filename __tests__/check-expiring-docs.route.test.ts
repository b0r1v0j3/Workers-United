import { beforeEach, describe, expect, it, vi } from "vitest";

const hasValidCronBearerToken = vi.fn();
const createAdminClient = vi.fn();
const queueEmail = vi.fn();

vi.mock("@/lib/cron-auth", () => ({
    hasValidCronBearerToken,
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

vi.mock("@/lib/email-queue", () => ({
    isEmailDeliveryAccepted: vi.fn(() => true),
}));

vi.mock("@/lib/reporting", () => ({
    hasKnownTypoEmailDomain: vi.fn(() => false),
    isInternalOrTestEmail: vi.fn(() => false),
}));

vi.mock("@/lib/worker-notification-eligibility", () => ({
    canSendWorkerDirectNotifications: vi.fn(() => true),
}));

vi.mock("@/lib/workers", () => ({
    normalizeWorkerPhone: vi.fn(() => null),
    pickCanonicalWorkerRecord: vi.fn(() => null),
}));

describe("GET /api/cron/check-expiring-docs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hasValidCronBearerToken.mockReturnValue(true);
        queueEmail.mockResolvedValue({
            id: "email-1",
            sent: true,
            queued: false,
            status: "sent",
            error: null,
        });
    });

    it("fails closed when the recent reminder dedupe query fails", async () => {
        createAdminClient.mockReturnValue({
            from: (table: string) => {
                if (table === "worker_documents") {
                    return {
                        select: () => ({
                            eq: () => ({
                                gt: () => ({
                                    lte: vi.fn(async () => ({
                                        data: [],
                                        error: null,
                                    })),
                                }),
                            }),
                        }),
                    };
                }

                if (table === "email_queue") {
                    return {
                        select: () => ({
                            eq: () => ({
                                in: () => ({
                                    gte: vi.fn(async () => ({
                                        data: null,
                                        error: { message: "email_queue unavailable" },
                                    })),
                                }),
                            }),
                        }),
                    };
                }

                throw new Error(`Unexpected table: ${table}`);
            },
        });

        const { GET } = await import("@/app/api/cron/check-expiring-docs/route");
        const response = await GET(new Request("http://localhost/api/cron/check-expiring-docs", {
            headers: {
                authorization: "Bearer test",
            },
        }));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({
            error: "Failed to load recent document reminder history",
        });
        expect(queueEmail).not.toHaveBeenCalled();
    });
});
