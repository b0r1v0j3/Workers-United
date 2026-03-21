import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendAnnouncement, sendStatusUpdate } = vi.hoisted(() => ({
    sendAnnouncement: vi.fn(),
    sendStatusUpdate: vi.fn(),
}));

const { logServerActivity } = vi.hoisted(() => ({
    logServerActivity: vi.fn(),
}));

vi.mock("@/lib/whatsapp", () => ({
    sendAnnouncement,
    sendStatusUpdate,
}));

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

import { loadWorkerWhatsAppBlastTargets, sendWorkerWhatsAppBlast } from "@/lib/whatsapp-blast";

const READY_WORKER_FIELDS = {
    status: "APPROVED",
    admin_approved: true,
    entry_fee_paid: false,
    phone: "+15550000001",
    nationality: "Ghanaian",
    current_country: "Ghana",
    preferred_job: "Construction",
    submitted_full_name: "Ali Worker",
    submitted_email: "ali@validmail.com",
    gender: "Male",
    date_of_birth: "1990-01-01",
    birth_country: "Ghana",
    birth_city: "Accra",
    citizenship: "Ghana",
    marital_status: "single",
    passport_number: "P1234567",
    passport_issued_by: "Ghana",
    passport_issue_date: "2020-01-01",
    passport_expiry_date: "2030-01-01",
    lives_abroad: false,
    previous_visas: false,
    family_data: null,
};

function createAdminClient(params?: {
    workers?: Array<Record<string, unknown>>;
    profiles?: Array<Record<string, unknown>>;
    documents?: Array<Record<string, unknown>>;
}) {
    const workerRows = params?.workers || [];
    const profileRows = params?.profiles || [];
    const documentRows = params?.documents || [];

    return {
        from(table: string) {
            if (table === "worker_onboarding") {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    not() {
                                        return {
                                            gt: async () => ({
                                                data: workerRows,
                                                error: null,
                                            }),
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            }

            if (table === "profiles") {
                return {
                    select() {
                        return {
                            in: async () => ({
                                data: profileRows,
                                error: null,
                            }),
                        };
                    },
                };
            }

            if (table === "worker_documents") {
                return {
                    select() {
                        return {
                            in: async () => ({
                                data: documentRows,
                                error: null,
                            }),
                        };
                    },
                };
            }

            throw new Error(`Unexpected table ${table}`);
        },
    };
}

describe("whatsapp-blast", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads only canonical payment-ready worker blast targets", async () => {
        const admin = createAdminClient({
            workers: [
                {
                    ...READY_WORKER_FIELDS,
                    id: "worker_old",
                    profile_id: "profile_1",
                    agency_id: null,
                    updated_at: "2026-03-19T10:00:00.000Z",
                },
                {
                    ...READY_WORKER_FIELDS,
                    id: "worker_new",
                    profile_id: "profile_1",
                    agency_id: null,
                    updated_at: "2026-03-20T10:00:00.000Z",
                },
                {
                    ...READY_WORKER_FIELDS,
                    id: "pending_worker",
                    profile_id: "profile_2",
                    agency_id: null,
                    admin_approved: false,
                    phone: "+15550000002",
                    submitted_email: "pending@validmail.com",
                    submitted_full_name: "Pending Worker",
                    updated_at: "2026-03-20T09:30:00.000Z",
                },
                {
                    id: "draft_worker",
                    profile_id: null,
                    agency_id: "agency_1",
                    submitted_email: null,
                    submitted_full_name: "Draft Worker",
                    phone: "+15550000003",
                    status: "NEW",
                    entry_fee_paid: false,
                    admin_approved: false,
                    updated_at: "2026-03-20T09:00:00.000Z",
                },
                {
                    ...READY_WORKER_FIELDS,
                    id: "sandbox_worker",
                    profile_id: "profile_3",
                    agency_id: null,
                    phone: "+381600000123",
                    submitted_email: "sandbox@validmail.com",
                    submitted_full_name: "Sandbox Worker",
                    updated_at: "2026-03-20T09:00:00.000Z",
                },
            ],
            profiles: [
                { id: "profile_1", full_name: "Ali Worker", email: "ali@validmail.com" },
                { id: "profile_2", full_name: "Pending Worker", email: "pending@validmail.com" },
                { id: "profile_3", full_name: "Sandbox Worker", email: "sandbox@validmail.com" },
            ],
            documents: [
                { user_id: "profile_1", document_type: "passport" },
                { user_id: "profile_1", document_type: "biometric_photo" },
                { user_id: "profile_1", document_type: "diploma" },
                { user_id: "profile_2", document_type: "passport" },
                { user_id: "profile_2", document_type: "biometric_photo" },
                { user_id: "profile_2", document_type: "diploma" },
                { user_id: "profile_3", document_type: "passport" },
                { user_id: "profile_3", document_type: "biometric_photo" },
                { user_id: "profile_3", document_type: "diploma" },
            ],
        });

        const targets = await loadWorkerWhatsAppBlastTargets(admin as never);

        expect(targets).toEqual([
            {
                workerId: "worker_new",
                profileId: "profile_1",
                phone: "+15550000001",
                status: "APPROVED",
                fullName: "Ali Worker",
                firstName: "Ali",
            },
        ]);
    });

    it("sends blast only to payment-ready workers and falls back to status update", async () => {
        sendAnnouncement
            .mockResolvedValueOnce({ success: false, error: "announcement_failed" })
            .mockResolvedValueOnce({ success: true, messageId: "msg_2" });
        sendStatusUpdate.mockResolvedValueOnce({ success: true, messageId: "msg_1" });

        const admin = createAdminClient({
            workers: [
                {
                    ...READY_WORKER_FIELDS,
                    id: "worker_1",
                    profile_id: "profile_1",
                    agency_id: null,
                    updated_at: "2026-03-20T10:00:00.000Z",
                },
                {
                    ...READY_WORKER_FIELDS,
                    id: "worker_2",
                    profile_id: "profile_2",
                    agency_id: null,
                    phone: "+15550000002",
                    submitted_email: "mira@validmail.com",
                    submitted_full_name: "Mira Worker",
                    updated_at: "2026-03-20T09:00:00.000Z",
                },
                {
                    ...READY_WORKER_FIELDS,
                    id: "review_worker",
                    profile_id: "profile_3",
                    agency_id: null,
                    phone: "+15550000003",
                    submitted_email: "review@validmail.com",
                    submitted_full_name: "Review Worker",
                    admin_approved: false,
                    updated_at: "2026-03-20T08:00:00.000Z",
                },
            ],
            profiles: [
                { id: "profile_1", full_name: "Ali Worker", email: "ali@validmail.com" },
                { id: "profile_2", full_name: "Mira Worker", email: "mira@validmail.com" },
                { id: "profile_3", full_name: "Review Worker", email: "review@validmail.com" },
            ],
            documents: [
                { user_id: "profile_1", document_type: "passport" },
                { user_id: "profile_1", document_type: "biometric_photo" },
                { user_id: "profile_1", document_type: "diploma" },
                { user_id: "profile_2", document_type: "passport" },
                { user_id: "profile_2", document_type: "biometric_photo" },
                { user_id: "profile_2", document_type: "diploma" },
                { user_id: "profile_3", document_type: "passport" },
                { user_id: "profile_3", document_type: "biometric_photo" },
                { user_id: "profile_3", document_type: "diploma" },
            ],
        });

        const result = await sendWorkerWhatsAppBlast({
            admin: admin as never,
            actorUserId: "admin_1",
            title: "Job Finder Is Unlocked",
            customMessage: "Hi {name}, pay here {link}",
        });

        expect(result.total).toBe(2);
        expect(result.sent).toBe(2);
        expect(result.failed).toBe(0);
        expect(sendAnnouncement).toHaveBeenCalledTimes(2);
        expect(sendAnnouncement).toHaveBeenNthCalledWith(
            1,
            "+15550000001",
            "Job Finder Is Unlocked",
            expect.stringContaining("Hi Ali, pay here"),
            "/profile/worker/queue",
            "profile_1"
        );
        expect(sendStatusUpdate).toHaveBeenCalledWith(
            "+15550000001",
            "Ali",
            expect.stringContaining("Complete the $9 Job Finder checkout"),
            "profile_1"
        );
        expect(logServerActivity).toHaveBeenCalledOnce();
    });
});
