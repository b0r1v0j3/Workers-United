import { SupabaseClient } from "@supabase/supabase-js";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";

// ─── Shared User Data Deletion ──────────────────────────────────────────────
// Used by both admin/delete-user and account/delete routes
// Deletes ALL user data: storage, documents, signatures, matches, payments, etc.

async function assertNoSupabaseError(
    step: string,
    operation: PromiseLike<{ error: { message: string } | null }>
) {
    const { error } = await operation;

    if (error) {
        throw new Error(`[deleteUserData] ${step}: ${error.message}`);
    }
}

export async function deleteUserData(adminClient: SupabaseClient, userId: string) {
    const { data: workerDocuments, error: workerDocumentsError } = await adminClient
        .from("worker_documents")
        .select("storage_path")
        .eq("user_id", userId);

    if (workerDocumentsError) {
        throw workerDocumentsError;
    }

    // 1. Delete document files referenced by DB first, so path mismatches do not leave orphans behind.
    const referencedStoragePaths = Array.from(
        new Set(
            (workerDocuments || [])
                .map((document) => document.storage_path?.trim())
                .filter((storagePath): storagePath is string => Boolean(storagePath))
        )
    );

    if (referencedStoragePaths.length > 0) {
        const { error: referencedRemoveError } = await adminClient.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .remove(referencedStoragePaths);

        if (referencedRemoveError) {
            console.warn("[deleteUserData] Referenced document cleanup failed:", referencedRemoveError);
        }
    }

    // 1b. Delete any legacy files that still live under the user folder.
    const docTypes = ['passport', 'biometric_photo', 'diploma'];
    for (const docType of docTypes) {
        const { data: files } = await adminClient.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .list(`${userId}/${docType}`);

        if (files && files.length > 0) {
            const filePaths = files.map(f => `${userId}/${docType}/${f.name}`);
            const { error: legacyRemoveError } = await adminClient.storage
                .from(WORKER_DOCUMENTS_BUCKET)
                .remove(filePaths);

            if (legacyRemoveError) {
                console.warn("[deleteUserData] Legacy folder cleanup failed:", legacyRemoveError);
            }
        }
    }

    // 2. Resolve worker/employer dependencies before deleting core rows.
    const { data: workerRows, error: workerRowsError } = await adminClient
        .from("worker_onboarding")
        .select("id")
        .eq("profile_id", userId);

    if (workerRowsError) {
        throw workerRowsError;
    }

    const workerRecordId = workerRows?.[0]?.id ?? null;

    const { data: employerRows, error: employerRowsError } = await adminClient
        .from("employers")
        .select("id")
        .eq("profile_id", userId);

    if (employerRowsError) {
        throw employerRowsError;
    }

    const employerIds = Array.from(
        new Set(
            (employerRows || [])
                .map((row) => row.id)
                .filter((id): id is string => Boolean(id))
        )
    );

    const workerMatchQuery = workerRecordId
        ? await adminClient
            .from("matches")
            .select("id")
            .eq("worker_id", workerRecordId)
        : { data: [], error: null };

    if (workerMatchQuery.error) {
        throw workerMatchQuery.error;
    }

    const workerMatchIds = Array.from(
        new Set(
            (workerMatchQuery.data || [])
                .map((row) => row.id)
                .filter((id): id is string => Boolean(id))
        )
    );

    const employerMatchQuery = employerIds.length > 0
        ? await adminClient
            .from("matches")
            .select("id")
            .in("employer_id", employerIds)
        : { data: [], error: null };

    if (employerMatchQuery.error) {
        throw employerMatchQuery.error;
    }

    const employerMatchIds = Array.from(
        new Set(
            (employerMatchQuery.data || [])
                .map((row) => row.id)
                .filter((id): id is string => Boolean(id))
        )
    );

    const jobRequestQuery = employerIds.length > 0
        ? await adminClient
            .from("job_requests")
            .select("id")
            .in("employer_id", employerIds)
        : { data: [], error: null };

    if (jobRequestQuery.error) {
        throw jobRequestQuery.error;
    }

    const jobRequestIds = Array.from(
        new Set(
            (jobRequestQuery.data || [])
                .map((row) => row.id)
                .filter((id): id is string => Boolean(id))
        )
    );

    const workerOfferQuery = workerRecordId
        ? await adminClient
            .from("offers")
            .select("id")
            .eq("worker_id", workerRecordId)
        : { data: [], error: null };

    if (workerOfferQuery.error) {
        throw workerOfferQuery.error;
    }

    const employerOfferQuery = jobRequestIds.length > 0
        ? await adminClient
            .from("offers")
            .select("id")
            .in("job_request_id", jobRequestIds)
        : { data: [], error: null };

    if (employerOfferQuery.error) {
        throw employerOfferQuery.error;
    }

    const offerIds = Array.from(
        new Set(
            [...(workerOfferQuery.data || []), ...(employerOfferQuery.data || [])]
                .map((row) => row.id)
                .filter((id): id is string => Boolean(id))
        )
    );

    const matchIds = Array.from(new Set([...workerMatchIds, ...employerMatchIds]));

    const directConversationQuery = await adminClient
        .from("conversations")
        .select("id")
        .or([
            `worker_profile_id.eq.${userId}`,
            `employer_profile_id.eq.${userId}`,
            `agency_profile_id.eq.${userId}`,
            `created_by_profile_id.eq.${userId}`,
            `closed_by_profile_id.eq.${userId}`,
            `last_message_by_profile_id.eq.${userId}`,
        ].join(","));

    if (directConversationQuery.error) {
        throw directConversationQuery.error;
    }

    const participantConversationQuery = await adminClient
        .from("conversation_participants")
        .select("conversation_id")
        .eq("profile_id", userId);

    if (participantConversationQuery.error) {
        throw participantConversationQuery.error;
    }

    const sentMessageConversationQuery = await adminClient
        .from("conversation_messages")
        .select("id, conversation_id")
        .eq("sender_profile_id", userId);

    if (sentMessageConversationQuery.error) {
        throw sentMessageConversationQuery.error;
    }

    const matchConversationQuery = matchIds.length > 0
        ? await adminClient
            .from("conversations")
            .select("id")
            .in("match_id", matchIds)
        : { data: [], error: null };

    if (matchConversationQuery.error) {
        throw matchConversationQuery.error;
    }

    const offerConversationQuery = offerIds.length > 0
        ? await adminClient
            .from("conversations")
            .select("id")
            .in("offer_id", offerIds)
        : { data: [], error: null };

    if (offerConversationQuery.error) {
        throw offerConversationQuery.error;
    }

    const conversationIds = Array.from(
        new Set(
            [
                ...(directConversationQuery.data || []).map((row) => row.id),
                ...(participantConversationQuery.data || []).map((row) => row.conversation_id),
                ...(sentMessageConversationQuery.data || []).map((row) => row.conversation_id),
                ...(matchConversationQuery.data || []).map((row) => row.id),
                ...(offerConversationQuery.data || []).map((row) => row.id),
            ].filter((id): id is string => Boolean(id))
        )
    );

    const conversationMessageQuery = conversationIds.length > 0
        ? await adminClient
            .from("conversation_messages")
            .select("id")
            .in("conversation_id", conversationIds)
        : { data: [], error: null };

    if (conversationMessageQuery.error) {
        throw conversationMessageQuery.error;
    }

    const conversationMessageIds = Array.from(
        new Set(
            [
                ...(conversationMessageQuery.data || []).map((row) => row.id),
                ...(sentMessageConversationQuery.data || []).map((row) => row.id),
            ].filter((id): id is string => Boolean(id))
        )
    );

    if (conversationIds.length > 0) {
        await assertNoSupabaseError(
            "Delete conversation flags by conversation",
            adminClient
                .from("conversation_flags")
                .delete()
                .in("conversation_id", conversationIds)
        );
    }

    if (conversationMessageIds.length > 0) {
        await assertNoSupabaseError(
            "Delete conversation flags by message",
            adminClient
                .from("conversation_flags")
                .delete()
                .in("message_id", conversationMessageIds)
        );
    }

    if (conversationIds.length > 0) {
        await assertNoSupabaseError(
            "Delete conversation messages",
            adminClient
                .from("conversation_messages")
                .delete()
                .in("conversation_id", conversationIds)
        );

        await assertNoSupabaseError(
            "Delete conversation participants",
            adminClient
                .from("conversation_participants")
                .delete()
                .in("conversation_id", conversationIds)
        );

        await assertNoSupabaseError(
            "Delete conversations",
            adminClient
                .from("conversations")
                .delete()
                .in("id", conversationIds)
        );
    }

    if (matchIds.length > 0) {
        await assertNoSupabaseError(
            "Delete contract data",
            adminClient
                .from("contract_data")
                .delete()
                .in("match_id", matchIds)
        );
    }

    // 3. Delete worker document records
    await assertNoSupabaseError(
        "Delete worker documents",
        adminClient
            .from("worker_documents")
            .delete()
            .eq("user_id", userId)
    );

    // 4. Delete signatures
    await assertNoSupabaseError(
        "Delete signatures",
        adminClient
            .from("signatures")
            .delete()
            .eq("user_id", userId)
    );

    if (offerIds.length > 0) {
        await assertNoSupabaseError(
            "Delete offers",
            adminClient
                .from("offers")
                .delete()
                .in("id", offerIds)
        );
    }

    if (matchIds.length > 0) {
        await assertNoSupabaseError(
            "Delete matches",
            adminClient
                .from("matches")
                .delete()
                .in("id", matchIds)
        );
    }

    if (jobRequestIds.length > 0) {
        await assertNoSupabaseError(
            "Delete job requests",
            adminClient
                .from("job_requests")
                .delete()
                .in("id", jobRequestIds)
        );
    }

    // 5. Delete payments
    await assertNoSupabaseError(
        "Delete payments by user_id",
        adminClient
            .from("payments")
            .delete()
            .eq("user_id", userId)
    );

    await assertNoSupabaseError(
        "Delete payments by profile_id",
        adminClient
            .from("payments")
            .delete()
            .eq("profile_id", userId)
    );

    // 6. Delete email_queue
    await assertNoSupabaseError(
        "Delete email queue",
        adminClient
            .from("email_queue")
            .delete()
            .eq("user_id", userId)
    );

    // 7. Delete whatsapp_messages
    await assertNoSupabaseError(
        "Delete WhatsApp messages",
        adminClient
            .from("whatsapp_messages")
            .delete()
            .eq("user_id", userId)
    );

    await assertNoSupabaseError(
        "Delete user activity",
        adminClient
            .from("user_activity")
            .delete()
            .eq("user_id", userId)
    );

    // 8. Delete worker records
    await assertNoSupabaseError(
        "Delete worker onboarding",
        adminClient
            .from("worker_onboarding")
            .delete()
            .eq("profile_id", userId)
    );

    // 9. Delete employers (if employer)
    await assertNoSupabaseError(
        "Delete employers",
        adminClient
            .from("employers")
            .delete()
            .eq("profile_id", userId)
    );

    // 10. Delete agencies (if agency account)
    try {
        await assertNoSupabaseError(
            "Delete agencies",
            adminClient
                .from("agencies")
                .delete()
                .eq("profile_id", userId)
        );
    } catch (error) {
        console.warn("[deleteUserData] Agency cleanup skipped:", error);
    }

    // 11. Delete profiles
    await assertNoSupabaseError(
        "Delete profiles",
        adminClient
            .from("profiles")
            .delete()
            .eq("id", userId)
    );

    // 12. Delete auth user LAST (after all DB/storage cleanup)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) {
        throw new Error(`Failed to delete auth user: ${authError.message}`);
    }
}
