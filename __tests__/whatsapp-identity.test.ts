import { describe, expect, it, vi } from "vitest";
import { resolveWhatsAppWorkerIdentity } from "@/lib/whatsapp-identity";

describe("whatsapp-identity", () => {
    it("resolves the latest worker/profile pair from direct phone matches", async () => {
        const matchedWorkers = [
            {
                id: "worker_1",
                profile_id: "profile_1",
                updated_at: "2026-03-19T12:00:00.000Z",
                entry_fee_paid: false,
            },
        ];

        const profileRow = {
            full_name: "Ali Worker",
            email: "ali@example.com",
            user_type: "worker",
            created_at: "2026-03-18T10:00:00.000Z",
        };

        const admin = {
            from: vi.fn((table: string) => {
                if (table === "worker_onboarding") {
                    return {
                        select: vi.fn(() => ({
                            or: vi.fn(() => ({
                                order: vi.fn(() => ({
                                    limit: vi.fn().mockResolvedValue({ data: matchedWorkers }),
                                })),
                            })),
                        })),
                    };
                }

                if (table === "profiles") {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                single: vi.fn().mockResolvedValue({ data: profileRow }),
                            })),
                        })),
                    };
                }

                throw new Error(`Unexpected table ${table}`);
            }),
            auth: {
                admin: {
                    listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }),
                },
            },
        };

        const result = await resolveWhatsAppWorkerIdentity<
            { id: string; profile_id: string; updated_at: string; entry_fee_paid: boolean },
            { full_name: string; email: string; user_type: string; created_at: string }
        >({
            admin,
            rawPhone: "971558476456",
            normalizedPhone: "+971558476456",
            workerSelect: "id, profile_id, updated_at, entry_fee_paid",
        });

        expect(result.workerRecord?.id).toBe("worker_1");
        expect(result.profile?.full_name).toBe("Ali Worker");
        expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    });

    it("prefers direct phone matches that already have a linked profile over richer orphan duplicates", async () => {
        const matchedWorkers = [
            {
                id: "worker_orphan",
                profile_id: null,
                updated_at: "2026-03-21T12:00:00.000Z",
                entry_fee_paid: true,
                queue_joined_at: "2026-03-20T09:00:00.000Z",
            },
            {
                id: "worker_linked",
                profile_id: "profile_linked",
                updated_at: "2026-03-20T12:00:00.000Z",
                entry_fee_paid: false,
                queue_joined_at: null,
            },
        ];

        const admin = {
            from: vi.fn((table: string) => {
                if (table === "worker_onboarding") {
                    return {
                        select: vi.fn(() => ({
                            or: vi.fn(() => ({
                                order: vi.fn(() => ({
                                    limit: vi.fn().mockResolvedValue({ data: matchedWorkers }),
                                })),
                            })),
                        })),
                    };
                }

                if (table === "profiles") {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                single: vi.fn().mockResolvedValue({
                                    data: {
                                        full_name: "Linked Worker",
                                        email: "linked@example.com",
                                        user_type: "worker",
                                        created_at: "2026-03-18T10:00:00.000Z",
                                    },
                                }),
                            })),
                        })),
                    };
                }

                throw new Error(`Unexpected table ${table}`);
            }),
            auth: {
                admin: {
                    listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }),
                },
            },
        };

        const result = await resolveWhatsAppWorkerIdentity<
            { id: string; profile_id: string | null; updated_at: string; entry_fee_paid: boolean; queue_joined_at: string | null },
            { full_name: string; email: string; user_type: string; created_at: string }
        >({
            admin,
            rawPhone: "381600000010",
            normalizedPhone: "+381600000010",
            workerSelect: "id, profile_id, updated_at, entry_fee_paid, queue_joined_at",
        });

        expect(result.workerRecord?.id).toBe("worker_linked");
        expect(result.profile?.full_name).toBe("Linked Worker");
        expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    });

    it("continues to auth fallback when the direct phone match is missing profile linkage", async () => {
        const phoneUpdates: Array<Record<string, unknown>> = [];
        const admin = {
            from: vi.fn((table: string) => {
                if (table === "worker_onboarding") {
                    return {
                        select: vi.fn(() => ({
                            or: vi.fn(() => ({
                                order: vi.fn(() => ({
                                    limit: vi.fn().mockResolvedValue({
                                        data: [
                                            {
                                                id: "worker_orphan",
                                                profile_id: null,
                                                updated_at: "2026-03-21T12:00:00.000Z",
                                            },
                                        ],
                                    }),
                                })),
                            })),
                            eq: vi.fn(() => ({
                                order: vi.fn(() => ({
                                    limit: vi.fn().mockResolvedValue({
                                        data: [
                                            {
                                                id: "worker_linked",
                                                profile_id: "profile_linked",
                                                updated_at: "2026-03-20T10:00:00.000Z",
                                            },
                                        ],
                                    }),
                                })),
                            })),
                        })),
                        update: vi.fn((payload: Record<string, unknown>) => {
                            phoneUpdates.push(payload);
                            return {
                                eq: vi.fn().mockResolvedValue({ error: null }),
                            };
                        }),
                    };
                }

                if (table === "profiles") {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                single: vi.fn().mockResolvedValue({
                                    data: {
                                        full_name: "Recovered Worker",
                                        email: "recovered@example.com",
                                        user_type: "worker",
                                        created_at: "2026-03-18T10:00:00.000Z",
                                    },
                                }),
                            })),
                        })),
                    };
                }

                throw new Error(`Unexpected table ${table}`);
            }),
            auth: {
                admin: {
                    listUsers: vi.fn().mockResolvedValue({
                        data: {
                            users: [
                                {
                                    id: "profile_linked",
                                    phone: "+381600000020",
                                    user_metadata: {},
                                },
                            ],
                        },
                    }),
                },
            },
        };

        const result = await resolveWhatsAppWorkerIdentity<
            { id: string; profile_id: string | null; updated_at: string },
            { full_name: string; email: string; user_type: string; created_at: string }
        >({
            admin,
            rawPhone: "381600000020",
            normalizedPhone: "+381600000020",
            workerSelect: "id, profile_id, updated_at",
        });

        expect(result.workerRecord?.id).toBe("worker_linked");
        expect(result.profile?.full_name).toBe("Recovered Worker");
        expect(admin.auth.admin.listUsers).toHaveBeenCalledOnce();
        expect(phoneUpdates).toContainEqual({ phone: "+381600000020" });
    });
});
