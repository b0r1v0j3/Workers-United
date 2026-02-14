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

        // 1. Delete from storage (documents bucket) — supports nested folders
        const docTypes = ['passport', 'biometric_photo', 'diploma'];
        for (const docType of docTypes) {
            const { data: files } = await adminClient.storage
                .from("candidate-docs")
                .list(`${userId}/${docType}`);

            if (files && files.length > 0) {
                const filePaths = files.map(f => `${userId}/${docType}/${f.name}`);
                await adminClient.storage.from("candidate-docs").remove(filePaths);
            }
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

        // 7. Delete auth user LAST (after all DB/storage cleanup)
        const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

        if (authError) {
            console.error("Auth delete error:", authError);
            return NextResponse.json({ error: `Failed to delete auth user: ${authError.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "User deleted completely" });

    } catch (error: any) {
        console.error("Delete user error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
