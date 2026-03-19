import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileMaybeSingle = vi.fn();
const documentsEq = vi.fn();
const workerUpdate = vi.fn();
const workerUpdateEq = vi.fn();
const getWorkerCompletion = vi.fn();
const loadCanonicalWorkerRecord = vi.fn();
const syncWorkerReviewStatus = vi.fn();

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

            if (table === "worker_documents") {
                return {
                    select: () => ({
                        eq: documentsEq,
                    }),
                };
            }

            throw new Error(`Unexpected client table: ${table}`);
        },
    }),
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
        from: (table: string) => {
            if (table === "worker_onboarding") {
                return {
                    update: workerUpdate,
                };
            }

            throw new Error(`Unexpected admin table: ${table}`);
        },
    }),
}));

vi.mock("@/lib/profile-completion", () => ({
    getWorkerCompletion,
}));

vi.mock("@/lib/workers", () => ({
    loadCanonicalWorkerRecord,
}));

vi.mock("@/lib/worker-review", () => ({
    syncWorkerReviewStatus,
}));

describe("POST /api/check-profile-completion", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        authGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "worker-1",
                    email: "worker@example.com",
                    user_metadata: { full_name: "Worker One" },
                },
            },
        });
        profileMaybeSingle.mockResolvedValue({
            data: { full_name: "Worker One", email: "worker@example.com" },
        });
        documentsEq.mockResolvedValue({
            data: [
                { document_type: "passport", status: "manual_review" },
                { document_type: "biometric_photo", status: "manual_review" },
                { document_type: "diploma", status: "manual_review" },
            ],
        });
        loadCanonicalWorkerRecord.mockResolvedValue({
            data: {
                id: "worker-row-1",
                entry_fee_paid: false,
                status: "NEW",
                admin_approved: false,
                phone: "+123456789",
            },
        });
        getWorkerCompletion.mockReturnValue({
            completion: 100,
            missingFields: [],
        });
        syncWorkerReviewStatus.mockResolvedValue({
            completion: 99,
            missingFields: ["diploma"],
            reviewQueued: false,
            targetStatus: null,
            allDocumentsVerified: false,
            notificationSent: false,
            notificationReason: null,
        });
        workerUpdate.mockReturnValue({
            eq: workerUpdateEq,
        });
    });

    it("delegates review-state ownership to syncWorkerReviewStatus instead of updating worker_onboarding directly", async () => {
        const { POST } = await import("@/app/api/check-profile-completion/route");

        const response = await POST();
        const payload = await response.json();

        expect(syncWorkerReviewStatus).toHaveBeenCalledWith({
            adminClient: expect.any(Object),
            profileId: "worker-1",
            fullNameFallback: "Worker One",
            notifyOnPendingApproval: true,
        });
        expect(workerUpdate).not.toHaveBeenCalled();
        expect(payload).toMatchObject({
            completion: 100,
            notificationSent: false,
            reviewQueued: false,
        });
    });

    it("returns notification results from the canonical review-sync helper", async () => {
        syncWorkerReviewStatus.mockResolvedValueOnce({
            completion: 100,
            missingFields: [],
            reviewQueued: true,
            targetStatus: "PENDING_APPROVAL",
            allDocumentsVerified: true,
            notificationSent: true,
            notificationReason: null,
        });

        const { POST } = await import("@/app/api/check-profile-completion/route");

        const response = await POST();
        const payload = await response.json();

        expect(payload).toMatchObject({
            completion: 100,
            notificationSent: true,
            reviewQueued: true,
        });
    });
});
