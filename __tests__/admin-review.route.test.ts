import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileSingle = vi.fn();
const workerDocumentUpdateEq = vi.fn();
const notificationProfileMaybeSingle = vi.fn();
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
        from: (table: string) => {
            if (table === "worker_documents") {
                return {
                    update: () => ({
                        eq: workerDocumentUpdateEq,
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

describe("POST /api/admin/admin-review structured actions", () => {
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
        workerDocumentUpdateEq.mockResolvedValue({
            error: null,
        });
        notificationProfileMaybeSingle.mockResolvedValue({
            data: {
                full_name: "Ali Worker",
                email: "ali@example.com",
            },
        });
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
});
