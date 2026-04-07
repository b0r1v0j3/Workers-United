import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { normalizeUserType } from "@/lib/domain";
import { listAdminConversationSummaries } from "@/lib/messaging";
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
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("[AdminSupportInbox] Profile lookup failed:", profileError);
            return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
        }

        const normalizedUserType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        const isAdmin = normalizedUserType === "admin" || isGodModeUser(user.email);
        if (!isAdmin) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const conversations = await listAdminConversationSummaries(admin);
        return NextResponse.json({ conversations });
    } catch (error) {
        console.error("[AdminSupportInbox] GET failed:", error);
        return NextResponse.json({ error: "Failed to load support inbox." }, { status: 500 });
    }
}
