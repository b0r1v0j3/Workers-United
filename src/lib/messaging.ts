import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/lib/database.types";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";

type AdminClient = SupabaseClient<Database>;

export type MessagingActorRole = "worker" | "employer" | "agency" | "admin";
export type SupportConversationRole = Exclude<MessagingActorRole, "admin">;

export type ConversationRow = Tables<"conversations">;
export type ConversationMessageRow = Tables<"conversation_messages">;
export type ConversationParticipantRow = Tables<"conversation_participants">;
export type ProfileRow = Tables<"profiles">;

export interface SupportAccessState {
    allowed: boolean;
    reason: string | null;
    unlockRequirement: "entry_fee" | null;
}

export interface EnsuredSupportConversationResult {
    conversation: ConversationRow;
    created: boolean;
}

export interface ConversationMessageWithSender extends ConversationMessageRow {
    senderName: string;
    senderEmail: string | null;
}

export interface SupportConversationSummary {
    id: string;
    type: ConversationRow["type"];
    status: ConversationRow["status"];
    participantRole: SupportConversationRole;
    participantProfileId: string | null;
    participantName: string;
    participantEmail: string | null;
    createdAt: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
}

const COMPLETED_PAYMENT_STATUSES = ["completed", "paid"] as const;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGE_LIST = 200;

function getSupportActorColumn(role: SupportConversationRole): "worker_profile_id" | "employer_profile_id" | "agency_profile_id" {
    switch (role) {
        case "worker":
            return "worker_profile_id";
        case "employer":
            return "employer_profile_id";
        case "agency":
            return "agency_profile_id";
    }
}

function getParticipantRoleLabel(role: SupportConversationRole): ConversationParticipantRow["role_in_thread"] {
    return role;
}

export function getSenderRole(role: MessagingActorRole): ConversationMessageRow["sender_role"] {
    return role === "admin" ? "admin" : role;
}

export function normalizeMessageBody(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return null;
    }

    return normalized.slice(0, MAX_MESSAGE_LENGTH);
}

function getConversationParticipantRole(conversation: ConversationRow): SupportConversationRole {
    if (conversation.worker_profile_id) {
        return "worker";
    }

    if (conversation.employer_profile_id) {
        return "employer";
    }

    return "agency";
}

function getConversationParticipantProfileId(conversation: ConversationRow): string | null {
    return conversation.worker_profile_id || conversation.employer_profile_id || conversation.agency_profile_id || null;
}

function getMessagePreview(body: string): string {
    const singleLine = body.replace(/\s+/g, " ").trim();
    return singleLine.length > 120 ? `${singleLine.slice(0, 117)}...` : singleLine;
}

function humanizeSenderRole(role: ConversationMessageRow["sender_role"]): string {
    switch (role) {
        case "admin":
        case "support":
            return "Workers United";
        case "worker":
            return "Worker";
        case "employer":
            return "Employer";
        case "agency":
            return "Agency";
        case "system":
            return "System";
        default:
            return "Message";
    }
}

async function ensureConversationParticipant(
    admin: AdminClient,
    conversationId: string,
    profileId: string,
    role: SupportConversationRole
) {
    const { error } = await admin.from("conversation_participants").upsert(
        {
            conversation_id: conversationId,
            profile_id: profileId,
            role_in_thread: getParticipantRoleLabel(role),
            can_write: true,
        },
        {
            onConflict: "conversation_id,profile_id",
        }
    );

    if (error) {
        throw error;
    }
}

async function findExistingSupportConversation(
    admin: AdminClient,
    profileId: string,
    role: SupportConversationRole
): Promise<ConversationRow | null> {
    const actorColumn = getSupportActorColumn(role);
    const { data, error } = await admin
        .from("conversations")
        .select("*")
        .eq("type", "support")
        .eq(actorColumn, profileId)
        .order("created_at", { ascending: true })
        .limit(1);

    if (error) {
        throw error;
    }

    return (data?.[0] as ConversationRow | undefined) ?? null;
}

function buildSupportConversationInsert(
    profileId: string,
    role: SupportConversationRole
): TablesInsert<"conversations"> {
    const base: TablesInsert<"conversations"> = {
        type: "support",
        status: "open",
        created_by_profile_id: profileId,
        unlocked_at: new Date().toISOString(),
    };

    if (role === "worker") {
        base.worker_profile_id = profileId;
    } else if (role === "employer") {
        base.employer_profile_id = profileId;
    } else {
        base.agency_profile_id = profileId;
    }

    return base;
}

export async function getSupportAccessState(
    admin: AdminClient,
    profileId: string,
    role: SupportConversationRole
): Promise<SupportAccessState> {
    if (role !== "worker") {
        return { allowed: true, reason: null, unlockRequirement: null };
    }

    const [
        { data: workerRecord, error: workerRecordError },
        { data: completedPayment, error: paymentError },
    ] = await Promise.all([
        loadCanonicalWorkerRecord(admin, profileId, "id, entry_fee_paid, job_search_active, queue_joined_at, status, updated_at"),
        admin
            .from("payments")
            .select("id")
            .eq("payment_type", "entry_fee")
            .in("status", [...COMPLETED_PAYMENT_STATUSES])
            .or(`user_id.eq.${profileId},profile_id.eq.${profileId}`)
            .limit(1)
            .maybeSingle(),
    ]);

    if (workerRecordError) {
        throw workerRecordError;
    }

    if (paymentError) {
        throw paymentError;
    }

    const unlocked = Boolean(
        workerRecord?.entry_fee_paid
        || workerRecord?.job_search_active
        || workerRecord?.queue_joined_at
        || isPostEntryFeeWorkerStatus(workerRecord?.status)
        || completedPayment?.id
    );
    if (unlocked) {
        return { allowed: true, reason: null, unlockRequirement: "entry_fee" };
    }

    return {
        allowed: false,
        reason: "Support unlocks after your profile and required documents are complete, admin approval is done, and the $9 Job Finder checkout is paid.",
        unlockRequirement: "entry_fee",
    };
}

export async function ensureSupportConversation(
    admin: AdminClient,
    profileId: string,
    role: SupportConversationRole
): Promise<EnsuredSupportConversationResult> {
    const existingConversation = await findExistingSupportConversation(admin, profileId, role);
    if (existingConversation) {
        await ensureConversationParticipant(admin, existingConversation.id, profileId, role);
        return { conversation: existingConversation, created: false };
    }

    const { data: createdConversation, error: createError } = await admin
        .from("conversations")
        .insert(buildSupportConversationInsert(profileId, role))
        .select("*")
        .single();

    if (createError) {
        throw createError;
    }

    await ensureConversationParticipant(admin, createdConversation.id, profileId, role);
    return { conversation: createdConversation as ConversationRow, created: true };
}

export async function getConversationById(
    admin: AdminClient,
    conversationId: string
): Promise<ConversationRow | null> {
    const { data, error } = await admin
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (data as ConversationRow | null) ?? null;
}

export async function getConversationAccess(
    admin: AdminClient,
    conversationId: string,
    actorProfileId: string,
    role: MessagingActorRole,
    isAdmin = false
): Promise<{ conversation: ConversationRow; canWrite: boolean } | null> {
    const conversation = await getConversationById(admin, conversationId);
    if (!conversation) {
        return null;
    }

    if (isAdmin || role === "admin") {
        return { conversation, canWrite: true };
    }

    const { data: participant, error: participantError } = await admin
        .from("conversation_participants")
        .select("can_write, role_in_thread")
        .eq("conversation_id", conversationId)
        .eq("profile_id", actorProfileId)
        .maybeSingle();

    if (participantError) {
        throw participantError;
    }

    if (participant) {
        return { conversation, canWrite: participant.can_write };
    }

    if (conversation.type === "support") {
        const participantProfileId = getConversationParticipantProfileId(conversation);
        if (participantProfileId === actorProfileId) {
            await ensureConversationParticipant(admin, conversation.id, actorProfileId, role as SupportConversationRole);
            return { conversation, canWrite: true };
        }
    }

    return null;
}

export async function markConversationRead(
    admin: AdminClient,
    conversationId: string,
    actorProfileId: string
) {
    const { error } = await admin
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("profile_id", actorProfileId);

    if (error) {
        throw error;
    }
}

export async function getConversationMessages(
    admin: AdminClient,
    conversationId: string
): Promise<ConversationMessageWithSender[]> {
    const { data: messages, error: messageError } = await admin
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(MAX_MESSAGE_LIST);

    if (messageError) {
        throw messageError;
    }

    if (!messages?.length) {
        return [];
    }

    const senderIds = Array.from(new Set(messages.map((message) => message.sender_profile_id)));
    const { data: profiles, error: profileError } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", senderIds);

    if (profileError) {
        throw profileError;
    }

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return [...messages]
        .reverse()
        .map((message) => {
            const senderProfile = profileMap.get(message.sender_profile_id);
            return {
                ...message,
                senderName: senderProfile?.full_name || senderProfile?.email || humanizeSenderRole(message.sender_role),
                senderEmail: senderProfile?.email || null,
            };
        });
}

function resolveConversationStatusAfterReply(
    conversation: ConversationRow,
    senderRole: ConversationMessageRow["sender_role"]
): ConversationRow["status"] {
    if (senderRole === "admin" || senderRole === "support") {
        if (conversation.worker_profile_id) {
            return "waiting_on_worker";
        }

        if (conversation.employer_profile_id) {
            return "waiting_on_employer";
        }

        return "open";
    }

    return "waiting_on_support";
}

export async function appendConversationMessage(
    admin: AdminClient,
    conversation: ConversationRow,
    actorProfileId: string,
    role: MessagingActorRole,
    body: unknown
): Promise<{ message: ConversationMessageRow; conversationStatus: ConversationRow["status"] }> {
    const normalizedBody = normalizeMessageBody(body);
    if (!normalizedBody) {
        throw new Error("Message body is required.");
    }

    const senderRole = getSenderRole(role);
    const { data: insertedMessage, error: insertError } = await admin
        .from("conversation_messages")
        .insert({
            conversation_id: conversation.id,
            sender_profile_id: actorProfileId,
            sender_role: senderRole,
            message_type: "text",
            moderation_status: "clean",
            body: normalizedBody,
        })
        .select("*")
        .single();

    if (insertError) {
        throw insertError;
    }

    const conversationStatus = resolveConversationStatusAfterReply(conversation, senderRole);
    const timestamp = insertedMessage.created_at || new Date().toISOString();
    const { error: conversationUpdateError } = await admin
        .from("conversations")
        .update({
            status: conversationStatus,
            last_message_at: timestamp,
            last_message_by_profile_id: actorProfileId,
        })
        .eq("id", conversation.id);

    if (conversationUpdateError) {
        throw conversationUpdateError;
    }

    if (role !== "admin") {
        await markConversationRead(admin, conversation.id, actorProfileId);
    }

    return {
        message: insertedMessage as ConversationMessageRow,
        conversationStatus,
    };
}

export async function listSupportConversationSummaries(
    admin: AdminClient
): Promise<SupportConversationSummary[]> {
    const { data: conversations, error: conversationError } = await admin
        .from("conversations")
        .select("*")
        .eq("type", "support")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    if (conversationError) {
        throw conversationError;
    }

    if (!conversations?.length) {
        return [];
    }

    const participantProfileIds = Array.from(
        new Set(
            conversations
                .map((conversation) => getConversationParticipantProfileId(conversation as ConversationRow))
                .filter((value): value is string => Boolean(value))
        )
    );

    const { data: participantProfiles, error: participantProfileError } = participantProfileIds.length
        ? await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", participantProfileIds)
        : { data: [] as ProfileRow[], error: null };

    if (participantProfileError) {
        throw participantProfileError;
    }

    const profileMap = new Map((participantProfiles || []).map((profile) => [profile.id, profile]));

    const conversationIds = conversations.map((conversation) => conversation.id);
    const { data: allMessages, error: allMessagesError } = await admin
        .from("conversation_messages")
        .select("conversation_id, body, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

    if (allMessagesError) {
        throw allMessagesError;
    }

    const latestMessageMap = new Map<string, { body: string; created_at: string }>();
    for (const message of allMessages || []) {
        if (!latestMessageMap.has(message.conversation_id)) {
            latestMessageMap.set(message.conversation_id, {
                body: message.body,
                created_at: message.created_at,
            });
        }
    }

    return conversations.map((conversation) => {
        const typedConversation = conversation as ConversationRow;
        const participantRole = getConversationParticipantRole(typedConversation);
        const participantProfileId = getConversationParticipantProfileId(typedConversation);
        const participantProfile = participantProfileId ? profileMap.get(participantProfileId) : null;
        const latestMessage = latestMessageMap.get(typedConversation.id);

        return {
            id: typedConversation.id,
            type: typedConversation.type,
            status: typedConversation.status,
            participantRole,
            participantProfileId,
            participantName: participantProfile?.full_name || participantProfile?.email || "Unknown participant",
            participantEmail: participantProfile?.email || null,
            createdAt: typedConversation.created_at,
            lastMessageAt: typedConversation.last_message_at || latestMessage?.created_at || null,
            lastMessagePreview: latestMessage ? getMessagePreview(latestMessage.body) : null,
        };
    });
}
