import { beforeEach, describe, expect, it, vi } from "vitest";

const hasValidCronBearerToken = vi.fn();
const getAllAuthUsers = vi.fn();
const queueEmail = vi.fn();
const deleteUserData = vi.fn();

type QueryResult = { data: unknown; error: { message: string } | null };

type BatchQueryChain = PromiseLike<QueryResult> & {
    in: () => BatchQueryChain;
    eq: () => BatchQueryChain;
    order: () => BatchQueryChain;
    limit: () => BatchQueryChain;
};

vi.mock("@/lib/cron-auth", () => ({
    hasValidCronBearerToken,
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: vi.fn(),
    getAllAuthUsers,
}));

vi.mock("@/lib/domain", () => ({
    normalizeUserType: vi.fn((value: string | null | undefined) => value || "worker"),
}));

vi.mock("@/lib/profile-completion", () => ({
    getWorkerCompletion: vi.fn(() => ({ completion: 0, missingFields: ["passport"] })),
    getEmployerCompletion: vi.fn(() => ({ completion: 0, missingFields: ["company"] })),
    getAgencyCompletion: vi.fn(() => ({ completion: 0, missingFields: ["name"] })),
}));

vi.mock("@/lib/email-templates", () => ({
    getEmailTemplate: vi.fn(() => ({ subject: "Reminder" })),
    queueEmail,
}));

vi.mock("@/lib/email-queue", () => ({
    isEmailDeliveryAccepted: vi.fn(() => false),
}));

vi.mock("@/lib/reporting", () => ({
    hasKnownTypoEmailDomain: vi.fn(() => false),
    isInternalOrTestEmail: vi.fn(() => false),
}));

vi.mock("@/lib/worker-notification-eligibility", () => ({
    canSendWorkerDirectNotifications: vi.fn(() => true),
}));

vi.mock("@/lib/user-management", () => ({
    deleteUserData,
}));

vi.mock("@/lib/profile-retention", () => ({
    PROFILE_RETENTION_ACTIVITY_CATEGORIES: ["profile_updated"],
    PROFILE_RETENTION_CASE_EMAIL_TYPES: ["profile_deletion"],
    getProfileRetentionState: vi.fn(() => null),
}));

vi.mock("@/lib/worker-status", () => ({
    isPostEntryFeeWorkerStatus: vi.fn(() => false),
}));

vi.mock("@/lib/workers", () => ({
    pickCanonicalWorkerRecord: vi.fn((rows: unknown[]) => rows[0] ?? null),
}));

function createBatchQuery(result: QueryResult) {
    const chain = {
        in: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    } as BatchQueryChain;
    return chain;
}

function createAdminClientMock(overrides?: Partial<Record<string, QueryResult>>) {
    const defaultResult: QueryResult = { data: [], error: null };
    const results: Record<string, QueryResult> = {
        profiles: defaultResult,
        worker_onboarding: defaultResult,
        employers: defaultResult,
        agencies: defaultResult,
        worker_documents: defaultResult,
        email_queue: defaultResult,
        signatures: defaultResult,
        user_activity: defaultResult,
        ...(overrides || {}),
    };

    return {
        from: (table: string) => ({
            select: () => createBatchQuery(results[table] || defaultResult),
        }),
    };
}

describe("GET /api/cron/profile-reminders", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        hasValidCronBearerToken.mockReturnValue(true);
        getAllAuthUsers.mockResolvedValue([
            {
                id: "worker-1",
                email: "worker@example.com",
                created_at: "2026-03-15T10:00:00.000Z",
                user_metadata: {
                    user_type: "worker",
                    full_name: "Worker Example",
                },
            },
        ]);
    });

    it("fails closed when email_queue preload fails", async () => {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        vi.mocked(createAdminClient).mockReturnValue(
            createAdminClientMock({
                email_queue: {
                    data: null,
                    error: { message: "email queue read failed" },
                },
            }) as never
        );

        const { GET } = await import("@/app/api/cron/profile-reminders/route");
        const response = await GET(new Request("http://localhost/api/cron/profile-reminders", {
            headers: { authorization: "Bearer cron-secret" },
        }));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: "Internal error",
            details: "Failed to load profile reminder batch context: email_queue",
        });
        expect(queueEmail).not.toHaveBeenCalled();
        expect(deleteUserData).not.toHaveBeenCalled();
    });

    it("fails closed when user activity preload fails", async () => {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        vi.mocked(createAdminClient).mockReturnValue(
            createAdminClientMock({
                user_activity: {
                    data: null,
                    error: { message: "activity read failed" },
                },
            }) as never
        );

        const { GET } = await import("@/app/api/cron/profile-reminders/route");
        const response = await GET(new Request("http://localhost/api/cron/profile-reminders", {
            headers: { authorization: "Bearer cron-secret" },
        }));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: "Internal error",
            details: "Failed to load profile reminder batch context: user_activity",
        });
        expect(queueEmail).not.toHaveBeenCalled();
        expect(deleteUserData).not.toHaveBeenCalled();
    });

    it("fails closed when auth pagination fails", async () => {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        vi.mocked(createAdminClient).mockReturnValue(createAdminClientMock() as never);
        getAllAuthUsers.mockRejectedValueOnce(new Error("auth pagination failed"));

        const { GET } = await import("@/app/api/cron/profile-reminders/route");
        const response = await GET(new Request("http://localhost/api/cron/profile-reminders", {
            headers: { authorization: "Bearer cron-secret" },
        }));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: "Internal error",
            details: "auth pagination failed",
        });
        expect(queueEmail).not.toHaveBeenCalled();
        expect(deleteUserData).not.toHaveBeenCalled();
    });
});
