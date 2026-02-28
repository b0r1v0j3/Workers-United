import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { deleteUserData } from "@/lib/user-management";

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check if user is admin
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== 'admin' && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { userId } = await request.json();
        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        // Prevent self-deletion
        if (userId === user.id) {
            return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
        }

        const adminClient = createAdminClient();

        // Audit log
        console.log(`[Admin Delete] Admin ${user.email} deleting user ${userId}`);

        // Delete all user data using shared function
        await deleteUserData(adminClient, userId);

        return NextResponse.json({ success: true, message: "User deleted completely" });

    } catch (error: any) {
        console.error("Delete user error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
