import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import {
    buildDocumentOrientationOcrPatch,
    detectDocumentBounds,
    detectDocumentOrientation,
} from "@/lib/document-ai";
import {
    buildAiOriginalBackupPath,
    buildAutoCropOcrPatch,
    getRestorableDocumentBackupPath,
    buildManualCropOcrPatch,
    processDocumentImageBuffer,
    resolveDocumentRotationToApply,
    sanitizeDocumentCrop,
    shouldApplyAutoCropForDocument,
} from "@/lib/document-image-processing";

export const dynamic = "force-dynamic";

interface RouteProps {
    params: Promise<{ documentId: string }>;
}

type AuthorizedAdminResult =
    | { admin: ReturnType<typeof createAdminClient> }
    | { response: NextResponse };

type DocumentContextResult =
    | {
        admin: ReturnType<typeof createAdminClient>;
        document: {
            id: string;
            storage_path: string;
            document_type: string;
            ocr_json: unknown;
        };
        buffer: Buffer;
        fileName: string;
        contentType: string;
        ocrJson: Record<string, unknown>;
    }
    | { response: NextResponse };

type ManualCropActionBody =
    | { action: "restore_original" }
    | { crop: unknown; documentId?: string };

function getMimeType(fileName: string, fallback?: string | null) {
    if (fallback && fallback.trim().length > 0 && fallback !== "application/octet-stream") {
        return fallback;
    }

    const lower = fileName.toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";

    return "application/octet-stream";
}

function getInlineFileName(storagePath: string, documentType: string) {
    const fallback = `${documentType || "document"}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const fileName = storagePath.split("/").pop() || fallback;
    return fileName.replace(/["\r\n]/g, "");
}

function isImageMimeType(mimeType: string) {
    return mimeType.startsWith("image/");
}

function normalizeOcrJson(ocrJson: unknown): Record<string, unknown> {
    if (ocrJson && typeof ocrJson === "object" && !Array.isArray(ocrJson)) {
        return ocrJson as Record<string, unknown>;
    }

    return {};
}

function hasProcessedOrientation(ocrJson: Record<string, unknown>) {
    return typeof ocrJson.orientation_processed_at === "string" && ocrJson.orientation_processed_at.trim().length > 0;
}

function hasProcessedAutoCrop(ocrJson: Record<string, unknown>) {
    return typeof ocrJson.auto_crop_processed_at === "string" && ocrJson.auto_crop_processed_at.trim().length > 0;
}

function hasManualCrop(ocrJson: Record<string, unknown>) {
    return ocrJson.manual_crop_applied === true;
}

function stripManualCropMetadata(ocrJson: Record<string, unknown>) {
    const next = { ...ocrJson };
    delete next.manual_crop_applied;
    delete next.manual_crop_applied_at;
    delete next.manual_crop;
    delete next.manual_crop_original_storage_path;
    return next;
}

function stripAutoCropMetadata(ocrJson: Record<string, unknown>) {
    const next = { ...ocrJson };
    delete next.auto_crop;
    delete next.auto_crop_applied;
    delete next.auto_crop_skip_reason;
    delete next.ai_original_storage_path;
    return next;
}

function buildInlineResponse(buffer: Buffer, contentType: string, fileName: string) {
    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${fileName}"`,
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
        },
    });
}

function buildManualCropBackupPath(storagePath: string) {
    const segments = storagePath.split("/");
    const fileName = segments.pop() || "document";
    const directory = segments.join("/");
    return `${directory}/_admin-originals/${fileName}`;
}

async function authorizeAdmin(): Promise<AuthorizedAdminResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return {
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        return {
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
    }

    return { admin: createAdminClient() };
}

async function loadDocumentContext(documentId: string): Promise<DocumentContextResult> {
    const auth = await authorizeAdmin();
    if ("response" in auth) {
        return auth;
    }

    const { admin } = auth;
    const { data: document, error: documentError } = await admin
        .from("worker_documents")
        .select("id, storage_path, document_type, ocr_json")
        .eq("id", documentId)
        .maybeSingle();

    if (documentError || !document?.storage_path) {
        return {
            response: NextResponse.json({ error: "Document not found" }, { status: 404 }),
        };
    }

    const { data: file, error: downloadError } = await admin.storage
        .from(WORKER_DOCUMENTS_BUCKET)
        .download(document.storage_path);

    if (downloadError || !file) {
        return {
            response: NextResponse.json({ error: "Stored document not found" }, { status: 404 }),
        };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = getInlineFileName(document.storage_path, document.document_type);
    const contentType = getMimeType(fileName, file.type);

    return {
        admin,
        document,
        buffer,
        fileName,
        contentType,
        ocrJson: normalizeOcrJson(document.ocr_json),
    };
}

export async function GET(_request: Request, { params }: RouteProps) {
    const { documentId } = await params;
    const context = await loadDocumentContext(documentId);

    if ("response" in context) {
        return context.response;
    }

    const { admin, document, buffer, fileName, contentType, ocrJson } = context;

    if (!isImageMimeType(contentType)) {
        return buildInlineResponse(buffer, contentType, fileName);
    }

    const orientationProcessed = hasProcessedOrientation(ocrJson);
    const autoCropProcessed = hasProcessedAutoCrop(ocrJson) || hasManualCrop(ocrJson);

    if (orientationProcessed && autoCropProcessed) {
        return buildInlineResponse(buffer, contentType, fileName);
    }

    try {
        const imageInput = {
            data: buffer.toString("base64"),
            mimeType: contentType,
        };
        const orientation = orientationProcessed
            ? { rotationDegrees: 0 as const, confidence: 0, summary: undefined as string | undefined }
            : await detectDocumentOrientation(imageInput, document.document_type);
        const bounds = autoCropProcessed
            ? { found: false as const, crop: undefined, rotationDegrees: undefined as number | undefined }
            : await detectDocumentBounds(imageInput, document.document_type);
        const rotationToApply = orientationProcessed
            ? 0
            : resolveDocumentRotationToApply(
                orientation.rotationDegrees,
                orientation.confidence,
                bounds.rotationDegrees
            );
        const detectedCrop = bounds.found ? sanitizeDocumentCrop(bounds.crop) : null;
        const safeCrop = detectedCrop && shouldApplyAutoCropForDocument(document.document_type, detectedCrop)
            ? detectedCrop
            : null;
        const autoCropSkippedReason = detectedCrop && !safeCrop
            ? "suspicious_passport_spread_crop"
            : null;
        const shouldRewriteImage = rotationToApply !== 0 || !!safeCrop;
        const processed = shouldRewriteImage
            ? await processDocumentImageBuffer(buffer, contentType, rotationToApply, safeCrop)
            : { buffer, contentType, cropApplied: false };
        let aiOriginalStoragePath = typeof ocrJson.ai_original_storage_path === "string"
            ? ocrJson.ai_original_storage_path.trim() || null
            : null;
        const patch = {
            ...(orientationProcessed ? {} : buildDocumentOrientationOcrPatch({
                detectedRotationDegrees: rotationToApply,
                appliedRotationDegrees: shouldRewriteImage ? rotationToApply : 0,
                confidence: orientation.confidence,
                summary: orientation.summary,
                cropApplied: processed.cropApplied,
            })),
            ...(autoCropProcessed ? {} : buildAutoCropOcrPatch({
                cropApplied: processed.cropApplied,
                crop: processed.cropApplied ? safeCrop : undefined,
                backupStoragePath: aiOriginalStoragePath,
                skipReason: autoCropSkippedReason,
            })),
        };

        if (Object.keys(patch).length > 0) {
            after(async () => {
                if (shouldRewriteImage) {
                    if (!aiOriginalStoragePath) {
                        aiOriginalStoragePath = buildAiOriginalBackupPath(document.storage_path);
                        const { error: backupError } = await admin.storage
                            .from(WORKER_DOCUMENTS_BUCKET)
                            .upload(aiOriginalStoragePath, buffer, {
                                contentType,
                                upsert: true,
                            });

                        if (backupError) {
                            console.warn("[Admin preview] Failed to preserve AI original before normalization:", backupError);
                            aiOriginalStoragePath = null;
                        }
                    }

                    const { error: uploadError } = await admin.storage
                        .from(WORKER_DOCUMENTS_BUCKET)
                        .update(document.storage_path, processed.buffer, {
                            contentType: processed.contentType,
                            upsert: true,
                        });

                    if (uploadError) {
                        console.warn("[Admin preview] Failed to persist normalized document:", uploadError);
                        return;
                    }
                }

                const { error: updateError } = await admin
                    .from("worker_documents")
                    .update({
                        ocr_json: {
                            ...ocrJson,
                            ...(aiOriginalStoragePath ? { ai_original_storage_path: aiOriginalStoragePath } : {}),
                            ...patch,
                        },
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", documentId);

                if (updateError) {
                    console.warn("[Admin preview] Failed to persist image normalization metadata:", updateError);
                }
            });
        }

        return buildInlineResponse(processed.buffer, processed.contentType, fileName);
    } catch (error) {
        console.warn("[Admin preview] Image normalization failed:", error);
    }

    return buildInlineResponse(buffer, contentType, fileName);
}

export async function POST(request: Request, { params }: RouteProps) {
    const { documentId } = await params;
    const context = await loadDocumentContext(documentId);

    if ("response" in context) {
        return context.response;
    }

    const { admin, document, buffer, contentType, ocrJson } = context;

    if (!isImageMimeType(contentType)) {
        return NextResponse.json({ error: "Manual crop is only available for images." }, { status: 400 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const actionBody = body as ManualCropActionBody | null;

    if (actionBody && typeof actionBody === "object" && "action" in actionBody && actionBody.action === "restore_original") {
        const backupStoragePath = getRestorableDocumentBackupPath(ocrJson);

        if (!backupStoragePath) {
            return NextResponse.json({ error: "No saved original image is available for this document." }, { status: 400 });
        }

        const { data: backupFile, error: backupError } = await admin.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .download(backupStoragePath);

        if (backupError || !backupFile) {
            console.warn("[Admin preview] Failed to load manual-crop backup:", backupError);
            return NextResponse.json({ error: "Could not load the saved original image." }, { status: 500 });
        }

        const backupBuffer = Buffer.from(await backupFile.arrayBuffer());
        const backupContentType = backupFile.type?.trim() || contentType;
        const { error: restoreError } = await admin.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .update(document.storage_path, backupBuffer, {
                contentType: backupContentType,
                upsert: true,
            });

        if (restoreError) {
            console.warn("[Admin preview] Failed to restore original image:", restoreError);
            return NextResponse.json({ error: "Failed to restore the original image." }, { status: 500 });
        }

        const restoredAt = new Date().toISOString();
        const restoredFromManualBackup =
            typeof ocrJson.manual_crop_original_storage_path === "string"
            && ocrJson.manual_crop_original_storage_path.trim() === backupStoragePath;
        const { error: updateError } = await admin
            .from("worker_documents")
            .update({
                ocr_json: {
                    ...stripAutoCropMetadata(stripManualCropMetadata(ocrJson)),
                    orientation_processed_at: typeof ocrJson.orientation_processed_at === "string" ? ocrJson.orientation_processed_at : restoredAt,
                    auto_crop_processed_at: typeof ocrJson.auto_crop_processed_at === "string" ? ocrJson.auto_crop_processed_at : restoredAt,
                    auto_crop_applied: false,
                    auto_rotation_applied_degrees: 0,
                    ...(restoredFromManualBackup
                        ? { original_restored_after_manual_crop_at: restoredAt }
                        : { original_restored_after_ai_processing_at: restoredAt }),
                },
                updated_at: restoredAt,
            })
            .eq("id", documentId);

        if (updateError) {
            console.warn("[Admin preview] Failed to clear manual crop metadata after restore:", updateError);
            return NextResponse.json({ error: "Original image was restored, but metadata cleanup failed." }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            restored: true,
            previewUrl: `/api/admin/documents/${documentId}/preview?v=${Date.now()}`,
        });
    }

    const crop = sanitizeDocumentCrop((body as { crop?: unknown } | null)?.crop);
    if (!crop) {
        return NextResponse.json({ error: "A valid crop selection is required." }, { status: 400 });
    }

    let backupStoragePath =
        typeof ocrJson.manual_crop_original_storage_path === "string" && ocrJson.manual_crop_original_storage_path.trim().length > 0
            ? ocrJson.manual_crop_original_storage_path.trim()
            : null;

    if (!backupStoragePath) {
        backupStoragePath = buildManualCropBackupPath(document.storage_path);
        const { error: backupError } = await admin.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .upload(backupStoragePath, buffer, {
                contentType,
                upsert: true,
            });

        if (backupError) {
            console.warn("[Admin preview] Failed to create manual-crop backup:", backupError);
            return NextResponse.json({ error: "Could not preserve the original image before cropping." }, { status: 500 });
        }
    }

    const processed = await processDocumentImageBuffer(buffer, contentType, 0, crop);

    if (!processed.cropApplied) {
        return NextResponse.json({ error: "The selected crop area is too small. Please draw a larger box." }, { status: 400 });
    }

    const { error: uploadError } = await admin.storage
        .from(WORKER_DOCUMENTS_BUCKET)
        .update(document.storage_path, processed.buffer, {
            contentType: processed.contentType,
            upsert: true,
        });

    if (uploadError) {
        console.warn("[Admin preview] Failed to save manual crop:", uploadError);
        return NextResponse.json({ error: "Failed to save the cropped document." }, { status: 500 });
    }

    const appliedAt = new Date().toISOString();
    const { error: updateError } = await admin
        .from("worker_documents")
        .update({
            ocr_json: {
                ...ocrJson,
                ...buildManualCropOcrPatch({
                    crop,
                    backupStoragePath,
                    appliedAt,
                }),
            },
            updated_at: appliedAt,
        })
        .eq("id", documentId);

    if (updateError) {
        console.warn("[Admin preview] Failed to persist manual crop metadata:", updateError);
        return NextResponse.json({ error: "Crop was saved, but metadata update failed." }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        previewUrl: `/api/admin/documents/${documentId}/preview?v=${Date.now()}`,
        manualCrop: crop,
    });
}
