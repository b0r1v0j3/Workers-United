import { NextRequest, NextResponse } from "next/server";
import { handleInboundEmailAgent, type EmailAgentPayload } from "@/lib/email-agent";
import { getSharedAgentGatewayConfig } from "@/lib/workers-agent";

function getWebhookSecret(): string {
    return process.env.AGENT_EMAIL_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
}

function getBearerToken(request: NextRequest): string {
    const authorization = request.headers.get("authorization") || "";
    return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

export async function POST(request: NextRequest) {
    const secret = getWebhookSecret();
    if (!secret) {
        return NextResponse.json({ error: "Email agent webhook secret is not configured." }, { status: 500 });
    }

    if (getBearerToken(request) !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = getSharedAgentGatewayConfig();
    if (!config) {
        return NextResponse.json({ error: "Shared Hermes agent gateway is not configured." }, { status: 503 });
    }

    try {
        const payload = await request.json() as EmailAgentPayload;
        const result = await handleInboundEmailAgent(payload);

        return NextResponse.json({
            success: true,
            model: result.model,
            gatewaySessionId: result.gatewaySessionId,
        });
    } catch (error) {
        console.error("[Email Agent] Error:", error);
        return NextResponse.json({ error: "Email agent failed." }, { status: 500 });
    }
}
