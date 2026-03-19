import { describe, expect, it } from "vitest";
import {
    extractWhatsAppMessageContent,
    isDuplicateWhatsAppInboundMessage,
    isTextLikeWhatsAppMessage,
    normalizeWhatsAppPhone,
    recordInboundWhatsAppMessage,
} from "@/lib/whatsapp-inbound-events";

function createInboundAdminClient(overrides?: {
    duplicate?: boolean;
}) {
    const inserts: Record<string, string | null>[] = [];

    return {
        inserts,
        client: {
            from(table: string) {
                expect(table).toBe("whatsapp_messages");

                return {
                    select() {
                        return {
                            eq(_column: string, _value: string) {
                                return {
                                    eq(_secondColumn: string, _secondValue: string) {
                                        return {
                                            maybeSingle: async () => ({
                                                data: overrides?.duplicate ? { id: "msg_1" } : null,
                                            }),
                                        };
                                    },
                                };
                            },
                        };
                    },
                    insert: async (payload: Record<string, string | null>) => {
                        inserts.push(payload);
                        return { error: null };
                    },
                };
            },
        },
    };
}

describe("whatsapp-inbound-events", () => {
    it("normalizes phone numbers to canonical WhatsApp format", () => {
        expect(normalizeWhatsAppPhone("381 66 299 444")).toBe("+38166299444");
        expect(normalizeWhatsAppPhone("(555) 123-0000")).toBe("+5551230000");
    });

    it("extracts text-like message content from supported types", () => {
        expect(extractWhatsAppMessageContent({
            type: "text",
            text: { body: "Hello" },
        })).toBe("Hello");
        expect(extractWhatsAppMessageContent({
            type: "button",
            button: { text: "Start" },
        })).toBe("Start");
        expect(extractWhatsAppMessageContent({
            type: "interactive",
            interactive: { button_reply: { title: "Open dashboard" } },
        })).toBe("Open dashboard");
        expect(extractWhatsAppMessageContent({
            type: "image",
        })).toBe("[image message]");
    });

    it("tracks which message types can continue through the text router", () => {
        expect(isTextLikeWhatsAppMessage("text")).toBe(true);
        expect(isTextLikeWhatsAppMessage("button")).toBe(true);
        expect(isTextLikeWhatsAppMessage("interactive")).toBe(true);
        expect(isTextLikeWhatsAppMessage("image")).toBe(false);
    });

    it("checks inbound dedupe and records inbound rows", async () => {
        const duplicateClient = createInboundAdminClient({ duplicate: true });
        const freshClient = createInboundAdminClient({ duplicate: false });

        expect(await isDuplicateWhatsAppInboundMessage(duplicateClient.client, "wamid_1")).toBe(true);
        expect(await isDuplicateWhatsAppInboundMessage(freshClient.client, "wamid_2")).toBe(false);

        await recordInboundWhatsAppMessage(freshClient.client, {
            userId: "profile_1",
            normalizedPhone: "+38166299444",
            messageType: "text",
            content: "Hello",
            wamid: "wamid_2",
        });

        expect(freshClient.inserts).toEqual([
            {
                user_id: "profile_1",
                phone_number: "+38166299444",
                direction: "inbound",
                message_type: "text",
                content: "Hello",
                wamid: "wamid_2",
                status: "delivered",
            },
        ]);
    });
});
