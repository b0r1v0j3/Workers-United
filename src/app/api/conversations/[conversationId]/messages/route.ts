import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import {
    appendConversationMessage,
    getConversationAccess,
    getConversationMessages,
    getSupportAccessState,
    markConversationRead,
    normalizeMessageBody,
    type SupportConversationRole,
} from "@/lib/messaging";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { checkRateLimit, standardLimiter } from "@/lib/rate-limit";

interface RouteContext {
    params: Promise<{ conversationId: string }>;
}

async function getActorContext(admin: ReturnType<typeof createTypedAdminClient>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { user: null, profile: null, role: null, isAdmin: false };
    }

    const { data: profile } = await admin
        .from("profiles")
        .select("full_name, email, user_type")
        .eq("id", user.id)
        .maybeSingle();

    const role = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
    const isAdmin = role === "admin" || isGodModeUser(user.email);

    return {
        user,
        profile,
        role,
        isAdmin,
    };
}

export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { conversationId } = await context.params;
        const admin = createTypedAdminClient();
        const actor = await getActorContext(admin);

        if (!actor.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!actor.role && !actor.isAdmin) {
            return NextResponse.json({ error: "Messaging is not available for this account." }, { status: 403 });
        }

        const access = await getConversationAccess(
            admin,
            conversationId,
            actor.user.id,
            (actor.role || "worker") as SupportConversationRole,
            actor.isAdmin
        );

        if (!access) {
            return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
        }

        if (!actor.isAdmin) {
            await markConversationRead(admin, conversationId, actor.user.id);
        }

        const messages = await getConversationMessages(admin, conversationId);

        return NextResponse.json({
            conversation: {
                id: access.conversation.id,
                type: access.conversation.type,
                status: access.conversation.status,
            },
            canWrite: access.canWrite,
            messages: messages.map((message) => ({
                id: message.id,
                body: message.body,
                createdAt: message.created_at,
                senderRole: message.sender_role,
                senderName: message.senderName,
                isOwn: message.sender_profile_id === actor.user?.id,
            })),
        });
    } catch (error) {
        console.error("[ConversationMessages] GET failed:", error);
        return NextResponse.json({ error: "Failed to load conversation messages." }, { status: 500 });
    }
}

export async function POST(request: NextRequest, context: RouteContext) {
    const blocked = checkRateLimit(request, standardLimiter);
    if (blocked) {
        return blocked;
    }

    try {
        const { conversationId } = await context.params;
        const admin = createTypedAdminClient();
        const actor = await getActorContext(admin);

        if (!actor.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!actor.role && !actor.isAdmin) {
            return NextResponse.json({ error: "Messaging is not available for this account." }, { status: 403 });
        }

        const access = await getConversationAccess(
            admin,
            conversationId,
            actor.user.id,
            (actor.role || "worker") as SupportConversationRole,
            actor.isAdmin
        );

        if (!access) {
            return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
        }

        if (!access.canWrite) {
            return NextResponse.json({ error: "Messaging is read-only for this thread." }, { status: 403 });
        }

        if (!actor.isAdmin && access.conversation.type === "support") {
            const supportAccess = await getSupportAccessState(
                admin,
                actor.user.id,
                (actor.role || "worker") as SupportConversationRole
            );

            if (!supportAccess.allowed) {
                return NextResponse.json({ error: supportAccess.reason || "Support is locked." }, { status: 403 });
            }
        }

        const body = await request.json() as { body?: unknown };
        const normalizedBody = normalizeMessageBody(body.body);
        if (!normalizedBody) {
            return NextResponse.json({ error: "Message body is required." }, { status: 400 });
        }

        const { message, conversationStatus } = await appendConversationMessage(
            admin,
            access.conversation,
            actor.user.id,
            actor.isAdmin ? "admin" : ((actor.role || "worker") as SupportConversationRole),
            normalizedBody
        );

        await logServerActivity(actor.user.id, actor.isAdmin ? "support_reply_sent" : "support_message_sent", "messaging", {
            conversation_id: access.conversation.id,
            conversation_type: access.conversation.type,
            sender_role: actor.isAdmin ? "admin" : actor.role,
        });

        return NextResponse.json({
            conversationStatus,
            message: {
                id: message.id,
                body: message.body,
                createdAt: message.created_at,
                senderRole: message.sender_role,
                senderName: actor.profile?.full_name || actor.profile?.email || actor.user.email || (actor.isAdmin ? "Workers United" : "User"),
                isOwn: true,
            },
        });
    } catch (error) {
        console.error("[ConversationMessages] POST failed:", error);
        const message = error instanceof Error ? error.message : "Failed to send message.";
        const status = message === "Message body is required." ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
