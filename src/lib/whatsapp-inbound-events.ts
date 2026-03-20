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

interface PostgresLikeError {
    code?: string;
}

export interface WhatsAppInboundRecordResult {
    id: string | null;
    inserted: boolean;
    duplicate: boolean;
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
        return {
            id: null,
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
) {
    if (!params.wamid || !params.userId) {
        return;
    }

    await admin
        .from("whatsapp_messages")
        .update({ user_id: params.userId })
        .eq("wamid", params.wamid)
        .eq("direction", "inbound")
        .is("user_id", null);
}
