import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const sendProfileIncomplete = vi.fn();
const canSendWorkerDirectNotifications = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/whatsapp", () => ({
    sendProfileIncomplete,
}));

vi.mock("@/lib/worker-notification-eligibility", () => ({
    canSendWorkerDirectNotifications,
}));

function createSupabaseAdmin() {
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
                                            data: [
                                                {
                                                    id: "worker_1",
                                                    profile_id: "profile_1",
                                                    agency_id: null,
                                                    submitted_email: null,
                                                    phone: "+381600000001",
                                                    status: "NEW",
                                                    entry_fee_paid: false,
                                                    updated_at: "2026-03-19T10:00:00.000Z",
                                                },
                                                {
                                                    id: "worker_2",
                                                    profile_id: null,
                                                    agency_id: "agency_1",
                                                    submitted_email: null,
                                                    phone: "+381600000002",
                                                    status: "NEW",
                                                    entry_fee_paid: false,
                                                    updated_at: "2026-03-19T10:00:00.000Z",
                                                },
                                            ],
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
                                    data: [
                                        {
                                            id: "profile_1",
                                            full_name: "Worker One",
                                            email: "worker@example.com",
                                        },
                                    ],
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
        expect(sendProfileIncomplete).toHaveBeenCalledTimes(1);
        expect(sendProfileIncomplete).toHaveBeenCalledWith(
            "+381600000001",
            "Worker",
            "almost ready",
            "complete your registration and join the job queue",
            "profile_1"
        );
        expect(payload).toMatchObject({
            status: "success",
            found: 2,
            nudged: 1,
            skipped: 1,
        });
    });
});
