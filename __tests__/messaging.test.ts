import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCanonicalWorkerRecord = vi.fn();

vi.mock("@/lib/workers", () => ({
    loadCanonicalWorkerRecord,
}));

function createPaymentsQuery(result: { data: { id: string } | null; error: null }) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        or: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(async () => result),
    };

    return query;
}

describe("getSupportAccessState", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it("keeps inbox access open for already-activated workers even without a payment row", async () => {
        loadCanonicalWorkerRecord.mockResolvedValue({
            data: {
                id: "worker-row-1",
                entry_fee_paid: false,
                job_search_active: false,
                queue_joined_at: "2026-03-19T10:00:00.000Z",
                status: "NEW",
            },
            error: null,
        });

        const admin = {
            from: vi.fn((table: string) => {
                if (table === "payments") {
                    return createPaymentsQuery({ data: null, error: null });
                }

                throw new Error(`Unexpected table ${table}`);
            }),
        };

        const { getSupportAccessState } = await import("@/lib/messaging");
        const state = await getSupportAccessState(admin as never, "profile-1", "worker");

        expect(state).toEqual({
            allowed: true,
            reason: null,
            unlockRequirement: "entry_fee",
        });
        expect(loadCanonicalWorkerRecord).toHaveBeenCalledWith(
            admin,
            "profile-1",
            expect.stringContaining("queue_joined_at")
        );
    });

    it("still blocks inbox access before entry fee activation", async () => {
        loadCanonicalWorkerRecord.mockResolvedValue({
            data: {
                id: "worker-row-1",
                entry_fee_paid: false,
                job_search_active: false,
                queue_joined_at: null,
                status: "NEW",
            },
            error: null,
        });

        const admin = {
            from: vi.fn((table: string) => {
                if (table === "payments") {
                    return createPaymentsQuery({ data: null, error: null });
                }

                throw new Error(`Unexpected table ${table}`);
            }),
        };

        const { getSupportAccessState } = await import("@/lib/messaging");
        const state = await getSupportAccessState(admin as never, "profile-1", "worker");

        expect(state.allowed).toBe(false);
        expect(state.reason).toContain("$9");
    });
});
