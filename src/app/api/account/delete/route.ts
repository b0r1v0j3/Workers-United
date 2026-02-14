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

        // 1. Sign out user first
        await supabase.auth.signOut();

        // 2. Delete from storage (documents bucket) — supports nested folders
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

        // 6. Delete employers (if employer)
        await adminClient
            .from("employers")
            .delete()
            .eq("profile_id", userId);

        // 7. Delete profiles
        await adminClient
            .from("profiles")
            .delete()
            .eq("id", userId);

        // 8. Delete auth user LAST (after all DB/storage cleanup)
        const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

        if (authError) {
            console.error("Auth delete error:", authError);
            return NextResponse.json({ error: `Failed to delete account: ${authError.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Account deleted successfully" });

    } catch (error: any) {
        console.error("Delete account error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
