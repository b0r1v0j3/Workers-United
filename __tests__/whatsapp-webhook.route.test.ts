import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createAdminClient = vi.fn();
const sendWhatsAppText = vi.fn();
const logServerActivity = vi.fn();
const saveBrainFactsDedup = vi.fn();
const persistWhatsAppDeliveryStatuses = vi.fn();
const extractWhatsAppMessageContent = vi.fn();
const isDuplicateWhatsAppInboundMessage = vi.fn();
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
    extractWhatsAppMessageContent,
    isDuplicateWhatsAppInboundMessage,
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
        extractWhatsAppMessageContent.mockImplementation((message: { text?: { body?: string } }) => message.text?.body || "");
        isDuplicateWhatsAppInboundMessage.mockResolvedValue(false);
        isTextLikeWhatsAppMessage.mockReturnValue(true);
        normalizeWhatsAppPhone.mockImplementation((phone: string) => (phone.startsWith("+") ? phone : `+${phone}`));
        recordInboundWhatsAppMessage.mockResolvedValue(undefined);
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
});
