import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({
    sendEmail: vi.fn(),
}));

const whatsappMocks = vi.hoisted(() => ({
    sendRoleWelcome: vi.fn(),
    sendRoleStatusUpdate: vi.fn(),
    sendPaymentConfirmed: vi.fn(),
    sendDocumentReminder: vi.fn(),
    sendProfileIncomplete: vi.fn(),
    sendRefundProcessed: vi.fn(),
    sendRoleAnnouncement: vi.fn(),
    sendJobOffer: vi.fn(),
}));

vi.mock("@/lib/mailer", () => ({
    sendEmail,
}));

vi.mock("@/lib/whatsapp", () => whatsappMocks);

import { queueEmail } from "@/lib/email-templates";

function createSupabaseMock(params?: { insertError?: string }) {
    const updates: Array<Record<string, unknown>> = [];
    const insertError = params?.insertError;

    return {
        updates,
        from(table: string) {
            expect(table).toBe("email_queue");

            return {
                insert(payload: Record<string, unknown>) {
                    return {
                        select() {
                            return {
                                single: async () => ({
                                    data: insertError
                                        ? null
                                        : {
                                            id: "email-1",
                                            scheduled_for: payload.scheduled_for,
                                        },
                                    error: insertError
                                        ? { message: insertError }
                                        : null,
                                }),
                            };
                        },
                    };
                },
                update(payload: Record<string, unknown>) {
                    updates.push(payload);
                    return {
                        eq: vi.fn(async () => ({ error: null })),
                    };
                },
            };
        },
    };
}

describe("queueEmail WhatsApp sidecar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sendEmail.mockResolvedValue({ success: true });
        whatsappMocks.sendRoleWelcome.mockResolvedValue({ success: true, messageId: "wamid_1" });
    });

    it("returns WhatsApp sidecar failure details without turning a successful email into a failure", async () => {
        const supabase = createSupabaseMock();
        whatsappMocks.sendRoleWelcome.mockResolvedValueOnce({
            success: false,
            error: "recipient blocked",
            retryable: false,
            failureCategory: "recipient",
        });

        const result = await queueEmail(
            supabase as never,
            "worker-1",
            "welcome",
            "worker@example.com",
            "Worker One",
            { recipientRole: "worker" },
            undefined,
            "+381601234567"
        );

        expect(result.status).toBe("sent");
        expect(result.sent).toBe(true);
        expect(result.whatsapp).toMatchObject({
            attempted: true,
            sent: false,
            error: "recipient blocked",
            retryable: false,
            failureCategory: "recipient",
        });
    });

    it("returns WhatsApp sidecar success details when the template send succeeds", async () => {
        const supabase = createSupabaseMock();

        const result = await queueEmail(
            supabase as never,
            "worker-1",
            "welcome",
            "worker@example.com",
            "Worker One",
            { recipientRole: "worker" },
            undefined,
            "+381601234567"
        );

        expect(result.status).toBe("sent");
        expect(result.whatsapp).toMatchObject({
            attempted: true,
            sent: true,
            messageId: "wamid_1",
        });
    });

    it("routes offer_expired through the shared worker status-update sidecar", async () => {
        const supabase = createSupabaseMock();
        whatsappMocks.sendRoleStatusUpdate.mockResolvedValueOnce({ success: true, messageId: "wamid_offer_1" });

        const result = await queueEmail(
            supabase as never,
            "worker-1",
            "offer_expired",
            "worker@example.com",
            "Worker One",
            {
                jobTitle: "Welder",
                queuePosition: 4,
            },
            undefined,
            "+381601234567"
        );

        expect(whatsappMocks.sendRoleStatusUpdate).toHaveBeenCalledWith(
            "+381601234567",
            "Worker",
            expect.stringContaining("Your offer for Welder has expired."),
            "worker",
            "worker-1"
        );
        expect(whatsappMocks.sendRoleStatusUpdate).toHaveBeenCalledWith(
            "+381601234567",
            "Worker",
            expect.stringContaining("#4"),
            "worker",
            "worker-1"
        );
        expect(result.whatsapp).toMatchObject({
            attempted: true,
            sent: true,
            messageId: "wamid_offer_1",
        });
    });

    it("fails closed and skips the WhatsApp sidecar when email_queue insert fails", async () => {
        const supabase = createSupabaseMock({ insertError: "duplicate key value violates unique constraint" });

        const result = await queueEmail(
            supabase as never,
            "worker-1",
            "welcome",
            "worker@example.com",
            "Worker One",
            { recipientRole: "worker" },
            undefined,
            "+381601234567"
        );

        expect(result).toMatchObject({
            id: null,
            sent: false,
            queued: false,
            status: "failed",
            error: "duplicate key value violates unique constraint",
            whatsapp: null,
        });
        expect(sendEmail).not.toHaveBeenCalled();
        expect(whatsappMocks.sendRoleWelcome).not.toHaveBeenCalled();
    });

    it("skips the WhatsApp sidecar when email delivery fails terminally", async () => {
        const supabase = createSupabaseMock();
        sendEmail.mockResolvedValueOnce({
            success: false,
            error: "smtp hard failure",
        });

        const result = await queueEmail(
            supabase as never,
            "worker-1",
            "welcome",
            "worker@example.com",
            "Worker One",
            { recipientRole: "worker" },
            undefined,
            "+381601234567"
        );

        expect(result).toMatchObject({
            id: "email-1",
            sent: false,
            queued: false,
            status: "failed",
            error: "smtp hard failure",
            whatsapp: null,
        });
        expect(whatsappMocks.sendRoleWelcome).not.toHaveBeenCalled();
    });

    it("still allows the WhatsApp sidecar when email is accepted for retry", async () => {
        const supabase = createSupabaseMock();
        sendEmail.mockResolvedValueOnce({
            success: false,
            error: "421 temporary failure",
        });

        const result = await queueEmail(
            supabase as never,
            "worker-1",
            "welcome",
            "worker@example.com",
            "Worker One",
            { recipientRole: "worker" },
            undefined,
            "+381601234567"
        );

        expect(result).toMatchObject({
            id: "email-1",
            sent: false,
            queued: true,
            status: "queued_retry",
            error: "421 temporary failure",
        });
        expect(result.whatsapp).toMatchObject({
            attempted: true,
            sent: true,
            messageId: "wamid_1",
        });
        expect(whatsappMocks.sendRoleWelcome).toHaveBeenCalledOnce();
    });
});
