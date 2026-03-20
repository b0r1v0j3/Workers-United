import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { appendConversationMessage, ensureSupportConversation } from "@/lib/messaging";
import { filterSafeWhatsAppBrainMemory } from "@/lib/whatsapp-brain";
import { humanizeWhatsAppHandoffReason } from "@/lib/whatsapp-quality";

type AdminDbClient = SupabaseClient<Database>;

export interface WhatsAppHistoryMessage {
    direction: string;
    content: string | null;
    created_at?: string | null;
    status?: string | null;
    message_type?: string | null;
    template_name?: string | null;
}

export interface WhatsAppBrainMemoryEntry {
    category: string;
    content: string;
    confidence: number;
}

export function truncateWhatsAppPreview(value: string, maxLength = 240): string {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxLength - 3)}...`;
}

export function formatWhatsAppHistory(
    historyMessages: WhatsAppHistoryMessage[],
    limit: number
): string {
    const trimmed = historyMessages.slice(-limit);
    if (trimmed.length === 0) {
        return "(No recent history)";
    }

    return trimmed
        .map((message) => `${message.direction === "inbound" ? "User" : "Assistant"}: ${(message.content || "").trim()}`)
        .join("\n");
}

export async function loadWhatsAppConversationHistory(
    admin: AdminDbClient,
    normalizedPhone: string,
    limit: number
): Promise<WhatsAppHistoryMessage[]> {
    try {
        const scanLimit = Math.max(limit * 3, limit + 12);
        const { data } = await admin
            .from("whatsapp_messages")
            .select("direction, content, created_at, status, message_type, template_name")
            .eq("phone_number", normalizedPhone)
            .order("created_at", { ascending: false })
            .limit(scanLimit);

        return (data || [])
            .filter((message) => {
                const failedOutbound = message.direction === "outbound" && message.status === "failed";
                const outboundTemplate = message.direction === "outbound"
                    && (message.message_type === "template" || !!message.template_name);
                return !(failedOutbound || outboundTemplate);
            })
            .reverse()
            .slice(-limit);
    } catch {
        return [];
    }
}

export async function loadWhatsAppBrainMemory(
    admin: AdminDbClient,
    limit: number
): Promise<WhatsAppBrainMemoryEntry[]> {
    try {
        const { data } = await admin
            .from("brain_memory")
            .select("category, content, confidence")
            .order("confidence", { ascending: false })
            .limit(limit);
        return filterSafeWhatsAppBrainMemory((data || []).map((entry) => ({
            category: entry.category,
            content: entry.content,
            confidence: entry.confidence ?? 0,
        })));
    } catch {
        return [];
    }
}

export async function createWhatsAppAutoHandoff(params: {
    admin: AdminDbClient;
    profileId: string;
    normalizedPhone: string;
    latestMessage: string;
    language: string;
    reason: string;
    snippets: string[];
}) {
    const { conversation } = await ensureSupportConversation(params.admin, params.profileId, "worker");
    const summaryLines = [
        "[WhatsApp auto-handoff]",
        `Reason: ${humanizeWhatsAppHandoffReason(params.reason)}`,
        `Phone: ${params.normalizedPhone}`,
        `Latest user message: ${truncateWhatsAppPreview(params.latestMessage, 500)}`,
    ];

    if (params.snippets.length > 0) {
        summaryLines.push(
            "Recent issue snippets:",
            ...params.snippets.map((snippet) => `- ${truncateWhatsAppPreview(snippet, 180)}`)
        );
    }

    const { message } = await appendConversationMessage(
        params.admin,
        conversation,
        params.profileId,
        "worker",
        summaryLines.join("\n")
    );

    await params.admin.from("conversation_flags").insert({
        conversation_id: conversation.id,
        message_id: message.id,
        flag_type: "whatsapp_auto_handoff",
    });

    await logServerActivity(
        params.profileId,
        "whatsapp_auto_handoff_created",
        "messaging",
        {
            phone: params.normalizedPhone,
            reason: params.reason,
            preview: truncateWhatsAppPreview(params.latestMessage),
            conversation_id: conversation.id,
            language: params.language,
        },
        "warning"
    );

    return conversation.id;
}
