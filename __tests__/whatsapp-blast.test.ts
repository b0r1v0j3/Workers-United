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

function createAdminClient(params?: {
    workers?: Array<Record<string, unknown>>;
    profiles?: Array<Record<string, unknown>>;
}) {
    const workerRows = params?.workers || [];
    const profileRows = params?.profiles || [];

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

            throw new Error(`Unexpected table ${table}`);
        },
    };
}

describe("whatsapp-blast", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads only eligible canonical worker blast targets", async () => {
        const admin = createAdminClient({
            workers: [
                {
                    id: "worker_old",
                    profile_id: "profile_1",
                    agency_id: null,
                    submitted_email: "worker@validmail.com",
                    phone: "+15550000001",
                    status: "APPROVED",
                    entry_fee_paid: false,
                    updated_at: "2026-03-19T10:00:00.000Z",
                },
                {
                    id: "worker_new",
                    profile_id: "profile_1",
                    agency_id: null,
                    submitted_email: "worker@validmail.com",
                    phone: "+15550000001",
                    status: "APPROVED",
                    entry_fee_paid: false,
                    updated_at: "2026-03-20T10:00:00.000Z",
                    preferred_job: "Construction",
                },
                {
                    id: "draft_worker",
                    profile_id: null,
                    agency_id: "agency_1",
                    submitted_email: null,
                    phone: "+15550000002",
                    status: "NEW",
                    entry_fee_paid: false,
                    updated_at: "2026-03-20T09:00:00.000Z",
                },
                {
                    id: "sandbox_worker",
                    profile_id: "profile_3",
                    agency_id: null,
                    submitted_email: "sandbox@validmail.com",
                    phone: "+381600000123",
                    status: "NEW",
                    entry_fee_paid: false,
                    updated_at: "2026-03-20T09:00:00.000Z",
                },
            ],
            profiles: [
                { id: "profile_1", full_name: "Ali Worker", email: "worker@validmail.com" },
                { id: "profile_3", full_name: "Sandbox Worker", email: "sandbox@validmail.com" },
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

    it("sends blast through announcement first and falls back to status update", async () => {
        sendAnnouncement
            .mockResolvedValueOnce({ success: false, error: "announcement_failed" })
            .mockResolvedValueOnce({ success: true, messageId: "msg_2" });
        sendStatusUpdate.mockResolvedValueOnce({ success: true, messageId: "msg_1" });

        const admin = createAdminClient({
            workers: [
                {
                    id: "worker_1",
                    profile_id: "profile_1",
                    agency_id: null,
                    submitted_email: "ali@validmail.com",
                    phone: "+15550000001",
                    status: "APPROVED",
                    entry_fee_paid: false,
                    updated_at: "2026-03-20T10:00:00.000Z",
                },
                {
                    id: "worker_2",
                    profile_id: "profile_2",
                    agency_id: null,
                    submitted_email: "mira@validmail.com",
                    phone: "+15550000002",
                    status: "PENDING_APPROVAL",
                    entry_fee_paid: false,
                    updated_at: "2026-03-20T09:00:00.000Z",
                },
            ],
            profiles: [
                { id: "profile_1", full_name: "Ali Worker", email: "ali@validmail.com" },
                { id: "profile_2", full_name: "Mira Worker", email: "mira@validmail.com" },
            ],
        });

        const result = await sendWorkerWhatsAppBlast({
            admin: admin as never,
            actorUserId: "admin_1",
            title: "Activate Job Finder",
            customMessage: "Hi {name}, pay here {link}",
        });

        expect(result.total).toBe(2);
        expect(result.sent).toBe(2);
        expect(result.failed).toBe(0);
        expect(sendAnnouncement).toHaveBeenNthCalledWith(
            1,
            "+15550000001",
            "Activate Job Finder",
            expect.stringContaining("Hi Ali, pay here"),
            "/profile/worker/queue",
            "profile_1"
        );
        expect(sendStatusUpdate).toHaveBeenCalledWith(
            "+15550000001",
            "Ali",
            expect.stringContaining("Activate Job Finder for $9"),
            "profile_1"
        );
        expect(logServerActivity).toHaveBeenCalledOnce();
    });
});
