import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileSingle = vi.fn();
const workerSingle = vi.fn();
const jobSingle = vi.fn();
const duplicateOfferLimit = vi.fn();
const matchInsertSingle = vi.fn();
const offerInsertSingle = vi.fn();
const workerUpdateMaybeSingle = vi.fn();
const offerDeleteEq = vi.fn();
const matchDeleteEq = vi.fn();
const incrementPositionsFilled = vi.fn();

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
                            single: profileSingle,
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
            if (table === "worker_onboarding") {
                return {
                    select: () => ({
                        eq: () => ({
                            single: workerSingle,
                        }),
                    }),
                    update: (payload: Record<string, unknown>) => ({
                        eq: (column: string, value: string) => ({
                            select: () => ({
                                maybeSingle: () => workerUpdateMaybeSingle(payload, column, value),
                            }),
                        }),
                    }),
                };
            }

            if (table === "job_requests") {
                return {
                    select: () => ({
                        eq: () => ({
                            single: jobSingle,
                        }),
                    }),
                };
            }

            if (table === "offers") {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                in: () => ({
                                    limit: duplicateOfferLimit,
                                }),
                            }),
                        }),
                    }),
                    insert: () => ({
                        select: () => ({
                            single: offerInsertSingle,
                        }),
                    }),
                    delete: () => ({
                        eq: offerDeleteEq,
                    }),
                };
            }

            if (table === "matches") {
                return {
                    insert: () => ({
                        select: () => ({
                            single: matchInsertSingle,
                        }),
                    }),
                    delete: () => ({
                        eq: matchDeleteEq,
                    }),
                };
            }

            throw new Error(`Unexpected admin table ${table}`);
        },
        rpc: incrementPositionsFilled,
    }),
}));

vi.mock("@/lib/godmode", () => ({
    isGodModeUser: vi.fn(() => false),
}));

function createRequest() {
    return new NextRequest("http://localhost/api/admin/manual-match", {
        method: "POST",
        body: JSON.stringify({
            workerId: "worker-1",
            jobRequestId: "job-1",
        }),
    });
}

describe("POST /api/admin/manual-match", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        authGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "admin-1",
                    email: "admin@example.com",
                },
            },
        });
        profileSingle.mockResolvedValue({
            data: {
                user_type: "admin",
            },
        });
        workerSingle.mockResolvedValue({
            data: {
                id: "worker-1",
                profile_id: "profile-1",
                status: "IN_QUEUE",
            },
            error: null,
        });
        jobSingle.mockResolvedValue({
            data: {
                id: "job-1",
                employer_id: "employer-1",
                title: "Warehouse Helper",
                positions_count: 3,
                positions_filled: 1,
                status: "open",
            },
            error: null,
        });
        duplicateOfferLimit.mockResolvedValue({
            data: [],
            error: null,
        });
        matchInsertSingle.mockResolvedValue({
            data: { id: "match-1" },
            error: null,
        });
        offerInsertSingle.mockResolvedValue({
            data: { id: "offer-1" },
            error: null,
        });
        workerUpdateMaybeSingle.mockResolvedValue({
            data: { id: "worker-1" },
            error: null,
        });
        offerDeleteEq.mockResolvedValue({ error: null });
        matchDeleteEq.mockResolvedValue({ error: null });
        incrementPositionsFilled.mockResolvedValue({ error: null });
    });

    it("returns rollbackFailed when offer creation fails and match cleanup also fails", async () => {
        offerInsertSingle.mockResolvedValue({
            data: null,
            error: {
                message: "offer insert failed",
            },
        });
        matchDeleteEq.mockResolvedValue({
            error: {
                message: "delete blocked",
            },
        });

        const { POST } = await import("@/app/api/admin/manual-match/route");
        const response = await POST(createRequest());

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: "Failed to create offer. Cleanup may be incomplete.",
            rollbackFailed: true,
            cleanupErrors: ["delete_match: delete blocked"],
        });
    });

    it("returns rollbackFailed when worker status update fails and offer cleanup is incomplete", async () => {
        workerUpdateMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: {
                message: "status blocked",
            },
        });
        offerDeleteEq.mockResolvedValue({
            error: {
                message: "offer row locked",
            },
        });

        const { POST } = await import("@/app/api/admin/manual-match/route");
        const response = await POST(createRequest());

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: "Failed to update worker status. Cleanup may be incomplete.",
            rollbackFailed: true,
            cleanupErrors: ["delete_offer: offer row locked"],
        });
        expect(matchDeleteEq).toHaveBeenCalledWith("id", "match-1");
    });

    it("returns rollbackFailed when position reservation fails and worker status restore also fails", async () => {
        incrementPositionsFilled.mockResolvedValue({
            error: {
                message: "rpc failed",
            },
        });
        workerUpdateMaybeSingle
            .mockResolvedValueOnce({
                data: { id: "worker-1" },
                error: null,
            })
            .mockResolvedValueOnce({
                data: null,
                error: {
                    message: "restore blocked",
                },
            });

        const { POST } = await import("@/app/api/admin/manual-match/route");
        const response = await POST(createRequest());

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: "Failed to reserve the job position. Cleanup may be incomplete.",
            rollbackFailed: true,
            cleanupErrors: ["restore_worker_status: restore blocked"],
        });
        expect(offerDeleteEq).toHaveBeenCalledWith("id", "offer-1");
        expect(matchDeleteEq).toHaveBeenCalledWith("id", "match-1");
    });

    it("returns 404 and rolls back when worker status update matches no row", async () => {
        workerUpdateMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { POST } = await import("@/app/api/admin/manual-match/route");
        const response = await POST(createRequest());

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Worker not found",
        });
        expect(offerDeleteEq).toHaveBeenCalledWith("id", "offer-1");
        expect(matchDeleteEq).toHaveBeenCalledWith("id", "match-1");
    });
});
