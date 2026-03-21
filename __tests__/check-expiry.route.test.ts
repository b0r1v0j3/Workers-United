import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const hasValidCronBearerToken = vi.fn();
const sendOfferNotification = vi.fn();
const sendOfferExpiredNotification = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/cron-auth", () => ({
    hasValidCronBearerToken,
}));

vi.mock("@/lib/notifications", () => ({
    sendOfferNotification,
    sendOfferExpiredNotification,
}));

function createCheckExpirySupabase(params?: {
    expiredOffers?: Array<Record<string, unknown>>;
    offerUpdateError?: string | null;
    refundWorkers?: Array<Record<string, unknown>>;
    refundWorkerUpdateError?: string | null;
    refundPaymentUpdateError?: string | null;
}) {
    const expiredOffers = params?.expiredOffers || [];
    const refundWorkers = params?.refundWorkers || [];

    return {
        from(table: string) {
            if (table === "offers") {
                return {
                    select: () => ({
                        eq: () => ({
                            lt: vi.fn(async () => ({
                                data: expiredOffers,
                                error: null,
                            })),
                        }),
                    }),
                    update: (payload: Record<string, unknown>) => ({
                        eq: vi.fn(async () => ({
                            error: payload.status === "expired" && params?.offerUpdateError
                                ? { message: params.offerUpdateError }
                                : null,
                        })),
                    }),
                };
            }

            if (table === "worker_onboarding") {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                lt: vi.fn(async () => ({
                                    data: refundWorkers,
                                    error: null,
                                })),
                            }),
                        }),
                    }),
                    update: (payload: Record<string, unknown>) => ({
                        eq: vi.fn(async () => ({
                            error: payload.status === "REFUND_FLAGGED" && params?.refundWorkerUpdateError
                                ? { message: params.refundWorkerUpdateError }
                                : null,
                        })),
                    }),
                };
            }

            if (table === "payments") {
                return {
                    update: () => ({
                        eq: vi.fn(async () => ({
                            error: params?.refundPaymentUpdateError
                                ? { message: params.refundPaymentUpdateError }
                                : null,
                        })),
                    }),
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        },
    };
}

describe("GET /api/cron/check-expiry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hasValidCronBearerToken.mockReturnValue(true);
    });

    it("does not count an expired offer when the offer status update fails", async () => {
        createAdminClient.mockReturnValue(createCheckExpirySupabase({
            expiredOffers: [
                {
                    id: "offer-1",
                    worker_id: "worker-1",
                    worker_onboarding: {
                        profile_id: "profile-1",
                    },
                    job_requests: {
                        title: "Welder",
                    },
                },
            ],
            offerUpdateError: "row locked",
        }));

        const { GET } = await import("@/app/api/cron/check-expiry/route");
        const response = await GET(new Request("http://localhost/api/cron/check-expiry", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.expiredOffers).toBe(0);
        expect(payload.errors).toContain(
            "Failed to process offer offer-1: Error: Failed to mark offer offer-1 as expired: row locked"
        );
        expect(sendOfferExpiredNotification).not.toHaveBeenCalled();
        expect(sendOfferNotification).not.toHaveBeenCalled();
    });

    it("does not count refund flagging when the payment refund marker update fails", async () => {
        createAdminClient.mockReturnValue(createCheckExpirySupabase({
            expiredOffers: [],
            refundWorkers: [
                {
                    id: "worker-1",
                    entry_payment_id: "payment-1",
                },
            ],
            refundPaymentUpdateError: "payment row missing",
        }));

        const { GET } = await import("@/app/api/cron/check-expiry/route");
        const response = await GET(new Request("http://localhost/api/cron/check-expiry", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.refundsFlagged).toBe(0);
        expect(payload.errors).toContain(
            "Failed to flag refund for worker-1: Error: Failed to flag payment payment-1 for refund: payment row missing"
        );
    });
});
