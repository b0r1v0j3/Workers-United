import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createAdminClient: vi.fn(),
    sendEmail: vi.fn(),
    buildWorkersAgentProfileContext: vi.fn(),
    buildWorkersAgentInstructions: vi.fn(),
    buildWorkersChannelMemoryScope: vi.fn(),
    buildWorkersChannelSessionId: vi.fn(),
    callSharedWorkersAgentGateway: vi.fn(),
    getSharedAgentGatewayConfig: vi.fn(),
    getWorkersProductFactsForAgent: vi.fn(),
    normalizeAgentMessages: vi.fn((messages) => messages),
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/mailer", () => ({
    sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/workers-agent", () => ({
    buildWorkersAgentProfileContext: mocks.buildWorkersAgentProfileContext,
    buildWorkersAgentInstructions: mocks.buildWorkersAgentInstructions,
    buildWorkersChannelMemoryScope: mocks.buildWorkersChannelMemoryScope,
    buildWorkersChannelSessionId: mocks.buildWorkersChannelSessionId,
    callSharedWorkersAgentGateway: mocks.callSharedWorkersAgentGateway,
    getSharedAgentGatewayConfig: mocks.getSharedAgentGatewayConfig,
    getWorkersProductFactsForAgent: mocks.getWorkersProductFactsForAgent,
    normalizeAgentMessages: mocks.normalizeAgentMessages,
}));

import { handleInboundEmailAgent } from "@/lib/email-agent";

function chain(result: unknown) {
    const builder = {
        select: vi.fn(() => builder),
        ilike: vi.fn(() => builder),
        not: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => result),
    };

    return builder;
}

function createSupabaseMock(results: Record<string, unknown>) {
    const builders: Record<string, ReturnType<typeof chain>> = {};

    return {
        builders,
        from(table: string) {
            const builder = chain(results[table] || { data: null, error: null });
            builders[table] = builder;
            return builder;
        },
    };
}

describe("email shared agent bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSharedAgentGatewayConfig.mockReturnValue({
            baseUrl: "https://hermes.example",
            endpoint: "https://hermes.example/v1/chat/completions",
            apiKey: "secret",
            model: "hermes-agent",
            productKey: "workers-united",
        });
        mocks.getWorkersProductFactsForAgent.mockResolvedValue([]);
        mocks.buildWorkersAgentInstructions.mockResolvedValue("instructions");
        mocks.buildWorkersChannelMemoryScope.mockReturnValue("workers-united:user:profile-1");
        mocks.buildWorkersChannelSessionId.mockReturnValue("session-1");
        mocks.callSharedWorkersAgentGateway.mockResolvedValue({
            reply: "Thanks, we will help.",
            gatewaySessionId: "gateway-session",
            model: "hermes-agent",
        });
        mocks.sendEmail.mockResolvedValue({ success: true });
    });

    it("uses an existing profile email for Hermes context and memory scope", async () => {
        const supabase = createSupabaseMock({
            profiles: {
                data: {
                    id: "profile-1",
                    email: "worker@example.com",
                    full_name: "Worker One",
                    user_type: "worker",
                },
                error: null,
            },
        });
        mocks.createAdminClient.mockReturnValue(supabase);
        mocks.buildWorkersAgentProfileContext.mockResolvedValue({
            isAuthenticated: true,
            profileId: "profile-1",
            role: "worker",
            name: "Worker One",
            email: "worker@example.com",
            summary: "Authenticated worker: Worker One.",
        });

        await handleInboundEmailAgent({
            fromEmail: "WORKER@example.com",
            fromName: "Worker One",
            subject: "Need help",
            text: "What should I do next?",
            messageId: "message-1",
        });

        expect(mocks.buildWorkersAgentProfileContext).toHaveBeenCalledWith({
            admin: supabase,
            user: {
                id: "profile-1",
                email: "worker@example.com",
                user_metadata: {
                    user_type: "worker",
                    full_name: "Worker One",
                },
            },
        });
        expect(mocks.buildWorkersChannelMemoryScope).toHaveBeenCalledWith({
            productKey: "workers-united",
            channel: "email",
            profileId: "profile-1",
            externalId: "worker@example.com",
        });
        expect(mocks.buildWorkersChannelSessionId).toHaveBeenCalledWith({
            productKey: "workers-united",
            channel: "email",
            identity: "profile-1",
            conversationId: "message-1",
        });
    });

    it("falls back to public email context when the sender is not a known account", async () => {
        const supabase = createSupabaseMock({
            profiles: { data: null, error: null },
            worker_onboarding: { data: null, error: null },
            employers: { data: null, error: null },
            agencies: { data: null, error: null },
        });
        mocks.createAdminClient.mockReturnValue(supabase);

        await handleInboundEmailAgent({
            fromEmail: "lead@example.com",
            fromName: "Lead",
            subject: "Question",
            text: "How can I start?",
        });

        expect(mocks.buildWorkersAgentProfileContext).not.toHaveBeenCalled();
        expect(mocks.buildWorkersAgentInstructions).toHaveBeenCalledWith(expect.objectContaining({
            profileContext: expect.objectContaining({
                isAuthenticated: false,
                profileId: null,
                role: "public",
                email: "lead@example.com",
            }),
        }));
        expect(mocks.buildWorkersChannelMemoryScope).toHaveBeenCalledWith({
            productKey: "workers-united",
            channel: "email",
            profileId: null,
            externalId: "lead@example.com",
        });
    });
});
