import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    queueEmail,
    getWorkerCompletion,
    canSendWorkerDirectNotifications,
    loadCanonicalWorkerRecord,
} = vi.hoisted(() => ({
    queueEmail: vi.fn(),
    getWorkerCompletion: vi.fn(),
    canSendWorkerDirectNotifications: vi.fn(),
    loadCanonicalWorkerRecord: vi.fn(),
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

vi.mock("@/lib/profile-completion", () => ({
    getWorkerCompletion,
}));

vi.mock("@/lib/worker-notification-eligibility", () => ({
    canSendWorkerDirectNotifications,
}));

vi.mock("@/lib/workers", () => ({
    loadCanonicalWorkerRecord,
    normalizeWorkerPhone: (value: string | null | undefined) => value || null,
}));

vi.mock("@/lib/worker-approval-notifications", () => ({
    buildWorkerPaymentUnlockedEmailData: vi.fn(() => ({ message: "Job Finder unlocked" })),
    resolveWorkerApprovalNotificationRecipient: vi.fn(() => null),
}));

import { syncWorkerReviewStatus } from "@/lib/worker-review";

function createAdminClient() {
    return {
        from(table: string) {
            if (table === "worker_documents") {
                return {
                    select: (selection: string) => {
                        if (selection === "ocr_json, status") {
                            return {
                                eq: () => ({
                                    eq: () => ({
                                        in: () => ({
                                            order: () => ({
                                                order: () => ({
                                                    limit: () => ({
                                                        maybeSingle: vi.fn(async () => ({
                                                            data: null,
                                                            error: null,
                                                        })),
                                                    }),
                                                }),
                                            }),
                                        }),
                                    }),
                                }),
                            };
                        }

                        return {
                            eq: vi.fn(async () => ({
                                data: [
                                    { document_type: "passport", status: "verified" },
                                    { document_type: "biometric_photo", status: "verified" },
                                    { document_type: "diploma", status: "verified" },
                                ],
                                error: null,
                            })),
                        };
                    },
                };
            }

            if (table === "profiles") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: vi.fn(async () => ({
                                data: {
                                    full_name: "Worker One",
                                    email: "worker@example.com",
                                },
                                error: null,
                            })),
                        }),
                    }),
                };
            }

            if (table === "email_queue") {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                eq: () => ({
                                    limit: () => ({
                                        maybeSingle: vi.fn(async () => ({
                                            data: null,
                                            error: null,
                                        })),
                                    }),
                                }),
                            }),
                        }),
                    }),
                };
            }

            if (table === "worker_onboarding") {
                return {
                    update: () => ({
                        eq: vi.fn(async () => ({ error: null })),
                    }),
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        },
    };
}

describe("syncWorkerReviewStatus notification hardening", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadCanonicalWorkerRecord.mockResolvedValue({
            data: {
                id: "worker-1",
                profile_id: "profile-1",
                phone: "+123456789",
                status: "NEW",
                entry_fee_paid: false,
                admin_approved: false,
                job_search_active: false,
                submitted_full_name: "Worker One",
            },
            error: null,
        });
        getWorkerCompletion.mockReturnValue({
            completion: 100,
            missingFields: [],
        });
        canSendWorkerDirectNotifications.mockReturnValue(true);
    });

    it("keeps review sync successful when the pending-approval notification queue call fails", async () => {
        queueEmail.mockRejectedValueOnce(new Error("Failed to mark email as sent"));

        const result = await syncWorkerReviewStatus({
            adminClient: createAdminClient() as never,
            profileId: "profile-1",
            notifyOnPendingApproval: true,
        });

        expect(result.reviewQueued).toBe(true);
        expect(result.notificationSent).toBe(false);
        expect(result.notificationReason).toBe("notification_queue_failed");
        expect(queueEmail).toHaveBeenCalledWith(
            expect.anything(),
            "profile-1",
            "profile_complete",
            "worker@example.com",
            "Worker One",
            {},
            undefined,
            "+123456789"
        );
    });
});
