import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileSingle = vi.fn();
const documentSingle = vi.fn();
const documentUpdateEq = vi.fn();
const draftWorkerMaybeSingle = vi.fn();
const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

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
            if (table === "worker_documents") {
                return {
                    select: () => ({
                        eq: () => ({
                            single: documentSingle,
                        }),
                    }),
                    update: () => ({
                        eq: documentUpdateEq,
                    }),
                };
            }

            if (table === "worker_onboarding") {
                return {
                    select: () => ({
                        contains: () => ({
                            maybeSingle: draftWorkerMaybeSingle,
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected admin table ${table}`);
        },
    }),
}));

vi.mock("@/lib/godmode", () => ({
    isGodModeUser: vi.fn(() => false),
}));

describe("POST /api/admin/re-verify", () => {
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
        documentSingle.mockResolvedValue({
            data: {
                id: "doc-1",
                user_id: "profile-1",
                document_type: "passport",
                storage_path: "worker-docs/doc-1.pdf",
            },
            error: null,
        });
        draftWorkerMaybeSingle.mockResolvedValue({
            data: null,
        });
    });

    it("fails closed before calling verify-document when setting verifying status fails", async () => {
        documentUpdateEq.mockResolvedValueOnce({
            error: {
                message: "write blocked",
            },
        });

        const { POST } = await import("@/app/api/admin/re-verify/route");

        const response = await POST(new NextRequest("http://localhost/api/admin/re-verify", {
            method: "POST",
            body: JSON.stringify({ documentId: "doc-1" }),
        }));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
            error: "Failed to reset document for re-verification: write blocked",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("surfaces status_reset_failed when verify failure cannot restore pending status", async () => {
        documentUpdateEq
            .mockResolvedValueOnce({ error: null })
            .mockResolvedValueOnce({
                error: {
                    message: "reset blocked",
                },
            });
        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                error: "vision timeout",
            }),
        });

        const { POST } = await import("@/app/api/admin/re-verify/route");

        const response = await POST(new NextRequest("http://localhost/api/admin/re-verify", {
            method: "POST",
            body: JSON.stringify({ documentId: "doc-1" }),
        }));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
            error: "vision timeout",
            status_reset_failed: true,
            status_reset_error: "reset blocked",
        });
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
