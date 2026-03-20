import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMessage = vi.fn();
const logServerActivity = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
        from: (table: string) => {
            if (table === "whatsapp_messages") {
                const query = {
                    select: vi.fn(() => query),
                    eq: vi.fn(() => query),
                    gte: vi.fn(() => query),
                    order: vi.fn(() => query),
                    limit: vi.fn(async () => ({
                        data: [],
                        error: null,
                    })),
                    insert: insertMessage,
                };

                return query;
            }

            throw new Error(`Unexpected table ${table}`);
        },
    }),
}));

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

describe("whatsapp log durability", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env.WHATSAPP_TOKEN = "test-token";
        process.env.WHATSAPP_PHONE_NUMBER_ID = "test-phone-id";
    });

    it("keeps a successful text send successful even if whatsapp_messages logging fails, and records a fallback activity", async () => {
        insertMessage.mockRejectedValueOnce(new Error("insert failed"));
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ({
                messaging_product: "whatsapp",
                contacts: [{ input: "15550000001", wa_id: "15550000001" }],
                messages: [{ id: "wamid.text.1" }],
            }),
        })));

        const { sendWhatsAppText } = await import("@/lib/whatsapp");
        const result = await sendWhatsAppText("+15550000001", "Hello there", "worker-1");

        expect(result).toMatchObject({
            success: true,
            messageId: "wamid.text.1",
        });
        expect(logServerActivity).toHaveBeenCalledWith(
            "worker-1",
            "whatsapp_message_log_failed",
            "messaging",
            expect.objectContaining({
                phone: "+15550000001",
                direction: "outbound",
                message_type: "text",
                message_status: "sent",
                preview: "Hello there",
                log_error: "insert failed",
            }),
            "error"
        );
    });

    it("classifies thrown template-send errors even when logging the failed attempt also breaks", async () => {
        insertMessage.mockRejectedValueOnce(new Error("insert failed"));
        vi.stubGlobal("fetch", vi.fn(async () => {
            throw new Error("network timeout");
        }));

        const { sendWhatsAppTemplate } = await import("@/lib/whatsapp");
        const result = await sendWhatsAppTemplate({
            to: "+15550000001",
            templateName: "payment_confirmed",
            bodyParams: ["$9", "Ali"],
            userId: "worker-2",
        });

        expect(result).toMatchObject({
            success: false,
            retryable: true,
            failureCategory: "platform",
            error: "network timeout",
        });
        expect(logServerActivity).toHaveBeenCalledWith(
            "worker-2",
            "whatsapp_message_log_failed",
            "messaging",
            expect.objectContaining({
                phone: "+15550000001",
                direction: "outbound",
                message_type: "template",
                message_status: "failed",
                template_name: "payment_confirmed",
                provider_error: "network timeout",
                failure_category: "platform",
                retryable: true,
                log_error: "insert failed",
            }),
            "error"
        );
    });

    it("never turns a successful provider send into a failure even if both DB logging and fallback activity logging fail", async () => {
        insertMessage.mockRejectedValueOnce(new Error("insert failed"));
        logServerActivity.mockRejectedValueOnce(new Error("activity log failed"));
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ({
                messaging_product: "whatsapp",
                contacts: [{ input: "15550000001", wa_id: "15550000001" }],
                messages: [{ id: "wamid.text.2" }],
            }),
        })));

        const { sendWhatsAppText } = await import("@/lib/whatsapp");
        const result = await sendWhatsAppText("+15550000001", "Still delivered", "worker-3");

        expect(result).toMatchObject({
            success: true,
            messageId: "wamid.text.2",
        });
        expect(logServerActivity).toHaveBeenCalledTimes(1);
    });
});
