import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDocumentOrientationOcrPatch, normalizeQuarterTurnRotation } from "@/lib/document-ai";

describe("document-ai orientation helpers", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-17T08:30:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("keeps only valid quarter-turn rotations", () => {
        expect(normalizeQuarterTurnRotation(0)).toBe(0);
        expect(normalizeQuarterTurnRotation(90)).toBe(90);
        expect(normalizeQuarterTurnRotation(180)).toBe(180);
        expect(normalizeQuarterTurnRotation(270)).toBe(270);
        expect(normalizeQuarterTurnRotation(45)).toBe(0);
        expect(normalizeQuarterTurnRotation("180")).toBe(0);
    });

    it("builds a stable OCR patch for orientation metadata", () => {
        expect(buildDocumentOrientationOcrPatch({
            detectedRotationDegrees: 180,
            appliedRotationDegrees: 180,
            confidence: 0.88,
            summary: "Document is upside down.",
            cropApplied: true,
        })).toEqual({
            orientation_processed_at: "2026-03-17T08:30:00.000Z",
            detected_rotation_to_upright_degrees: 180,
            auto_rotation_applied_degrees: 180,
            orientation_detection_confidence: 0.88,
            orientation_summary: "Document is upside down.",
            auto_crop_applied: true,
        });
    });
});
