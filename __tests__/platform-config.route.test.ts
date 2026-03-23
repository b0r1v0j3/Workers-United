import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const profileSingle = vi.fn();
const platformConfigUpdateMaybeSingle = vi.fn();
const invalidateConfigCache = vi.fn();

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
            if (table === "platform_config") {
                return {
                    update: (payload: Record<string, unknown>) => ({
                        eq: (column: string, value: string) => ({
                            select: () => ({
                                maybeSingle: () => platformConfigUpdateMaybeSingle(payload, column, value),
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

vi.mock("@/lib/platform-config", () => ({
    invalidateConfigCache,
}));

function createRequest(body: Record<string, unknown> = { key: "website_url", value: "https://workersunited.eu" }) {
    return new NextRequest("http://localhost/api/admin/platform-config", {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

describe("PUT /api/admin/platform-config", () => {
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

        platformConfigUpdateMaybeSingle.mockResolvedValue({
            data: {
                key: "website_url",
            },
            error: null,
        });
    });

    it("returns success and invalidates cache when the config row is updated", async () => {
        const { PUT } = await import("@/app/api/admin/platform-config/route");
        const response = await PUT(createRequest());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            key: "website_url",
            value: "https://workersunited.eu",
        });
        expect(platformConfigUpdateMaybeSingle).toHaveBeenCalledWith(
            expect.objectContaining({
                value: "https://workersunited.eu",
                updated_by: "admin-1",
                updated_at: expect.any(String),
            }),
            "key",
            "website_url"
        );
        expect(invalidateConfigCache).toHaveBeenCalledTimes(1);
    });

    it("returns 404 and keeps the cache intact when no config row matches", async () => {
        platformConfigUpdateMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        const { PUT } = await import("@/app/api/admin/platform-config/route");
        const response = await PUT(createRequest({ key: "missing_key", value: "noop" }));

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Config key not found",
        });
        expect(invalidateConfigCache).not.toHaveBeenCalled();
    });
});
