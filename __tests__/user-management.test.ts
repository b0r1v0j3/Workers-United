import { describe, expect, it } from "vitest";
import { deleteUserData } from "@/lib/user-management";

function createDeleteUserAdminMock() {
    const removeCalls: Array<{ bucket: string; paths: string[] }> = [];
    const listCalls: Array<{ bucket: string; prefix: string }> = [];
    const deleteCalls: Array<{ table: string; mode: "eq" | "in"; column: string; value: unknown }> = [];
    const authDeleteCalls: string[] = [];

    const client = {
        from(table: string) {
            return {
                select() {
                    return {
                        eq(column: string, value: string) {
                            if (table === "worker_documents") {
                                return Promise.resolve({
                                    data: [
                                        { storage_path: "worker-profile/passport/current.png" },
                                        { storage_path: "worker-profile/passport/current.png" },
                                        { storage_path: null },
                                    ],
                                    error: null,
                                });
                            }

                            if (table === "worker_onboarding") {
                                return {
                                    single() {
                                        return Promise.resolve({
                                            data: { id: "worker-row-1" },
                                            error: null,
                                        });
                                    },
                                };
                            }

                            if (table === "matches") {
                                return Promise.resolve({
                                    data: [{ id: "match-1" }, { id: "match-2" }],
                                    error: null,
                                });
                            }

                            throw new Error(`Unexpected select chain: ${table}.${column}=${value}`);
                        },
                    };
                },
                delete() {
                    return {
                        eq(column: string, value: string) {
                            deleteCalls.push({ table, mode: "eq", column, value });
                            return Promise.resolve({ data: null, error: null });
                        },
                        in(column: string, value: string[]) {
                            deleteCalls.push({ table, mode: "in", column, value });
                            return Promise.resolve({ data: null, error: null });
                        },
                    };
                },
            };
        },
        storage: {
            from(bucket: string) {
                return {
                    list(prefix: string) {
                        listCalls.push({ bucket, prefix });
                        if (prefix === "worker-profile/passport") {
                            return Promise.resolve({
                                data: [{ name: "legacy-passport.png" }],
                                error: null,
                            });
                        }

                        return Promise.resolve({ data: [], error: null });
                    },
                    remove(paths: string[]) {
                        removeCalls.push({ bucket, paths });
                        return Promise.resolve({ data: null, error: null });
                    },
                };
            },
        },
        auth: {
            admin: {
                deleteUser(userId: string) {
                    authDeleteCalls.push(userId);
                    return Promise.resolve({ data: null, error: null });
                },
            },
        },
    };

    return {
        authDeleteCalls,
        client: client as never,
        deleteCalls,
        listCalls,
        removeCalls,
    };
}

describe("deleteUserData", () => {
    it("removes referenced document paths before legacy user folders", async () => {
        const mock = createDeleteUserAdminMock();

        await deleteUserData(mock.client as never, "worker-profile");

        expect(mock.removeCalls[0]).toEqual({
            bucket: "worker-docs",
            paths: ["worker-profile/passport/current.png"],
        });
        expect(mock.removeCalls[1]).toEqual({
            bucket: "worker-docs",
            paths: ["worker-profile/passport/legacy-passport.png"],
        });
        expect(mock.listCalls).toEqual([
            { bucket: "worker-docs", prefix: "worker-profile/passport" },
            { bucket: "worker-docs", prefix: "worker-profile/biometric_photo" },
            { bucket: "worker-docs", prefix: "worker-profile/diploma" },
        ]);
        expect(mock.deleteCalls).toContainEqual({
            table: "worker_documents",
            mode: "eq",
            column: "user_id",
            value: "worker-profile",
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "contract_data",
            mode: "in",
            column: "match_id",
            value: ["match-1", "match-2"],
        });
        expect(mock.authDeleteCalls).toEqual(["worker-profile"]);
    });
});
