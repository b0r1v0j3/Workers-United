import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

        // 1. Delete from storage (documents bucket)
        const { data: files } = await adminClient.storage
            .from("documents")
            .list(userId);

        if (files && files.length > 0) {
            const filePaths = files.map(f => `${userId}/${f.name}`);
            await adminClient.storage.from("documents").remove(filePaths);
        }

        // 2. Delete candidate_documents
        await adminClient
            .from("candidate_documents")
            .delete()
            .eq("user_id", userId);

        // 3. Delete signatures
        await adminClient
            .from("signatures")
            .delete()
            .eq("user_id", userId);

        // 4. Delete candidates
        await adminClient
            .from("candidates")
            .delete()
            .eq("profile_id", userId);

        // 5. Delete employers (if employer)
        await adminClient
            .from("employers")
            .delete()
            .eq("profile_id", userId);

        // 6. Delete profiles
        await adminClient
            .from("profiles")
            .delete()
            .eq("id", userId);

        // 7. Sign out user first
        await supabase.auth.signOut();

        // 8. Delete auth user
        const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

        if (authError) {
            console.error("Auth delete error:", authError);
            return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Account deleted successfully" });

    } catch (error: any) {
        console.error("Delete account error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
