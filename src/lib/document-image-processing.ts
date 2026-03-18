import sharp from "sharp";
import { normalizeQuarterTurnRotation } from "@/lib/document-ai";

export type DocumentCrop = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type ProcessedImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export function getProcessedImageMimeType(mimeType: string): ProcessedImageMimeType {
    if (mimeType === "image/png") {
        return "image/png";
    }

    if (mimeType === "image/webp") {
        return "image/webp";
    }

    return "image/jpeg";
}

export function resolveDocumentRotationToApply(
    primaryRotation: 0 | 90 | 180 | 270,
    primaryConfidence: number,
    fallbackRotation?: number
): 0 | 90 | 180 | 270 {
    const normalizedFallback = normalizeQuarterTurnRotation(fallbackRotation);

    if (primaryConfidence >= 0.45) {
        return primaryRotation;
    }

    if (primaryRotation === normalizedFallback) {
        return primaryRotation;
    }

    if (normalizedFallback !== 0) {
        return normalizedFallback;
    }

    return primaryRotation;
}

export function sanitizeDocumentCrop(crop: unknown): DocumentCrop | null {
    if (!crop || typeof crop !== "object" || Array.isArray(crop)) {
        return null;
    }

    const raw = crop as Partial<DocumentCrop>;
    const x = typeof raw.x === "number" ? raw.x : Number.NaN;
    const y = typeof raw.y === "number" ? raw.y : Number.NaN;
    const width = typeof raw.width === "number" ? raw.width : Number.NaN;
    const height = typeof raw.height === "number" ? raw.height : Number.NaN;

    if (![x, y, width, height].every(Number.isFinite)) {
        return null;
    }

    const safeX = Math.max(0, Math.min(99, x));
    const safeY = Math.max(0, Math.min(99, y));
    const maxWidth = 100 - safeX;
    const maxHeight = 100 - safeY;
    const safeWidth = Math.max(1, Math.min(maxWidth, width));
    const safeHeight = Math.max(1, Math.min(maxHeight, height));

    if (safeWidth < 3 || safeHeight < 3) {
        return null;
    }

    return {
        x: Number(safeX.toFixed(3)),
        y: Number(safeY.toFixed(3)),
        width: Number(safeWidth.toFixed(3)),
        height: Number(safeHeight.toFixed(3)),
    };
}

export async function processDocumentImageBuffer(
    buffer: Buffer,
    mimeType: string,
    rotationDegrees: 0 | 90 | 180 | 270,
    crop?: DocumentCrop | null
): Promise<{ buffer: Buffer; contentType: ProcessedImageMimeType; cropApplied: boolean }> {
    let pipeline = sharp(buffer).rotate();

    if (rotationDegrees !== 0) {
        pipeline = pipeline.rotate(rotationDegrees);
    }

    let cropApplied = false;
    const safeCrop = sanitizeDocumentCrop(crop);

    if (safeCrop) {
        const rotatedBuffer = await pipeline.toBuffer();
        const metadata = await sharp(rotatedBuffer).metadata();
        const imgW = metadata.width || 1;
        const imgH = metadata.height || 1;
        const cropX = Math.round((safeCrop.x / 100) * imgW);
        const cropY = Math.round((safeCrop.y / 100) * imgH);
        const cropW = Math.min(Math.round((safeCrop.width / 100) * imgW), imgW - cropX);
        const cropH = Math.min(Math.round((safeCrop.height / 100) * imgH), imgH - cropY);

        if (cropW > 50 && cropH > 50) {
            pipeline = sharp(rotatedBuffer).extract({
                left: cropX,
                top: cropY,
                width: cropW,
                height: cropH,
            });
            cropApplied = true;
        } else {
            pipeline = sharp(rotatedBuffer);
        }
    }

    const processedMimeType = getProcessedImageMimeType(mimeType);

    if (processedMimeType === "image/png") {
        return {
            buffer: await pipeline.png().toBuffer(),
            contentType: "image/png",
            cropApplied,
        };
    }

    if (processedMimeType === "image/webp") {
        return {
            buffer: await pipeline.webp({ quality: 92 }).toBuffer(),
            contentType: "image/webp",
            cropApplied,
        };
    }

    return {
        buffer: await pipeline.jpeg({ quality: 92 }).toBuffer(),
        contentType: "image/jpeg",
        cropApplied,
    };
}

export function buildAutoCropOcrPatch(options: {
    cropApplied: boolean;
    crop?: DocumentCrop | null;
    processedAt?: string;
}) {
    return {
        auto_crop_processed_at: options.processedAt || new Date().toISOString(),
        auto_crop_applied: options.cropApplied,
        ...(options.crop ? { auto_crop: options.crop } : {}),
    };
}

export function buildManualCropOcrPatch(options: {
    crop: DocumentCrop;
    backupStoragePath?: string | null;
    appliedAt?: string;
}) {
    return {
        manual_crop_applied: true,
        manual_crop_applied_at: options.appliedAt || new Date().toISOString(),
        manual_crop: options.crop,
        ...(options.backupStoragePath ? { manual_crop_original_storage_path: options.backupStoragePath } : {}),
    };
}
