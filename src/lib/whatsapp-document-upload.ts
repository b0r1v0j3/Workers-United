import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { sanitizeStorageFileName } from "@/lib/workers";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import { downloadWhatsAppMedia } from "@/lib/whatsapp-media";
import { syncWorkerReviewStatus } from "@/lib/worker-review";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

export type WhatsAppWorkerDocumentType = "passport" | "biometric_photo" | "diploma";

export interface WhatsAppImageAnalysisSnapshot {
    isDocument: boolean;
    documentType: string | null;
    extractedText?: string | null;
    description?: string | null;
}

interface InferWhatsAppWorkerDocumentTypeInput {
    messageType: string;
    caption?: string | null;
    fileName?: string | null;
    imageAnalysis?: WhatsAppImageAnalysisSnapshot | null;
}

interface SaveWhatsAppWorkerDocumentInput extends InferWhatsAppWorkerDocumentTypeInput {
    admin: SupabaseAdminClient;
    mediaId: string;
    workerProfileId?: string | null;
    workerRecordId?: string | null;
    normalizedPhone: string;
    declaredMimeType?: string | null;
    downloadMedia?: typeof downloadWhatsAppMedia;
    now?: () => Date;
}

export type WhatsAppWorkerDocumentUploadResult =
    | {
        handled: false;
        status: "not_worker_document_candidate";
    }
    | {
        handled: true;
        status: "needs_linked_profile" | "needs_document_type" | "unsupported_file_type" | "file_too_large" | "upload_failed";
        docType?: WhatsAppWorkerDocumentType | null;
        mimeType?: string | null;
        sizeBytes?: number;
        error?: string;
    }
    | {
        handled: true;
        status: "saved";
        docType: WhatsAppWorkerDocumentType;
        storagePath: string;
        replacedExisting: boolean;
        mimeType: string;
        sizeBytes: number;
    };

const DOCUMENT_TYPES = new Set<WhatsAppWorkerDocumentType>(["passport", "biometric_photo", "diploma"]);

function normalizeSearchText(...parts: Array<string | null | undefined>) {
    return parts
        .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
        .join(" ")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function hasAnyWord(text: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(text));
}

function inferDocumentTypeFromAnalysis(documentType: string | null | undefined): WhatsAppWorkerDocumentType | null {
    const normalized = (documentType || "").trim().toLowerCase();
    if (normalized === "passport") return "passport";
    if (normalized === "diploma" || normalized === "certificate") return "diploma";
    return null;
}

export function inferWhatsAppWorkerDocumentType({
    messageType,
    caption,
    fileName,
    imageAnalysis,
}: InferWhatsAppWorkerDocumentTypeInput): WhatsAppWorkerDocumentType | null {
    const text = normalizeSearchText(caption, fileName);

    if (hasAnyWord(text, [
        /\bbiometric\b/,
        /\bpassport\s+photo\b/,
        /\bvisa\s+photo\b/,
        /\bphoto\s+for\s+visa\b/,
        /\bslika\s+za\s+pasos\b/,
        /\bpasosna\s+slika\b/,
        /\bfotografija\s+za\s+pasos\b/,
    ])) {
        return "biometric_photo";
    }

    if (hasAnyWord(text, [
        /\bpassport\b/,
        /\bpassaport\b/,
        /\bpasos\b/,
        /\bputovnica\b/,
        /\bpasport\b/,
    ])) {
        return "passport";
    }

    if (hasAnyWord(text, [
        /\bdiploma\b/,
        /\bdiplom\b/,
        /\bdegree\b/,
        /\bgraduation\b/,
        /\bschool\s+certificate\b/,
        /\buniversity\s+certificate\b/,
        /\bvocational\s+certificate\b/,
        /\bcertificate\s+of\s+education\b/,
        /\bsvjedocanstvo\b/,
        /\bsvedocanstvo\b/,
    ])) {
        return "diploma";
    }

    const inferredFromAnalysis = inferDocumentTypeFromAnalysis(imageAnalysis?.documentType);
    if (inferredFromAnalysis) {
        return inferredFromAnalysis;
    }

    if (messageType === "image" && imageAnalysis?.isDocument) {
        return null;
    }

    return null;
}

function looksLikeWorkerDocumentCandidate(input: InferWhatsAppWorkerDocumentTypeInput) {
    if (input.messageType === "document") {
        return true;
    }

    if (input.imageAnalysis?.isDocument) {
        return true;
    }

    return inferWhatsAppWorkerDocumentType(input) !== null;
}

function normalizeMimeType(mimeType: string | null | undefined) {
    return (mimeType || "").split(";")[0].trim().toLowerCase();
}

function extensionForMimeType(mimeType: string) {
    switch (normalizeMimeType(mimeType)) {
        case "application/pdf":
        case "application/octet-stream":
            return "pdf";
        case "image/jpeg":
        case "image/jpg":
            return "jpg";
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        case "image/heic":
            return "heic";
        case "image/heif":
            return "heif";
        default:
            return "bin";
    }
}

function isPdfMimeOrFile(mimeType: string, fileName?: string | null) {
    return normalizeMimeType(mimeType) === "application/pdf" || /\.pdf$/i.test(fileName || "");
}

function isAllowedWhatsAppDocumentMime(mimeType: string, fileName?: string | null) {
    const normalized = normalizeMimeType(mimeType);
    if (SUPPORTED_WHATSAPP_DOCUMENT_IMAGE_MIMES.has(normalized)) {
        return true;
    }

    if (normalized === "application/pdf") {
        return true;
    }

    return normalized === "application/octet-stream" && /\.pdf$/i.test(fileName || "");
}

const SUPPORTED_WHATSAPP_DOCUMENT_IMAGE_MIMES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
]);

function withTrustedFileExtension(fileName: string | null | undefined, fallbackFileName: string, mimeType: string) {
    const trustedExtension = extensionForMimeType(mimeType);
    const safeFileName = sanitizeStorageFileName(fileName || fallbackFileName, fallbackFileName);
    const dotIndex = safeFileName.lastIndexOf(".");
    const safeBase = dotIndex > 0 ? safeFileName.slice(0, dotIndex) : safeFileName;
    return `${safeBase || "whatsapp_document"}.${trustedExtension}`;
}

export async function saveWhatsAppWorkerDocumentFromMedia({
    admin,
    mediaId,
    workerProfileId,
    workerRecordId,
    messageType,
    caption,
    fileName,
    declaredMimeType,
    imageAnalysis,
    downloadMedia = downloadWhatsAppMedia,
    now = () => new Date(),
}: SaveWhatsAppWorkerDocumentInput): Promise<WhatsAppWorkerDocumentUploadResult> {
    const docType = inferWhatsAppWorkerDocumentType({ messageType, caption, fileName, imageAnalysis });

    if (!docType && !looksLikeWorkerDocumentCandidate({ messageType, caption, fileName, imageAnalysis })) {
        return { handled: false, status: "not_worker_document_candidate" };
    }

    if (!workerProfileId) {
        return { handled: true, status: "needs_linked_profile", docType };
    }

    if (!docType || !DOCUMENT_TYPES.has(docType)) {
        return { handled: true, status: "needs_document_type" };
    }

    try {
        const media = await downloadMedia(mediaId);
        const mimeType = normalizeMimeType(media.mimeType || declaredMimeType);
        const sizeBytes = media.buffer.length;

        if (!isAllowedWhatsAppDocumentMime(mimeType, fileName)) {
            return { handled: true, status: "unsupported_file_type", docType, mimeType, sizeBytes };
        }

        if (docType === "biometric_photo" && isPdfMimeOrFile(mimeType, fileName)) {
            return { handled: true, status: "unsupported_file_type", docType, mimeType, sizeBytes };
        }

        if (sizeBytes > MAX_FILE_SIZE_BYTES) {
            return { handled: true, status: "file_too_large", docType, mimeType, sizeBytes };
        }

        const receivedAt = now();
        const nowIso = receivedAt.toISOString();
        const fallbackFileName = `whatsapp_${docType}.${extensionForMimeType(mimeType)}`;
        const safeFileName = withTrustedFileExtension(fileName, fallbackFileName, mimeType);
        const storagePath = `${workerProfileId}/${docType}/${receivedAt.getTime()}_whatsapp_${safeFileName}`;

        const { data: existingDocument, error: existingDocumentError } = await admin
            .from("worker_documents")
            .select("id, storage_path")
            .eq("user_id", workerProfileId)
            .eq("document_type", docType)
            .maybeSingle();

        if (existingDocumentError) {
            return { handled: true, status: "upload_failed", docType, mimeType, sizeBytes, error: existingDocumentError.message };
        }

        const { error: uploadError } = await admin.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .upload(storagePath, media.buffer, {
                contentType: mimeType || undefined,
            });

        if (uploadError) {
            return { handled: true, status: "upload_failed", docType, mimeType, sizeBytes, error: uploadError.message };
        }

        const ocrJson = {
            source: "whatsapp",
            uploaded_via: "whatsapp",
            media_id: mediaId,
            received_at: nowIso,
            original_file_name: fileName || null,
            original_mime_type: mimeType || null,
            whatsapp_message_type: messageType,
            whatsapp_caption: caption || null,
            ai_recommendation: "review",
            review_state: "awaiting_admin_approval",
            image_analysis: imageAnalysis
                ? {
                    is_document: imageAnalysis.isDocument,
                    document_type: imageAnalysis.documentType,
                    extracted_text: imageAnalysis.extractedText || null,
                    description: imageAnalysis.description || null,
                }
                : null,
        };

        const documentMutation = existingDocument
            ? admin
                .from("worker_documents")
                .update({
                    user_id: workerProfileId,
                    storage_path: storagePath,
                    status: "manual_review",
                    reject_reason: null,
                    verified_at: null,
                    extracted_data: null,
                    ocr_json: ocrJson,
                    updated_at: nowIso,
                })
                .eq("id", existingDocument.id)
            : admin
                .from("worker_documents")
                .insert({
                    user_id: workerProfileId,
                    document_type: docType,
                    storage_path: storagePath,
                    status: "manual_review",
                    reject_reason: null,
                    verified_at: null,
                    extracted_data: null,
                    ocr_json: ocrJson,
                    updated_at: nowIso,
                });

        const { error: persistError } = await documentMutation;
        if (persistError) {
            await admin.storage.from(WORKER_DOCUMENTS_BUCKET).remove([storagePath]);
            return { handled: true, status: "upload_failed", docType, mimeType, sizeBytes, error: persistError.message };
        }

        if (existingDocument?.storage_path && existingDocument.storage_path !== storagePath) {
            await admin.storage.from(WORKER_DOCUMENTS_BUCKET).remove([existingDocument.storage_path]);
        }

        try {
            await syncWorkerReviewStatus({
                adminClient: admin as unknown as SupabaseClient<Database>,
                profileId: workerProfileId,
                workerId: workerRecordId || null,
                documentOwnerId: workerProfileId,
                notifyOnPendingApproval: false,
            });
        } catch (syncError) {
            console.warn("[WhatsAppDocuments] Review status sync failed:", syncError);
        }

        return {
            handled: true,
            status: "saved",
            docType,
            storagePath,
            replacedExisting: !!existingDocument,
            mimeType,
            sizeBytes,
        };
    } catch (error) {
        return {
            handled: true,
            status: "upload_failed",
            docType,
            error: error instanceof Error ? error.message : "Unknown upload error",
        };
    }
}

function isBalkanLanguage(language: string | null | undefined) {
    return /serbian|srpski|bosnian|bosanski|croatian|hrvatski|montenegrin|crnogorski/i.test(language || "");
}

function getDocumentLabel(docType: WhatsAppWorkerDocumentType | null | undefined, language?: string | null) {
    const serbian = isBalkanLanguage(language);
    if (docType === "biometric_photo") return serbian ? "biometrijsku sliku" : "biometric photo";
    if (docType === "diploma") return serbian ? "diplomu" : "diploma";
    if (docType === "passport") return serbian ? "pasos" : "passport";
    return serbian ? "dokument" : "document";
}

export function buildWhatsAppDocumentUploadReply(
    result: Exclude<WhatsAppWorkerDocumentUploadResult, { handled: false }>,
    language?: string | null
) {
    const serbian = isBalkanLanguage(language);
    const label = getDocumentLabel(result.docType, language);

    switch (result.status) {
        case "saved":
            return serbian
                ? `Primio sam i sacuvao ${label}. Dokument je poslat na proveru i status ces videti u profilu.`
                : `I received and saved your ${label}. It has been sent for review, and you can see the status in your profile.`;
        case "needs_linked_profile":
            return serbian
                ? "Mogu da sacuvam dokument preko WhatsApp-a tek kad je ovaj broj povezan sa radnickim profilom. Prijavi se ili zavrsi registraciju, pa posalji dokument ponovo."
                : "I can save documents from WhatsApp only after this number is linked to a worker profile. Please sign in or finish registration, then send the document again.";
        case "needs_document_type":
            return serbian
                ? "Primio sam fajl, ali ne mogu sigurno da prepoznam da li je pasos, diploma ili biometrijska slika. Posalji ga ponovo uz caption: passport, diploma ili biometric photo."
                : "I received the file, but I cannot safely tell whether it is a passport, diploma, or biometric photo. Please resend it with this caption: passport, diploma, or biometric photo.";
        case "unsupported_file_type":
            if (result.docType === "biometric_photo") {
                return serbian
                    ? `Biometrijska slika mora biti slika, ne PDF. Posalji JPG, PNG, WEBP ili HEIC fajl.`
                    : "The biometric photo must be an image, not a PDF. Please send a JPG, PNG, WEBP, or HEIC file.";
            }
            return serbian
                ? "Ovaj tip fajla ne mogu da sacuvam kao dokument. Posalji sliku ili PDF."
                : "I cannot save this file type as a worker document. Please send an image or PDF.";
        case "file_too_large":
            return serbian
                ? `Fajl je prevelik. Maksimalna velicina je ${MAX_FILE_SIZE_MB}MB.`
                : `The file is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
        case "upload_failed":
        default:
            return serbian
                ? "Nisam uspeo da sacuvam dokument. Probaj ponovo za par minuta ili ga ubaci kroz profil."
                : "I could not save the document. Please try again in a few minutes or upload it from your profile.";
    }
}
