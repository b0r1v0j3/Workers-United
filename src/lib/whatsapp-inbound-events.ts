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

export async function isDuplicateWhatsAppInboundMessage(
    admin: any,
    wamid: string
) {
    if (!wamid) {
        return false;
    }

    const { data } = await admin
        .from("whatsapp_messages")
        .select("id")
        .eq("wamid", wamid)
        .eq("direction", "inbound")
        .maybeSingle();

    return !!data?.id;
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
) {
    await admin.from("whatsapp_messages").insert({
        user_id: params.userId,
        phone_number: params.normalizedPhone,
        direction: "inbound",
        message_type: params.messageType,
        content: params.content,
        wamid: params.wamid,
        status: "delivered",
    });
}
