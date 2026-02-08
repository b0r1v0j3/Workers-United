/**
 * Client-side image processing for biometric photo uploads.
 * Handles EXIF rotation and center-cropping to passport photo ratio.
 */

const BIOMETRIC_WIDTH = 600;
const BIOMETRIC_HEIGHT = 770; // ~35x45mm ratio (7:9)

/**
 * Fix EXIF orientation and auto-crop to biometric photo ratio.
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
