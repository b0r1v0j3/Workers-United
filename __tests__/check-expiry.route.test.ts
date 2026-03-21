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

function buildUpdateMaybeSingle(options?: {
    error?: string | null;
    zeroRows?: boolean;
    id?: string;
}) {
    return {
        select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
                data: options?.error || options?.zeroRows ? null : { id: options?.id || "updated-row" },
                error: options?.error ? { message: options.error } : null,
            })),
        })),
    };
}

function createCheckExpirySupabase(params?: {
    expiredOffers?: Array<Record<string, unknown>>;
    offerUpdateError?: string | null;
    offerUpdateZeroRows?: boolean;
    queueWorkerUpdateError?: string | null;
    queueWorkerUpdateZeroRows?: boolean;
    refundWorkers?: Array<Record<string, unknown>>;
    refundWorkerUpdateError?: string | null;
    refundWorkerUpdateZeroRows?: boolean;
    refundPaymentUpdateError?: string | null;
    refundPaymentUpdateZeroRows?: boolean;
    onPaymentUpdate?: () => void;
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
                        eq: vi.fn(() => buildUpdateMaybeSingle({
                            error: payload.status === "expired" ? params?.offerUpdateError : null,
                            zeroRows: payload.status === "expired" ? params?.offerUpdateZeroRows : false,
                            id: "offer-update",
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
                        eq: vi.fn(() => buildUpdateMaybeSingle({
                            error: payload.status === "REFUND_FLAGGED"
                                ? params?.refundWorkerUpdateError
                                : payload.status === "IN_QUEUE"
                                    ? params?.queueWorkerUpdateError
                                    : null,
                            zeroRows: payload.status === "REFUND_FLAGGED"
                                ? params?.refundWorkerUpdateZeroRows
                                : payload.status === "IN_QUEUE"
                                    ? params?.queueWorkerUpdateZeroRows
                                    : false,
                            id: "worker-update",
                        })),
                    }),
                };
            }

            if (table === "payments") {
                return {
                    update: () => ({
                        eq: vi.fn(() => {
                            params?.onPaymentUpdate?.();
                            return buildUpdateMaybeSingle({
                                error: params?.refundPaymentUpdateError,
                                zeroRows: params?.refundPaymentUpdateZeroRows,
                                id: "payment-update",
                            });
                        }),
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

    it("does not count an expired offer when the offer status update matches zero rows", async () => {
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
            offerUpdateZeroRows: true,
        }));

        const { GET } = await import("@/app/api/cron/check-expiry/route");
        const response = await GET(new Request("http://localhost/api/cron/check-expiry", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.expiredOffers).toBe(0);
        expect(payload.errors).toContain(
            "Failed to process offer offer-1: Error: Failed to mark offer offer-1 as expired: no rows updated"
        );
        expect(sendOfferExpiredNotification).not.toHaveBeenCalled();
        expect(sendOfferNotification).not.toHaveBeenCalled();
    });

    it("does not count an expired offer when returning the worker to queue matches zero rows", async () => {
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
            queueWorkerUpdateZeroRows: true,
        }));

        const { GET } = await import("@/app/api/cron/check-expiry/route");
        const response = await GET(new Request("http://localhost/api/cron/check-expiry", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.expiredOffers).toBe(0);
        expect(payload.errors).toContain(
            "Failed to process offer offer-1: Error: Failed to return worker worker-1 to queue: no rows updated"
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

    it("does not count refund flagging when the worker refund marker matches zero rows", async () => {
        const paymentUpdateSpy = vi.fn();
        createAdminClient.mockReturnValue(createCheckExpirySupabase({
            expiredOffers: [],
            refundWorkers: [
                {
                    id: "worker-1",
                    entry_payment_id: "payment-1",
                },
            ],
            refundWorkerUpdateZeroRows: true,
            onPaymentUpdate: paymentUpdateSpy,
        }));

        const { GET } = await import("@/app/api/cron/check-expiry/route");
        const response = await GET(new Request("http://localhost/api/cron/check-expiry", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.refundsFlagged).toBe(0);
        expect(payload.errors).toContain(
            "Failed to flag refund for worker-1: Error: Failed to flag worker worker-1 for refund: no rows updated"
        );
        expect(paymentUpdateSpy).not.toHaveBeenCalled();
    });

    it("does not count refund flagging when the payment refund marker matches zero rows", async () => {
        createAdminClient.mockReturnValue(createCheckExpirySupabase({
            expiredOffers: [],
            refundWorkers: [
                {
                    id: "worker-1",
                    entry_payment_id: "payment-1",
                },
            ],
            refundPaymentUpdateZeroRows: true,
        }));

        const { GET } = await import("@/app/api/cron/check-expiry/route");
        const response = await GET(new Request("http://localhost/api/cron/check-expiry", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.refundsFlagged).toBe(0);
        expect(payload.errors).toContain(
            "Failed to flag refund for worker-1: Error: Failed to flag payment payment-1 for refund: no rows updated"
        );
    });

    it("rolls back a shifted offer when the OFFER_PENDING update matches zero rows", async () => {
        const rollbackShiftedOffer = vi.fn(async () => ({ error: null }));
        createAdminClient.mockReturnValue({
            from(table: string) {
                if (table === "offers") {
                    return {
                        select: () => ({
                            eq: (field: string, value: string) => {
                                if (field === "status" && value === "pending") {
                                    return {
                                        lt: vi.fn(async () => ({
                                            data: [
                                                {
                                                    id: "offer-1",
                                                    worker_id: "worker-1",
                                                    job_request_id: "job-1",
                                                    queue_position_at_offer: 1,
                                                    worker_onboarding: {
                                                        profile_id: "profile-1",
                                                    },
                                                    job_requests: {
                                                        title: "Welder",
                                                    },
                                                },
                                            ],
                                            error: null,
                                        })),
                                    };
                                }

                                if (field === "job_request_id" && value === "job-1") {
                                    return {
                                        eq: vi.fn(() => ({
                                            maybeSingle: vi.fn(async () => ({
                                                data: null,
                                                error: null,
                                            })),
                                        })),
                                    };
                                }

                                throw new Error(`Unexpected offers select filter: ${field}=${value}`);
                            },
                        }),
                        update: (payload: Record<string, unknown>) => ({
                            eq: vi.fn(() => buildUpdateMaybeSingle({
                                id: payload.status === "expired" ? "offer-1" : "offer-update",
                            })),
                        }),
                        insert: () => ({
                            select: () => ({
                                single: vi.fn(async () => ({
                                    data: { id: "shifted-offer-1" },
                                    error: null,
                                })),
                            }),
                        }),
                        delete: () => ({
                            eq: rollbackShiftedOffer,
                        }),
                    };
                }

                if (table === "worker_onboarding") {
                    return {
                        select: () => ({
                            eq: (field: string, value: string | boolean) => {
                                if (field === "status" && value === "IN_QUEUE") {
                                    return {
                                        eq: vi.fn((_entryFeeField: string, _entryFeeValue: boolean) => ({
                                            gt: vi.fn(() => ({
                                                order: vi.fn(() => ({
                                                    limit: vi.fn(() => ({
                                                        maybeSingle: vi.fn(async () => ({
                                                            data: {
                                                                id: "worker-2",
                                                                profile_id: "profile-2",
                                                                phone: "+381600000",
                                                                queue_position: 2,
                                                            },
                                                            error: null,
                                                        })),
                                                    })),
                                                })),
                                            })),
                                            lt: vi.fn(async () => ({
                                                data: [],
                                                error: null,
                                            })),
                                        })),
                                        lt: vi.fn(async () => ({
                                            data: [],
                                            error: null,
                                        })),
                                    };
                                }

                                throw new Error(`Unexpected worker_onboarding select filter: ${field}=${String(value)}`);
                            },
                        }),
                        update: (payload: Record<string, unknown>) => ({
                            eq: vi.fn(() => buildUpdateMaybeSingle({
                                id: payload.status === "IN_QUEUE" ? "worker-1" : "worker-2",
                                zeroRows: payload.status === "OFFER_PENDING",
                            })),
                        }),
                    };
                }

                if (table === "job_requests") {
                    return {
                        select: () => ({
                            eq: vi.fn(() => ({
                                maybeSingle: vi.fn(async () => ({
                                    data: {
                                        id: "job-1",
                                        status: "open",
                                        title: "Welder",
                                        destination_country: "Serbia",
                                    },
                                    error: null,
                                })),
                            })),
                        }),
                    };
                }

                if (table === "profiles") {
                    return {
                        select: () => ({
                            eq: vi.fn(() => ({
                                single: vi.fn(async () => ({
                                    data: null,
                                    error: null,
                                })),
                                maybeSingle: vi.fn(async () => ({
                                    data: {
                                        email: "worker2@example.com",
                                        full_name: "Worker Two",
                                    },
                                    error: null,
                                })),
                            })),
                        }),
                    };
                }

                if (table === "payments") {
                    return {
                        update: () => ({
                            eq: vi.fn(() => buildUpdateMaybeSingle({
                                id: "payment-1",
                            })),
                        }),
                    };
                }

                throw new Error(`Unexpected table: ${table}`);
            },
        });

        const { GET } = await import("@/app/api/cron/check-expiry/route");
        const response = await GET(new Request("http://localhost/api/cron/check-expiry", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.newOffers).toBe(0);
        expect(payload.errors).toContain(
            "Failed to process offer offer-1: Error: Failed to mark worker worker-2 as OFFER_PENDING: no rows updated"
        );
        expect(sendOfferNotification).not.toHaveBeenCalled();
        expect(rollbackShiftedOffer).toHaveBeenCalledWith("id", "shifted-offer-1");
    });
});
