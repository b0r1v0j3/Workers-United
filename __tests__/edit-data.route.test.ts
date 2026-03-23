import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileSingle = vi.fn();
const adminProfileMaybeSingle = vi.fn();
const adminProfileUpdateEq = vi.fn();
const adminProfileUpdateSelect = vi.fn();
const adminProfileUpdateMaybeSingle = vi.fn();
const adminContractMaybeSingle = vi.fn();
const adminContractUpdateEq = vi.fn();
const adminContractUpdateSelect = vi.fn();
const adminContractUpdateMaybeSingle = vi.fn();
const auditInsert = vi.fn();
const syncAuthContactFields = vi.fn();
const buildContractDataForMatch = vi.fn();

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

            if (table === "contract_data") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: adminContractMaybeSingle,
                        }),
                    }),
                    update: () => ({
                        eq: adminContractUpdateEq,
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
    buildContractDataForMatch,
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
        adminProfileUpdateEq.mockImplementation(() => ({
            select: adminProfileUpdateSelect,
        }));
        adminProfileUpdateSelect.mockImplementation(() => ({
            maybeSingle: adminProfileUpdateMaybeSingle,
        }));
        adminProfileUpdateMaybeSingle.mockResolvedValue({
            data: {
                id: "profile-1",
            },
            error: null,
        });
        adminContractMaybeSingle.mockResolvedValue({
            data: {
                id: "contract-1",
                match_id: "match-1",
            },
            error: null,
        });
        adminContractUpdateEq.mockImplementation(() => ({
            select: adminContractUpdateSelect,
        }));
        adminContractUpdateSelect.mockImplementation(() => ({
            maybeSingle: adminContractUpdateMaybeSingle,
        }));
        adminContractUpdateMaybeSingle.mockResolvedValue({
            data: {
                id: "contract-1",
            },
            error: null,
        });
        buildContractDataForMatch.mockResolvedValue({
            contractData: {
                contact_email: "old@workersunited.eu",
                start_date: "2026-03-01",
            },
            worker: { id: "worker-1" },
            employer: { id: "employer-1" },
            jobRequest: { id: "job-1" },
            durationMonths: 12,
        });
        auditInsert.mockResolvedValue({
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

    it("fails closed when a generic profile edit matches no record", async () => {
        adminProfileUpdateMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { POST } = await import("@/app/api/admin/edit-data/route");

        const response = await POST(new NextRequest("http://localhost/api/admin/edit-data", {
            method: "POST",
            body: JSON.stringify({
                table: "profiles",
                recordId: "profile-404",
                field: "full_name",
                value: "New Name",
            }),
        }));

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "profiles record not found",
        });
        expect(syncAuthContactFields).not.toHaveBeenCalled();
        expect(auditInsert).not.toHaveBeenCalled();
    });

    it("fails closed when a direct contract override matches no contract row", async () => {
        adminContractUpdateMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { POST } = await import("@/app/api/admin/edit-data/route");

        const response = await POST(new NextRequest("http://localhost/api/admin/edit-data", {
            method: "POST",
            body: JSON.stringify({
                table: "contract_data",
                recordId: "contract-404",
                field: "contact_email",
                value: "new@workersunited.eu",
            }),
        }));

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Contract record not found",
        });
        expect(buildContractDataForMatch).toHaveBeenCalledWith(expect.anything(), "match-1");
        expect(auditInsert).not.toHaveBeenCalled();
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
