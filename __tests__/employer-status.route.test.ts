import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileSingle = vi.fn();
const employerUpdateMaybeSingle = vi.fn();

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
            if (table === "employers") {
                return {
                    update: (payload: Record<string, unknown>) => ({
                        eq: (column: string, value: string) => ({
                            select: () => ({
                                maybeSingle: () => employerUpdateMaybeSingle(payload, column, value),
                            }),
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected admin table ${table}`);
        },
    }),
}));

vi.mock("@/lib/godmode", () => ({
    isGodModeUser: vi.fn(() => false),
}));

function createRequest(body: Record<string, unknown> = { employerId: "employer-1", status: "VERIFIED" }) {
    return new NextRequest("http://localhost/api/admin/employer-status", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/admin/employer-status", () => {
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

        employerUpdateMaybeSingle.mockResolvedValue({
            data: { id: "employer-1" },
            error: null,
        });
    });

    it("returns success when employer status update persists", async () => {
        const { PATCH } = await import("@/app/api/admin/employer-status/route");
        const response = await PATCH(createRequest());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            status: "VERIFIED",
        });
        expect(employerUpdateMaybeSingle).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "VERIFIED",
                updated_at: expect.any(String),
            }),
            "id",
            "employer-1"
        );
    });

    it("returns 404 when employer status update matches no row", async () => {
        employerUpdateMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { PATCH } = await import("@/app/api/admin/employer-status/route");
        const response = await PATCH(createRequest());

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Employer not found",
        });
    });
});
