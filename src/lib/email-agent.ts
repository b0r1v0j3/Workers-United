import { sendEmail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/sanitize";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    buildWorkersAgentProfileContext,
    buildWorkersAgentInstructions,
    buildWorkersChannelMemoryScope,
    buildWorkersChannelSessionId,
    callSharedWorkersAgentGateway,
    getSharedAgentGatewayConfig,
    getWorkersProductFactsForAgent,
    normalizeAgentMessages,
    type WorkersAgentProfileContext,
} from "@/lib/workers-agent";

type AdminClient = ReturnType<typeof createAdminClient>;

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

function buildPublicEmailContext({
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

async function findProfileUserByEmail(admin: AdminClient, fromEmail: string) {
    const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id, email, full_name, user_type")
        .ilike("email", fromEmail)
        .limit(1)
        .maybeSingle();

    if (profileError) {
        throw profileError;
    }

    if (profile?.id) {
        return {
            id: profile.id,
            email: profile.email,
            user_metadata: {
                user_type: profile.user_type,
                full_name: profile.full_name,
            },
        };
    }

    const [
        { data: worker, error: workerError },
        { data: employer, error: employerError },
        { data: agency, error: agencyError },
    ] = await Promise.all([
        admin
            .from("worker_onboarding")
            .select("profile_id, submitted_email, submitted_full_name")
            .ilike("submitted_email", fromEmail)
            .not("profile_id", "is", null)
            .limit(1)
            .maybeSingle(),
        admin
            .from("employers")
            .select("profile_id, contact_email, company_name")
            .ilike("contact_email", fromEmail)
            .not("profile_id", "is", null)
            .limit(1)
            .maybeSingle(),
        admin
            .from("agencies")
            .select("profile_id, contact_email, display_name, legal_name")
            .ilike("contact_email", fromEmail)
            .limit(1)
            .maybeSingle(),
    ]);

    const lookupError = workerError || employerError || agencyError;
    if (lookupError) {
        throw lookupError;
    }

    if (worker?.profile_id) {
        return {
            id: worker.profile_id,
            email: worker.submitted_email || fromEmail,
            user_metadata: {
                user_type: "worker",
                full_name: worker.submitted_full_name,
            },
        };
    }

    if (employer?.profile_id) {
        return {
            id: employer.profile_id,
            email: employer.contact_email || fromEmail,
            user_metadata: {
                user_type: "employer",
                full_name: employer.company_name,
            },
        };
    }

    if (agency?.profile_id) {
        return {
            id: agency.profile_id,
            email: agency.contact_email || fromEmail,
            user_metadata: {
                user_type: "agency",
                full_name: agency.display_name || agency.legal_name,
            },
        };
    }

    return null;
}

async function buildEmailContext({
    admin,
    fromEmail,
    fromName,
    subject,
}: {
    admin: AdminClient;
    fromEmail: string;
    fromName: string;
    subject: string;
}): Promise<WorkersAgentProfileContext> {
    const profileUser = await findProfileUserByEmail(admin, fromEmail);
    const channelSummary = [
        `Channel: email via ${CONTACT_EMAIL}.`,
        `Sender email: ${fromEmail}`,
        `Sender name: ${fromName || "not provided"}`,
        `Subject: ${subject || "(no subject)"}`,
    ].join("\n");

    if (!profileUser) {
        return buildPublicEmailContext({ fromEmail, fromName, subject });
    }

    const accountContext = await buildWorkersAgentProfileContext({ admin, user: profileUser });

    return {
        ...accountContext,
        summary: [
            channelSummary,
            "",
            accountContext.summary,
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
    const profileContext = await buildEmailContext({ admin: supabase, fromEmail, fromName, subject });
    const memoryScope = buildWorkersChannelMemoryScope({
        productKey: config.productKey,
        channel: "email",
        profileId: profileContext.profileId,
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
- If someone asks why they should send personal data before receiving a job offer, say that Workers United needs the portal profile and required documents first so the team can review eligibility and match them with suitable employers/jobs. Do not request CV/resume or work-experience text because those are not current portal steps.
- Ask at most one focused follow-up question if more information is needed.`;
    const sessionId = buildWorkersChannelSessionId({
        productKey: config.productKey,
        channel: "email",
        identity: profileContext.profileId || fromEmail,
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
