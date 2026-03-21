import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAllAuthUsers } = vi.hoisted(() => ({
    getAllAuthUsers: vi.fn(),
}));

const { queueEmail } = vi.hoisted(() => ({
    queueEmail: vi.fn(),
}));

const { logServerActivity } = vi.hoisted(() => ({
    logServerActivity: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
    getAllAuthUsers,
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

import { loadAnnouncementTargets, sendAdminAnnouncement, sendDocumentFixAnnouncementEmails } from "@/lib/admin-announcements";

function createAdminClient(params?: {
    workerRows?: Array<Record<string, unknown>>;
}) {
    const workerRows = params?.workerRows || [];

    return {
        from(table: string) {
            if (table === "worker_onboarding") {
                return {
                    select() {
                        return {
                            in: async () => ({
                                data: workerRows,
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

describe("admin-announcements", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads deduped deliverable targets and skips hidden draft owners/internal emails", async () => {
        getAllAuthUsers.mockResolvedValue([
            {
                id: "worker_1",
                email: "worker@validmail.com",
                user_metadata: { user_type: "worker", full_name: "Ali Worker" },
            },
            {
                id: "worker_dup",
                email: "worker@validmail.com",
                user_metadata: { user_type: "worker", full_name: "Ali Duplicate" },
            },
            {
                id: "hidden_draft_owner",
                email: "draft-worker-1@workersunited.internal",
                user_metadata: { user_type: "worker", hidden_draft_owner: true, full_name: "Hidden Draft" },
            },
            {
                id: "employer_1",
                email: "boss@company.com",
                user_metadata: { user_type: "employer", full_name: "Boss Company" },
            },
            {
                id: "agency_1",
                email: "agent@agency.com",
                user_metadata: { user_type: "agency", full_name: "Agency Team" },
            },
            {
                id: "admin_1",
                email: "admin@workersunited.eu",
                user_metadata: { user_type: "admin", full_name: "Admin User" },
            },
            {
                id: "null_role_worker",
                email: "nullrole@validmail.com",
                user_metadata: { full_name: "Null Role Worker" },
            },
        ]);

        const admin = createAdminClient({
            workerRows: [
                {
                    profile_id: "worker_1",
                    agency_id: null,
                    submitted_email: "worker@validmail.com",
                    phone: "+15550000001",
                    updated_at: "2026-03-20T08:00:00.000Z",
                },
                {
                    profile_id: "worker_dup",
                    agency_id: null,
                    submitted_email: "worker@validmail.com",
                    phone: "+15550000002",
                    updated_at: "2026-03-20T07:00:00.000Z",
                },
                {
                    profile_id: "null_role_worker",
                    agency_id: null,
                    submitted_email: "nullrole@validmail.com",
                    phone: "+15550000003",
                    updated_at: "2026-03-20T06:00:00.000Z",
                },
            ],
        });

        const allTargets = await loadAnnouncementTargets(admin as never, "all");
        const workerTargets = await loadAnnouncementTargets(admin as never, "workers");

        expect(allTargets).toEqual([
            {
                userId: "worker_1",
                email: "worker@validmail.com",
                name: "Ali Worker",
                recipientRole: "worker",
            },
            {
                userId: "employer_1",
                email: "boss@company.com",
                name: "Boss Company",
                recipientRole: "employer",
            },
            {
                userId: "agency_1",
                email: "agent@agency.com",
                name: "Agency Team",
                recipientRole: "agency",
            },
            {
                userId: "null_role_worker",
                email: "nullrole@validmail.com",
                name: "Null Role Worker",
                recipientRole: "worker",
            },
        ]);

        expect(workerTargets).toEqual([
            {
                userId: "worker_1",
                email: "worker@validmail.com",
                name: "Ali Worker",
                recipientRole: "worker",
            },
            {
                userId: "null_role_worker",
                email: "nullrole@validmail.com",
                name: "Null Role Worker",
                recipientRole: "worker",
            },
        ]);
    });

    it("sends announcement emails through queueEmail and records audit data", async () => {
        getAllAuthUsers.mockResolvedValue([
            {
                id: "worker_1",
                email: "worker@validmail.com",
                user_metadata: { user_type: "worker", full_name: "Ali Worker" },
            },
            {
                id: "agency_1",
                email: "agent@agency.com",
                user_metadata: { user_type: "agency", full_name: "Agency Team" },
            },
        ]);

        queueEmail
            .mockResolvedValueOnce({ id: "email_1", sent: true, error: null })
            .mockResolvedValueOnce({ id: "email_2", sent: false, error: "smtp_failed" });

        const admin = createAdminClient({
            workerRows: [
                {
                    profile_id: "worker_1",
                    agency_id: null,
                    submitted_email: "worker@validmail.com",
                    phone: "+15550000001",
                    updated_at: "2026-03-20T08:00:00.000Z",
                },
            ],
        });

        const result = await sendAdminAnnouncement({
            admin: admin as never,
            actorUserId: "admin_user",
            audience: "all",
            subject: "Important update",
            message: "Please review your case.",
            actionLink: "https://workersunited.eu/profile/worker",
        });

        expect(result.total).toBe(2);
        expect(result.sent).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.failedDetails).toEqual([
            {
                email: "agent@agency.com",
                name: "Agency Team",
                error: "smtp_failed",
            },
        ]);
        expect(queueEmail).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            "worker_1",
            "announcement",
            "worker@validmail.com",
            "Ali Worker",
            expect.objectContaining({
                title: "Important update",
                message: "Please review your case.",
                actionText: "View Details",
                actionLink: "https://workersunited.eu/profile/worker",
                recipientRole: "worker",
            })
        );
        expect(queueEmail).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            "agency_1",
            "announcement",
            "agent@agency.com",
            "Agency Team",
            expect.objectContaining({
                recipientRole: "agency",
            })
        );
        expect(logServerActivity).toHaveBeenCalledOnce();
    });

    it("sends document-fix announcements through the shared worker audience path", async () => {
        getAllAuthUsers.mockResolvedValue([
            {
                id: "worker_1",
                email: "worker@validmail.com",
                user_metadata: { user_type: "worker", full_name: "Ali Worker" },
            },
            {
                id: "agency_1",
                email: "agent@agency.com",
                user_metadata: { user_type: "agency", full_name: "Agency Team" },
            },
        ]);

        queueEmail.mockResolvedValueOnce({ id: "email_1", sent: true, error: null });

        const admin = createAdminClient({
            workerRows: [
                {
                    profile_id: "worker_1",
                    agency_id: null,
                    submitted_email: "worker@validmail.com",
                    phone: "+15550000001",
                    updated_at: "2026-03-20T08:00:00.000Z",
                },
            ],
        });

        const result = await sendDocumentFixAnnouncementEmails({
            admin: admin as never,
            actorUserId: "admin_user",
        });

        expect(result.total).toBe(1);
        expect(result.sent).toBe(1);
        expect(result.queued).toBe(0);
        expect(result.failed).toBe(0);
        expect(queueEmail).toHaveBeenCalledOnce();
        expect(queueEmail).toHaveBeenCalledWith(
            expect.anything(),
            "worker_1",
            "announcement_document_fix",
            "worker@validmail.com",
            "Ali Worker",
            expect.objectContaining({
                recipientRole: "worker",
            })
        );
        expect(logServerActivity).toHaveBeenCalledOnce();
        expect(logServerActivity).toHaveBeenCalledWith(
            "admin_user",
            "admin_document_fix_announcement_sent",
            "messaging",
            expect.objectContaining({
                audience: "workers",
                template: "announcement_document_fix",
                total: 1,
                sent: 1,
                queued: 0,
            }),
            "ok"
        );
    });

    it("treats queued-retry announcement emails as accepted instead of failed", async () => {
        getAllAuthUsers.mockResolvedValue([
            {
                id: "worker_1",
                email: "worker@validmail.com",
                user_metadata: { user_type: "worker", full_name: "Ali Worker" },
            },
        ]);

        queueEmail.mockResolvedValueOnce({
            id: "email_1",
            sent: false,
            queued: true,
            status: "queued_retry",
            error: "421 Temporary failure",
        });

        const admin = createAdminClient({
            workerRows: [
                {
                    profile_id: "worker_1",
                    agency_id: null,
                    submitted_email: "worker@validmail.com",
                    phone: "+15550000001",
                    updated_at: "2026-03-20T08:00:00.000Z",
                },
            ],
        });

        const result = await sendAdminAnnouncement({
            admin: admin as never,
            actorUserId: "admin_user",
            audience: "workers",
            subject: "Important update",
            message: "Please review your case.",
        });

        expect(result.total).toBe(1);
        expect(result.sent).toBe(0);
        expect(result.queued).toBe(1);
        expect(result.failed).toBe(0);
        expect(result.failedDetails).toEqual([]);
        expect(logServerActivity).toHaveBeenCalledWith(
            "admin_user",
            "admin_announcement_sent",
            "messaging",
            expect.objectContaining({
                sent: 0,
                queued: 1,
                failed: 0,
            }),
            "warning"
        );
    });
});
