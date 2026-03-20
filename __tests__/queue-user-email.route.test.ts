import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authGetUser = vi.fn();
const workerMaybeSingle = vi.fn();
const queueEmail = vi.fn();
const isInternalOrTestEmail = vi.fn();
const hasKnownTypoEmailDomain = vi.fn();
const canSendWorkerDirectNotifications = vi.fn();
const queuedWelcomeMaybeSingle = vi.fn();

let welcomeEmailPending = false;

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: {
            getUser: authGetUser,
        },
        from: (table: string) => {
            if (table === "email_queue") {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                in: () => ({
                                    limit: () => ({
                                        maybeSingle: queuedWelcomeMaybeSingle,
                                    }),
                                }),
                            }),
                        }),
                    }),
                };
            }

            if (table === "worker_onboarding") {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: workerMaybeSingle,
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        },
    }),
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

vi.mock("@/lib/reporting", () => ({
    isInternalOrTestEmail,
    hasKnownTypoEmailDomain,
}));

vi.mock("@/lib/worker-notification-eligibility", () => ({
    canSendWorkerDirectNotifications,
}));

describe("POST /api/queue-user-email", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        welcomeEmailPending = false;

        authGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "employer-1",
                    email: "company@example.com",
                    user_metadata: {
                        full_name: "Acme Hiring",
                        user_type: "employer",
                    },
                },
            },
        });
        workerMaybeSingle.mockResolvedValue({ data: null });
        queuedWelcomeMaybeSingle.mockImplementation(async () => ({
            data: welcomeEmailPending ? { id: "welcome-1" } : null,
            error: null,
        }));
        queueEmail.mockResolvedValue({ sent: true, error: null });
        isInternalOrTestEmail.mockReturnValue(false);
        hasKnownTypoEmailDomain.mockReturnValue(false);
        canSendWorkerDirectNotifications.mockReturnValue(true);
    });

    it("passes the canonical recipientRole when queueing welcome mail", async () => {
        const { POST } = await import("@/app/api/queue-user-email/route");

        const response = await POST(new NextRequest("http://localhost/api/queue-user-email", {
            method: "POST",
            body: JSON.stringify({ emailType: "welcome" }),
        }));

        expect(response.status).toBe(200);
        expect(queueEmail).toHaveBeenCalledWith(
            expect.anything(),
            "employer-1",
            "welcome",
            "company@example.com",
            "Acme Hiring",
            { recipientRole: "employer" },
            undefined,
            undefined
        );
    });

    it("skips duplicate welcome queueing when a welcome email is already pending", async () => {
        welcomeEmailPending = true;
        authGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "worker-1",
                    email: "worker@example.com",
                    user_metadata: {
                        full_name: "Worker One",
                        user_type: "worker",
                    },
                },
            },
        });
        workerMaybeSingle.mockResolvedValue({
            data: {
                profile_id: "worker-1",
                agency_id: null,
                submitted_email: "worker@example.com",
                phone: "+15550000001",
            },
        });

        const { POST } = await import("@/app/api/queue-user-email/route");

        const response = await POST(new NextRequest("http://localhost/api/queue-user-email", {
            method: "POST",
            body: JSON.stringify({ emailType: "welcome" }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            skipped: true,
            reason: "welcome_already_queued",
        });
        expect(queueEmail).not.toHaveBeenCalled();
    });

    it("returns a truthful failure payload when queueEmail reports a send failure", async () => {
        const { POST } = await import("@/app/api/queue-user-email/route");

        const response = await POST(new NextRequest("http://localhost/api/queue-user-email", {
            method: "POST",
            body: JSON.stringify({ emailType: "payment_success" }),
        }));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: "Only welcome emails can be queued from this route.",
        });
    });

    it("treats retry-queued welcome emails as accepted", async () => {
        queueEmail.mockResolvedValueOnce({
            id: "email-queued",
            sent: false,
            queued: true,
            status: "queued_retry",
            error: "421 temporary failure",
        });

        const { POST } = await import("@/app/api/queue-user-email/route");

        const response = await POST(new NextRequest("http://localhost/api/queue-user-email", {
            method: "POST",
            body: JSON.stringify({ emailType: "welcome" }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            queued: true,
            deliveryStatus: "queued_retry",
        });
    });
});
