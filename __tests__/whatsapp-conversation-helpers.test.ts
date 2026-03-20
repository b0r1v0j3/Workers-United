import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    ensureSupportConversation,
    appendConversationMessage,
    logServerActivity,
    humanizeWhatsAppHandoffReason,
} = vi.hoisted(() => ({
    ensureSupportConversation: vi.fn(),
    appendConversationMessage: vi.fn(),
    logServerActivity: vi.fn(),
    humanizeWhatsAppHandoffReason: vi.fn(),
}));

vi.mock("@/lib/messaging", () => ({
    ensureSupportConversation,
    appendConversationMessage,
}));

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

vi.mock("@/lib/whatsapp-quality", () => ({
    humanizeWhatsAppHandoffReason,
}));

import {
    createWhatsAppAutoHandoff,
    formatWhatsAppHistory,
    loadWhatsAppBrainMemory,
    loadWhatsAppConversationHistory,
    maybeEscalateWhatsAppReplyDeliveryFailure,
    truncateWhatsAppPreview,
} from "@/lib/whatsapp-conversation-helpers";

function createReadAdmin() {
    return {
        from(table: string) {
            if (table === "whatsapp_messages") {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    order() {
                                        return {
                                            limit: async () => ({
                                                data: [
                                                    {
                                                        direction: "outbound",
                                                        content: "Failed reply",
                                                        created_at: "2026-03-19T10:02:00.000Z",
                                                        status: "failed",
                                                    },
                                                    {
                                                        direction: "outbound",
                                                        content: "Template nudge",
                                                        created_at: "2026-03-19T10:01:30.000Z",
                                                        status: "sent",
                                                        message_type: "template",
                                                        template_name: "profile_incomplete",
                                                    },
                                                    {
                                                        direction: "outbound",
                                                        content: "Reply 1",
                                                        created_at: "2026-03-19T10:01:00.000Z",
                                                        status: "sent",
                                                    },
                                                    {
                                                        direction: "inbound",
                                                        content: "Hello",
                                                        created_at: "2026-03-19T10:00:00.000Z",
                                                        status: "delivered",
                                                    },
                                                ],
                                            }),
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            }

            if (table === "brain_memory") {
                return {
                    select() {
                        return {
                            order() {
                                return {
                                    limit: async () => ({
                                        data: [
                                            {
                                                category: "copy_rule",
                                                content: "Keep the first WhatsApp reply shorter and answer the first question before asking another.",
                                                confidence: 0.9,
                                            },
                                        ],
                                    }),
                                };
                            },
                        };
                    },
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        },
    };
}

describe("whatsapp-conversation-helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        humanizeWhatsAppHandoffReason.mockReturnValue("Repeated support loop");
    });

    it("truncates previews without breaking short text", () => {
        expect(truncateWhatsAppPreview("hello")).toBe("hello");
        expect(truncateWhatsAppPreview("a".repeat(10), 8)).toBe("aaaaa...");
    });

    it("formats history into User/Assistant transcript lines", () => {
        expect(formatWhatsAppHistory([], 5)).toBe("(No recent history)");
        expect(formatWhatsAppHistory([
            { direction: "inbound", content: "Hi" },
            { direction: "outbound", content: "Hello there" },
        ], 5)).toBe("User: Hi\nAssistant: Hello there");
    });

    it("loads whatsapp history in chronological order and excludes failed or template outbound turns", async () => {
        const history = await loadWhatsAppConversationHistory(createReadAdmin() as never, "+381600000000", 2);

        expect(history).toEqual([
            {
                direction: "inbound",
                content: "Hello",
                created_at: "2026-03-19T10:00:00.000Z",
                status: "delivered",
                message_type: undefined,
                template_name: undefined,
            },
            {
                direction: "outbound",
                content: "Reply 1",
                created_at: "2026-03-19T10:01:00.000Z",
                status: "sent",
                message_type: undefined,
                template_name: undefined,
            },
        ]);
    });

    it("loads and normalizes safe brain-memory entries", async () => {
        const entries = await loadWhatsAppBrainMemory(createReadAdmin() as never, 8);

        expect(entries).toEqual([
            {
                category: "copy_rule",
                content: "Keep the first WhatsApp reply shorter and answer the first question before asking another.",
                confidence: 0.9,
            },
        ]);
    });

    it("creates support handoff summary, flag, and activity log", async () => {
        ensureSupportConversation.mockResolvedValue({
            conversation: { id: "conv_1" },
        });
        appendConversationMessage.mockResolvedValue({
            message: { id: "msg_1" },
        });

        const insert = vi.fn().mockResolvedValue({ data: null, error: null });
        const admin = {
            from(table: string) {
                if (table === "conversation_flags") {
                    return { insert };
                }
                throw new Error(`Unexpected table: ${table}`);
            },
        };

        const conversationId = await createWhatsAppAutoHandoff({
            admin: admin as never,
            profileId: "worker_1",
            normalizedPhone: "+381600000000",
            latestMessage: "Please help me because the same payment problem keeps happening and I cannot continue in the dashboard.",
            language: "English",
            reason: "support_loop",
            snippets: [
                "The dashboard says retry later.",
                "I already paid and still need help.",
            ],
        });

        expect(conversationId).toBe("conv_1");
        expect(ensureSupportConversation).toHaveBeenCalledWith(admin, "worker_1", "worker");
        expect(appendConversationMessage).toHaveBeenCalledTimes(1);
        expect(String(appendConversationMessage.mock.calls[0][4])).toContain("[WhatsApp auto-handoff]");
        expect(String(appendConversationMessage.mock.calls[0][4])).toContain("Reason: Repeated support loop");
        expect(insert).toHaveBeenCalledWith({
            conversation_id: "conv_1",
            message_id: "msg_1",
            flag_type: "whatsapp_auto_handoff",
        });
        expect(logServerActivity).toHaveBeenCalledWith(
            "worker_1",
            "whatsapp_auto_handoff_created",
            "messaging",
            expect.objectContaining({
                phone: "+381600000000",
                reason: "support_loop",
                conversation_id: "conv_1",
                language: "English",
            }),
            "warning"
        );
    });

    it("creates a support flag after repeated retryable reply delivery failures", async () => {
        ensureSupportConversation.mockResolvedValue({
            conversation: { id: "conv_reply_1" },
        });
        appendConversationMessage.mockResolvedValue({
            message: { id: "msg_reply_1" },
        });

        const insert = vi.fn().mockResolvedValue({ data: null, error: null });
        const recentFailureRows = [
            {
                action: "whatsapp_reply_delivery_failed",
                created_at: "2026-03-20T09:05:00.000Z",
                details: {
                    phone: "+381600000000",
                    retryable: true,
                },
            },
            {
                action: "whatsapp_reply_delivery_failed",
                created_at: "2026-03-20T09:00:00.000Z",
                details: {
                    phone: "+381600000000",
                    retryable: true,
                },
            },
        ];
        const recentHandoffRows: unknown[] = [];
        const admin = {
            from(table: string) {
                if (table === "user_activity") {
                    const filters: Record<string, string> = {};
                    return {
                        select() {
                            const query = {
                                eq(field: string, value: string) {
                                    filters[field] = value;
                                    return query;
                                },
                                gte() {
                                    return query;
                                },
                                order() {
                                    return query;
                                },
                                limit: async () => ({
                                    data: filters.action === "whatsapp_reply_delivery_failed"
                                        ? recentFailureRows
                                        : recentHandoffRows,
                                    error: null,
                                }),
                            };
                            return query;
                        },
                    };
                }
                if (table === "conversation_flags") {
                    return { insert };
                }
                throw new Error(`Unexpected table: ${table}`);
            },
        };

        const conversationId = await maybeEscalateWhatsAppReplyDeliveryFailure({
            admin: admin as never,
            profileId: "worker_1",
            role: "worker",
            normalizedPhone: "+381600000000",
            failureContext: "ai_reply",
            failureCategory: "platform",
            replyPreview: "Please try again in a minute.",
        });

        expect(conversationId).toBe("conv_reply_1");
        expect(ensureSupportConversation).toHaveBeenCalledWith(admin, "worker_1", "worker");
        expect(String(appendConversationMessage.mock.calls.at(-1)?.[4] || "")).toContain("[WhatsApp reply delivery failure]");
        expect(insert).toHaveBeenCalledWith({
            conversation_id: "conv_reply_1",
            message_id: "msg_reply_1",
            flag_type: "whatsapp_reply_delivery_failure",
        });
        expect(logServerActivity).toHaveBeenCalledWith(
            "worker_1",
            "whatsapp_reply_delivery_handoff_created",
            "messaging",
            expect.objectContaining({
                phone: "+381600000000",
                failure_category: "platform",
                failure_context: "ai_reply",
                reply_failure_count: 2,
                conversation_id: "conv_reply_1",
            }),
            "warning"
        );
    });
});
