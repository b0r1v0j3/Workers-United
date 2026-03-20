import { describe, expect, it } from "vitest";
import {
    attachInboundWhatsAppMessageUser,
    extractWhatsAppMessageContent,
    isTextLikeWhatsAppMessage,
    normalizeWhatsAppPhone,
    recordInboundWhatsAppMessage,
} from "@/lib/whatsapp-inbound-events";

function createInboundAdminClient(options?: {
    insertError?: { code?: string; message?: string } | null;
    attachError?: { message?: string } | null;
    attachRows?: Array<{ id: string }> | null;
    lookupError?: { message?: string } | null;
    lookupRow?: { id: string; user_id: string | null } | null;
}) {
    const inserts: Record<string, string | null>[] = [];
    const updates: Record<string, string>[] = [];
    const filters: Array<Record<string, string | null>> = [];

    return {
        inserts,
        updates,
        filters,
        client: {
            from(table: string) {
                expect(table).toBe("whatsapp_messages");

                return {
                    insert(payload: Record<string, string | null>) {
                        inserts.push(payload);
                        return {
                            select() {
                                return {
                                    single: async () => {
                                        if (options?.insertError) {
                                            return {
                                                data: null,
                                                error: options.insertError,
                                            };
                                        }

                                        return {
                                            data: { id: "msg_1" },
                                            error: null,
                                        };
                                    },
                                };
                            },
                        };
                    },
                    update(payload: Record<string, string>) {
                        updates.push(payload);
                        const query = {
                            select() {
                                return query;
                            },
                            eq(column: string, value: string) {
                                filters.push({ [column]: value });
                                return query;
                            },
                            is(column: string, value: null) {
                                filters.push({ [column]: value });
                                if (options?.attachError) {
                                    return Promise.resolve({
                                        data: null,
                                        error: options.attachError,
                                    });
                                }
                                return Promise.resolve({
                                    data: options?.attachRows ?? [{ id: "msg_attach" }],
                                    error: null,
                                });
                            },
                        };
                        return query;
                    },
                    select() {
                        const query = {
                            eq(column: string, value: string) {
                                filters.push({ [column]: value });
                                return query;
                            },
                            maybeSingle: async () => {
                                if (options?.lookupError) {
                                    return {
                                        data: null,
                                        error: options.lookupError,
                                    };
                                }
                                return {
                                    data: Object.prototype.hasOwnProperty.call(options || {}, "lookupRow")
                                        ? options?.lookupRow ?? null
                                        : { id: "msg_attach", user_id: "profile_attach" },
                                    error: null,
                                };
                            },
                        };
                        return query;
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

    it("records new inbound rows and reports successful inserts", async () => {
        const freshClient = createInboundAdminClient();

        const result = await recordInboundWhatsAppMessage(freshClient.client, {
            userId: "profile_1",
            normalizedPhone: "+38166299444",
            messageType: "text",
            content: "Hello",
            wamid: "wamid_2",
        });

        expect(result).toEqual({
            id: "msg_1",
            inserted: true,
            duplicate: false,
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

    it("treats unique violations as duplicates instead of throwing", async () => {
        const duplicateClient = createInboundAdminClient({
            insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
        });

        const result = await recordInboundWhatsAppMessage(duplicateClient.client, {
            userId: null,
            normalizedPhone: "+38166299444",
            messageType: "text",
            content: "Hello again",
            wamid: "wamid_2",
        });

        expect(result).toEqual({
            id: null,
            inserted: false,
            duplicate: true,
        });
    });

    it("attaches user identity onto an already-recorded inbound row", async () => {
        const client = createInboundAdminClient();

        const result = await attachInboundWhatsAppMessageUser(client.client, {
            wamid: "wamid_attach",
            userId: "profile_attach",
        });

        expect(result).toEqual({
            attached: true,
            alreadyAttached: false,
            messageId: "msg_attach",
        });
        expect(client.updates).toEqual([
            { user_id: "profile_attach" },
        ]);
        expect(client.filters).toEqual([
            { wamid: "wamid_attach" },
            { direction: "inbound" },
            { user_id: null },
        ]);
    });

    it("treats already-linked inbound rows as durable success on duplicate delivery retries", async () => {
        const client = createInboundAdminClient({
            attachRows: [],
            lookupRow: { id: "msg_existing", user_id: "profile_attach" },
        });

        const result = await attachInboundWhatsAppMessageUser(client.client, {
            wamid: "wamid_attach",
            userId: "profile_attach",
        });

        expect(result).toEqual({
            attached: false,
            alreadyAttached: true,
            messageId: "msg_existing",
        });
    });

    it("throws when the inbound row is missing instead of silently pretending attach succeeded", async () => {
        const client = createInboundAdminClient({
            attachRows: [],
            lookupRow: null,
        });

        await expect(
            attachInboundWhatsAppMessageUser(client.client, {
                wamid: "wamid_missing",
                userId: "profile_attach",
            })
        ).rejects.toThrow("was not found");
    });
});
