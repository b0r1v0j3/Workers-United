import { SupabaseClient } from "@supabase/supabase-js";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";

// ─── Shared User Data Deletion ──────────────────────────────────────────────
// Used by both admin/delete-user and account/delete routes
// Deletes ALL user data: storage, documents, signatures, matches, payments, etc.

export async function deleteUserData(adminClient: SupabaseClient, userId: string) {
    // 1. Delete from storage (documents bucket) — supports nested folders
    const docTypes = ['passport', 'biometric_photo', 'diploma'];
    for (const docType of docTypes) {
        const { data: files } = await adminClient.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .list(`${userId}/${docType}`);

        if (files && files.length > 0) {
            const filePaths = files.map(f => `${userId}/${docType}/${f.name}`);
            await adminClient.storage.from(WORKER_DOCUMENTS_BUCKET).remove(filePaths);
        }
    }

    // 2. Delete worker document records
    await adminClient
        .from("worker_documents")
        .delete()
        .eq("user_id", userId);

    // 3. Delete signatures
    await adminClient
        .from("signatures")
        .delete()
        .eq("user_id", userId);

    // 4. Get the canonical worker record ID for cascade cleanup
    const { data: workerRecord } = await adminClient
        .from("worker_onboarding")
        .select("id")
        .eq("profile_id", userId)
        .single();

    if (workerRecord) {
        // 5a. Delete contract_data via matches
        const { data: matches } = await adminClient
            .from("matches")
            .select("id")
            .eq("worker_id", workerRecord.id);

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
            .eq("worker_id", workerRecord.id);

        // 5c. Delete matches
        await adminClient
            .from("matches")
            .delete()
            .eq("worker_id", workerRecord.id);
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

    // 9. Delete worker records
    await adminClient
        .from("worker_onboarding")
        .delete()
        .eq("profile_id", userId);

    // 10. Delete employers (if employer)
    await adminClient
        .from("employers")
        .delete()
        .eq("profile_id", userId);

    // 11. Delete agencies (if agency account)
    try {
        await adminClient
            .from("agencies")
            .delete()
            .eq("profile_id", userId);
    } catch (error) {
        console.warn("[deleteUserData] Agency cleanup skipped:", error);
    }

    // 12. Delete profiles
    await adminClient
        .from("profiles")
        .delete()
        .eq("id", userId);

    // 13. Delete auth user LAST (after all DB/storage cleanup)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) {
        throw new Error(`Failed to delete auth user: ${authError.message}`);
    }
}
