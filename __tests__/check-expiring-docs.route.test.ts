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
                                eq: () => ({
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

    it("does not suppress a reminder when only a pending document_expiring row exists", async () => {
        createAdminClient.mockReturnValue({
            from: (table: string) => {
                if (table === "worker_documents") {
                    return {
                        select: () => ({
                            eq: () => ({
                                gt: () => ({
                                    lte: vi.fn(async () => ({
                                        data: [
                                            {
                                                id: "doc-1",
                                                document_type: "passport",
                                                expires_at: "2026-12-31T00:00:00.000Z",
                                                profiles: {
                                                    id: "profile-1",
                                                    email: "worker@example.com",
                                                    full_name: "Worker One",
                                                },
                                            },
                                        ],
                                        error: null,
                                    })),
                                }),
                            }),
                        }),
                    };
                }

                if (table === "worker_onboarding") {
                    return {
                        select: () => ({
                            in: vi.fn(async () => ({
                                data: [
                                    {
                                        profile_id: "profile-1",
                                        agency_id: null,
                                        submitted_email: "worker@example.com",
                                        phone: null,
                                        updated_at: "2026-03-20T10:00:00.000Z",
                                        entry_fee_paid: false,
                                    },
                                ],
                                error: null,
                            })),
                        }),
                    };
                }

                if (table === "email_queue") {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    gte: vi.fn(async () => ({
                                        data: [{ user_id: "profile-2" }],
                                        error: null,
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

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            success: true,
            processed_count: 1,
            failed_count: 0,
        });
        expect(queueEmail).toHaveBeenCalledTimes(1);
        expect(queueEmail).toHaveBeenCalledWith(
            expect.anything(),
            "profile-1",
            "document_expiring",
            "worker@example.com",
            "Worker One",
            expect.objectContaining({
                documentType: "PASSPORT",
                offerLink: expect.stringContaining("/profile/worker/documents"),
            }),
            undefined,
            undefined
        );
    });

    it("fails closed when the worker reminder context preload fails", async () => {
        createAdminClient.mockReturnValue({
            from: (table: string) => {
                if (table === "worker_documents") {
                    return {
                        select: () => ({
                            eq: () => ({
                                gt: () => ({
                                    lte: vi.fn(async () => ({
                                        data: [
                                            {
                                                id: "doc-1",
                                                document_type: "passport",
                                                expires_at: "2026-12-31T00:00:00.000Z",
                                                profiles: {
                                                    id: "profile-1",
                                                    email: "worker@example.com",
                                                    full_name: "Worker One",
                                                },
                                            },
                                        ],
                                        error: null,
                                    })),
                                }),
                            }),
                        }),
                    };
                }

                if (table === "worker_onboarding") {
                    return {
                        select: () => ({
                            in: vi.fn(async () => ({
                                data: null,
                                error: { message: "worker_onboarding unavailable" },
                            })),
                        }),
                    };
                }

                if (table === "email_queue") {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    gte: vi.fn(async () => ({
                                        data: [],
                                        error: null,
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
            error: "Failed to load worker reminder context",
        });
        expect(queueEmail).not.toHaveBeenCalled();
    });
});
