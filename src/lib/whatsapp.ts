// WhatsApp Business Cloud API helper
// Sends template messages via Meta's Graph API and logs to whatsapp_messages table
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages

import { createAdminClient } from "@/lib/supabase/admin";
import type { CanonicalUserType } from "@/lib/domain";
import { isRecipientSideWhatsAppFailure } from "@/lib/whatsapp-health";

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

export interface SendTemplateOptions {
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

interface SendAttemptResult extends SendResult {
    errorData?: any;
}

const RECIPIENT_BLOCK_LOOKBACK_DAYS = 30;

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

function buildTemplateComponents(options: SendTemplateOptions): TemplateComponent[] {
    const components: TemplateComponent[] = [];

    if (options.headerParams && options.headerParams.length > 0) {
        components.push({
            type: "header",
            parameters: options.headerParams.map(text => ({ type: "text" as const, text })),
        });
    }

    if (options.bodyParams && options.bodyParams.length > 0) {
        components.push({
            type: "body",
            parameters: options.bodyParams.map(text => ({ type: "text" as const, text })),
        });
    }

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

    return components;
}

function buildTemplateContent(options: SendTemplateOptions): string {
    const body = options.bodyParams?.join(", ") || "";
    const button = options.buttonParams?.map((btn) => btn.url).join(", ");
    const buttonNote = button ? ` [buttons: ${button}]` : "";
    return `[Template: ${options.templateName}] ${body}${buttonNote}`.trim();
}

export function normalizeTemplateOptions(options: SendTemplateOptions): SendTemplateOptions {
    switch (options.templateName) {
        case "profile_incomplete":
            // Meta currently accepts the approved profile_incomplete variant without a CTA button.
            // Stripping buttons here avoids the guaranteed first-pass (#132018) failure before fallback recovery.
            return options.buttonParams?.length
                ? { ...options, buttonParams: undefined }
                : options;
        default:
            return options;
    }
}

function dedupeTemplateVariants(variants: SendTemplateOptions[]): SendTemplateOptions[] {
    const seen = new Set<string>();
    return variants.filter((variant) => {
        const key = JSON.stringify({
            templateName: variant.templateName,
            bodyParams: variant.bodyParams || [],
            headerParams: variant.headerParams || [],
            buttonParams: variant.buttonParams || [],
        });
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildTemplateFallbackVariants(options: SendTemplateOptions): SendTemplateOptions[] {
    const baseWithoutButtons = options.buttonParams?.length
        ? { ...options, buttonParams: undefined }
        : null;

    const variants: SendTemplateOptions[] = [];

    if (baseWithoutButtons) {
        variants.push(baseWithoutButtons);
    }

    switch (options.templateName) {
        case "status_update":
            if (baseWithoutButtons) {
                variants.push({
                    ...baseWithoutButtons,
                    bodyParams: options.bodyParams?.slice(-1),
                });
            }
            break;
        case "profile_incomplete":
            if (baseWithoutButtons) {
                variants.push({
                    ...baseWithoutButtons,
                    bodyParams: options.bodyParams?.slice(0, 2),
                });
                variants.push({
                    ...baseWithoutButtons,
                    bodyParams: options.bodyParams?.slice(0, 1),
                });
            }
            break;
        case "payment_confirmed":
            if (baseWithoutButtons && options.bodyParams && options.bodyParams.length > 1) {
                variants.push({
                    ...baseWithoutButtons,
                    bodyParams: [options.bodyParams[1], options.bodyParams[0]],
                });
            }
            break;
        default:
            break;
    }

    return dedupeTemplateVariants(variants);
}

async function attemptTemplateSend(
    config: NonNullable<ReturnType<typeof getConfig>>,
    to: string,
    options: SendTemplateOptions
): Promise<SendAttemptResult> {
    const languageCode = options.languageCode || "en";
    const components = buildTemplateComponents(options);
    const payload = {
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "template",
        template: {
            name: options.templateName,
            language: { code: languageCode },
            ...(components.length > 0 ? { components } : {}),
        },
    };

    const response = await fetch(`${GRAPH_API_BASE}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${config.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        return { success: false, error: errorMsg, errorData };
    }

    const data: WhatsAppApiResponse = await response.json();
    return { success: true, messageId: data.messages?.[0]?.id };
}

async function findRecentRecipientSideBlock(phoneNumber: string): Promise<string | null> {
    try {
        const supabase = createAdminClient();
        const since = new Date(Date.now() - RECIPIENT_BLOCK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from("whatsapp_messages")
            .select("error_message")
            .eq("phone_number", phoneNumber)
            .eq("direction", "outbound")
            .eq("message_type", "template")
            .eq("status", "failed")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) {
            console.warn("[WhatsApp] Failed to inspect recent recipient-side failures:", error);
            return null;
        }

        const recentRecipientFailure = (data || []).find((message: { error_message?: string | null }) =>
            isRecipientSideWhatsAppFailure(message.error_message)
        );

        return recentRecipientFailure?.error_message?.trim() || null;
    } catch (error) {
        console.warn("[WhatsApp] Failed to inspect recent recipient-side block history:", error);
        return null;
    }
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

    const normalizedOptions = normalizeTemplateOptions(options);
    const to = normalizePhone(normalizedOptions.to);

    try {
        const recentRecipientBlock = await findRecentRecipientSideBlock(to);
        if (recentRecipientBlock) {
            const suppressionError = `Suppressed due to recent recipient-side WhatsApp block: ${recentRecipientBlock}`;
            await logMessage({
                userId: normalizedOptions.userId,
                phoneNumber: to,
                direction: "outbound",
                messageType: "template",
                content: buildTemplateContent(normalizedOptions),
                templateName: normalizedOptions.templateName,
                status: "blocked",
                errorMessage: suppressionError,
            });
            return { success: false, error: suppressionError };
        }

        let attemptedOptions = normalizedOptions;
        let sendResult = await attemptTemplateSend(config, to, normalizedOptions);

        if (!sendResult.success && sendResult.error?.includes("(#132018)")) {
            for (const fallbackOptions of buildTemplateFallbackVariants(normalizedOptions)) {
                const fallbackResult = await attemptTemplateSend(config, to, fallbackOptions);
                if (fallbackResult.success) {
                    attemptedOptions = fallbackOptions;
                    sendResult = fallbackResult;
                    console.warn("[WhatsApp] Template recovered via fallback variant:", {
                        templateName: normalizedOptions.templateName,
                        originalBodyCount: normalizedOptions.bodyParams?.length || 0,
                        fallbackBodyCount: fallbackOptions.bodyParams?.length || 0,
                        droppedButtons: !!normalizedOptions.buttonParams?.length && !fallbackOptions.buttonParams?.length,
                    });
                    break;
                }

                sendResult = fallbackResult;
            }
        }

        if (!sendResult.success) {
            console.error("[WhatsApp] Template send failed:", sendResult.error, sendResult.errorData);
            await logMessage({
                userId: options.userId,
                phoneNumber: to,
                direction: "outbound",
                messageType: "template",
                content: buildTemplateContent(attemptedOptions),
                templateName: attemptedOptions.templateName,
                status: "failed",
                errorMessage: sendResult.error,
            });

            return { success: false, error: sendResult.error };
        }

        await logMessage({
            userId: options.userId,
            phoneNumber: to,
            direction: "outbound",
            messageType: "template",
            content: buildTemplateContent(attemptedOptions),
            templateName: attemptedOptions.templateName,
            wamid: sendResult.messageId,
            status: "sent",
        });

        return { success: true, messageId: sendResult.messageId };
    } catch (error: any) {
        console.error("[WhatsApp] Send error:", error);

        await logMessage({
            userId: normalizedOptions.userId,
            phoneNumber: to,
            direction: "outbound",
            messageType: "template",
            content: `${buildTemplateContent(normalizedOptions)} FAILED: ${error.message}`,
            templateName: normalizedOptions.templateName,
            status: "failed",
            errorMessage: error.message,
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
            await logMessage({
                userId,
                phoneNumber: phone,
                direction: "outbound",
                messageType: "text",
                content: text,
                status: "failed",
                errorMessage: errorMsg,
            });
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
        await logMessage({
            userId,
            phoneNumber: phone,
            direction: "outbound",
            messageType: "text",
            content: text,
            status: "failed",
            errorMessage: error.message,
        });
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
    errorMessage?: string;
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
            error_message: params.errorMessage || null,
        });
    } catch (err) {
        // Logging failure should never break message sending
        console.error("[WhatsApp] Log error:", err);
    }
}

// ─── Convenience wrappers for each template ─────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu";

type WhatsAppRecipientRole = Exclude<CanonicalUserType, "admin">;

function getRoleWorkspacePath(role: WhatsAppRecipientRole, purpose: "welcome" | "dashboard" | "documents" | "queue" = "dashboard") {
    switch (role) {
        case "employer":
            return "/profile/employer";
        case "agency":
            return "/profile/agency";
        case "worker":
        default:
            switch (purpose) {
                case "welcome":
                    return "/profile/worker/edit";
                case "documents":
                    return "/profile/worker/documents";
                case "queue":
                    return "/profile/worker/queue";
                case "dashboard":
                default:
                    return "/profile/worker";
            }
    }
}

function toTemplateUrlSuffix(url: string) {
    return url.startsWith("http://") || url.startsWith("https://")
        ? url.replace(BASE_URL, "")
        : url;
}

export async function sendRoleWelcome(
    phone: string,
    firstName: string,
    role: WhatsAppRecipientRole,
    userId?: string
) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "welcome_registration",
        bodyParams: [firstName],
        buttonParams: [{ type: "url", url: getRoleWorkspacePath(role, "welcome") }],
        userId,
    });
}

export async function sendWelcome(phone: string, firstName: string, userId?: string) {
    return sendRoleWelcome(phone, firstName, "worker", userId);
}

export async function sendProfileVerified(phone: string, firstName: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "profile_verified",
        bodyParams: [firstName],
        buttonParams: [{ type: "url", url: getRoleWorkspacePath("worker", "dashboard") }],
        userId,
    });
}

export async function sendPaymentConfirmed(phone: string, firstName: string, amount: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "payment_confirmed",
        bodyParams: [amount, firstName],
        buttonParams: [{ type: "url", url: getRoleWorkspacePath("worker", "queue") }],
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
        buttonParams: [{ type: "url", url: getRoleWorkspacePath("worker", "documents") }],
        userId,
    });
}

export async function sendProfileIncomplete(phone: string, name: string, completion: string, missingFields: string, userId?: string) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "profile_incomplete",
        bodyParams: [name, completion, missingFields],
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

export async function sendRoleStatusUpdate(
    phone: string,
    name: string,
    message: string,
    role: WhatsAppRecipientRole,
    userId?: string
) {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "status_update",
        bodyParams: [name, message],
        buttonParams: [{ type: "url", url: getRoleWorkspacePath(role, "dashboard") }],
        userId,
    });
}

export async function sendStatusUpdate(phone: string, name: string, message: string, userId?: string) {
    return sendRoleStatusUpdate(phone, name, message, "worker", userId);
}

export async function sendRoleAnnouncement(
    phone: string,
    title: string,
    message: string,
    _role: WhatsAppRecipientRole,
    actionUrl?: string,
    userId?: string
) {
    const resolvedActionUrl = actionUrl ? toTemplateUrlSuffix(actionUrl) : undefined;
    return sendWhatsAppTemplate({
        to: phone,
        templateName: "announcement",
        bodyParams: [title, message],
        ...(resolvedActionUrl ? { buttonParams: [{ type: "url" as const, url: resolvedActionUrl }] } : {}),
        userId,
    });
}

export async function sendAnnouncement(phone: string, title: string, message: string, actionUrl?: string, userId?: string) {
    return sendRoleAnnouncement(phone, title, message, "worker", actionUrl, userId);
}
