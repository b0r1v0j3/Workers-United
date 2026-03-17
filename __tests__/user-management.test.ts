import { describe, expect, it } from "vitest";
import { deleteUserData } from "@/lib/user-management";

function buildDirectConversationFilter(userId: string) {
    return [
        `worker_profile_id.eq.${userId}`,
        `employer_profile_id.eq.${userId}`,
        `agency_profile_id.eq.${userId}`,
        `created_by_profile_id.eq.${userId}`,
        `closed_by_profile_id.eq.${userId}`,
        `last_message_by_profile_id.eq.${userId}`,
    ].join(",");
}

type SelectMap = Record<string, unknown[]>;
type ListMap = Record<string, Array<{ name: string }>>;

function createDeleteUserAdminMock(config?: {
    selectEq?: SelectMap;
    selectIn?: SelectMap;
    selectOr?: SelectMap;
    listByPrefix?: ListMap;
}) {
    const removeCalls: Array<{ bucket: string; paths: string[] }> = [];
    const listCalls: Array<{ bucket: string; prefix: string }> = [];
    const deleteCalls: Array<{ table: string; mode: "eq" | "in"; column: string; value: unknown }> = [];
    const authDeleteCalls: string[] = [];

    const selectEq = new Map(Object.entries(config?.selectEq || {}));
    const selectIn = new Map(Object.entries(config?.selectIn || {}));
    const selectOr = new Map(Object.entries(config?.selectOr || {}));
    const listByPrefix = new Map(Object.entries(config?.listByPrefix || {}));

    const getRows = (source: Map<string, unknown[]>, key: string) => {
        const value = source.get(key);
        return Array.isArray(value) ? value : [];
    };

    const client = {
        from(table: string) {
            return {
                select() {
                    return {
                        eq(column: string, value: string) {
                            return Promise.resolve({
                                data: getRows(selectEq, `${table}:${column}:${value}`),
                                error: null,
                            });
                        },
                        in(column: string, value: string[]) {
                            return Promise.resolve({
                                data: getRows(selectIn, `${table}:${column}:${value.join("|")}`),
                                error: null,
                            });
                        },
                        or(filters: string) {
                            return Promise.resolve({
                                data: getRows(selectOr, `${table}:${filters}`),
                                error: null,
                            });
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
                        return Promise.resolve({
                            data: listByPrefix.get(prefix) || [],
                            error: null,
                        });
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
        const mock = createDeleteUserAdminMock({
            selectEq: {
                "worker_documents:user_id:worker-profile": [
                    { storage_path: "worker-profile/passport/current.png" },
                    { storage_path: "worker-profile/passport/current.png" },
                    { storage_path: null },
                ],
                "worker_onboarding:profile_id:worker-profile": [{ id: "worker-row-1" }],
                "matches:worker_id:worker-row-1": [{ id: "match-1" }, { id: "match-2" }],
                "offers:worker_id:worker-row-1": [],
                "employers:profile_id:worker-profile": [],
                "conversation_participants:profile_id:worker-profile": [],
                "conversation_messages:sender_profile_id:worker-profile": [],
            },
            selectOr: {
                [`conversations:${buildDirectConversationFilter("worker-profile")}`]: [],
            },
            listByPrefix: {
                "worker-profile/passport": [{ name: "legacy-passport.png" }],
            },
        });

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
        expect(mock.deleteCalls).toContainEqual({
            table: "user_activity",
            mode: "eq",
            column: "user_id",
            value: "worker-profile",
        });
        expect(mock.authDeleteCalls).toEqual(["worker-profile"]);
    });

    it("cleans employer jobs and conversations before deleting auth/profile rows", async () => {
        const conversationIds = [
            "conversation-direct",
            "conversation-from-match",
            "conversation-from-offer",
        ];

        const mock = createDeleteUserAdminMock({
            selectEq: {
                "worker_documents:user_id:employer-profile": [],
                "worker_onboarding:profile_id:employer-profile": [],
                "employers:profile_id:employer-profile": [{ id: "employer-row-1" }],
                "conversation_participants:profile_id:employer-profile": [],
                "conversation_messages:sender_profile_id:employer-profile": [],
            },
            selectIn: {
                "matches:employer_id:employer-row-1": [{ id: "match-employer-1" }],
                "job_requests:employer_id:employer-row-1": [{ id: "job-request-1" }],
                "offers:job_request_id:job-request-1": [{ id: "offer-1" }],
                "conversations:match_id:match-employer-1": [{ id: "conversation-from-match" }],
                "conversations:offer_id:offer-1": [{ id: "conversation-from-offer" }],
                [`conversation_messages:conversation_id:${conversationIds.join("|")}`]: [
                    { id: "message-1" },
                    { id: "message-2" },
                ],
            },
            selectOr: {
                [`conversations:${buildDirectConversationFilter("employer-profile")}`]: [{ id: "conversation-direct" }],
            },
        });

        await deleteUserData(mock.client as never, "employer-profile");

        expect(mock.deleteCalls).toContainEqual({
            table: "conversation_flags",
            mode: "in",
            column: "conversation_id",
            value: conversationIds,
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "conversation_flags",
            mode: "in",
            column: "message_id",
            value: ["message-1", "message-2"],
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "conversation_messages",
            mode: "in",
            column: "conversation_id",
            value: conversationIds,
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "conversation_participants",
            mode: "in",
            column: "conversation_id",
            value: conversationIds,
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "conversations",
            mode: "in",
            column: "id",
            value: conversationIds,
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "contract_data",
            mode: "in",
            column: "match_id",
            value: ["match-employer-1"],
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "offers",
            mode: "in",
            column: "id",
            value: ["offer-1"],
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "matches",
            mode: "in",
            column: "id",
            value: ["match-employer-1"],
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "job_requests",
            mode: "in",
            column: "id",
            value: ["job-request-1"],
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "employers",
            mode: "eq",
            column: "profile_id",
            value: "employer-profile",
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "profiles",
            mode: "eq",
            column: "id",
            value: "employer-profile",
        });

        const deleteOrder = mock.deleteCalls.map((call) => call.table);
        expect(deleteOrder.indexOf("job_requests")).toBeLessThan(deleteOrder.indexOf("employers"));
        expect(deleteOrder.indexOf("employers")).toBeLessThan(deleteOrder.indexOf("profiles"));
        expect(mock.authDeleteCalls).toEqual(["employer-profile"]);
    });
});
