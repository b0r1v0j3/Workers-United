import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMessage = vi.fn();
let recentFailures: Array<{ error_message: string | null }> = [];

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
        from: (table: string) => {
            if (table !== "whatsapp_messages") {
                throw new Error(`Unexpected table ${table}`);
            }

            const query = {
                select: vi.fn(() => query),
                eq: vi.fn(() => query),
                gte: vi.fn(() => query),
                order: vi.fn(() => query),
                limit: vi.fn(async () => ({
                    data: recentFailures,
                    error: null,
                })),
                insert: insertMessage,
            };

            return query;
        },
    }),
}));

describe("whatsapp proactive send suppression", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        recentFailures = [];
        insertMessage.mockResolvedValue({ error: null });
        process.env.WHATSAPP_TOKEN = "test-token";
        process.env.WHATSAPP_PHONE_NUMBER_ID = "test-phone-id";
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ({
                messaging_product: "whatsapp",
                contacts: [{ input: "15550000001", wa_id: "15550000001" }],
                messages: [{ id: "wamid.123" }],
            }),
        })));
    });

    it("suppresses proactive template sends after a recent recipient-side failure", async () => {
        recentFailures = [{ error_message: "(#131026) Message undeliverable" }];
        const { sendWhatsAppTemplate } = await import("@/lib/whatsapp");

        const result = await sendWhatsAppTemplate({
            to: "+15550000001",
            templateName: "payment_confirmed",
            bodyParams: ["$9", "Ali"],
            userId: "worker-1",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("recipient-side WhatsApp block");
        expect(fetch).not.toHaveBeenCalled();
        expect(insertMessage).toHaveBeenCalledWith(expect.objectContaining({
            status: "blocked",
            template_name: "payment_confirmed",
        }));
    });

    it("still sends normally when there is no recent recipient-side failure", async () => {
        const { sendWhatsAppTemplate } = await import("@/lib/whatsapp");

        const result = await sendWhatsAppTemplate({
            to: "+15550000001",
            templateName: "payment_confirmed",
            bodyParams: ["$9", "Ali"],
            userId: "worker-1",
        });

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledOnce();
        expect(insertMessage).toHaveBeenCalledWith(expect.objectContaining({
            status: "sent",
            template_name: "payment_confirmed",
        }));
    });
});
