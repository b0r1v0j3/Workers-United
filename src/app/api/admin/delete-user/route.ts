import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";

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
            .select("role")
            .eq("id", user.id)
            .single();

        if (profile?.role !== 'admin' && !isGodModeUser(user.email)) {
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

        // 1. Delete auth user FIRST (before DB rows that may have FK constraints)
        const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

        if (authError) {
            console.error("Auth delete error:", authError);
            return NextResponse.json({ error: `Failed to delete auth user: ${authError.message}` }, { status: 500 });
        }

        // 2. Delete from storage (documents bucket)
        const { data: files } = await adminClient.storage
            .from("documents")
            .list(userId);

        if (files && files.length > 0) {
            const filePaths = files.map(f => `${userId}/${f.name}`);
            await adminClient.storage.from("documents").remove(filePaths);
        }

        // 3. Delete candidate_documents
        await adminClient
            .from("candidate_documents")
            .delete()
            .eq("user_id", userId);

        // 4. Delete signatures
        await adminClient
            .from("signatures")
            .delete()
            .eq("user_id", userId);

        // 5. Delete candidates
        await adminClient
            .from("candidates")
            .delete()
            .eq("profile_id", userId);

        // 6. Delete profiles
        await adminClient
            .from("profiles")
            .delete()
            .eq("id", userId);

        return NextResponse.json({ success: true, message: "User deleted completely" });

    } catch (error: any) {
        console.error("Delete user error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
