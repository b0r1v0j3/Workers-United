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

function createSupabaseMock() {
    const updates: Array<Record<string, unknown>> = [];

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
                                    data: {
                                        id: "email-1",
                                        scheduled_for: payload.scheduled_for,
                                    },
                                    error: null,
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
});
