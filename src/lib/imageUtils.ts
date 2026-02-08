/**
 * Client-side image processing for document uploads.
 * Handles EXIF rotation for all images and center-cropping for biometric photos.
 */

const BIOMETRIC_WIDTH = 600;
const BIOMETRIC_HEIGHT = 770; // ~35x45mm ratio (7:9)

/**
 * Fix EXIF orientation for any image.
 * Returns a new File with correct rotation applied.
 */
export async function fixImageOrientation(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
    );

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
        type: "image/jpeg",
        lastModified: Date.now(),
    });
}

/**
 * Fix EXIF orientation and auto-crop to biometric photo ratio (7:9).
 * Returns a new File ready for upload.
 */
export async function processBiometricPhoto(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    // Calculate crop dimensions for 7:9 ratio (centered)
    const targetRatio = 7 / 9;
    const imageRatio = bitmap.width / bitmap.height;

    let cropX = 0;
    let cropY = 0;
    let cropW = bitmap.width;
    let cropH = bitmap.height;

    if (imageRatio > targetRatio) {
        // Image is wider than target — crop sides
        cropW = Math.round(bitmap.height * targetRatio);
        cropX = Math.round((bitmap.width - cropW) / 2);
    } else {
        // Image is taller than target — crop top/bottom
        cropH = Math.round(bitmap.width / targetRatio);
        cropY = Math.round((bitmap.height - cropH) / 2);
    }

    // Draw cropped and resized result
    const canvas = document.createElement("canvas");
    canvas.width = BIOMETRIC_WIDTH;
    canvas.height = BIOMETRIC_HEIGHT;
    const ctx = canvas.getContext("2d")!;

    ctx.drawImage(
        bitmap,
        cropX, cropY, cropW, cropH,     // source crop
        0, 0, BIOMETRIC_WIDTH, BIOMETRIC_HEIGHT  // destination
    );

    bitmap.close();

    // Convert canvas to File
    const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
    );

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
        type: "image/jpeg",
        lastModified: Date.now(),
    });
}

/**
 * Stitch 2 images vertically into one (e.g., front + back of passport).
 * Both images are EXIF-corrected and scaled to the same width.
 */
export async function stitchImages(file1: File, file2: File): Promise<File> {
    const [bmp1, bmp2] = await Promise.all([
        createImageBitmap(file1, { imageOrientation: "from-image" }),
        createImageBitmap(file2, { imageOrientation: "from-image" }),
    ]);

    // Use the wider image's width, scale the other to match
    const targetWidth = Math.max(bmp1.width, bmp2.width);
    const scale1 = targetWidth / bmp1.width;
    const scale2 = targetWidth / bmp2.width;
    const h1 = Math.round(bmp1.height * scale1);
    const h2 = Math.round(bmp2.height * scale2);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = h1 + h2;
    const ctx = canvas.getContext("2d")!;

    // Draw first image at top
    ctx.drawImage(bmp1, 0, 0, targetWidth, h1);
    // Draw second image below
    ctx.drawImage(bmp2, 0, h1, targetWidth, h2);

    bmp1.close();
    bmp2.close();

    const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
    );

    return new File([blob], "combined_document.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
    });
}
