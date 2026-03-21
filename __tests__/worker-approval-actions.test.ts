import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/profile-completion", () => ({
    getWorkerCompletion: vi.fn(),
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail: vi.fn(),
}));

vi.mock("@/lib/worker-approval-notifications", () => ({
    buildWorkerPaymentUnlockedEmailData: vi.fn(() => ({
        title: "Job Finder Is Now Unlocked",
        message: "Payment is now available.",
        subject: "Job Finder unlocked",
    })),
    resolveWorkerApprovalNotificationRecipient: vi.fn(() => ({
        email: "worker@example.com",
        name: "Worker Example",
    })),
}));

vi.mock("@/lib/workers", () => ({
    loadCanonicalWorkerRecord: vi.fn(async () => ({ data: null })),
    normalizeWorkerPhone: vi.fn((phone: string | null | undefined) => phone || null),
}));

import { queueEmail } from "@/lib/email-templates";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { applyWorkerApprovalAction, loadWorkerApprovalGuardState } from "@/lib/worker-review";

function createAdminClientMock({
    worker,
    documents,
    updateResult,
}: {
    worker: Record<string, any>;
    documents: Array<{ document_type: string | null; status?: string | null }>;
    updateResult?: { data: { id: string } | null; error: { message: string } | null };
}) {
    const updates: Array<Record<string, any>> = [];
    const workerUpdateMaybeSingle = vi.fn().mockResolvedValue(updateResult ?? {
        data: { id: worker.id },
        error: null,
    });

    const workerDocumentsQuery = () => {
        const chain: any = {
            eq: () => chain,
            in: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => ({ data: null, error: null }),
            then: (onFulfilled: (value: { data: typeof documents; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
                Promise.resolve({ data: documents, error: null }).then(onFulfilled, onRejected),
        };
        return chain;
    };

    const adminClient = {
        auth: {
            admin: {
                getUserById: vi.fn().mockResolvedValue({ data: { user: null } }),
            },
        },
        from: (table: string) => {
            if (table === "worker_onboarding") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: async () => ({ data: worker, error: null }),
                        }),
                    }),
                    update: (payload: Record<string, any>) => {
                        updates.push(payload);
                        return {
                            eq: () => ({
                                select: () => ({
                                    maybeSingle: () => workerUpdateMaybeSingle(),
                                }),
                            }),
                        };
                    },
                };
            }

            if (table === "worker_documents") {
                return {
                    select: () => workerDocumentsQuery(),
                };
            }

            if (table === "profiles") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: async () => ({ data: null, error: null }),
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        },
    };

    return { adminClient, updates, workerUpdateMaybeSingle };
}

describe("worker approval actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(queueEmail).mockResolvedValue({ id: "email-1", sent: true, queued: false, status: "sent", error: null });
        vi.mocked(getWorkerCompletion).mockReturnValue({
            completion: 100,
            missingFields: [],
        } as any);
    });

    it("keeps approval locked until all three documents are verified", async () => {
        vi.mocked(getWorkerCompletion).mockReturnValueOnce({
            completion: 100,
            missingFields: ["diploma"],
        } as any);

        const worker = {
            id: "worker-1",
            profile_id: null,
            submitted_full_name: "Agency Worker",
            status: "NEW",
            admin_approved: false,
            entry_fee_paid: false,
            job_search_active: false,
            phone: "+381600000000",
        };
        const { adminClient } = createAdminClientMock({
            worker,
            documents: [
                { document_type: "passport", status: "verified" },
                { document_type: "biometric_photo", status: "verified" },
            ],
        });

        const result = await loadWorkerApprovalGuardState({
            adminClient: adminClient as any,
            workerId: worker.id,
            documentOwnerId: worker.id,
            phoneOptional: true,
            fullNameFallback: worker.submitted_full_name,
        });

        expect(result?.completion).toBe(99);
        expect(result?.canApprove).toBe(false);
        expect(result?.missingFields).toContain("diploma");
    });

    it("queues the canonical unlock email when approval succeeds", async () => {
        const worker = {
            id: "worker-2",
            profile_id: null,
            submitted_full_name: "Agency Worker",
            status: "PENDING_APPROVAL",
            admin_approved: false,
            entry_fee_paid: false,
            job_search_active: false,
            phone: "+381600000001",
        };
        const { adminClient, updates } = createAdminClientMock({
            worker,
            documents: [
                { document_type: "passport", status: "verified" },
                { document_type: "biometric_photo", status: "verified" },
                { document_type: "diploma", status: "verified" },
            ],
        });

        const result = await applyWorkerApprovalAction({
            adminClient: adminClient as any,
            actorUserId: "admin-1",
            action: "approve",
            workerId: worker.id,
            documentOwnerId: worker.id,
            phoneOptional: true,
            fullNameFallback: worker.submitted_full_name,
        });

        expect(result).toMatchObject({
            approved: true,
            status: "APPROVED",
            completion: 100,
            notificationQueued: true,
            notification: {
                status: "sent",
                error: null,
            },
            workerId: worker.id,
        });
        expect(updates).toHaveLength(1);
        expect(updates[0]).toMatchObject({
            admin_approved: true,
            admin_approved_by: "admin-1",
            status: "APPROVED",
        });
        expect(queueEmail).toHaveBeenCalledWith(
            adminClient,
            worker.id,
            "admin_update",
            "worker@example.com",
            "Worker Example",
            expect.objectContaining({
                title: "Job Finder Is Now Unlocked",
            }),
            undefined,
            "+381600000001",
        );
    });

    it("blocks approval revocation once Job Finder is already active", async () => {
        const worker = {
            id: "worker-3",
            profile_id: null,
            submitted_full_name: "Agency Worker",
            status: "IN_QUEUE",
            admin_approved: true,
            entry_fee_paid: true,
            job_search_active: true,
            phone: "+381600000002",
        };
        const { adminClient } = createAdminClientMock({
            worker,
            documents: [
                { document_type: "passport", status: "verified" },
                { document_type: "biometric_photo", status: "verified" },
                { document_type: "diploma", status: "verified" },
            ],
        });

        await expect(applyWorkerApprovalAction({
            adminClient: adminClient as any,
            actorUserId: "admin-1",
            action: "revoke",
            workerId: worker.id,
            documentOwnerId: worker.id,
            phoneOptional: true,
            fullNameFallback: worker.submitted_full_name,
        })).rejects.toThrow("Cannot revoke approval after Job Finder is active.");
    });

    it("keeps notificationQueued false when the unlock email fails", async () => {
        vi.mocked(queueEmail).mockResolvedValueOnce({ id: "email-2", sent: false, queued: false, status: "failed", error: "smtp_failed" });

        const worker = {
            id: "worker-4",
            profile_id: null,
            submitted_full_name: "Agency Worker",
            status: "PENDING_APPROVAL",
            admin_approved: false,
            entry_fee_paid: false,
            job_search_active: false,
            phone: "+381600000003",
        };
        const { adminClient } = createAdminClientMock({
            worker,
            documents: [
                { document_type: "passport", status: "verified" },
                { document_type: "biometric_photo", status: "verified" },
                { document_type: "diploma", status: "verified" },
            ],
        });

        const result = await applyWorkerApprovalAction({
            adminClient: adminClient as any,
            actorUserId: "admin-1",
            action: "approve",
            workerId: worker.id,
            documentOwnerId: worker.id,
            phoneOptional: true,
            fullNameFallback: worker.submitted_full_name,
        });

        expect(result.notificationQueued).toBe(false);
        expect(result.notification).toEqual({
            status: "failed",
            error: "smtp_failed",
            whatsapp: {
                status: "skipped",
                error: null,
            },
        });
    });

    it("preserves WhatsApp partial failure when the unlock email succeeds", async () => {
        vi.mocked(queueEmail).mockResolvedValueOnce({
            id: "email-3",
            sent: true,
            queued: false,
            status: "sent",
            error: null,
            whatsapp: {
                attempted: true,
                sent: false,
                error: "recipient blocked",
                retryable: false,
                failureCategory: "recipient",
                messageId: null,
            },
        });

        const worker = {
            id: "worker-6",
            profile_id: null,
            submitted_full_name: "Agency Worker",
            status: "PENDING_APPROVAL",
            admin_approved: false,
            entry_fee_paid: false,
            job_search_active: false,
            phone: "+381600000005",
        };
        const { adminClient } = createAdminClientMock({
            worker,
            documents: [
                { document_type: "passport", status: "verified" },
                { document_type: "biometric_photo", status: "verified" },
                { document_type: "diploma", status: "verified" },
            ],
        });

        const result = await applyWorkerApprovalAction({
            adminClient: adminClient as any,
            actorUserId: "admin-1",
            action: "approve",
            workerId: worker.id,
            documentOwnerId: worker.id,
            phoneOptional: true,
            fullNameFallback: worker.submitted_full_name,
        });

        expect(result.notificationQueued).toBe(true);
        expect(result.notification).toEqual({
            status: "sent",
            error: null,
            whatsapp: {
                status: "failed",
                error: "recipient blocked",
            },
        });
    });

    it("fails closed when the approval update matches no worker row", async () => {
        const worker = {
            id: "worker-5",
            profile_id: null,
            submitted_full_name: "Agency Worker",
            status: "PENDING_APPROVAL",
            admin_approved: false,
            entry_fee_paid: false,
            job_search_active: false,
            phone: "+381600000004",
        };
        const { adminClient } = createAdminClientMock({
            worker,
            documents: [
                { document_type: "passport", status: "verified" },
                { document_type: "biometric_photo", status: "verified" },
                { document_type: "diploma", status: "verified" },
            ],
            updateResult: {
                data: null,
                error: null,
            },
        });

        await expect(applyWorkerApprovalAction({
            adminClient: adminClient as any,
            actorUserId: "admin-1",
            action: "approve",
            workerId: worker.id,
            documentOwnerId: worker.id,
            phoneOptional: true,
            fullNameFallback: worker.submitted_full_name,
        })).rejects.toThrow("Worker record not found while updating approval.");

        expect(queueEmail).not.toHaveBeenCalled();
    });
});
