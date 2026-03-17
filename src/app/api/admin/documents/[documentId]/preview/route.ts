import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import { buildDocumentOrientationOcrPatch, detectDocumentOrientation } from "@/lib/document-ai";
import sharp from "sharp";

export const dynamic = "force-dynamic";

interface RouteProps {
    params: Promise<{ documentId: string }>;
}

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

async function renderNormalizedImage(buffer: Buffer, mimeType: string, rotationDegrees: 0 | 90 | 180 | 270) {
    let pipeline = sharp(buffer).rotate();

    if (rotationDegrees !== 0) {
        pipeline = pipeline.rotate(rotationDegrees);
    }

    if (mimeType === "image/png") {
        return {
            buffer: await pipeline.png().toBuffer(),
            contentType: "image/png",
        };
    }

    if (mimeType === "image/webp") {
        return {
            buffer: await pipeline.webp({ quality: 92 }).toBuffer(),
            contentType: "image/webp",
        };
    }

    return {
        buffer: await pipeline.jpeg({ quality: 92 }).toBuffer(),
        contentType: "image/jpeg",
    };
}

export async function GET(_request: Request, { params }: RouteProps) {
    const { documentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: document, error: documentError } = await admin
        .from("worker_documents")
        .select("storage_path, document_type, ocr_json")
        .eq("id", documentId)
        .maybeSingle();

    if (documentError || !document?.storage_path) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: file, error: downloadError } = await admin.storage
        .from(WORKER_DOCUMENTS_BUCKET)
        .download(document.storage_path);

    if (downloadError || !file) {
        return NextResponse.json({ error: "Stored document not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = getInlineFileName(document.storage_path, document.document_type);
    const contentType = getMimeType(fileName, file.type);
    const ocrJson = normalizeOcrJson(document.ocr_json);

    if (!isImageMimeType(contentType) || hasProcessedOrientation(ocrJson)) {
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${fileName}"`,
                "Cache-Control": "private, no-store, max-age=0",
                "X-Content-Type-Options": "nosniff",
            },
        });
    }

    try {
        const orientation = await detectDocumentOrientation({
            data: buffer.toString("base64"),
            mimeType: contentType,
        }, document.document_type);

        const hasOrientationSignal = orientation.confidence > 0 || !!orientation.summary;

        if (!hasOrientationSignal) {
            return new NextResponse(new Uint8Array(buffer), {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `inline; filename="${fileName}"`,
                    "Cache-Control": "private, no-store, max-age=0",
                    "X-Content-Type-Options": "nosniff",
                },
            });
        }

        const normalized = await renderNormalizedImage(buffer, contentType, orientation.rotationDegrees);
        const orientationOcrPatch = buildDocumentOrientationOcrPatch({
            detectedRotationDegrees: orientation.rotationDegrees,
            appliedRotationDegrees: orientation.rotationDegrees,
            confidence: orientation.confidence,
            summary: orientation.summary,
        });

        after(async () => {
            const { error: uploadError } = await admin.storage
                .from(WORKER_DOCUMENTS_BUCKET)
                .update(document.storage_path, normalized.buffer, {
                    contentType: normalized.contentType,
                    upsert: true,
                });

            if (uploadError) {
                console.warn("[Admin preview] Failed to persist normalized document:", uploadError);
                return;
            }

            const { error: updateError } = await admin
                .from("worker_documents")
                .update({
                    ocr_json: {
                        ...ocrJson,
                        ...orientationOcrPatch,
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq("id", documentId);

            if (updateError) {
                console.warn("[Admin preview] Failed to persist orientation metadata:", updateError);
            }
        });

        return new NextResponse(new Uint8Array(normalized.buffer), {
            headers: {
                "Content-Type": normalized.contentType,
                "Content-Disposition": `inline; filename="${fileName}"`,
                "Cache-Control": "private, no-store, max-age=0",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.warn("[Admin preview] Orientation normalization failed:", error);
    }

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${fileName}"`,
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
