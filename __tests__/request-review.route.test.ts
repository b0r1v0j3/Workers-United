import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileMaybeSingle = vi.fn();
const documentMaybeSingle = vi.fn();
const documentUpdateWhereEq = vi.fn();
const documentUpdateEq = vi.fn();
const targetProfileMaybeSingle = vi.fn();
const logServerActivity = vi.fn();
const queueEmail = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: {
            getUser: authGetUser,
        },
        from: (table: string) => {
            if (table === "profiles") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: profileMaybeSingle,
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected server table ${table}`);
        },
    }),
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
        from: (table: string) => {
            if (table === "worker_documents") {
                return {
                    select: () => ({
                        eq: (_column: string, _value: string) => ({
                            eq: (_nestedColumn: string, _nestedValue: string) => ({
                                maybeSingle: documentMaybeSingle,
                            }),
                        }),
                    }),
                    update: () => {
                        const chain = {
                            eq: documentUpdateWhereEq.mockImplementation(() => ({
                                select: vi.fn(() => ({
                                    maybeSingle: documentUpdateEq,
                                })),
                            })),
                        };
                        return chain;
                    },
                };
            }

            if (table === "profiles") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: targetProfileMaybeSingle,
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected admin table ${table}`);
        },
    }),
}));

vi.mock("@/lib/agencies", () => ({
    getAgencyOwnedClaimedWorkerByProfileId: vi.fn(),
    getAgencyOwnedWorker: vi.fn(),
}));

vi.mock("@/lib/godmode", () => ({
    isGodModeUser: vi.fn(() => false),
}));

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

vi.mock("@/lib/rate-limit", () => ({
    checkRateLimit: vi.fn(() => null),
    standardLimiter: {},
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

describe("POST /api/documents/request-review", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ADMIN_EMAIL = "admin@workersunited.eu";
        process.env.NEXT_PUBLIC_BASE_URL = "https://www.workersunited.eu";

        authGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "worker-profile-1",
                    email: "worker@example.com",
                    user_metadata: {
                        user_type: "worker",
                    },
                },
            },
        });
        profileMaybeSingle.mockResolvedValue({
            data: {
                user_type: "worker",
                full_name: "Worker One",
            },
        });
        documentMaybeSingle.mockResolvedValue({
            data: {
                id: "doc-1",
                status: "rejected",
            },
            error: null,
        });
        documentUpdateEq.mockResolvedValue({
            data: { id: "doc-1" },
            error: null,
        });
        targetProfileMaybeSingle.mockResolvedValue({
            data: {
                full_name: "Worker One",
                email: "worker@example.com",
            },
        });
        logServerActivity.mockResolvedValue(undefined);
    });

    it("returns truthful partial success when the admin alert queue fails", async () => {
        queueEmail.mockResolvedValueOnce({
            id: "email-1",
            sent: false,
            queued: false,
            status: "failed",
            error: "email_queue insert failed",
        });

        const { POST } = await import("@/app/api/documents/request-review/route");
        const response = await POST(new Request("http://localhost/api/documents/request-review", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                docType: "passport",
            }),
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({
            ok: true,
            adminAlertStatus: "failed",
            adminAlertError: "email_queue insert failed",
        });
        expect(documentUpdateWhereEq).toHaveBeenCalledWith("id", "doc-1");
    });

    it("keeps document success but surfaces thrown admin alert errors", async () => {
        queueEmail.mockRejectedValueOnce(new Error("smtp exploded"));

        const { POST } = await import("@/app/api/documents/request-review/route");
        const response = await POST(new Request("http://localhost/api/documents/request-review", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                docType: "passport",
            }),
        }));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({
            ok: true,
            adminAlertStatus: "failed",
            adminAlertError: "smtp exploded",
        });
        expect(logServerActivity).toHaveBeenCalledOnce();
    });

    it("fails closed when the manual_review update matches zero rows", async () => {
        documentUpdateEq.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { POST } = await import("@/app/api/documents/request-review/route");
        const response = await POST(new Request("http://localhost/api/documents/request-review", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                docType: "passport",
            }),
        }));
        const payload = await response.json();

        expect(response.status).toBe(404);
        expect(payload).toEqual({ error: "Document not found" });
        expect(logServerActivity).not.toHaveBeenCalled();
        expect(queueEmail).not.toHaveBeenCalled();
    });
});
