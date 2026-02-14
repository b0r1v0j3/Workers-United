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

        // 5. Get candidate ID for cascade cleanup
        const { data: candidate } = await adminClient
            .from("candidates")
            .select("id")
            .eq("profile_id", userId)
            .single();

        if (candidate) {
            // 5a. Delete contract_data via matches
            const { data: matches } = await adminClient
                .from("matches")
                .select("id")
                .eq("candidate_id", candidate.id);

            if (matches && matches.length > 0) {
                const matchIds = matches.map(m => m.id);
                await adminClient
                    .from("contract_data")
                    .delete()
                    .in("match_id", matchIds);
            }

            // 5b. Delete offers
            await adminClient
                .from("offers")
                .delete()
                .eq("candidate_id", candidate.id);

            // 5c. Delete matches
            await adminClient
                .from("matches")
                .delete()
                .eq("candidate_id", candidate.id);
        }

        // 6. Delete payments
        await adminClient
            .from("payments")
            .delete()
            .eq("user_id", userId);

        // 7. Delete email_queue
        await adminClient
            .from("email_queue")
            .delete()
            .eq("user_id", userId);

        // 8. Delete whatsapp_messages
        await adminClient
            .from("whatsapp_messages")
            .delete()
            .eq("user_id", userId);

        // 9. Delete candidates
        await adminClient
            .from("candidates")
            .delete()
            .eq("profile_id", userId);

        // 10. Delete employers (if employer)
        await adminClient
            .from("employers")
            .delete()
            .eq("profile_id", userId);

        // 11. Delete profiles
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
