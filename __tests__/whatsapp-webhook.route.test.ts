import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createAdminClient = vi.fn();
const sendWhatsAppText = vi.fn();
const logServerActivity = vi.fn();
const saveBrainFactsDedup = vi.fn();
const persistWhatsAppDeliveryStatuses = vi.fn();
const attachInboundWhatsAppMessageUser = vi.fn();
const extractWhatsAppMessageContent = vi.fn();
const isTextLikeWhatsAppMessage = vi.fn();
const normalizeWhatsAppPhone = vi.fn();
const recordInboundWhatsAppMessage = vi.fn();
const resolveWhatsAppWorkerIdentity = vi.fn();
const resolveEmployerWhatsAppLead = vi.fn();
const loadWhatsAppConversationHistory = vi.fn();
const loadWhatsAppBrainMemory = vi.fn();
const generateEmployerWhatsAppReply = vi.fn();
const handleWhatsAppAdminCommand = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/whatsapp", () => ({
    sendWhatsAppText,
}));

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

vi.mock("@/lib/brain-memory", () => ({
    saveBrainFactsDedup,
}));

vi.mock("@/lib/whatsapp-status-events", () => ({
    persistWhatsAppDeliveryStatuses,
}));

vi.mock("@/lib/whatsapp-inbound-events", () => ({
    attachInboundWhatsAppMessageUser,
    extractWhatsAppMessageContent,
    isTextLikeWhatsAppMessage,
    normalizeWhatsAppPhone,
    recordInboundWhatsAppMessage,
}));

vi.mock("@/lib/whatsapp-identity", () => ({
    resolveWhatsAppWorkerIdentity,
}));

vi.mock("@/lib/whatsapp-employer-flow", () => ({
    resolveEmployerWhatsAppLead,
    generateEmployerWhatsAppReply,
    getEmployerWhatsAppDefaultReply: (language: string) => `DEFAULT:${language}`,
    getEmployerWhatsAppErrorReply: (language: string) => `ERR:${language}`,
    getEmployerWhatsAppStaticReply: (language: string) => `STATIC:${language}`,
}));

vi.mock("@/lib/whatsapp-conversation-helpers", () => ({
    loadWhatsAppConversationHistory,
    loadWhatsAppBrainMemory,
    createWhatsAppAutoHandoff: vi.fn(),
}));

vi.mock("@/lib/whatsapp-admin-commands", () => ({
    handleWhatsAppAdminCommand,
}));

describe("POST /api/whatsapp/webhook", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        createAdminClient.mockReturnValue({ admin: true });
        sendWhatsAppText.mockResolvedValue({ success: true, messageId: "wamid_out_1" });
        persistWhatsAppDeliveryStatuses.mockResolvedValue(0);
        attachInboundWhatsAppMessageUser.mockResolvedValue(undefined);
        extractWhatsAppMessageContent.mockImplementation((message: { text?: { body?: string } }) => message.text?.body || "");
        isTextLikeWhatsAppMessage.mockReturnValue(true);
        normalizeWhatsAppPhone.mockImplementation((phone: string) => (phone.startsWith("+") ? phone : `+${phone}`));
        recordInboundWhatsAppMessage.mockResolvedValue({
            id: "msg_1",
            inserted: true,
            duplicate: false,
        });
        resolveWhatsAppWorkerIdentity.mockResolvedValue({ workerRecord: null, profile: null });
        resolveEmployerWhatsAppLead.mockResolvedValue({ employerRecord: null, isEmployer: true, isLikelyEmployer: true });
        loadWhatsAppConversationHistory.mockResolvedValue([]);
        loadWhatsAppBrainMemory.mockResolvedValue([]);
        generateEmployerWhatsAppReply.mockResolvedValue("Employer reply");
        handleWhatsAppAdminCommand.mockResolvedValue({ handled: false, replySent: false });
    });

    it("processes every message in a batched inbound payload instead of returning after the first one", async () => {
        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_1", from: "381600000001", type: "text", text: { body: "hello" } },
                                { id: "wamid_2", from: "381600000002", type: "text", text: { body: "bonjour" } },
                            ],
                        },
                    }],
                }],
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({ status: "ok" });
        expect(sendWhatsAppText).toHaveBeenCalledTimes(2);
        expect(sendWhatsAppText).toHaveBeenNthCalledWith(1, "+381600000001", "Employer reply", undefined);
        expect(sendWhatsAppText).toHaveBeenNthCalledWith(2, "+381600000002", "Employer reply", undefined);
    });

    it("processes every entry and change in a Meta webhook payload", async () => {
        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [
                    {
                        changes: [
                            {
                                value: {
                                    messages: [
                                        { id: "wamid_a1", from: "381600000011", type: "text", text: { body: "hello" } },
                                    ],
                                },
                            },
                            {
                                value: {
                                    messages: [
                                        { id: "wamid_a2", from: "381600000012", type: "text", text: { body: "bonjour" } },
                                    ],
                                },
                            },
                        ],
                    },
                    {
                        changes: [
                            {
                                value: {
                                    messages: [
                                        { id: "wamid_b1", from: "381600000013", type: "text", text: { body: "ola" } },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({ status: "ok" });
        expect(sendWhatsAppText).toHaveBeenCalledTimes(3);
        expect(sendWhatsAppText).toHaveBeenNthCalledWith(1, "+381600000011", "Employer reply", undefined);
        expect(sendWhatsAppText).toHaveBeenNthCalledWith(2, "+381600000012", "Employer reply", undefined);
        expect(sendWhatsAppText).toHaveBeenNthCalledWith(3, "+381600000013", "Employer reply", undefined);
    });

    it("keeps processing later batched messages and returns partial failure when one message crashes", async () => {
        recordInboundWhatsAppMessage
            .mockRejectedValueOnce(new Error("db boom"))
            .mockResolvedValue({
                id: "msg_2",
                inserted: true,
                duplicate: false,
            });

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_fail", from: "381600000021", type: "text", text: { body: "hello" } },
                                { id: "wamid_ok", from: "381600000022", type: "text", text: { body: "bonjour" } },
                            ],
                        },
                    }],
                }],
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({ status: "partial_failure" });
        expect(sendWhatsAppText).toHaveBeenCalledTimes(1);
        expect(sendWhatsAppText).toHaveBeenCalledWith("+381600000022", "Employer reply", undefined);
        expect(logServerActivity).toHaveBeenCalledWith(
            "anonymous",
            "whatsapp_webhook_message_failed",
            "error",
            expect.objectContaining({
                phone: "+381600000021",
                wamid: "wamid_fail",
                error: "db boom",
            }),
            "error"
        );
    });

    it("skips duplicate inbound wamid rows without replying twice", async () => {
        recordInboundWhatsAppMessage
            .mockResolvedValueOnce({
                id: null,
                inserted: false,
                duplicate: true,
            })
            .mockResolvedValueOnce({
                id: "msg_2",
                inserted: true,
                duplicate: false,
            });

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_dup", from: "381600000031", type: "text", text: { body: "hello" } },
                                { id: "wamid_ok", from: "381600000032", type: "text", text: { body: "bonjour" } },
                            ],
                        },
                    }],
                }],
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({ status: "ok" });
        expect(sendWhatsAppText).toHaveBeenCalledTimes(1);
        expect(sendWhatsAppText).toHaveBeenCalledWith("+381600000032", "Employer reply", undefined);
    });

    it("keeps employer error fallback in the conversation language when AI degrades", async () => {
        loadWhatsAppConversationHistory.mockResolvedValueOnce([
            { direction: "inbound", content: "Bonjour", created_at: "2026-03-19T12:00:00.000Z" },
        ]);
        generateEmployerWhatsAppReply.mockRejectedValueOnce(new Error("boom"));

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_3", from: "381600000003", type: "text", text: { body: "ok" } },
                            ],
                        },
                    }],
                }],
            }),
        });

        await POST(request);

        expect(sendWhatsAppText).toHaveBeenCalledWith("+381600000003", "ERR:French", undefined);
    });

    it("returns partial_failure when reply delivery fails for a retryable platform error", async () => {
        sendWhatsAppText.mockResolvedValueOnce({
            success: false,
            error: "HTTP 500",
            retryable: true,
            failureCategory: "platform",
        });

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_retry", from: "381600000099", type: "text", text: { body: "hello" } },
                            ],
                        },
                    }],
                }],
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({ status: "partial_failure" });
        expect(logServerActivity).toHaveBeenCalledWith(
            "anonymous",
            "whatsapp_reply_delivery_failed",
            "messaging",
            expect.objectContaining({
                phone: "+381600000099",
                retryable: true,
                failure_category: "platform",
            }),
            "error"
        );
    });
});
