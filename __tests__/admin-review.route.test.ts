import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileSingle = vi.fn();
const workerDocumentSelectMaybeSingle = vi.fn();
const workerDocumentUpdateMaybeSingle = vi.fn();
const workerDocumentDeleteMaybeSingle = vi.fn();
const notificationProfileMaybeSingle = vi.fn();
const storageRemove = vi.fn();
const queueEmail = vi.fn();
const loadCanonicalWorkerRecord = vi.fn();
const syncWorkerReviewStatus = vi.fn();
const logServerActivity = vi.fn();

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
        storage: {
            from: () => ({
                remove: storageRemove,
            }),
        },
        from: (table: string) => {
            if (table === "worker_documents") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: workerDocumentSelectMaybeSingle,
                        }),
                    }),
                    update: () => {
                        const chain = {
                            eq: vi.fn(() => chain),
                            select: vi.fn(() => ({
                                maybeSingle: workerDocumentUpdateMaybeSingle,
                            })),
                        };
                        return chain;
                    },
                    delete: () => ({
                        eq: vi.fn(() => ({
                            select: vi.fn(() => ({
                                maybeSingle: workerDocumentDeleteMaybeSingle,
                            })),
                        })),
                    }),
                };
            }

            if (table === "profiles") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: notificationProfileMaybeSingle,
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

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

vi.mock("@/lib/worker-review", () => ({
    syncWorkerReviewStatus,
}));

vi.mock("@/lib/workers", () => ({
    loadCanonicalWorkerRecord,
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

describe("POST /api/admin/admin-review", () => {
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
        loadCanonicalWorkerRecord.mockResolvedValue({
            data: {
                id: "worker-1",
                profile_id: "profile-1",
                submitted_full_name: "Ali Worker",
                application_data: null,
            },
        });
        workerDocumentSelectMaybeSingle.mockResolvedValue({
            data: {
                storage_path: "worker-docs/profile-1/passport.jpg",
                ocr_json: null,
            },
            error: null,
        });
        workerDocumentUpdateMaybeSingle.mockResolvedValue({
            data: { id: "doc-1" },
            error: null,
        });
        workerDocumentDeleteMaybeSingle.mockResolvedValue({
            data: { id: "doc-1" },
            error: null,
        });
        notificationProfileMaybeSingle.mockResolvedValue({
            data: {
                full_name: "Ali Worker",
                email: "ali@example.com",
            },
        });
        storageRemove.mockResolvedValue({ data: [], error: null });
        syncWorkerReviewStatus.mockResolvedValue(undefined);
        logServerActivity.mockResolvedValue(undefined);
    });

    it("includes queued documentNotification when the review email is accepted for retry", async () => {
        queueEmail.mockResolvedValueOnce({
            id: "email-1",
            sent: false,
            queued: true,
            status: "queued_retry",
            error: "421 temporary failure",
        });

        const { POST } = await import("@/app/api/admin/admin-review/route");

        const body = new URLSearchParams({
            mode: "update_status",
            worker_id: "worker-1",
            doc_id: "doc-1",
            doc_type: "passport",
            status: "verified",
            redirect_to: "/admin/workers/worker-1",
        });

        const response = await POST(new Request("http://localhost/api/admin/admin-review", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        }));

        expect(response.status).toBe(303);
        const location = response.headers.get("location");
        expect(location).toContain("documentAction=updated");
        expect(location).toContain("documentNotification=queued");
    });

    it("includes failed documentNotification when the review email fails", async () => {
        queueEmail.mockResolvedValueOnce({
            id: "email-1",
            sent: false,
            queued: false,
            status: "failed",
            error: "smtp_failed",
        });

        const { POST } = await import("@/app/api/admin/admin-review/route");

        const body = new URLSearchParams({
            mode: "update_status",
            worker_id: "worker-1",
            doc_id: "doc-1",
            doc_type: "passport",
            status: "rejected",
            feedback: "Need a clearer scan.",
            redirect_to: "/admin/workers/worker-1",
        });

        const response = await POST(new Request("http://localhost/api/admin/admin-review", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        }));

        expect(response.status).toBe(303);
        const location = response.headers.get("location");
        expect(location).toContain("documentAction=updated");
        expect(location).toContain("documentNotification=failed");
    });

    it("fails closed for structured update_status when the target document no longer exists", async () => {
        workerDocumentUpdateMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { POST } = await import("@/app/api/admin/admin-review/route");

        const body = new URLSearchParams({
            mode: "update_status",
            worker_id: "worker-1",
            doc_id: "doc-missing",
            doc_type: "passport",
            status: "verified",
            redirect_to: "/admin/workers/worker-1",
        });

        const response = await POST(new Request("http://localhost/api/admin/admin-review", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        }));

        expect(response.status).toBe(303);
        const location = new URL(response.headers.get("location") || "http://localhost");
        expect(location.searchParams.get("documentAction")).toBe("error");
        expect(location.searchParams.get("documentError")).toBe("Document not found.");
        expect(syncWorkerReviewStatus).not.toHaveBeenCalled();
        expect(logServerActivity).not.toHaveBeenCalled();
        expect(queueEmail).not.toHaveBeenCalled();
    });

    it("fails closed for request_new_document when the target document no longer exists", async () => {
        workerDocumentSelectMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { POST } = await import("@/app/api/admin/admin-review/route");

        const body = new URLSearchParams({
            mode: "request_new_document",
            worker_id: "worker-1",
            doc_id: "doc-missing",
            doc_type: "passport",
            reason: "Need a clearer scan.",
            redirect_to: "/admin/workers/worker-1",
        });

        const response = await POST(new Request("http://localhost/api/admin/admin-review", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        }));

        expect(response.status).toBe(303);
        const location = new URL(response.headers.get("location") || "http://localhost");
        expect(location.searchParams.get("documentAction")).toBe("error");
        expect(location.searchParams.get("documentError")).toBe("Document not found.");
        expect(storageRemove).not.toHaveBeenCalled();
        expect(syncWorkerReviewStatus).not.toHaveBeenCalled();
        expect(logServerActivity).not.toHaveBeenCalled();
        expect(queueEmail).not.toHaveBeenCalled();
    });

    it("returns 404 for JSON approve when no matching document row exists", async () => {
        workerDocumentUpdateMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { POST } = await import("@/app/api/admin/admin-review/route");

        const response = await POST(new Request("http://localhost/api/admin/admin-review", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId: "worker-1",
                docType: "passport",
                action: "approve",
            }),
        }));

        const payload = await response.json();

        expect(response.status).toBe(404);
        expect(payload).toEqual({ error: "Document not found" });
        expect(syncWorkerReviewStatus).not.toHaveBeenCalled();
        expect(logServerActivity).not.toHaveBeenCalled();
        expect(queueEmail).not.toHaveBeenCalled();
    });
});
