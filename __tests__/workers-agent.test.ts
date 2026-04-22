import { describe, expect, it } from "vitest";
import {
    buildSharedAgentEndpoint,
    buildSharedAgentMessages,
    buildWorkersAgentMemoryScope,
    buildWorkersAgentSessionId,
    buildWorkersChannelMemoryScope,
    buildWorkersChannelSessionId,
    callSharedWorkersAgentGateway,
    extractSharedAgentReply,
    getLatestUserMessage,
    getSharedAgentGatewayConfig,
    normalizeAgentMessages,
    type SharedAgentGatewayConfig,
    type WorkersAgentProfileContext,
} from "@/lib/workers-agent";

const workerContext: WorkersAgentProfileContext = {
    isAuthenticated: true,
    profileId: "11111111-2222-3333-4444-555555555555",
    role: "worker",
    name: "Test Worker",
    email: "worker@example.com",
    summary: "Authenticated worker: Test Worker.",
};

describe("workers shared agent bridge helpers", () => {
    it("normalizes only valid agent messages", () => {
        const messages = normalizeAgentMessages([
            { role: "system", content: "ignore" },
            { role: "user", content: "  Hello  " },
            { role: "assistant", content: "" },
            { role: "assistant", content: "Hi" },
            { role: "user", content: 123 },
        ]);

        expect(messages).toEqual([
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi" },
        ]);
    });

    it("finds the latest user message", () => {
        const latest = getLatestUserMessage([
            { role: "user", content: "first" },
            { role: "assistant", content: "reply" },
            { role: "user", content: "second" },
        ]);

        expect(latest).toBe("second");
    });

    it("builds the OpenAI-compatible Hermes endpoint from common base URLs", () => {
        expect(buildSharedAgentEndpoint("http://localhost:8642")).toBe("http://localhost:8642/v1/chat/completions");
        expect(buildSharedAgentEndpoint("http://localhost:8642/v1")).toBe("http://localhost:8642/v1/chat/completions");
        expect(buildSharedAgentEndpoint("http://localhost:8642/v1/chat/completions")).toBe("http://localhost:8642/v1/chat/completions");
    });

    it("requires a configured shared gateway and normalizes the project key", () => {
        const config = getSharedAgentGatewayConfig({
            SHARED_AGENT_BASE_URL: "http://localhost:8642/v1",
            SHARED_AGENT_API_KEY: "secret",
            SHARED_AGENT_MODEL: "hermes-agent",
            SHARED_AGENT_PRODUCT_KEY: "Workers United!",
        });

        expect(config).toMatchObject({
            endpoint: "http://localhost:8642/v1/chat/completions",
            apiKey: "secret",
            model: "hermes-agent",
            productKey: "workers-united",
        });
        expect(getSharedAgentGatewayConfig({ SHARED_AGENT_BASE_URL: "http://localhost:8642" })).toBeNull();
    });

    it("scopes memory and session identity to Workers United plus the authenticated profile", () => {
        expect(buildWorkersAgentMemoryScope(workerContext, "workers-united")).toBe(
            "workers-united:user:11111111-2222-3333-4444-555555555555"
        );

        expect(buildWorkersAgentSessionId({
            productKey: "workers-united",
            profileId: workerContext.profileId || "",
            conversationId: "thread:abc",
        })).toBe(
            "workers-united-profile-11111111-2222-3333-4444-555555555555-thread-thread-abc"
        );
    });

    it("scopes channel memory and sessions for WhatsApp and email identities", () => {
        expect(buildWorkersChannelMemoryScope({
            productKey: "workers-united",
            channel: "whatsapp",
            externalId: "+381 66 299 444",
        })).toBe("workers-united:whatsapp:381-66-299-444");

        expect(buildWorkersChannelMemoryScope({
            productKey: "workers-united",
            channel: "email",
            profileId: workerContext.profileId,
            externalId: "worker@example.com",
        })).toBe("workers-united:user:11111111-2222-3333-4444-555555555555");

        expect(buildWorkersChannelSessionId({
            productKey: "Workers United!",
            channel: "email",
            identity: "contact+lead@example.com",
            conversationId: "Re: Need workers",
        })).toBe("Workers-United-email-contact-lead-example-com-thread-Re-Need-workers");
    });

    it("layers Workers context as a system message for the shared Hermes agent", () => {
        const sharedMessages = buildSharedAgentMessages({
            instructions: "Shared Hermes instructions with Workers context.",
            messages: [{ role: "user", content: "Sta dalje?" }],
        });

        expect(sharedMessages).toEqual([
            { role: "system", content: "Shared Hermes instructions with Workers context." },
            { role: "user", content: "Sta dalje?" },
        ]);
    });

    it("extracts the assistant reply from a chat-completions response", () => {
        expect(extractSharedAgentReply({
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: "Use the shared agent.",
                    },
                },
            ],
        })).toBe("Use the shared agent.");
    });

    it("calls the shared Hermes gateway with project and session headers", async () => {
        const config: SharedAgentGatewayConfig = {
            baseUrl: "http://localhost:8642",
            endpoint: "http://localhost:8642/v1/chat/completions",
            apiKey: "secret",
            model: "hermes-agent",
            productKey: "workers-united",
        };
        let capturedInit: RequestInit | undefined;

        const fetcher: typeof fetch = async (_input, init) => {
            capturedInit = init;
            return new Response(JSON.stringify({
                choices: [{ message: { role: "assistant", content: "Shared reply" } }],
            }), {
                status: 200,
                headers: { "x-hermes-session-id": "gateway-session" },
            });
        };

        const result = await callSharedWorkersAgentGateway({
            config,
            instructions: "Instructions",
            messages: [{ role: "user", content: "Hello" }],
            sessionId: "workers-united-profile-1-thread-2",
            fetcher,
        });

        const headers = capturedInit?.headers as Record<string, string>;
        const body = JSON.parse(capturedInit?.body as string);

        expect(headers.Authorization).toBe("Bearer secret");
        expect(headers["X-Hermes-Project"]).toBe("workers-united");
        expect(headers["X-Hermes-Session-Id"]).toBe("workers-united-profile-1-thread-2");
        expect(body.messages[0]).toEqual({ role: "system", content: "Instructions" });
        expect(result).toEqual({
            reply: "Shared reply",
            gatewaySessionId: "gateway-session",
            model: "hermes-agent",
        });
    });
});
