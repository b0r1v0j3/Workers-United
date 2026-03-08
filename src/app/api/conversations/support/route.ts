import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import {
    ensureSupportConversation,
    getConversationMessages,
    getSupportAccessState,
    markConversationRead,
    type SupportConversationRole,
} from "@/lib/messaging";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { checkRateLimit, standardLimiter } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
    const blocked = checkRateLimit(request, standardLimiter);
    if (blocked) {
        return blocked;
    }

    try {
        const supabase = await createClient();
        const admin = createTypedAdminClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile, error: profileError } = await admin
            .from("profiles")
            .select("full_name, email, user_type")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("[SupportConversation] Profile lookup failed:", profileError);
            return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
        }

        const normalizedUserType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        const isAdmin = normalizedUserType === "admin" || isGodModeUser(user.email);
        if (isAdmin) {
            return NextResponse.json({ error: "Admin accounts should use /admin/inbox." }, { status: 403 });
        }

        if (!normalizedUserType || !["worker", "employer", "agency"].includes(normalizedUserType)) {
            return NextResponse.json({ error: "Messaging is not available for this account." }, { status: 403 });
        }

        const access = await getSupportAccessState(admin, user.id, normalizedUserType as SupportConversationRole);
        if (!access.allowed) {
            return NextResponse.json({
                access,
                conversation: null,
                messages: [],
            });
        }

        const { conversation, created } = await ensureSupportConversation(admin, user.id, normalizedUserType as SupportConversationRole);
        await markConversationRead(admin, conversation.id, user.id);

        if (created) {
            await logServerActivity(user.id, "support_conversation_created", "messaging", {
                role: normalizedUserType,
                conversation_id: conversation.id,
            });
        }

        const messages = await getConversationMessages(admin, conversation.id);

        return NextResponse.json({
            access,
            conversation: {
                id: conversation.id,
                status: conversation.status,
                type: conversation.type,
            },
            messages: messages.map((message) => ({
                id: message.id,
                body: message.body,
                createdAt: message.created_at,
                senderRole: message.sender_role,
                senderName: message.senderName,
                isOwn: message.sender_profile_id === user.id,
            })),
        });
    } catch (error) {
        console.error("[SupportConversation] GET failed:", error);
        return NextResponse.json({ error: "Failed to load support conversation." }, { status: 500 });
    }
}
