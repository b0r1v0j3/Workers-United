import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const createAdminClient = vi.fn();
const queueEmail = vi.fn();
const sendWelcome = vi.fn();
const ensureEmployerRecord = vi.fn();
const ensureAgencyRecord = vi.fn();
const getAgencySchemaState = vi.fn();
const claimAgencyWorkerDraft = vi.fn();
const syncAuthContactFields = vi.fn();
const ensureWorkerProfileRecord = vi.fn();
const ensureWorkerRecord = vi.fn();
const loadCanonicalWorkerRecord = vi.fn();
const canSendWorkerDirectNotifications = vi.fn();
const logServerActivity = vi.fn();
const isInternalOrTestEmail = vi.fn();
const hasKnownTypoEmailDomain = vi.fn();

let welcomeEmailSent = false;
let welcomeEmailPending = false;
let whatsappWelcomeRecorded = false;
let welcomeWhatsAppSent = false;

function buildQuery(resultFactory: () => Promise<{ data: unknown; error: null }>) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(resultFactory),
    };

    return query;
}

function buildAdminClient() {
    const emailQueueQuery = buildQuery(async () => ({
        data: welcomeEmailSent || welcomeEmailPending ? { id: "welcome-email" } : null,
        error: null,
    }));
    const whatsappMessagesQuery = {
        select: vi.fn(() => whatsappMessagesQuery),
        eq: vi.fn(() => whatsappMessagesQuery),
        in: vi.fn(() => whatsappMessagesQuery),
        limit: vi.fn(() => whatsappMessagesQuery),
        maybeSingle: vi.fn(async () => ({
            data: welcomeWhatsAppSent ? { id: "wa-welcome" } : null,
            error: null,
        })),
    };
    const userActivityQuery = {
        select: vi.fn(() => userActivityQuery),
        eq: vi.fn(() => userActivityQuery),
        limit: vi.fn(() => userActivityQuery),
        maybeSingle: vi.fn(async () => ({
            data: whatsappWelcomeRecorded ? { id: "activity-1" } : null,
            error: null,
        })),
        insert: vi.fn(async () => {
            whatsappWelcomeRecorded = true;
            return { error: null };
        }),
    };

    return {
        auth: {
            admin: {
                updateUserById: vi.fn(async () => ({ error: null })),
            },
        },
        from: vi.fn((table: string) => {
            if (table === "email_queue") {
                return emailQueueQuery;
            }

            if (table === "user_activity") {
                return userActivityQuery;
            }

            if (table === "whatsapp_messages") {
                return whatsappMessagesQuery;
            }

            throw new Error(`Unexpected table ${table}`);
        }),
    };
}

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

vi.mock("@/lib/employers", () => ({
    ensureEmployerRecord,
}));

vi.mock("@/lib/agencies", () => ({
    claimAgencyWorkerDraft,
    ensureAgencyRecord,
    getAgencySchemaState,
}));

vi.mock("@/lib/auth-contact-sync", () => ({
    syncAuthContactFields,
}));

vi.mock("@/lib/workers", () => ({
    ensureWorkerProfileRecord,
    ensureWorkerRecord,
    loadCanonicalWorkerRecord,
}));

vi.mock("@/lib/worker-notification-eligibility", () => ({
    canSendWorkerDirectNotifications,
}));

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

vi.mock("@/lib/reporting", () => ({
    hasKnownTypoEmailDomain,
    isInternalOrTestEmail,
}));

vi.mock("@/lib/whatsapp", () => ({
    sendWelcome,
}));

describe("resolvePostAuthRedirect", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        welcomeEmailSent = false;
        welcomeEmailPending = false;
        whatsappWelcomeRecorded = false;
        welcomeWhatsAppSent = false;

        createAdminClient.mockReturnValue(buildAdminClient());
        queueEmail.mockImplementation(async () => {
            welcomeEmailSent = true;
            return { success: true };
        });
        sendWelcome.mockResolvedValue({ success: true });
        ensureEmployerRecord.mockResolvedValue({ employer: null, employerCreated: false, duplicates: [] });
        ensureAgencyRecord.mockResolvedValue({ agency: null, agencyCreated: false });
        getAgencySchemaState.mockResolvedValue({ ready: true });
        claimAgencyWorkerDraft.mockResolvedValue({ reason: null });
        syncAuthContactFields.mockResolvedValue(undefined);
        ensureWorkerProfileRecord.mockResolvedValue({ profileCreated: false });
        ensureWorkerRecord.mockResolvedValue({ workerCreated: false });
        loadCanonicalWorkerRecord.mockResolvedValue({
            data: {
                id: "worker-row-1",
                profile_id: "user-1",
                phone: "+381600000001",
                nationality: null,
                entry_fee_paid: false,
                queue_joined_at: null,
                job_search_active: false,
                current_country: null,
                preferred_job: null,
                status: "NEW",
            },
        });
        canSendWorkerDirectNotifications.mockReturnValue(true);
        logServerActivity.mockResolvedValue(undefined);
        isInternalOrTestEmail.mockReturnValue(false);
        hasKnownTypoEmailDomain.mockReturnValue(false);
    });

    it("dedupes WhatsApp welcome after the first successful worker login", async () => {
        const { resolvePostAuthRedirect } = await import("@/lib/auth-redirect");
        const user = {
            id: "user-1",
            email: "worker@example.com",
            user_metadata: {
                full_name: "Worker One",
                user_type: "worker",
            },
        } as unknown as User;

        const firstHref = await resolvePostAuthRedirect({ origin: "http://localhost", user });
        const secondHref = await resolvePostAuthRedirect({ origin: "http://localhost", user });

        expect(firstHref).toBe("http://localhost/profile/worker");
        expect(secondHref).toBe("http://localhost/profile/worker");
        expect(sendWelcome).toHaveBeenCalledTimes(1);
        expect(queueEmail).toHaveBeenCalledTimes(1);
        expect(loadCanonicalWorkerRecord).toHaveBeenCalledWith(
            expect.anything(),
            "user-1",
            expect.stringContaining("queue_joined_at")
        );
    });

    it("does not resend welcome email or WhatsApp when a prior welcome email/template already exists", async () => {
        welcomeEmailSent = true;
        welcomeWhatsAppSent = true;

        const { resolvePostAuthRedirect } = await import("@/lib/auth-redirect");
        const user = {
            id: "user-1",
            email: "worker@example.com",
            user_metadata: {
                full_name: "Worker One",
                user_type: "worker",
            },
        } as unknown as User;

        const href = await resolvePostAuthRedirect({ origin: "http://localhost", user });

        expect(href).toBe("http://localhost/profile/worker");
        expect(queueEmail).not.toHaveBeenCalled();
        expect(sendWelcome).not.toHaveBeenCalled();
    });

    it("does not enqueue a duplicate welcome email when one is already pending", async () => {
        welcomeEmailPending = true;

        const { resolvePostAuthRedirect } = await import("@/lib/auth-redirect");
        const user = {
            id: "user-1",
            email: "worker@example.com",
            user_metadata: {
                full_name: "Worker One",
                user_type: "worker",
            },
        } as unknown as User;

        const href = await resolvePostAuthRedirect({ origin: "http://localhost", user });

        expect(href).toBe("http://localhost/profile/worker");
        expect(queueEmail).not.toHaveBeenCalled();
        expect(sendWelcome).toHaveBeenCalledTimes(1);
    });

    it("does not record a WhatsApp welcome marker when the send fails", async () => {
        sendWelcome.mockResolvedValue({ success: false, error: "meta rejected", retryable: false, failureCategory: "recipient" });

        const { resolvePostAuthRedirect } = await import("@/lib/auth-redirect");
        const user = {
            id: "user-1",
            email: "worker@example.com",
            user_metadata: {
                full_name: "Worker One",
                user_type: "worker",
            },
        } as unknown as User;

        await resolvePostAuthRedirect({ origin: "http://localhost", user });
        await resolvePostAuthRedirect({ origin: "http://localhost", user });

        expect(sendWelcome).toHaveBeenCalledTimes(2);
    });
});
