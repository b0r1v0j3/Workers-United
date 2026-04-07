import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/lib/database.types";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";

type AdminClient = Pick<SupabaseClient<Database>, "from">;

export type MessagingActorRole = "worker" | "employer" | "agency" | "admin";
export type SupportConversationRole = Exclude<MessagingActorRole, "admin">;
export type MatchConversationActorRole = Extract<MessagingActorRole, "worker" | "employer">;

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

export interface MatchConversationSummary {
    id: string;
    status: ConversationRow["status"];
    offerId: string | null;
    matchId: string | null;
    otherParticipantName: string;
    otherParticipantEmail: string | null;
    createdAt: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
}

const COMPLETED_PAYMENT_STATUSES = ["completed", "paid"] as const;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGE_LIST = 200;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const EXTERNAL_LINK_PATTERN = /(https?:\/\/|www\.|wa\.me\/|t\.me\/|telegram\.me\/|instagram\.com\/|facebook\.com\/|linkedin\.com\/)/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

const CONTACT_LEAKAGE_WARNING =
    "Direct contact details are blocked in match messaging. Keep communication inside Workers United.";

export class ConversationMessageBlockedError extends Error {
    constructor(message = CONTACT_LEAKAGE_WARNING) {
        super(message);
        this.name = "ConversationMessageBlockedError";
    }
}

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

function extractPhoneDigits(value: string): string {
    return value.replace(/\D/g, "");
}

export function detectContactLeakageFlags(messageBody: string): Array<"phone" | "email" | "external_link" | "off_platform_attempt"> {
    const normalized = messageBody.trim();
    if (!normalized) {
        return [];
    }

    const flags = new Set<"phone" | "email" | "external_link" | "off_platform_attempt">();

    if (EMAIL_PATTERN.test(normalized)) {
        flags.add("email");
    }

    if (EXTERNAL_LINK_PATTERN.test(normalized)) {
        flags.add("external_link");
    }

    const phoneMatches = normalized.match(PHONE_PATTERN) || [];
    const hasLikelyPhone = phoneMatches.some((candidate) => {
        const digits = extractPhoneDigits(candidate);
        return digits.length >= 8 && digits.length <= 16;
    });

    if (hasLikelyPhone) {
        flags.add("phone");
    }

    if (flags.size > 0) {
        flags.add("off_platform_attempt");
    }

    return Array.from(flags);
}

async function insertConversationFlags(
    admin: AdminClient,
    conversationId: string,
    messageId: string,
    flags: string[]
) {
    if (flags.length === 0) {
        return;
    }

    const payload = flags.map((flag) => ({
        conversation_id: conversationId,
        message_id: messageId,
        flag_type: flag,
    }));

    const { error } = await admin.from("conversation_flags").insert(payload);
    if (error) {
        throw error;
    }
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
    const leakageFlags =
        conversation.type === "match" && senderRole !== "admin" && senderRole !== "support"
            ? detectContactLeakageFlags(normalizedBody)
            : [];
    const isBlockedByLeakage = leakageFlags.length > 0;
    const messageBody = isBlockedByLeakage
        ? "[Message blocked: direct contact details are not allowed. Keep communication inside Workers United.]"
        : normalizedBody;

    const { data: insertedMessage, error: insertError } = await admin
        .from("conversation_messages")
        .insert({
            conversation_id: conversation.id,
            sender_profile_id: actorProfileId,
            sender_role: senderRole,
            message_type: "text",
            moderation_status: isBlockedByLeakage ? "blocked" : "clean",
            body: messageBody,
        })
        .select("*")
        .single();

    if (insertError) {
        throw insertError;
    }

    if (isBlockedByLeakage) {
        await insertConversationFlags(admin, conversation.id, insertedMessage.id, leakageFlags);
    }

    const conversationStatus = isBlockedByLeakage
        ? "waiting_on_support"
        : resolveConversationStatusAfterReply(conversation, senderRole);
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

    if (isBlockedByLeakage) {
        throw new ConversationMessageBlockedError();
    }

    return {
        message: insertedMessage as ConversationMessageRow,
        conversationStatus,
    };
}

async function hasCompletedConfirmationFeePaymentForOffer(
    admin: AdminClient,
    offerId: string
): Promise<boolean> {
    const { data, error } = await admin
        .from("payments")
        .select("id")
        .eq("payment_type", "confirmation_fee")
        .in("status", [...COMPLETED_PAYMENT_STATUSES])
        .contains("metadata", { offer_id: offerId })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return !!data?.id;
}

async function ensureMatchConversationParticipants(
    admin: AdminClient,
    conversationId: string,
    workerProfileId: string,
    employerProfileId: string
) {
    await ensureConversationParticipant(admin, conversationId, workerProfileId, "worker");
    await ensureConversationParticipant(admin, conversationId, employerProfileId, "employer");
}

export async function ensureMatchConversationForOffer(
    admin: AdminClient,
    params: {
        offerId: string;
        workerProfileId: string;
        createdByProfileId?: string;
    }
): Promise<ConversationRow | null> {
    const { data: offer, error: offerError } = await admin
        .from("offers")
        .select("id, status, job_request_id, worker_id")
        .eq("id", params.offerId)
        .maybeSingle();

    if (offerError) {
        throw offerError;
    }

    if (!offer || offer.status !== "accepted" || !offer.job_request_id) {
        return null;
    }

    const paymentCompleted = await hasCompletedConfirmationFeePaymentForOffer(admin, params.offerId);
    if (!paymentCompleted) {
        return null;
    }

    const { data: jobRequest, error: jobRequestError } = await admin
        .from("job_requests")
        .select("id, employer_id")
        .eq("id", offer.job_request_id)
        .maybeSingle();

    if (jobRequestError) {
        throw jobRequestError;
    }

    if (!jobRequest?.employer_id) {
        return null;
    }

    const { data: employer, error: employerError } = await admin
        .from("employers")
        .select("id, profile_id")
        .eq("id", jobRequest.employer_id)
        .maybeSingle();

    if (employerError) {
        throw employerError;
    }

    if (!employer?.profile_id) {
        return null;
    }

    const { data: existingConversation, error: existingConversationError } = await admin
        .from("conversations")
        .select("*")
        .eq("type", "match")
        .eq("offer_id", params.offerId)
        .limit(1)
        .maybeSingle();

    if (existingConversationError) {
        throw existingConversationError;
    }

    if (existingConversation) {
        if (!existingConversation.unlocked_at) {
            const { error: unlockError } = await admin
                .from("conversations")
                .update({ unlocked_at: new Date().toISOString() })
                .eq("id", existingConversation.id);

            if (unlockError) {
                throw unlockError;
            }
        }

        await ensureMatchConversationParticipants(
            admin,
            existingConversation.id,
            params.workerProfileId,
            employer.profile_id
        );
        return existingConversation as ConversationRow;
    }

    const insertedConversationPayload: TablesInsert<"conversations"> = {
        type: "match",
        status: "open",
        worker_profile_id: params.workerProfileId,
        employer_profile_id: employer.profile_id,
        offer_id: params.offerId,
        match_id: null,
        created_by_profile_id: params.createdByProfileId || params.workerProfileId,
        unlocked_at: new Date().toISOString(),
    };

    const { data: createdConversation, error: createdConversationError } = await admin
        .from("conversations")
        .insert(insertedConversationPayload)
        .select("*")
        .single();

    if (createdConversationError) {
        throw createdConversationError;
    }

    await ensureMatchConversationParticipants(
        admin,
        createdConversation.id,
        params.workerProfileId,
        employer.profile_id
    );

    return createdConversation as ConversationRow;
}

export async function listMatchConversationSummariesForActor(
    admin: AdminClient,
    profileId: string,
    role: MatchConversationActorRole
): Promise<MatchConversationSummary[]> {
    const actorColumn = role === "worker" ? "worker_profile_id" : "employer_profile_id";
    const oppositeColumn = role === "worker" ? "employer_profile_id" : "worker_profile_id";

    const { data: conversations, error: conversationError } = await admin
        .from("conversations")
        .select("*")
        .eq("type", "match")
        .eq(actorColumn, profileId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    if (conversationError) {
        throw conversationError;
    }

    if (!conversations?.length) {
        return [];
    }

    const oppositeProfileIds = Array.from(
        new Set(
            conversations
                .map((conversation) => conversation[oppositeColumn as keyof typeof conversation])
                .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
    );

    const { data: oppositeProfiles, error: oppositeProfilesError } = oppositeProfileIds.length
        ? await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", oppositeProfileIds)
        : { data: [] as ProfileRow[], error: null };

    if (oppositeProfilesError) {
        throw oppositeProfilesError;
    }

    const profileMap = new Map((oppositeProfiles || []).map((profile) => [profile.id, profile]));

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
        const oppositeProfileId = conversation[oppositeColumn as keyof typeof conversation];
        const oppositeProfile = typeof oppositeProfileId === "string"
            ? profileMap.get(oppositeProfileId)
            : null;
        const latestMessage = latestMessageMap.get(conversation.id);

        return {
            id: conversation.id,
            status: conversation.status,
            offerId: conversation.offer_id,
            matchId: conversation.match_id,
            otherParticipantName: oppositeProfile?.full_name || oppositeProfile?.email || "Match participant",
            otherParticipantEmail: oppositeProfile?.email || null,
            createdAt: conversation.created_at,
            lastMessageAt: conversation.last_message_at || latestMessage?.created_at || null,
            lastMessagePreview: latestMessage ? getMessagePreview(latestMessage.body) : null,
        };
    });
}

async function listConversationSummariesByTypes(
    admin: AdminClient,
    types: ConversationRow["type"][]
): Promise<SupportConversationSummary[]> {
    const { data: conversations, error: conversationError } = await admin
        .from("conversations")
        .select("*")
        .in("type", types)
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

export async function listSupportConversationSummaries(
    admin: AdminClient
): Promise<SupportConversationSummary[]> {
    return listConversationSummariesByTypes(admin, ["support"]);
}

export async function listAdminConversationSummaries(
    admin: AdminClient
): Promise<SupportConversationSummary[]> {
    return listConversationSummariesByTypes(admin, ["support", "match"]);
}
