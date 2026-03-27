import { beforeEach, describe, expect, it, vi } from "vitest";

const insertMessage = vi.fn();
let recentFailures: Array<{ status: string | null; error_message: string | null; created_at: string | null }> = [];

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
        recentFailures = [{
            status: "failed",
            error_message: "(#131026) Message undeliverable",
            created_at: new Date().toISOString(),
        }];
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

    it("does not suppress when a newer successful template send exists after an older recipient failure", async () => {
        recentFailures = [
            {
                status: "delivered",
                error_message: null,
                created_at: new Date().toISOString(),
            },
            {
                status: "failed",
                error_message: "(#131026) Message undeliverable",
                created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
        ];
        const { sendWhatsAppTemplate } = await import("@/lib/whatsapp");

        const result = await sendWhatsAppTemplate({
            to: "+15550000001",
            templateName: "payment_confirmed",
            bodyParams: ["$9", "Ali"],
            userId: "worker-1",
        });

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledOnce();
    });

    it("does not keep suppression forever when the last recipient failure is stale", async () => {
        recentFailures = [{
            status: "failed",
            error_message: "(#131026) Message undeliverable",
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        }];
        const { sendWhatsAppTemplate } = await import("@/lib/whatsapp");

        const result = await sendWhatsAppTemplate({
            to: "+15550000001",
            templateName: "payment_confirmed",
            bodyParams: ["$9", "Ali"],
            userId: "worker-1",
        });

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledOnce();
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

    it("classifies thrown template send errors as retryable platform failures", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => {
            throw new Error("network timeout");
        }));
        const { sendWhatsAppTemplate } = await import("@/lib/whatsapp");

        const result = await sendWhatsAppTemplate({
            to: "+15550000001",
            templateName: "payment_confirmed",
            bodyParams: ["$9", "Ali"],
            userId: "worker-1",
        });

        expect(result).toMatchObject({
            success: false,
            retryable: true,
            failureCategory: "platform",
        });
        expect(insertMessage).toHaveBeenCalledWith(expect.objectContaining({
            status: "failed",
            template_name: "payment_confirmed",
            error_message: "network timeout",
        }));
    });

    it("normalizes bare NEXT_PUBLIC_BASE_URL before stripping template CTA suffixes", async () => {
        process.env.NEXT_PUBLIC_BASE_URL = "workersunited.example";
        const { sendOfferExpiring } = await import("@/lib/whatsapp");

        const result = await sendOfferExpiring(
            "+15550000001",
            "Warehouse Worker",
            "https://workersunited.example/profile/worker/offers/123?ref=test#details",
            "worker-1"
        );

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledOnce();

        const requestInit = vi.mocked(fetch).mock.calls[0]?.[1];
        const payload = JSON.parse(String(requestInit?.body));
        const buttonComponent = payload.template.components.find((component: { type: string }) => component.type === "button");

        expect(buttonComponent.parameters).toEqual([{ type: "text", text: "/profile/worker/offers/123?ref=test#details" }]);
    });

    it("strips CTA suffixes even when action URLs use the www alias", async () => {
        process.env.NEXT_PUBLIC_BASE_URL = "https://workersunited.eu";
        const { sendAnnouncement } = await import("@/lib/whatsapp");

        const result = await sendAnnouncement(
            "+15550000001",
            "Platform update",
            "Please review your dashboard.",
            "https://www.workersunited.eu/profile/worker?tab=queue",
            "worker-1"
        );

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledOnce();

        const requestInit = vi.mocked(fetch).mock.calls[0]?.[1];
        const payload = JSON.parse(String(requestInit?.body));
        const buttonComponent = payload.template.components.find((component: { type: string }) => component.type === "button");

        expect(buttonComponent.parameters).toEqual([{ type: "text", text: "/profile/worker?tab=queue" }]);
    });
});
