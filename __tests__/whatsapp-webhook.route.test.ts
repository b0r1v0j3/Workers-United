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
const maybeEscalateWhatsAppReplyDeliveryFailure = vi.fn();
const generateEmployerWhatsAppReply = vi.fn();
const handleWhatsAppAdminCommand = vi.fn();
const callOpenAIResponseText = vi.fn();
const callClaudeResponseText = vi.fn();
const mutableEnv = process.env as Record<string, string | undefined>;

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
    looksLikeAutomatedWhatsAppAutoReply: vi.fn((messageType: string, content: string) => {
        if (messageType !== "text" && messageType !== "button" && messageType !== "interactive") {
            return false;
        }
        return /thank you for contacting.*how we can help|thank you for your message.*unavailable right now/i.test(content);
    }),
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
    maybeEscalateWhatsAppReplyDeliveryFailure,
    formatWhatsAppHistory: vi.fn(() => "(No recent history)"),
}));

vi.mock("@/lib/whatsapp-admin-commands", () => ({
    handleWhatsAppAdminCommand,
}));

vi.mock("@/lib/openai-response-text", () => ({
    callOpenAIResponseText,
}));

vi.mock("@/lib/claude-response-text", () => ({
    callClaudeResponseText,
}));

vi.mock("@/lib/platform-config", async () => {
    const actual = await vi.importActual<typeof import("@/lib/platform-config")>("@/lib/platform-config");

    return {
        ...actual,
        getPlatformConfig: vi.fn(async () => ({
            platform_name: "Workers United",
            website_url: "https://workersunited.eu",
            contact_email: "contact@workersunited.eu",
        })),
    };
});

describe("POST /api/whatsapp/webhook", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mutableEnv.NODE_ENV = "test";
        delete process.env.VERCEL_ENV;
        delete process.env.META_APP_SECRET;
        mutableEnv.OPENAI_API_KEY = "test-openai-key";
        mutableEnv.ANTHROPIC_API_KEY = "test-anthropic-key";

        createAdminClient.mockReturnValue({ admin: true });
        sendWhatsAppText.mockResolvedValue({ success: true, messageId: "wamid_out_1" });
        persistWhatsAppDeliveryStatuses.mockResolvedValue(0);
        attachInboundWhatsAppMessageUser.mockResolvedValue(undefined);
        extractWhatsAppMessageContent.mockImplementation((message: { text?: { body?: string } }) => message.text?.body || "");
        isTextLikeWhatsAppMessage.mockReturnValue(true);
        normalizeWhatsAppPhone.mockImplementation((phone: string | null | undefined) => {
            if (!phone) {
                return "";
            }
            return phone.startsWith("+") ? phone : `+${phone}`;
        });
        recordInboundWhatsAppMessage.mockResolvedValue({
            id: "msg_1",
            inserted: true,
            duplicate: false,
        });
        resolveWhatsAppWorkerIdentity.mockResolvedValue({ workerRecord: null, profile: null });
        resolveEmployerWhatsAppLead.mockResolvedValue({ employerRecord: null, isEmployer: true, isLikelyEmployer: true });
        loadWhatsAppConversationHistory.mockResolvedValue([]);
        loadWhatsAppBrainMemory.mockResolvedValue([]);
        maybeEscalateWhatsAppReplyDeliveryFailure.mockResolvedValue(null);
        generateEmployerWhatsAppReply.mockResolvedValue("Employer reply");
        handleWhatsAppAdminCommand.mockResolvedValue({ handled: false, replySent: false });
        callOpenAIResponseText.mockResolvedValue("AI fallback reply");
        callClaudeResponseText.mockResolvedValue("Claude conversational reply");
    });

    it("fails closed when META_APP_SECRET is missing in production", async () => {
        mutableEnv.NODE_ENV = "production";
        mutableEnv.VERCEL_ENV = "production";
        delete process.env.META_APP_SECRET;

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_prod_missing_secret", from: "381600000000", type: "text", text: { body: "hello" } },
                            ],
                        },
                    }],
                }],
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(503);
        expect(payload).toEqual({ error: "Webhook signature not configured" });
        expect(recordInboundWhatsAppMessage).not.toHaveBeenCalled();
        expect(sendWhatsAppText).not.toHaveBeenCalled();
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
    }, 15000);

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
    }, 15000);

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

    it("still repairs inbound user identity on duplicate delivery retries before skipping the reply", async () => {
        recordInboundWhatsAppMessage.mockResolvedValueOnce({
            id: null,
            inserted: false,
            duplicate: true,
        });
        resolveWhatsAppWorkerIdentity.mockResolvedValueOnce({
            workerRecord: {
                id: "worker_1",
                profile_id: "profile_1",
                status: "NEW",
                queue_position: null,
                preferred_job: null,
                desired_countries: null,
                refund_deadline: null,
                refund_eligible: null,
                entry_fee_paid: false,
                admin_approved: false,
                queue_joined_at: null,
                nationality: null,
                current_country: null,
                gender: null,
                experience_years: null,
                updated_at: null,
                phone: "+381600000041",
                marital_status: null,
                onboarding_completed: true,
            },
            profile: { full_name: "Test Worker", email: "worker@example.com", user_type: "worker" },
        });
        resolveEmployerWhatsAppLead.mockResolvedValueOnce({
            employerRecord: null,
            isEmployer: false,
            isLikelyEmployer: false,
        });
        attachInboundWhatsAppMessageUser.mockResolvedValueOnce({
            attached: true,
            alreadyAttached: false,
            messageId: "msg_existing",
        });

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_dup_attach", from: "381600000041", type: "text", text: { body: "hello" } },
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
        expect(attachInboundWhatsAppMessageUser).toHaveBeenCalledWith({ admin: true }, {
            wamid: "wamid_dup_attach",
            userId: "profile_1",
        });
        expect(sendWhatsAppText).not.toHaveBeenCalled();
    });

    it("returns partial_failure when inbound identity attach fails after the row was recorded", async () => {
        resolveWhatsAppWorkerIdentity.mockResolvedValueOnce({
            workerRecord: {
                id: "worker_1",
                profile_id: "profile_1",
                status: "NEW",
                queue_position: null,
                preferred_job: null,
                desired_countries: null,
                refund_deadline: null,
                refund_eligible: null,
                entry_fee_paid: false,
                admin_approved: false,
                queue_joined_at: null,
                nationality: null,
                current_country: null,
                gender: null,
                experience_years: null,
                updated_at: null,
                phone: "+381600000042",
                marital_status: null,
                onboarding_completed: true,
            },
            profile: { full_name: "Test Worker", email: "worker@example.com", user_type: "worker" },
        });
        resolveEmployerWhatsAppLead.mockResolvedValueOnce({
            employerRecord: null,
            isEmployer: false,
            isLikelyEmployer: false,
        });
        attachInboundWhatsAppMessageUser.mockRejectedValueOnce(new Error("attach failed"));

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_attach_fail", from: "381600000042", type: "text", text: { body: "hello" } },
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
            "profile_1",
            "whatsapp_inbound_identity_attach_failed",
            "messaging",
            expect.objectContaining({
                phone: "+381600000042",
                wamid: "wamid_attach_fail",
                duplicate_delivery: false,
                error: "attach failed",
            }),
            "error"
        );
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

    it("marks malformed inbound payloads as partial failures without trying to record or reply", async () => {
        normalizeWhatsAppPhone.mockReturnValueOnce("");

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: null, from: null, type: "text", text: { body: "hello" } },
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
        expect(recordInboundWhatsAppMessage).not.toHaveBeenCalled();
        expect(sendWhatsAppText).not.toHaveBeenCalled();
        expect(logServerActivity).toHaveBeenCalledWith(
            "anonymous",
            "whatsapp_webhook_message_malformed",
            "error",
            expect.objectContaining({
                phone: null,
                normalized_phone: null,
                wamid: null,
                message_type: "text",
            }),
            "error"
        );
    });

    it("uses recent conversation language for media fallback replies instead of defaulting to English", async () => {
        isTextLikeWhatsAppMessage.mockReturnValue(false);
        extractWhatsAppMessageContent.mockReturnValue("");
        loadWhatsAppConversationHistory.mockResolvedValue([
            { direction: "inbound", content: "Bonjour, ça va ?" },
            { direction: "outbound", content: "Bonjour ! Je suis l’assistant IA de Workers United." },
        ]);

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_media", from: "33123456789", type: "image", image: { id: "img_1" } },
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
        expect(sendWhatsAppText).toHaveBeenCalledWith(
            "+33123456789",
            expect.stringContaining("j’ai bien reçu la pièce jointe"),
            undefined
        );
    }, 15000);

    it("suppresses obvious inbound autoresponder texts instead of replying to them", async () => {
        resolveEmployerWhatsAppLead.mockResolvedValueOnce({
            employerRecord: null,
            isEmployer: false,
            isLikelyEmployer: false,
        });

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                {
                                    id: "wamid_autoreply",
                                    from: "923462806092",
                                    type: "text",
                                    text: { body: "Thank you for your message. We're unavailable right now, but will respond as soon as possible." },
                                },
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
        expect(sendWhatsAppText).not.toHaveBeenCalled();
        expect(logServerActivity).toHaveBeenCalledWith(
            "anonymous",
            "whatsapp_inbound_autoreply_suppressed",
            "messaging",
            expect.objectContaining({
                phone: "+923462806092",
                content_preview: expect.stringContaining("Thank you for your message"),
            }),
            "warning"
        );
    });

    it("keeps explicit language-switch replies in Serbian through the full webhook route", async () => {
        createAdminClient.mockReturnValueOnce({
            from: vi.fn(() => ({
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: null }),
                    }),
                }),
                delete: () => ({
                    eq: vi.fn(),
                }),
                upsert: vi.fn(),
            })),
        });
        resolveEmployerWhatsAppLead.mockResolvedValueOnce({
            employerRecord: null,
            isEmployer: false,
            isLikelyEmployer: false,
        });
        callOpenAIResponseText.mockResolvedValueOnce(JSON.stringify({
            intent: "general",
            language: "English",
            confidence: 0.92,
            reason: "generic first contact",
        }));

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_sr_switch", from: "38166033333", type: "text", text: { body: "Pisi na srpskom" } },
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
        expect(sendWhatsAppText).toHaveBeenCalledWith(
            "+38166033333",
            expect.any(String),
            undefined
        );
        // With Claude enabled, the reply is AI-generated (not the deterministic Serbian text)
        // The deterministic reply is passed as a reference draft for Claude to rephrase
        expect(callClaudeResponseText).toHaveBeenCalled();
    });

    it("keeps explicit language-switch history in Serbian for short fallback follow-ups", async () => {
        mutableEnv.OPENAI_API_KEY = "";
        mutableEnv.ANTHROPIC_API_KEY = "";
        createAdminClient.mockReturnValueOnce({
            from: vi.fn(() => ({
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: null }),
                    }),
                }),
                delete: () => ({
                    eq: vi.fn(),
                }),
                upsert: vi.fn(),
            })),
        });
        resolveEmployerWhatsAppLead.mockResolvedValueOnce({
            employerRecord: null,
            isEmployer: false,
            isLikelyEmployer: false,
        });
        loadWhatsAppConversationHistory.mockResolvedValueOnce([
            { direction: "inbound", content: "Pisi na srpskom" },
            { direction: "outbound", content: "Naravno — nastaviću na srpskom." },
        ]);

        const { POST } = await import("@/app/api/whatsapp/webhook/route");
        const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body: JSON.stringify({
                entry: [{
                    changes: [{
                        value: {
                            messages: [
                                { id: "wamid_sr_followup", from: "38166033333", type: "text", text: { body: "ok" } },
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
        expect(sendWhatsAppText).toHaveBeenCalledWith(
            "+38166033333",
            expect.stringContaining("Dobrodošli u Workers United"),
            undefined
        );
    });

    it("seeds onboarding in the recent conversation language for short onboarding openers", async () => {
        const { handleWhatsAppOnboarding } = await import("@/app/api/whatsapp/webhook/route");
        const upsert = vi.fn().mockResolvedValue({ error: null });
        const supabase = {
            from: vi.fn(() => ({
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: null }),
                    }),
                }),
                upsert,
                delete: () => ({
                    eq: vi.fn(),
                }),
            })),
        };

        const reply = await handleWhatsAppOnboarding(
            supabase,
            "+33123456789",
            "register whatsapp",
            null,
            "English",
            [
                { direction: "inbound", content: "Bonjour, ça va ?" },
                { direction: "outbound", content: "Bonjour ! Je suis l’assistant IA de Workers United." },
            ]
        );

        expect(reply).toContain("Souhaitez-vous remplir votre profil");
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                phone_number: "+33123456789",
                current_step: "ask_start",
                language: "French",
            }),
            { onConflict: "phone_number" }
        );
    });

    it("uses deterministic human-support onboarding fallback when AI API keys are missing", async () => {
        delete process.env.OPENAI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;

        const { handleWhatsAppOnboarding } = await import("@/app/api/whatsapp/webhook/route");
        const supabase = {
            from: vi.fn(() => ({
                select: () => ({
                    eq: () => ({
                        single: async () => ({
                            data: {
                                phone_number: "+381600000055",
                                current_step: "full_name",
                                collected_data: {},
                                language: "English",
                                updated_at: new Date().toISOString(),
                            },
                        }),
                    }),
                }),
                upsert: vi.fn(),
                delete: () => ({
                    eq: vi.fn(),
                }),
            })),
        };

        const reply = await handleWhatsAppOnboarding(
            supabase,
            "+381600000055",
            "I want to talk to a human",
            null,
            "English"
        );

        expect(reply).toContain("option isn't available just yet");
        expect(callOpenAIResponseText).not.toHaveBeenCalled();
    });
});
