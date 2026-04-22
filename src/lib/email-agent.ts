import { sendEmail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    buildWorkersAgentInstructions,
    buildWorkersChannelMemoryScope,
    buildWorkersChannelSessionId,
    callSharedWorkersAgentGateway,
    getSharedAgentGatewayConfig,
    getWorkersProductFactsForAgent,
    normalizeAgentMessages,
    type WorkersAgentProfileContext,
} from "@/lib/workers-agent";

export type EmailAgentPayload = {
    fromEmail?: string;
    fromName?: string;
    subject?: string;
    text?: string;
    html?: string;
    messageId?: string;
    threadId?: string;
};

export type EmailAgentResult = {
    model: string;
    gatewaySessionId: string | null;
};

export const CONTACT_EMAIL = "contact@workersunited.eu";

const MAX_EMAIL_TEXT_LENGTH = 6000;

export function stripHtml(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

export function normalizeEmail(value: string | undefined): string {
    return (value || "").trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildReplyHtml(reply: string): string {
    return `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 680px;">
            <div style="white-space: pre-wrap;">${escapeHtml(reply)}</div>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
                Workers United<br />
                ${CONTACT_EMAIL}
            </p>
        </div>
    `;
}

function buildEmailContext({
    fromEmail,
    fromName,
    subject,
}: {
    fromEmail: string;
    fromName: string;
    subject: string;
}): WorkersAgentProfileContext {
    return {
        isAuthenticated: false,
        profileId: null,
        role: "public",
        name: fromName || fromEmail,
        email: fromEmail,
        summary: [
            `Channel: email via ${CONTACT_EMAIL}.`,
            `Sender email: ${fromEmail}`,
            `Sender name: ${fromName || "not provided"}`,
            `Subject: ${subject || "(no subject)"}`,
            "This may be a worker lead, employer lead, agency lead, or public inquiry.",
            "Reply as an email assistant from Workers United. Do not claim that you performed external actions unless a tool actually did it.",
        ].join("\n"),
    };
}

export async function handleInboundEmailAgent(payload: EmailAgentPayload): Promise<EmailAgentResult> {
    const config = getSharedAgentGatewayConfig();
    if (!config) {
        throw new Error("Shared Hermes agent gateway is not configured.");
    }

    const fromEmail = normalizeEmail(payload.fromEmail);
    const fromName = (payload.fromName || "").trim();
    const subject = (payload.subject || "Workers United").trim().slice(0, 240);
    const bodyText = ((payload.text || stripHtml(payload.html || "")).trim()).slice(0, MAX_EMAIL_TEXT_LENGTH);

    if (!isValidEmail(fromEmail) || !bodyText) {
        throw new Error("fromEmail and text/html body are required.");
    }

    const supabase = createAdminClient();
    const profileContext = buildEmailContext({ fromEmail, fromName, subject });
    const memoryScope = buildWorkersChannelMemoryScope({
        productKey: config.productKey,
        channel: "email",
        externalId: fromEmail,
    });
    const productFacts = await getWorkersProductFactsForAgent(supabase);
    const baseInstructions = await buildWorkersAgentInstructions({
        profileContext,
        productFacts,
        productKey: config.productKey,
        memoryScope,
    });
    const instructions = `${baseInstructions}

Email channel rules:
- This conversation is happening by email at ${CONTACT_EMAIL}.
- Write a complete but concise email reply.
- Do not mention or offer a Workers United dashboard agent button.
- Ask at most one focused follow-up question if more information is needed.`;
    const sessionId = buildWorkersChannelSessionId({
        productKey: config.productKey,
        channel: "email",
        identity: fromEmail,
        conversationId: payload.threadId || payload.messageId || subject,
    });
    const messages = normalizeAgentMessages([{
        role: "user",
        content: [
            `Inbound email to ${CONTACT_EMAIL}`,
            `From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}`,
            `Subject: ${subject}`,
            "",
            bodyText,
        ].join("\n"),
    }]);

    const result = await callSharedWorkersAgentGateway({
        config,
        instructions,
        messages,
        sessionId,
    });
    const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
    const emailResult = await sendEmail(fromEmail, replySubject, buildReplyHtml(result.reply));

    if (!emailResult.success) {
        throw new Error(emailResult.error || "Failed to send reply.");
    }

    return {
        model: result.model,
        gatewaySessionId: result.gatewaySessionId,
    };
}
