import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import { sanitizeStorageFileName } from "@/lib/workers";

export const AGENCY_DRAFT_DOCUMENT_OWNER_KEY = "draft_document_owner_profile_id";

type JsonObject = { [key: string]: Json | undefined };

type WorkerDocumentOwnerSource = {
    id: string;
    profile_id?: string | null;
    application_data?: Json | null;
    submitted_full_name?: string | null;
};

type WorkerDocumentRecord = Pick<
    Database["public"]["Tables"]["worker_documents"]["Row"],
    "document_type" | "id" | "storage_path"
>;

function asObject(value: Json | null | undefined): JsonObject {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as JsonObject;
    }

    return {};
}

export function getAgencyDraftDocumentOwnerId(applicationData: Json | null | undefined): string | null {
    const value = asObject(applicationData)[AGENCY_DRAFT_DOCUMENT_OWNER_KEY];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveAgencyWorkerDocumentOwnerId(worker: WorkerDocumentOwnerSource): string | null {
    return worker.profile_id || getAgencyDraftDocumentOwnerId(worker.application_data);
}

function buildClaimedWorkerStoragePath(profileId: string, document: WorkerDocumentRecord): string | null {
    if (!document.storage_path) {
        return null;
    }

    if (document.storage_path.startsWith(`${profileId}/`)) {
        return document.storage_path;
    }

    const currentFileName = document.storage_path.split("/").pop()?.trim();
    const safeFileName = sanitizeStorageFileName(
        `${document.id}_${currentFileName || `${document.document_type}.bin`}`,
        `${document.document_type}_${document.id}`
    );

    return `${profileId}/${document.document_type}/${safeFileName}`;
}

function isStorageConflictError(error: { message?: string | null; status?: number | null; statusCode?: string | null } | null | undefined): boolean {
    if (!error) {
        return false;
    }

    const message = String(error.message || "").toLowerCase();
    const statusCode = String(error.statusCode || "");
    return error.status === 409 || statusCode === "409" || message.includes("already exists");
}

export async function ensureAgencyDraftDocumentOwner(
    admin: SupabaseClient<Database>,
    worker: WorkerDocumentOwnerSource
): Promise<{ documentOwnerId: string; applicationData: JsonObject }> {
    const existingOwnerId = resolveAgencyWorkerDocumentOwnerId(worker);
    if (existingOwnerId) {
        return {
            documentOwnerId: existingOwnerId,
            applicationData: asObject(worker.application_data),
        };
    }

    const syntheticEmail = `draft-worker-${worker.id}@workersunited.internal`;
    const { data: existingProfile, error: profileLookupError } = await admin
        .from("profiles")
        .select("id")
        .eq("email", syntheticEmail)
        .maybeSingle();

    if (profileLookupError) {
        throw profileLookupError;
    }

    let documentOwnerId = existingProfile?.id || null;
    if (!documentOwnerId) {
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
            email: syntheticEmail,
            password: `DraftDoc!${randomUUID()}`,
            email_confirm: true,
            user_metadata: {
                user_type: "worker",
                full_name: worker.submitted_full_name || "Agency draft worker",
                hidden_draft_owner: true,
                source: "agency_draft_documents",
            },
        });

        if (authError || !authData.user) {
            throw authError || new Error("Failed to create draft document owner.");
        }

        documentOwnerId = authData.user.id;

        const { error: profileUpsertError } = await admin.from("profiles").upsert({
            id: documentOwnerId,
            email: syntheticEmail,
            full_name: worker.submitted_full_name || "Agency draft worker",
            user_type: "worker",
        });

        if (profileUpsertError) {
            throw profileUpsertError;
        }
    }

    const nextApplicationData = {
        ...asObject(worker.application_data),
        [AGENCY_DRAFT_DOCUMENT_OWNER_KEY]: documentOwnerId,
    };

    const { error: updateError } = await admin
        .from("worker_onboarding")
        .update({
            application_data: nextApplicationData,
            updated_at: new Date().toISOString(),
        })
        .eq("id", worker.id);

    if (updateError) {
        throw updateError;
    }

    return {
        documentOwnerId,
        applicationData: nextApplicationData,
    };
}

export async function relinkAgencyDraftDocumentsToClaimedProfile(
    admin: SupabaseClient<Database>,
    input: {
        workerId: string;
        profileId: string;
        applicationData: Json | null | undefined;
    }
): Promise<{ error: { message: string } | null }> {
    const draftOwnerId = getAgencyDraftDocumentOwnerId(input.applicationData);
    if (!draftOwnerId) {
        return { error: null };
    }

    const nowIso = new Date().toISOString();
    const { data: draftDocuments, error: draftDocumentsError } = await admin
        .from("worker_documents")
        .select("id, document_type, storage_path")
        .eq("user_id", draftOwnerId);

    if (draftDocumentsError) {
        return { error: draftDocumentsError };
    }

    for (const document of draftDocuments || []) {
        const nextStoragePath = buildClaimedWorkerStoragePath(input.profileId, document);
        const shouldCopyStorage =
            Boolean(document.storage_path) &&
            Boolean(nextStoragePath) &&
            nextStoragePath !== document.storage_path;

        let copiedToClaimedPath = false;

        if (shouldCopyStorage && document.storage_path && nextStoragePath) {
            const { error: copyError } = await admin.storage
                .from(WORKER_DOCUMENTS_BUCKET)
                .copy(document.storage_path, nextStoragePath);

            if (copyError && !isStorageConflictError(copyError)) {
                return { error: copyError };
            }

            copiedToClaimedPath = !copyError;
        }

        const { error: documentUpdateError } = await admin
            .from("worker_documents")
            .update({
                user_id: input.profileId,
                storage_path: nextStoragePath,
                updated_at: nowIso,
            })
            .eq("id", document.id);

        if (documentUpdateError) {
            if (copiedToClaimedPath && nextStoragePath) {
                await admin.storage.from(WORKER_DOCUMENTS_BUCKET).remove([nextStoragePath]);
            }

            return { error: documentUpdateError };
        }

        if (shouldCopyStorage && document.storage_path) {
            const { error: removeOldPathError } = await admin.storage
                .from(WORKER_DOCUMENTS_BUCKET)
                .remove([document.storage_path]);

            if (removeOldPathError) {
                console.warn("[agency-draft-documents] Old draft storage cleanup failed:", {
                    documentId: document.id,
                    storagePath: document.storage_path,
                    error: removeOldPathError,
                });
            }
        }
    }

    const { error: documentError } = await admin
        .from("worker_documents")
        .update({
            user_id: input.profileId,
            updated_at: nowIso,
        })
        .eq("user_id", draftOwnerId);

    if (documentError) {
        return { error: documentError };
    }

    const nextApplicationData = { ...asObject(input.applicationData) };
    delete nextApplicationData[AGENCY_DRAFT_DOCUMENT_OWNER_KEY];

    const { error: workerUpdateError } = await admin
        .from("worker_onboarding")
        .update({
            application_data: nextApplicationData,
            updated_at: nowIso,
        })
        .eq("id", input.workerId);

    if (workerUpdateError) {
        return { error: workerUpdateError };
    }

    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", draftOwnerId);
    if (profileDeleteError) {
        console.warn("[agency-draft-documents] Draft owner profile cleanup failed:", {
            draftOwnerId,
            error: profileDeleteError,
        });
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(draftOwnerId);
    if (authDeleteError) {
        console.warn("[agency-draft-documents] Draft owner auth cleanup failed:", {
            draftOwnerId,
            error: authDeleteError,
        });
    }

    return { error: null };
}
