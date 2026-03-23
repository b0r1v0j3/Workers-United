export interface WhatsAppInboundMessage {
    id?: string | null;
    from?: string | null;
    type?: string | null;
    text?: {
        body?: string | null;
    } | null;
    button?: {
        text?: string | null;
    } | null;
    interactive?: {
        button_reply?: {
            title?: string | null;
        } | null;
        list_reply?: {
            title?: string | null;
        } | null;
    } | null;
}

const TEXT_LIKE_MESSAGE_TYPES = new Set(["text", "button", "interactive"]);
const STRONG_AUTOREPLY_PATTERNS: readonly RegExp[] = [
    /\bthank you for contacting\b.*\b(?:let us know how we can help|how we can help you)\b/i,
    /\bthank you for your message\b.*\b(?:unavailable right now|respond as soon as possible|get back to you)\b/i,
    /\bthis is an automated (?:message|reply|response)\b/i,
    /\bout of office\b/i,
];
const AUTOREPLY_GRATITUDE_PATTERNS: readonly RegExp[] = [
    /\bthank you for contacting\b/i,
    /\bthank you for your message\b/i,
];
const AUTOREPLY_DELAY_PATTERNS: readonly RegExp[] = [
    /\b(?:we(?:'re| are)|i(?:'m| am)) unavailable right now\b/i,
    /\b(?:will|can) respond as soon as possible\b/i,
    /\b(?:we(?:'ll| will)|i(?:'ll| will)) get back to you\b/i,
    /\b(?:we(?:'ll| will)|i(?:'ll| will)) respond shortly\b/i,
];

interface PostgresLikeError {
    code?: string;
}

interface ExistingInboundWhatsAppMessageRow {
    id?: string | null;
    user_id?: string | null;
}

export interface WhatsAppInboundRecordResult {
    id: string | null;
    inserted: boolean;
    duplicate: boolean;
}

export interface WhatsAppInboundAttachResult {
    attached: boolean;
    alreadyAttached: boolean;
    messageId: string | null;
}

export function normalizeWhatsAppPhone(rawPhone: string): string {
    const digits = rawPhone.replace(/\D/g, "");
    return digits ? `+${digits}` : "";
}

export function isTextLikeWhatsAppMessage(messageType: string) {
    return TEXT_LIKE_MESSAGE_TYPES.has(messageType);
}

export function extractWhatsAppMessageContent(message: WhatsAppInboundMessage): string {
    const messageType = message.type || "unknown";

    if (messageType === "text") {
        return message.text?.body || "";
    }

    if (messageType === "button") {
        return message.button?.text || "";
    }

    if (messageType === "interactive") {
        return message.interactive?.button_reply?.title
            || message.interactive?.list_reply?.title
            || `[${messageType}]`;
    }

    return `[${messageType} message]`;
}

export function looksLikeAutomatedWhatsAppAutoReply(messageType: string, content: string): boolean {
    if (!TEXT_LIKE_MESSAGE_TYPES.has(messageType)) {
        return false;
    }

    const normalized = content.trim();
    if (!normalized) {
        return false;
    }

    if (STRONG_AUTOREPLY_PATTERNS.some((pattern) => pattern.test(normalized))) {
        return true;
    }

    const hasGratitude = AUTOREPLY_GRATITUDE_PATTERNS.some((pattern) => pattern.test(normalized));
    const hasDelaySignal = AUTOREPLY_DELAY_PATTERNS.some((pattern) => pattern.test(normalized));

    return hasGratitude && hasDelaySignal;
}

async function findInboundWhatsAppMessageByWamid(
    admin: any,
    wamid: string
): Promise<ExistingInboundWhatsAppMessageRow | null> {
    const { data, error } = await admin
        .from("whatsapp_messages")
        .select("id, user_id")
        .eq("wamid", wamid)
        .eq("direction", "inbound")
        .limit(1);

    if (error) {
        throw error;
    }

    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    return data[0] || null;
}

export async function recordInboundWhatsAppMessage(
    admin: any,
    params: {
        userId: string | null;
        normalizedPhone: string;
        messageType: string;
        content: string;
        wamid: string;
    }
) : Promise<WhatsAppInboundRecordResult> {
    const payload = {
        user_id: params.userId,
        phone_number: params.normalizedPhone,
        direction: "inbound",
        message_type: params.messageType,
        content: params.content,
        wamid: params.wamid,
        status: "delivered",
    };
    const existingMessage = await findInboundWhatsAppMessageByWamid(admin, params.wamid);
    if (existingMessage?.id) {
        return {
            id: existingMessage.id,
            inserted: false,
            duplicate: true,
        };
    }

    const { data, error } = await admin
        .from("whatsapp_messages")
        .insert(payload)
        .select("id")
        .single();

    if (!error) {
        return {
            id: data?.id || null,
            inserted: true,
            duplicate: false,
        };
    }

    if ((error as PostgresLikeError)?.code === "23505") {
        const duplicateMessage = await findInboundWhatsAppMessageByWamid(admin, params.wamid);
        return {
            id: duplicateMessage?.id || null,
            inserted: false,
            duplicate: true,
        };
    }

    throw error;
}

export async function attachInboundWhatsAppMessageUser(
    admin: any,
    params: {
        wamid: string;
        userId: string;
    }
): Promise<WhatsAppInboundAttachResult> {
    if (!params.wamid || !params.userId) {
        return {
            attached: false,
            alreadyAttached: false,
            messageId: null,
        };
    }

    const { data: attachedRows, error: attachError } = await admin
        .from("whatsapp_messages")
        .update({ user_id: params.userId })
        .select("id")
        .eq("wamid", params.wamid)
        .eq("direction", "inbound")
        .is("user_id", null);

    if (attachError) {
        throw attachError;
    }

    if (Array.isArray(attachedRows) && attachedRows.length > 0) {
        return {
            attached: true,
            alreadyAttached: false,
            messageId: attachedRows[0]?.id || null,
        };
    }

    const existingRow = await findInboundWhatsAppMessageByWamid(admin, params.wamid);

    if (!existingRow?.id) {
        throw new Error(`Inbound WhatsApp message ${params.wamid} was not found for user attach`);
    }

    if (existingRow.user_id) {
        return {
            attached: false,
            alreadyAttached: true,
            messageId: existingRow.id,
        };
    }

    throw new Error(`Inbound WhatsApp message ${params.wamid} exists but user attach did not persist`);
}
