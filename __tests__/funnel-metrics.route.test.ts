import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getAllAuthUsers = vi.fn();
const isGodModeUser = vi.fn(() => false);
const classifyEntryFeePaymentQuality = vi.fn(() => ({
    outcome: "completed",
    label: "Completed",
    detail: "Completed",
}));
const readPaymentQualityMarketSignals = vi.fn(() => ({
    workerCountry: null,
    billingCountry: null,
    cardCountry: null,
}));
const getWorkerCompletion = vi.fn(() => ({ completion: 0 }));
const isReportablePaymentProfile = vi.fn(() => true);
const pickCanonicalWorkerRecord = vi.fn((rows: unknown[]) => rows[0] ?? null);

const authGetUser = vi.fn();
const authProfileSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
    getAllAuthUsers,
}));

vi.mock("@/lib/godmode", () => ({
    isGodModeUser,
}));

vi.mock("@/lib/payment-quality", () => ({
    classifyEntryFeePaymentQuality,
    readPaymentQualityMarketSignals,
}));

vi.mock("@/lib/profile-completion", () => ({
    getWorkerCompletion,
}));

vi.mock("@/lib/reporting", () => ({
    isReportablePaymentProfile,
}));

vi.mock("@/lib/workers", () => ({
    pickCanonicalWorkerRecord,
}));

function createServerSupabase(userType = "admin") {
    authGetUser.mockResolvedValue({
        data: {
            user: {
                id: "admin-1",
                email: "admin@example.com",
            },
        },
    });
    authProfileSingle.mockResolvedValue({
        data: {
            user_type: userType,
        },
    });

    return {
        auth: {
            getUser: authGetUser,
        },
        from(table: string) {
            if (table === "profiles") {
                return {
                    select: () => ({
                        eq: () => ({
                            single: authProfileSingle,
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected server table ${table}`);
        },
    };
}

function createAdminSupabase(params?: {
    profilesError?: string | null;
    workerOnboardingError?: string | null;
    workerDocumentsError?: string | null;
    jobMatchesError?: string | null;
    queueWorkersError?: string | null;
    openJobsError?: string | null;
    employersError?: string | null;
    paymentsError?: string | null;
    paymentActivitiesError?: string | null;
    paymentsData?: Array<Record<string, unknown>>;
}) {
    return {
        from(table: string) {
            if (table === "profiles") {
                return {
                    select: vi.fn(async () => ({
                        data: [],
                        error: params?.profilesError ? { message: params.profilesError } : null,
                    })),
                };
            }

            if (table === "worker_onboarding") {
                return {
                    select: (fields: string) => {
                        if (fields.includes("preferred_job")) {
                            return {
                                eq: vi.fn(async () => ({
                                    data: [],
                                    error: params?.queueWorkersError ? { message: params.queueWorkersError } : null,
                                })),
                            };
                        }

                        return Promise.resolve({
                            data: [],
                            error: params?.workerOnboardingError ? { message: params.workerOnboardingError } : null,
                        });
                    },
                };
            }

            if (table === "worker_documents") {
                return {
                    select: vi.fn(async () => ({
                        data: [],
                        error: params?.workerDocumentsError ? { message: params.workerDocumentsError } : null,
                    })),
                };
            }

            if (table === "email_queue") {
                return {
                    select: () => ({
                        eq: vi.fn(async () => ({
                            data: [],
                            error: params?.jobMatchesError ? { message: params.jobMatchesError } : null,
                        })),
                    }),
                };
            }

            if (table === "job_requests") {
                return {
                    select: () => ({
                        in: vi.fn(async () => ({
                            data: [],
                            error: params?.openJobsError ? { message: params.openJobsError } : null,
                        })),
                    }),
                };
            }

            if (table === "employers") {
                return {
                    select: vi.fn(async () => ({
                        data: [],
                        error: params?.employersError ? { message: params.employersError } : null,
                    })),
                };
            }

            if (table === "payments") {
                return {
                    select: vi.fn(async () => ({
                        data: params?.paymentsData || [],
                        error: params?.paymentsError ? { message: params.paymentsError } : null,
                    })),
                };
            }

            if (table === "user_activity") {
                return {
                    select: () => ({
                        in: vi.fn(() => ({
                            in: vi.fn(() => ({
                                order: vi.fn(() => ({
                                    range: vi.fn(async () => ({
                                        data: [],
                                        error: params?.paymentActivitiesError ? { message: params.paymentActivitiesError } : null,
                                    })),
                                })),
                            })),
                        })),
                    }),
                };
            }

            throw new Error(`Unexpected admin table ${table}`);
        },
    };
}

describe("GET /api/admin/funnel-metrics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createClient.mockResolvedValue(createServerSupabase());
        createAdminClient.mockReturnValue(createAdminSupabase());
        getAllAuthUsers.mockResolvedValue([]);
    });

    it("returns zeroed metrics when core datasets are available", async () => {
        const { GET } = await import("@/app/api/admin/funnel-metrics/route");

        const response = await GET(new Request("http://localhost/api/admin/funnel-metrics"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.data).toMatchObject({
            total_users: 0,
            completed_profiles: 0,
            uploaded_documents: 0,
            verified: 0,
            job_matched: 0,
        });
    });

    it("fails closed when worker profile loading errors", async () => {
        createAdminClient.mockReturnValue(createAdminSupabase({
            profilesError: "profiles unavailable",
        }));

        const { GET } = await import("@/app/api/admin/funnel-metrics/route");
        const response = await GET(new Request("http://localhost/api/admin/funnel-metrics"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({ error: "Internal Server Error" });
    });

    it("fails closed when open job loading errors", async () => {
        createAdminClient.mockReturnValue(createAdminSupabase({
            openJobsError: "job_requests unavailable",
        }));

        const { GET } = await import("@/app/api/admin/funnel-metrics/route");
        const response = await GET(new Request("http://localhost/api/admin/funnel-metrics"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({ error: "Internal Server Error" });
    });

    it("fails closed when payment loading errors", async () => {
        createAdminClient.mockReturnValue(createAdminSupabase({
            paymentsError: "payments unavailable",
        }));

        const { GET } = await import("@/app/api/admin/funnel-metrics/route");
        const response = await GET(new Request("http://localhost/api/admin/funnel-metrics"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({ error: "Internal Server Error" });
    });

    it("fails closed when payment activity loading errors for entry-fee attempts", async () => {
        createAdminClient.mockReturnValue(createAdminSupabase({
            paymentActivitiesError: "user_activity unavailable",
            paymentsData: [
                {
                    id: "payment-1",
                    profile_id: "worker-1",
                    status: "pending",
                    payment_type: "entry_fee",
                    stripe_checkout_session_id: "cs_123",
                    paid_at: null,
                    deadline_at: null,
                    metadata: {},
                    amount: 9,
                    amount_cents: 900,
                },
            ],
        }));
        getAllAuthUsers.mockResolvedValue([
            {
                id: "worker-1",
                created_at: new Date().toISOString(),
                user_metadata: {
                    user_type: "worker",
                },
            },
        ]);

        const { GET } = await import("@/app/api/admin/funnel-metrics/route");
        const response = await GET(new Request("http://localhost/api/admin/funnel-metrics"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({ error: "Internal Server Error" });
    });
});
