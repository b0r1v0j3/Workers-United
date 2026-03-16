import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import {
    getAdminTestAgencyWorker,
    getAdminTestAgencyWorkerDocuments,
    uploadAdminTestAgencyWorkerDocument,
} from "@/lib/admin-test-data";
import { getAgencyOwnedWorker, getAgencySchemaState } from "@/lib/agencies";
import { normalizeUserType } from "@/lib/domain";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { checkRateLimit, standardLimiter } from "@/lib/rate-limit";
import { sanitizeStorageFileName } from "@/lib/workers";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import {
    ensureAgencyDraftDocumentOwner,
    resolveAgencyWorkerDocumentOwnerId,
} from "@/lib/agency-draft-documents";

const ALLOWED_DOC_TYPES = new Set(["passport", "biometric_photo", "diploma"]);

interface RouteContext {
    params: Promise<{ workerId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { workerId } = await context.params;
        const supabase = await createClient();
        const admin = createAdminClient();
        const adminTestSession = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (!adminTestSession.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (adminTestSession.activePersona?.role === "agency") {
            const sandboxWorker = await getAdminTestAgencyWorker(admin, adminTestSession.activePersona.id, workerId);
            if (!sandboxWorker) {
                return NextResponse.json({ error: "Worker not found" }, { status: 404 });
            }

            const documents = await getAdminTestAgencyWorkerDocuments(admin, adminTestSession.activePersona.id, workerId);

            return NextResponse.json({
                worker: {
                    workerId,
                    profileId: null,
                    verifiedDocuments: (documents || []).filter((document) => document.status === "verified").length,
                    documents: documents || [],
                },
                sandbox: true,
            });
        }

        const schemaState = await getAgencySchemaState(admin);
        if (!schemaState.ready) {
            return NextResponse.json({ error: "Agency workspace setup is not active yet." }, { status: 503 });
        }

        const user = adminTestSession.user;
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await admin
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();

        const userType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        const inspectProfileId = userType === "admin"
            ? request.nextUrl.searchParams.get("inspect")?.trim() || null
            : null;

        if (userType !== "agency" && !(userType === "admin" && inspectProfileId)) {
            return NextResponse.json({ error: "Agency access required" }, { status: 403 });
        }

        const targetAgencyProfileId = userType === "agency" ? user.id : inspectProfileId;
        const { worker } = await getAgencyOwnedWorker(admin, targetAgencyProfileId || user.id, workerId);
        if (!worker) {
            return NextResponse.json({ error: "Worker not found" }, { status: 404 });
        }

        const documentOwnerId = resolveAgencyWorkerDocumentOwnerId(worker);
        const { data: documents, error: documentsError } = documentOwnerId
            ? await admin
                .from("worker_documents")
                .select("id, user_id, document_type, status, reject_reason, storage_path, updated_at, created_at, verified_at, extracted_data, ocr_json")
                .eq("user_id", documentOwnerId)
                .order("updated_at", { ascending: false })
            : { data: [], error: null };

        if (documentsError) {
            console.error("[AgencyWorkerDocuments GET] Document fetch failed:", documentsError);
            return NextResponse.json({ error: "Failed to load worker documents" }, { status: 500 });
        }

        return NextResponse.json({
            worker: {
                workerId: worker.id,
                profileId: worker.profile_id || null,
                verifiedDocuments: (documents || []).filter((document) => document.status === "verified").length,
                documents: documents || [],
            },
        });
    } catch (error) {
        console.error("[AgencyWorkerDocuments GET] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest, context: RouteContext) {
    const blocked = checkRateLimit(request, standardLimiter);
    if (blocked) {
        return blocked;
    }

    try {
        const { workerId } = await context.params;
        const supabase = await createClient();
        const admin = createAdminClient();
        const adminTestSession = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (!adminTestSession.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const docTypeRaw = formData.get("docType");
        const fileEntry = formData.get("file");
        const docType = typeof docTypeRaw === "string" ? docTypeRaw.trim() : "";

        if (!ALLOWED_DOC_TYPES.has(docType)) {
            return NextResponse.json({ error: "Unsupported document type" }, { status: 400 });
        }

        if (!fileEntry || typeof fileEntry === "string") {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.` }, { status: 400 });
        }

        if (adminTestSession.activePersona?.role === "agency" && adminTestSession.ownerProfile) {
            const sandboxWorker = await getAdminTestAgencyWorker(admin, adminTestSession.activePersona.id, workerId);
            if (!sandboxWorker) {
                return NextResponse.json({ error: "Worker not found" }, { status: 404 });
            }

            const document = await uploadAdminTestAgencyWorkerDocument({
                admin,
                personaId: adminTestSession.activePersona.id,
                ownerProfileId: adminTestSession.ownerProfile.id,
                workerId,
                docType,
                file: fileEntry,
            });

            return NextResponse.json({
                success: true,
                sandbox: true,
                docType,
                document,
                message: "Sandbox document uploaded and verified.",
            });
        }

        const schemaState = await getAgencySchemaState(admin);
        if (!schemaState.ready) {
            return NextResponse.json({ error: "Agency workspace setup is not active yet." }, { status: 503 });
        }

        const user = adminTestSession.user;
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await admin
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();

        if (normalizeUserType(profile?.user_type || user.user_metadata?.user_type) !== "agency") {
            return NextResponse.json({ error: "Agency access required" }, { status: 403 });
        }

        const { worker } = await getAgencyOwnedWorker(admin, user.id, workerId);
        if (!worker) {
            return NextResponse.json({ error: "Worker not found" }, { status: 404 });
        }

        const nowIso = new Date().toISOString();
        const documentOwnerId = worker.profile_id
            ? worker.profile_id
            : (await ensureAgencyDraftDocumentOwner(admin, worker)).documentOwnerId;
        const sanitizedFileName = sanitizeStorageFileName(fileEntry.name || `${docType}.bin`, docType);
        const storagePath = `${documentOwnerId}/${docType}/${Date.now()}_${sanitizedFileName}`;

        const { data: existingDocument, error: existingDocumentError } = await admin
            .from("worker_documents")
            .select("id, storage_path")
            .eq("user_id", documentOwnerId)
            .eq("document_type", docType)
            .maybeSingle();

        if (existingDocumentError) {
            console.error("[AgencyWorkerDocuments] Existing document lookup failed:", existingDocumentError);
            return NextResponse.json({ error: "Failed to load worker document state" }, { status: 500 });
        }

        const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
        const { error: uploadError } = await admin.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .upload(storagePath, fileBuffer, {
                contentType: fileEntry.type || undefined,
            });

        if (uploadError) {
            console.error("[AgencyWorkerDocuments] Storage upload failed:", uploadError);
            return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
        }

        const documentMutation = existingDocument
            ? admin
                .from("worker_documents")
                .update({
                    user_id: documentOwnerId,
                    storage_path: storagePath,
                    status: "uploaded",
                    reject_reason: null,
                    verified_at: null,
                    extracted_data: null,
                    ocr_json: null,
                    updated_at: nowIso,
                })
                .eq("id", existingDocument.id)
            : admin
                .from("worker_documents")
                .insert({
                    user_id: documentOwnerId,
                    document_type: docType,
                    storage_path: storagePath,
                    status: "uploaded",
                    reject_reason: null,
                    verified_at: null,
                    extracted_data: null,
                    ocr_json: null,
                    updated_at: nowIso,
                });

        const { error: persistError } = await documentMutation;

        if (persistError) {
            await admin.storage.from(WORKER_DOCUMENTS_BUCKET).remove([storagePath]);
            console.error("[AgencyWorkerDocuments] Document record upsert failed:", persistError);
            return NextResponse.json({ error: "Failed to save document metadata" }, { status: 500 });
        }

        if (existingDocument?.storage_path && existingDocument.storage_path !== storagePath) {
            const { error: removeError } = await admin.storage
                .from(WORKER_DOCUMENTS_BUCKET)
                .remove([existingDocument.storage_path]);

            if (removeError) {
                console.warn("[AgencyWorkerDocuments] Previous document cleanup failed:", removeError);
            }
        }

        await logServerActivity(worker.profile_id || worker.id, "document_uploaded_server", "documents", {
            doc_type: docType,
            uploaded_by_agency: true,
            agency_profile_id: user.id,
            worker_id: worker.id,
            draft_worker: !worker.profile_id,
        });

        return NextResponse.json({
            success: true,
            docType,
            profileId: worker.profile_id,
            documentOwnerId,
            storagePath,
        });
    } catch (error) {
        console.error("[AgencyWorkerDocuments] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
