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
});
