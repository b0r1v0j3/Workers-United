import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildAutoCropOcrPatch,
    buildManualCropOcrPatch,
    resolveDocumentRotationToApply,
    sanitizeDocumentCrop,
} from "@/lib/document-image-processing";

describe("document-image-processing helpers", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-18T16:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("keeps sane crop percentages inside image bounds", () => {
        expect(sanitizeDocumentCrop({
            x: -4,
            y: 12,
            width: 110,
            height: 95,
        })).toEqual({
            x: 0,
            y: 12,
            width: 100,
            height: 88,
        });
    });

    it("rejects tiny crop selections", () => {
        expect(sanitizeDocumentCrop({
            x: 10,
            y: 10,
            width: 1.5,
            height: 20,
        })).toBeNull();
    });

    it("prefers fallback rotation when primary detector is weak", () => {
        expect(resolveDocumentRotationToApply(0, 0.2, 90)).toBe(90);
        expect(resolveDocumentRotationToApply(180, 0.8, 90)).toBe(180);
    });

    it("records auto-crop review metadata even when crop data exists", () => {
        expect(buildAutoCropOcrPatch({
            cropApplied: true,
            crop: { x: 8, y: 4, width: 71, height: 89 },
        })).toEqual({
            auto_crop_processed_at: "2026-03-18T16:00:00.000Z",
            auto_crop_applied: true,
            auto_crop: { x: 8, y: 4, width: 71, height: 89 },
        });
    });

    it("stores manual-crop metadata together with the backup path", () => {
        expect(buildManualCropOcrPatch({
            crop: { x: 3, y: 6, width: 81, height: 88 },
            backupStoragePath: "worker-docs/abc/_admin-originals/passport.jpg",
        })).toEqual({
            manual_crop_applied: true,
            manual_crop_applied_at: "2026-03-18T16:00:00.000Z",
            manual_crop: { x: 3, y: 6, width: 81, height: 88 },
            manual_crop_original_storage_path: "worker-docs/abc/_admin-originals/passport.jpg",
        });
    });
});
