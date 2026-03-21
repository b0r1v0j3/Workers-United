import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileSingle = vi.fn();
const adminProfileMaybeSingle = vi.fn();
const adminProfileUpdateEq = vi.fn();
const auditInsert = vi.fn();
const syncAuthContactFields = vi.fn();

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
                            single: profileSingle,
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected server table ${table}`);
        },
    }),
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
        from: (table: string) => {
            if (table === "profiles") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: adminProfileMaybeSingle,
                        }),
                    }),
                    update: () => ({
                        eq: adminProfileUpdateEq,
                    }),
                };
            }

            if (table === "admin_audit_log") {
                return {
                    insert: auditInsert,
                };
            }

            throw new Error(`Unexpected admin table ${table}`);
        },
    }),
}));

vi.mock("@/lib/auth-contact-sync", () => ({
    syncAuthContactFields,
}));

vi.mock("@/lib/godmode", () => ({
    isGodModeUser: vi.fn(() => false),
}));

vi.mock("@/lib/contract-data", () => ({
    buildContractDataForMatch: vi.fn(),
}));

describe("POST /api/admin/edit-data", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        authGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "admin-1",
                    email: "admin@example.com",
                },
            },
        });
        profileSingle.mockResolvedValue({
            data: {
                user_type: "admin",
            },
        });
        adminProfileMaybeSingle.mockResolvedValue({
            data: {
                full_name: "Old Name",
            },
        });
        adminProfileUpdateEq.mockResolvedValue({
            error: null,
        });
        syncAuthContactFields.mockResolvedValue(undefined);
    });

    it("returns truthful partial success when the audit log insert fails after the data update", async () => {
        auditInsert.mockResolvedValueOnce({
            error: {
                message: "insert blocked",
            },
        });

        const { POST } = await import("@/app/api/admin/edit-data/route");

        const response = await POST(new NextRequest("http://localhost/api/admin/edit-data", {
            method: "POST",
            body: JSON.stringify({
                table: "profiles",
                recordId: "profile-1",
                field: "full_name",
                value: "New Name",
            }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            auditLogged: false,
            warning: "Data was updated, but the admin audit log entry failed to save.",
            field: "full_name",
            value: "New Name",
        });
        expect(syncAuthContactFields).toHaveBeenCalledWith(expect.anything(), {
            userId: "profile-1",
            fullName: "New Name",
        });
    });

    it("returns auditLogged true when the data update and audit log both succeed", async () => {
        auditInsert.mockResolvedValueOnce({
            error: null,
        });

        const { POST } = await import("@/app/api/admin/edit-data/route");

        const response = await POST(new NextRequest("http://localhost/api/admin/edit-data", {
            method: "POST",
            body: JSON.stringify({
                table: "profiles",
                recordId: "profile-1",
                field: "full_name",
                value: "New Name",
            }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            auditLogged: true,
            field: "full_name",
            value: "New Name",
        });
    });
});
