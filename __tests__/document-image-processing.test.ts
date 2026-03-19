import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildAiOriginalBackupPath,
    buildAutoCropOcrPatch,
    buildManualCropOcrPatch,
    collectDocumentStoragePathsForCleanup,
    getRestorableDocumentBackupPath,
    resolveDocumentRotationToApply,
    sanitizeDocumentCrop,
    shouldApplyAutoCropForDocument,
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

    it("skips suspicious passport crops that keep almost the full top spread", () => {
        expect(shouldApplyAutoCropForDocument("passport", {
            x: 0,
            y: 0,
            width: 100,
            height: 80,
        })).toBe(false);
    });

    it("accepts tighter passport crops that isolate the biodata page", () => {
        expect(shouldApplyAutoCropForDocument("passport", {
            x: 8,
            y: 6,
            width: 66,
            height: 86,
        })).toBe(true);
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

    it("builds a stable AI-original backup path beside the document", () => {
        expect(buildAiOriginalBackupPath("abc/passport/image.jpg")).toBe("abc/passport/_ai-originals/image.jpg");
    });

    it("prefers manual backup first and falls back to AI backup", () => {
        expect(getRestorableDocumentBackupPath({
            manual_crop_original_storage_path: "manual.jpg",
            ai_original_storage_path: "ai.jpg",
        })).toBe("manual.jpg");

        expect(getRestorableDocumentBackupPath({
            ai_original_storage_path: "ai.jpg",
        })).toBe("ai.jpg");
    });

    it("collects primary and backup storage paths without duplicates", () => {
        expect(collectDocumentStoragePathsForCleanup("current.jpg", {
            manual_crop_original_storage_path: "manual.jpg",
            ai_original_storage_path: "current.jpg",
        })).toEqual(["current.jpg", "manual.jpg"]);
    });
});
