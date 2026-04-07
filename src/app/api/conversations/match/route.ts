import { NextRequest, NextResponse } from "next/server";
import type { Tables } from "@/lib/database.types";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import { checkRateLimit, standardLimiter } from "@/lib/rate-limit";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type MatchRole = "worker" | "employer";
type MatchConversationRow = Tables<"conversations">;

interface MatchConversationSummary {
    id: string;
    status: MatchConversationRow["status"];
    offerId: string | null;
    matchId: string | null;
    otherParticipantName: string;
    otherParticipantEmail: string | null;
    createdAt: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
}

function getMessagePreview(raw: string | null): string | null {
    if (!raw) {
        return null;
    }

    const collapsed = raw.replace(/\s+/g, " ").trim();
    if (!collapsed) {
        return null;
    }

    return collapsed.length > 160 ? `${collapsed.slice(0, 157)}...` : collapsed;
}

async function listMatchConversationSummaries(
    profileId: string,
    role: MatchRole
): Promise<MatchConversationSummary[]> {
    const admin = createTypedAdminClient();
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
                .map((conversation) => conversation[oppositeColumn as keyof MatchConversationRow])
                .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
    );

    const { data: oppositeProfiles, error: oppositeProfilesError } = oppositeProfileIds.length
        ? await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", oppositeProfileIds)
        : { data: [] as Tables<"profiles">[], error: null };

    if (oppositeProfilesError) {
        throw oppositeProfilesError;
    }

    const profileById = new Map((oppositeProfiles || []).map((profile) => [profile.id, profile]));

    const conversationIds = conversations.map((conversation) => conversation.id);
    const { data: messages, error: messagesError } = await admin
        .from("conversation_messages")
        .select("conversation_id, body, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

    if (messagesError) {
        throw messagesError;
    }

    const latestMessageByConversationId = new Map<string, { body: string; createdAt: string }>();
    for (const message of messages || []) {
        if (latestMessageByConversationId.has(message.conversation_id)) {
            continue;
        }

        latestMessageByConversationId.set(message.conversation_id, {
            body: message.body,
            createdAt: message.created_at,
        });
    }

    return conversations.map((conversation) => {
        const oppositeProfileId = conversation[oppositeColumn as keyof MatchConversationRow];
        const oppositeProfile = typeof oppositeProfileId === "string" ? profileById.get(oppositeProfileId) : null;
        const latestMessage = latestMessageByConversationId.get(conversation.id);

        return {
            id: conversation.id,
            status: conversation.status,
            offerId: conversation.offer_id,
            matchId: conversation.match_id,
            otherParticipantName: oppositeProfile?.full_name || oppositeProfile?.email || "Match participant",
            otherParticipantEmail: oppositeProfile?.email || null,
            createdAt: conversation.created_at,
            lastMessageAt: conversation.last_message_at || latestMessage?.createdAt || null,
            lastMessagePreview: getMessagePreview(latestMessage?.body || null),
        };
    });
}

export async function GET(request: NextRequest) {
    const blocked = checkRateLimit(request, standardLimiter);
    if (blocked) {
        return blocked;
    }

    try {
        const supabase = await createClient();
        const admin = createTypedAdminClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile, error: profileError } = await admin
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("[MatchConversations] Profile lookup failed:", profileError);
            return NextResponse.json({ error: "Failed to load profile." }, { status: 500 });
        }

        const normalizedUserType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        const isAdmin = normalizedUserType === "admin" || isGodModeUser(user.email);

        if (isAdmin) {
            return NextResponse.json({ conversations: [] });
        }

        if (normalizedUserType !== "worker" && normalizedUserType !== "employer") {
            return NextResponse.json({ error: "Match inbox is only available to workers and employers." }, { status: 403 });
        }

        const conversations = await listMatchConversationSummaries(user.id, normalizedUserType);
        return NextResponse.json({ conversations });
    } catch (error) {
        console.error("[MatchConversations] GET failed:", error);
        return NextResponse.json({ error: "Failed to load match inbox." }, { status: 500 });
    }
}
