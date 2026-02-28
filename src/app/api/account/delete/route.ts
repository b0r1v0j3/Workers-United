import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUserData } from "@/lib/user-management";

export async function DELETE() {
    try {
        const supabase = await createClient();

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = user.id;
        const adminClient = createAdminClient();

        // Delete all user data using shared function
        // NOTE: signOut happens AFTER deletion (BUG-001 fix)
        await deleteUserData(adminClient, userId);

        // Sign out LAST — after all data is deleted
        await supabase.auth.signOut();

        return NextResponse.json({ success: true, message: "Account deleted successfully" });

    } catch (error: any) {
        console.error("Delete account error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
