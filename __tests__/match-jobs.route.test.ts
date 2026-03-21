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

function createMatchJobsSupabase(params?: {
    workerStatusUpdateError?: string | null;
    workerStatusUpdatedRows?: { id: string }[] | null;
    queueLockError?: string | null;
    activeOffersError?: string | null;
}) {
    const deletedOfferIds: string[] = [];

    const job = {
        id: "job-1",
        title: "Welder",
        industry: "construction",
        destination_country: "Germany",
        salary_rsd: 120000,
    };

    const workerRow = {
        id: "worker-row-1",
        profile_id: "profile-1",
        queue_position: 4,
        preferred_job: "construction",
        desired_countries: ["Germany"],
        entry_fee_paid: true,
        profiles: {
            id: "profile-1",
            email: "worker@example.com",
            full_name: "Worker One",
        },
    };

    const supabase = {
        deletedOfferIds,
        from(table: string) {
            if (table === "email_queue") {
                return {
                    select: () => ({
                        eq: () => ({
                            gte: () => ({
                                limit: vi.fn(async () => ({
                                    data: [],
                                    error: params?.queueLockError ? { message: params.queueLockError } : null,
                                })),
                            }),
                        }),
                    }),
                };
            }

            if (table === "job_requests") {
                return {
                    select: () => ({
                        eq: vi.fn(async () => ({
                            data: [job],
                            error: null,
                        })),
                    }),
                };
            }

            if (table === "worker_documents") {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: vi.fn(async () => ({
                                data: [{ user_id: "profile-1" }],
                                error: null,
                            })),
                        }),
                    }),
                };
            }

            if (table === "worker_onboarding") {
                return {
                    select: () => ({
                        in: () => ({
                            eq: () => ({
                                eq: vi.fn(async () => ({
                                    data: [workerRow],
                                    error: null,
                                })),
                            }),
                        }),
                    }),
                    update: (payload: Record<string, unknown>) => ({
                        eq: vi.fn(() => ({
                            select: vi.fn(async () => ({
                                data: payload.status === "OFFER_PENDING"
                                    ? (params?.workerStatusUpdatedRows ?? [{ id: workerRow.id }])
                                    : [{ id: workerRow.id }],
                                error: payload.status === "OFFER_PENDING" && params?.workerStatusUpdateError
                                    ? { message: params.workerStatusUpdateError }
                                    : null,
                            })),
                        })),
                    }),
                };
            }

            if (table === "offers") {
                return {
                    select: (selection: string) => {
                        if (selection === "worker_id, job_request_id, status") {
                            return {
                                in: () => ({
                                    in: vi.fn(async () => ({
                                        data: [],
                                        error: params?.activeOffersError ? { message: params.activeOffersError } : null,
                                    })),
                                }),
                            };
                        }

                        throw new Error(`Unexpected offers select: ${selection}`);
                    },
                    insert: () => ({
                        select: () => ({
                            single: vi.fn(async () => ({
                                data: { id: "offer-1" },
                                error: null,
                            })),
                        }),
                    }),
                    delete: () => ({
                        eq: vi.fn(async (_field: string, id: string) => {
                            deletedOfferIds.push(id);
                            return { error: null };
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        },
    };

    return supabase;
}

describe("GET /api/cron/match-jobs", () => {
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

    it("rolls back a new offer when the worker status update fails", async () => {
        const supabase = createMatchJobsSupabase({
            workerStatusUpdateError: "row locked",
        });
        createAdminClient.mockReturnValue(supabase);

        const { GET } = await import("@/app/api/cron/match-jobs/route");
        const response = await GET(new Request("http://localhost/api/cron/match-jobs", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            success: true,
            matches: 0,
            emails_sent: 0,
            emails_queued: 0,
            email_failures: 0,
            match_failures: 1,
        });
        expect(supabase.deletedOfferIds).toEqual(["offer-1"]);
        expect(queueEmail).not.toHaveBeenCalled();
    });

    it("rolls back a new offer when the worker status update matches no rows", async () => {
        const supabase = createMatchJobsSupabase({
            workerStatusUpdatedRows: [],
        });
        createAdminClient.mockReturnValue(supabase);

        const { GET } = await import("@/app/api/cron/match-jobs/route");
        const response = await GET(new Request("http://localhost/api/cron/match-jobs", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            success: true,
            matches: 0,
            emails_sent: 0,
            emails_queued: 0,
            email_failures: 0,
            match_failures: 1,
        });
        expect(supabase.deletedOfferIds).toEqual(["offer-1"]);
        expect(queueEmail).not.toHaveBeenCalled();
    });

    it("counts queued-retry notifications as accepted instead of failed", async () => {
        createAdminClient.mockReturnValue(createMatchJobsSupabase());
        queueEmail.mockResolvedValueOnce({
            id: "email-1",
            sent: false,
            queued: true,
            status: "queued_retry",
            error: "421 Temporary failure",
        });

        const { GET } = await import("@/app/api/cron/match-jobs/route");
        const response = await GET(new Request("http://localhost/api/cron/match-jobs", {
            headers: { authorization: "Bearer test" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            success: true,
            matches: 1,
            emails_sent: 0,
            emails_queued: 1,
            email_failures: 0,
            match_failures: 0,
        });
        expect(String(payload.message)).toContain("queued 1");
        expect(queueEmail).toHaveBeenCalledTimes(1);
    });
});
