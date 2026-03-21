import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const sendProfileIncomplete = vi.fn();
const collectRecentRecipientSideBlockedPhones = vi.fn(() => new Set<string>());
const canSendWorkerDirectNotifications = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/whatsapp", () => ({
    sendProfileIncomplete,
    collectRecentRecipientSideBlockedPhones,
}));

vi.mock("@/lib/worker-notification-eligibility", () => ({
    canSendWorkerDirectNotifications,
}));

type MockWorkerRow = {
    id: string;
    profile_id: string | null;
    agency_id: string | null;
    submitted_email: string | null;
    phone: string | null;
    status: string | null;
    admin_approved: boolean | null;
    entry_fee_paid: boolean | null;
    queue_joined_at: string | null;
    job_search_active: boolean | null;
    updated_at: string;
};

type MockProfileRow = {
    id: string;
    full_name: string;
    email: string;
};

function createSupabaseAdmin({
    workerRows = [
        {
            id: "worker_1",
            profile_id: "profile_1",
            agency_id: null,
            submitted_email: null,
            phone: "+381600000001",
            status: "NEW",
            admin_approved: false,
            entry_fee_paid: false,
            queue_joined_at: null,
            job_search_active: false,
            updated_at: "2026-03-19T10:00:00.000Z",
        },
        {
            id: "worker_2",
            profile_id: null,
            agency_id: "agency_1",
            submitted_email: null,
            phone: "+381600000002",
            status: "NEW",
            admin_approved: false,
            entry_fee_paid: false,
            queue_joined_at: null,
            job_search_active: false,
            updated_at: "2026-03-19T10:00:00.000Z",
        },
    ] satisfies MockWorkerRow[],
    profileRows = [
        {
            id: "profile_1",
            full_name: "Worker One",
            email: "worker@example.com",
        },
    ] satisfies MockProfileRow[],
    workerRowsError = null,
}: {
    workerRows?: MockWorkerRow[];
    profileRows?: MockProfileRow[];
    workerRowsError?: { message: string } | null;
} = {}) {
    const insert = vi.fn().mockResolvedValue({ error: null });

    return {
        insert,
        client: {
            from(table: string) {
                if (table === "worker_onboarding") {
                    return {
                        select() {
                            return {
                                eq() {
                                    return {
                                        not: async () => ({
                                            data: workerRowsError ? null : workerRows,
                                            error: workerRowsError,
                                        }),
                                    };
                                },
                            };
                        },
                    };
                }

                if (table === "whatsapp_messages") {
                    return {
                        select() {
                            return {
                                eq() {
                                    return {
                                        eq() {
                                            return {
                                                eq() {
                                                    return {
                                                        gte: async () => ({ data: [] }),
                                                    };
                                                },
                                            };
                                        },
                                        in() {
                                            return {
                                                gte: async () => ({ data: [] }),
                                            };
                                        },
                                        gte: async () => ({ data: [] }),
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
                                }),
                            };
                        },
                    };
                }

                if (table === "user_activity") {
                    return { insert };
                }

                throw new Error(`Unexpected table ${table}`);
            },
        },
    };
}

describe("GET /api/cron/whatsapp-nudge", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        const { client } = createSupabaseAdmin();
        createAdminClient.mockReturnValue(client);
        sendProfileIncomplete.mockResolvedValue({ success: true });
        collectRecentRecipientSideBlockedPhones.mockReturnValue(new Set<string>());
        canSendWorkerDirectNotifications
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(false);
        process.env.CRON_SECRET = "secret";
    });

    it("uses shared worker notification eligibility before sending WhatsApp nudges", async () => {
        const { GET } = await import("@/app/api/cron/whatsapp-nudge/route");
        const response = await GET(new Request("http://localhost/api/cron/whatsapp-nudge", {
            headers: { authorization: "Bearer secret" },
        }));
        const payload = await response.json();

        expect(canSendWorkerDirectNotifications).toHaveBeenCalledTimes(2);
        expect(collectRecentRecipientSideBlockedPhones).toHaveBeenCalledTimes(1);
        expect(sendProfileIncomplete).toHaveBeenCalledTimes(1);
        expect(sendProfileIncomplete).toHaveBeenCalledWith(
            "+381600000001",
            "Worker",
            "finish your profile",
            "finish your profile and required documents so we can review your case",
            "profile_1"
        );
        expect(payload).toMatchObject({
            status: "success",
            found: 2,
            nudged: 1,
            skipped: 1,
        });
    });

    it("skips phones returned by the shared recent recipient-block helper", async () => {
        collectRecentRecipientSideBlockedPhones.mockReturnValue(new Set(["+381600000001"]));
        canSendWorkerDirectNotifications.mockReturnValue(true);

        const { GET } = await import("@/app/api/cron/whatsapp-nudge/route");
        const response = await GET(new Request("http://localhost/api/cron/whatsapp-nudge", {
            headers: { authorization: "Bearer secret" },
        }));
        const payload = await response.json();

        expect(sendProfileIncomplete).toHaveBeenCalledTimes(1);
        expect(sendProfileIncomplete).toHaveBeenCalledWith(
            "+381600000002",
            "there",
            "finish your profile",
            "finish your profile and required documents so we can review your case",
            undefined
        );
        expect(payload).toMatchObject({
            status: "success",
            found: 2,
            nudged: 1,
            skipped: 1,
        });
    });

    it("skips review-ready and approval-unlocked workers before any nudge is sent", async () => {
        sendProfileIncomplete.mockReset();
        sendProfileIncomplete.mockResolvedValue({ success: true });
        canSendWorkerDirectNotifications.mockReset();
        collectRecentRecipientSideBlockedPhones.mockReturnValue(new Set<string>());

        const { client } = createSupabaseAdmin({
            workerRows: [
                {
                    id: "worker_2",
                    profile_id: "profile_2",
                    agency_id: null,
                    submitted_email: null,
                    phone: "+381600000002",
                    status: "PENDING_APPROVAL",
                    admin_approved: false,
                    entry_fee_paid: false,
                    queue_joined_at: null,
                    job_search_active: false,
                    updated_at: "2026-03-19T10:00:00.000Z",
                },
                {
                    id: "worker_3",
                    profile_id: "profile_3",
                    agency_id: null,
                    submitted_email: null,
                    phone: "+381600000003",
                    status: "APPROVED",
                    admin_approved: true,
                    entry_fee_paid: false,
                    queue_joined_at: null,
                    job_search_active: false,
                    updated_at: "2026-03-19T10:00:00.000Z",
                },
            ],
            profileRows: [
                {
                    id: "profile_2",
                    full_name: "Worker Two",
                    email: "worker2@example.com",
                },
                {
                    id: "profile_3",
                    full_name: "Worker Three",
                    email: "worker3@example.com",
                },
            ],
        });

        createAdminClient.mockReturnValue(client);
        canSendWorkerDirectNotifications.mockReturnValue(true);

        const { GET } = await import("@/app/api/cron/whatsapp-nudge/route");
        const response = await GET(new Request("http://localhost/api/cron/whatsapp-nudge", {
            headers: { authorization: "Bearer secret" },
        }));
        const payload = await response.json();

        expect(canSendWorkerDirectNotifications).not.toHaveBeenCalled();
        expect(sendProfileIncomplete).not.toHaveBeenCalled();
        expect(payload).toMatchObject({
            status: "success",
            found: 2,
            nudged: 0,
            skipped: 2,
        });
    });

    it("fails closed when unpaid worker candidate preload fails", async () => {
        const { client } = createSupabaseAdmin({
            workerRows: [],
            workerRowsError: { message: "worker_onboarding unavailable" },
        });

        createAdminClient.mockReturnValue(client);

        const { GET } = await import("@/app/api/cron/whatsapp-nudge/route");
        const response = await GET(new Request("http://localhost/api/cron/whatsapp-nudge", {
            headers: { authorization: "Bearer secret" },
        }));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({
            status: "error",
            error: "Failed to load unpaid worker nudge candidates",
            found: 0,
            nudged: 0,
            skipped: 0,
            errors: 0,
        });
        expect(sendProfileIncomplete).not.toHaveBeenCalled();
    });
});
