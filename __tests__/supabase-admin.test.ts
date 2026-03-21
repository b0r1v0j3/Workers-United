import { describe, expect, it, vi } from "vitest";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { getAllAuthUsers } from "@/lib/supabase/admin";

function createAuthUser(id: string) {
    return { id } as SupabaseAuthUser;
}

describe("getAllAuthUsers", () => {
    it("collects every page until the final short page", async () => {
        const listUsers = vi.fn()
            .mockResolvedValueOnce({
                data: {
                    users: Array.from({ length: 1000 }, (_, index) => createAuthUser(`user-${index + 1}`)),
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    users: [createAuthUser("user-1001"), createAuthUser("user-1002")],
                },
                error: null,
            });

        const users = await getAllAuthUsers({
            auth: {
                admin: {
                    listUsers,
                },
            },
        } as never);

        expect(users).toHaveLength(1002);
        expect(users[0]?.id).toBe("user-1");
        expect(users[1001]?.id).toBe("user-1002");
        expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 });
        expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 });
    });

    it("throws instead of returning partial auth users when a later page fails", async () => {
        const pageError = {
            message: "page 2 failed",
            status: 500,
        };

        const listUsers = vi.fn()
            .mockResolvedValueOnce({
                data: {
                    users: Array.from({ length: 1000 }, (_, index) => createAuthUser(`user-${index + 1}`)),
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: null,
                error: pageError,
            });

        await expect(getAllAuthUsers({
            auth: {
                admin: {
                    listUsers,
                },
            },
        } as never)).rejects.toEqual(pageError);

        expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 });
        expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 });
    });
});
