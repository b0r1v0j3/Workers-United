// WhatsApp Business Cloud API helper
// Sends template messages via Meta's Graph API and logs to whatsapp_messages table
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages

import { createAdminClient } from "@/lib/supabase/admin";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ─── Types ──────────────────────────────────────────────────────────────────

export type WhatsAppTemplateName =
    | "welcome_registration"
    | "profile_verified"
    | "payment_confirmed"
    | "job_offer_received"
    | "offer_expiring_soon"
    | "document_reminder"
    | "profile_incomplete"
    | "refund_processed"
    | "status_update"
    | "announcement";

interface TemplateButton {
    type: "url";
    url: string;            // dynamic URL suffix (appended to the template's URL)
}

interface TemplateComponent {
    type: "header" | "body" | "button";
    parameters: TemplateParameter[];
    sub_type?: "url";
    index?: number;
}

type TemplateParameter =
    | { type: "text"; text: string }
    | { type: "image"; image: { link: string } };

interface SendTemplateOptions {
    to: string;             // phone number in international format (e.g. "+381641234567")
    templateName: WhatsAppTemplateName;
    languageCode?: string;  // default "en"
    bodyParams?: string[];  // {{1}}, {{2}}, etc. for the body
    headerParams?: string[];
    buttonParams?: TemplateButton[];
    userId?: string;        // optional: link to user for logging
}

interface WhatsAppApiResponse {
    messaging_product: string;
    contacts: { input: string; wa_id: string }[];
    messages: { id: string }[];
}

interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ─── Environment helpers ────────────────────────────────────────────────────

function getConfig() {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
        return null;
    }

    return { token, phoneNumberId };
}

// ─── Normalize phone number ─────────────────────────────────────────────────

/**
 * Ensures phone number is in E.164 format (digits only with leading +).
 * Strips spaces, dashes, parentheses. Prepends + if missing.
 */
function normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-()]/g, "");
    if (!cleaned.startsWith("+")) {
        cleaned = "+" + cleaned;
    }
    return cleaned;
}

// ─── Send template message ──────────────────────────────────────────────────

/**
 * Sends a pre-approved WhatsApp template message via Meta Cloud API.
 * Returns { success, messageId } on success or { success: false, error } on failure.
 *
 * IMPORTANT: Template must be approved in Meta Business Manager before use.
 */
export async function sendWhatsAppTemplate(options: SendTemplateOptions): Promise<SendResult> {
    const config = getConfig();
    if (!config) {
        // WhatsApp not configured — silently skip (not all deployments have it)
        return { success: false, error: "WhatsApp not configured (missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID)" };
    }

    const to = normalizePhone(options.to);
    const languageCode = options.languageCode || "en";

    // Build template components
    const components: TemplateComponent[] = [];

    // Header parameters (if any)
    if (options.headerParams && options.headerParams.length > 0) {
        components.push({
            type: "header",
            parameters: options.headerParams.map(text => ({ type: "text" as const, text })),
        });
    }

    // Body parameters (if any)
    if (options.bodyParams && options.bodyParams.length > 0) {
        components.push({
            type: "body",
            parameters: options.bodyParams.map(text => ({ type: "text" as const, text })),
        });
    }

    // Button parameters (dynamic URLs)
    if (options.buttonParams && options.buttonParams.length > 0) {
        options.buttonParams.forEach((btn, index) => {
            components.push({
                type: "button",
                sub_type: "url",
                index,
                parameters: [{ type: "text" as const, text: btn.url }],
            });
        });
    }

    const payload = {
        messaging_product: "whatsapp",
        to: to.replace("+", ""), // Meta API wants digits without +
        type: "template",
        template: {
            name: options.templateName,
            language: { code: languageCode },
            ...(components.length > 0 ? { components } : {}),
        },
    };

    try {
        const response = await fetch(
            `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${config.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
            console.error("[WhatsApp] Template send failed:", errorMsg, errorData);

            // Log failed attempt
            await logMessage({
                userId: options.userId,
                phoneNumber: to,
                direction: "outbound",
                messageType: "template",
                content: `[Template: ${options.templateName}] ${options.bodyParams?.join(", ") || ""}`,
                templateName: options.templateName,
                status: "failed",
            });

            return { success: false, error: errorMsg };
        }

        const data: WhatsAppApiResponse = await response.json();
        const messageId = data.messages?.[0]?.id;

        // Log successful send
        await logMessage({
            userId: options.userId,
            phoneNumber: to,
            direction: "outbound",
            messageType: "template",
            content: `[Template: ${options.templateName}] ${options.bodyParams?.join(", ") || ""}`,
            templateName: options.templateName,
            wamid: messageId,
            status: "sent",
        });

        return { success: true, messageId };
    } catch (error: any) {
        console.error("[WhatsApp] Send error:", error);

        await logMessage({
            userId: options.userId,
            phoneNumber: to,
            direction: "outbound",
            messageType: "template",
            content: `[Template: ${options.templateName}] FAILED: ${error.message}`,
            templateName: options.templateName,
            status: "failed",
        });

        return { success: false, error: error.message };
    }
}

// ─── Send free-form text (only within 24h customer service window) ──────────

/**
 * Sends a free-form text message. Only works within 24h of last user message.
 * For proactive/outbound messaging, use sendWhatsAppTemplate() instead.
 */
export async function sendWhatsAppText(
    to: string,
    text: string,
    userId?: string
): Promise<SendResult> {
    const config = getConfig();
    if (!config) {
        return { success: false, error: "WhatsApp not configured" };
    }

    const phone = normalizePhone(to);

    const payload = {
        messaging_product: "whatsapp",
        to: phone.replace("+", ""),
        type: "text",
        text: { body: text },
    };

    try {
        const response = await fetch(
            `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${config.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
            console.error("[WhatsApp] Text send failed:", errorMsg);
            return { success: false, error: errorMsg };
        }

        const data: WhatsAppApiResponse = await response.json();
        const messageId = data.messages?.[0]?.id;

        await logMessage({
            userId,
            phoneNumber: phone,
            direction: "outbound",
            messageType: "text",
            content: text,
            wamid: messageId,
            status: "sent",
        });

        return { success: true, messageId };
    } catch (error: any) {
        console.error("[WhatsApp] Text send error:", error);
        return { success: false, error: error.message };
    }
}

// ─── Logging helper ─────────────────────────────────────────────────────────

interface LogMessageParams {
    userId?: string;
    phoneNumber: string;
    direction: "inbound" | "outbound";
    messageType: string;
    content: string;
    templateName?: string;
    wamid?: string;
    status: string;
}

async function logMessage(params: LogMessageParams): Promise<void> {
    try {
        const supabase = createAdminClient();
        await supabase.from("whatsapp_messages").insert({
            user_id: params.userId || null,
            phone_number: params.phoneNumber,
            direction: params.direction,
            message_type: params.messageType,
            content: params.content,
            template_name: params.templateName || null,
            wamid: params.wamid || null,
            status: params.status,
        });
    } catch (err) {
        // Logging failure should never break message sending
        console.error("[WhatsApp] Log error:", err);
    }
}

// ─── Convenience wrappers for each template ─────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu";

export async function sendWelcome(phone: string, firstName: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "welcome_registration",
        bodyParams: [firstName],
        buttonParams: [{ type: "url", url: "/profile/worker/edit" }],
        userId,
    });
}

export async function sendProfileVerified(phone: string, firstName: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "profile_verified",
        bodyParams: [firstName],
        buttonParams: [{ type: "url", url: "/profile/worker" }],
        userId,
    });
}

export async function sendPaymentConfirmed(phone: string, firstName: string, amount: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "payment_confirmed",
        bodyParams: [amount, firstName],
        buttonParams: [{ type: "url", url: "/profile/worker/queue" }],
        userId,
    });
}

export async function sendJobOffer(
    phone: string,
    name: string,
    jobTitle: string,
    company: string,
    country: string,
    offerId: string,
    userId?: string
) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "job_offer_received",
        bodyParams: [name, jobTitle, company, country],
        buttonParams: [{ type: "url", url: `/profile/worker/offers/${offerId}` }],
        userId,
    });
}

export async function sendOfferExpiring(phone: string, jobTitle: string, offerUrl: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "offer_expiring_soon",
        bodyParams: [jobTitle],
        buttonParams: [{ type: "url", url: offerUrl.replace(BASE_URL, "") }],
        userId,
    });
}

export async function sendDocumentReminder(phone: string, name: string, docType: string, expiryDate: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "document_reminder",
        bodyParams: [name, docType, expiryDate],
        buttonParams: [{ type: "url", url: "/profile/worker/documents" }],
        userId,
    });
}

export async function sendProfileIncomplete(phone: string, name: string, completion: string, missingFields: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "profile_incomplete",
        bodyParams: [name, completion, missingFields],
        buttonParams: [{ type: "url", url: "/profile/worker/edit" }],
        userId,
    });
}

export async function sendRefundProcessed(phone: string, name: string, amount: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "refund_processed",
        bodyParams: [name, amount],
        userId,
    });
}

export async function sendStatusUpdate(phone: string, name: string, message: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "status_update",
        bodyParams: [name, message],
        buttonParams: [{ type: "url", url: "/profile" }],
        userId,
    });
}

export async function sendAnnouncement(phone: string, title: string, message: string, actionUrl?: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "announcement",
        bodyParams: [title, message],
        ...(actionUrl ? { buttonParams: [{ type: "url" as const, url: actionUrl }] } : {}),
        userId,
    });
}
