import { describe, expect, it } from "vitest";
import {
    AGENCY_DRAFT_DOCUMENT_OWNER_KEY,
    getAgencyDraftDocumentOwnerId,
    relinkAgencyDraftDocumentsToClaimedProfile,
    resolveAgencyWorkerDocumentOwnerId,
} from "@/lib/agency-draft-documents";

type DraftDocument = {
    id: string;
    document_type: string;
    storage_path: string | null;
};

function createRelinkAdminMock(options?: {
    copyError?: { message?: string | null; status?: number | null; statusCode?: string | null } | null;
    documents?: DraftDocument[];
    draftOwnerId?: string;
}) {
    const draftOwnerId = options?.draftOwnerId || "draft-owner";
    const documents = options?.documents || [
        {
            id: "doc-1",
            document_type: "passport",
            storage_path: `${draftOwnerId}/passport/original.png`,
        },
    ];

    const updateCalls: Array<{ table: string; values: Record<string, unknown>; column: string; value: string }> = [];
    const deleteCalls: Array<{ table: string; column: string; value: string }> = [];
    const copyCalls: Array<{ bucket: string; fromPath: string; toPath: string }> = [];
    const removeCalls: Array<{ bucket: string; paths: string[] }> = [];
    const authDeleteCalls: string[] = [];

    const client = {
        from(table: string) {
            if (table === "worker_documents") {
                return {
                    select() {
                        return {
                            eq(column: string, value: string) {
                                if (column !== "user_id") {
                                    throw new Error(`Unexpected worker_documents select filter: ${column}`);
                                }

                                return Promise.resolve({
                                    data: value === draftOwnerId ? documents : [],
                                    error: null,
                                });
                            },
                        };
                    },
                    update(values: Record<string, unknown>) {
                        return {
                            eq(column: string, value: string) {
                                updateCalls.push({ table, values, column, value });
                                return Promise.resolve({ data: null, error: null });
                            },
                        };
                    },
                };
            }

            if (table === "worker_onboarding") {
                return {
                    update(values: Record<string, unknown>) {
                        return {
                            eq(column: string, value: string) {
                                updateCalls.push({ table, values, column, value });
                                return Promise.resolve({ data: null, error: null });
                            },
                        };
                    },
                };
            }

            if (table === "profiles") {
                return {
                    delete() {
                        return {
                            eq(column: string, value: string) {
                                deleteCalls.push({ table, column, value });
                                return Promise.resolve({ data: null, error: null });
                            },
                        };
                    },
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        },
        storage: {
            from(bucket: string) {
                return {
                    copy(fromPath: string, toPath: string) {
                        copyCalls.push({ bucket, fromPath, toPath });
                        return Promise.resolve({ data: null, error: options?.copyError || null });
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
        copyCalls,
        deleteCalls,
        removeCalls,
        updateCalls,
    };
}

describe("agency-draft-documents", () => {
    it("reads and resolves draft document owner ids", () => {
        const applicationData = {
            [AGENCY_DRAFT_DOCUMENT_OWNER_KEY]: "draft-owner-123",
        };

        expect(getAgencyDraftDocumentOwnerId(applicationData)).toBe("draft-owner-123");
        expect(resolveAgencyWorkerDocumentOwnerId({ id: "worker-1", profile_id: "profile-1" })).toBe("profile-1");
        expect(resolveAgencyWorkerDocumentOwnerId({ id: "worker-1", application_data: applicationData })).toBe("draft-owner-123");
    });

    it("relinks draft documents, migrates storage path, and clears the draft owner pointer", async () => {
        const mock = createRelinkAdminMock();

        const result = await relinkAgencyDraftDocumentsToClaimedProfile(mock.client as never, {
            workerId: "worker-1",
            profileId: "claimed-profile",
            applicationData: {
                [AGENCY_DRAFT_DOCUMENT_OWNER_KEY]: "draft-owner",
            },
        });

        expect(result.error).toBeNull();
        expect(mock.copyCalls).toEqual([
            {
                bucket: "worker-docs",
                fromPath: "draft-owner/passport/original.png",
                toPath: "claimed-profile/passport/doc-1_original.png",
            },
        ]);
        expect(mock.removeCalls).toEqual([
            {
                bucket: "worker-docs",
                paths: ["draft-owner/passport/original.png"],
            },
        ]);
        expect(mock.updateCalls).toContainEqual({
            table: "worker_documents",
            values: {
                user_id: "claimed-profile",
                storage_path: "claimed-profile/passport/doc-1_original.png",
                updated_at: expect.any(String),
            },
            column: "id",
            value: "doc-1",
        });
        expect(mock.updateCalls).toContainEqual({
            table: "worker_onboarding",
            values: {
                application_data: {},
                updated_at: expect.any(String),
            },
            column: "id",
            value: "worker-1",
        });
        expect(mock.deleteCalls).toContainEqual({
            table: "profiles",
            column: "id",
            value: "draft-owner",
        });
        expect(mock.authDeleteCalls).toEqual(["draft-owner"]);
    });

    it("treats storage copy conflicts as idempotent relinks", async () => {
        const mock = createRelinkAdminMock({
            copyError: {
                message: "The resource already exists",
                status: 409,
            },
        });

        const result = await relinkAgencyDraftDocumentsToClaimedProfile(mock.client as never, {
            workerId: "worker-1",
            profileId: "claimed-profile",
            applicationData: {
                [AGENCY_DRAFT_DOCUMENT_OWNER_KEY]: "draft-owner",
            },
        });

        expect(result.error).toBeNull();
        expect(mock.copyCalls).toHaveLength(1);
        expect(mock.removeCalls).toEqual([
            {
                bucket: "worker-docs",
                paths: ["draft-owner/passport/original.png"],
            },
        ]);
    });

    it("does nothing when the worker has no draft document owner", async () => {
        const mock = createRelinkAdminMock();

        const result = await relinkAgencyDraftDocumentsToClaimedProfile(mock.client as never, {
            workerId: "worker-1",
            profileId: "claimed-profile",
            applicationData: {},
        });

        expect(result.error).toBeNull();
        expect(mock.copyCalls).toHaveLength(0);
        expect(mock.updateCalls).toHaveLength(0);
        expect(mock.authDeleteCalls).toHaveLength(0);
    });
});
