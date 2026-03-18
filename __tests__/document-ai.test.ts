import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildDocumentOrientationOcrPatch,
    buildDocumentBoundsPrompt,
    evaluateBiometricPhotoGuardrails,
    evaluateDiplomaGuardrails,
    normalizeQuarterTurnRotation,
} from "@/lib/document-ai";

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

describe("document-ai crop prompts", () => {
    it("tells passport detection to prefer only the biodata page", () => {
        const prompt = buildDocumentBoundsPrompt("passport");

        expect(prompt).toContain("biodata / identity page");
        expect(prompt).toContain("crop those parts OUT");
        expect(prompt).toContain("machine-readable zone");
    });
});

describe("document-ai diploma guardrails", () => {
    it("rejects certificate-of-completion uploads as short-course documents", () => {
        const result = evaluateDiplomaGuardrails({
            document_title: "Certificate of Completion",
            document_description: "Certificate of Completion for Virtual Productivity Assistant training",
            institution_name: "VM Academy",
        });

        expect(result.isAccepted).toBe(false);
        expect(result.documentKind).toBe("short_course_certificate");
        expect(result.issues).toContain("short_course_not_accepted");
        expect(result.workerGuidance).toContain("cannot accept short course");
    });

    it("rejects transcript-only uploads", () => {
        const result = evaluateDiplomaGuardrails({
            document_kind: "transcript_or_marksheet",
            document_title: "Academic Transcript",
            institution_name: "Example University",
        });

        expect(result.isAccepted).toBe(false);
        expect(result.documentKind).toBe("transcript_or_marksheet");
        expect(result.issues).toContain("transcript_only");
    });

    it("accepts formal diploma wording from a school", () => {
        const result = evaluateDiplomaGuardrails({
            document_kind: "formal_diploma",
            document_title: "Bachelor of Science Degree",
            institution_name: "Example University",
            degree_type: "Bachelor of Science",
        });

        expect(result.isAccepted).toBe(true);
        expect(result.documentKind).toBe("formal_diploma");
    });
});

describe("document-ai biometric guardrails", () => {
    it("rejects printed portrait scans even when a face is visible", () => {
        const result = evaluateBiometricPhotoGuardrails({
            document_kind: "printed_photo_scan",
            summary: "This looks like a scan of an older printed portrait.",
            face_visible: true,
            exactly_one_person: true,
            meets_embassy_quality: false,
            quality_issues: ["scan_of_printed_photo"],
        });

        expect(result.isAccepted).toBe(false);
        expect(result.isCorrectType).toBe(true);
        expect(result.documentKind).toBe("printed_photo_scan");
        expect(result.issues).toContain("scan_of_printed_photo");
        expect(result.workerGuidance).toContain("Do not upload a scan");
    });

    it("rejects blurry low-resolution portrait photos for embassy quality", () => {
        const result = evaluateBiometricPhotoGuardrails({
            document_kind: "passport_style_photo",
            summary: "Biometric photo detected, but the image is soft and pixelated.",
            face_visible: true,
            exactly_one_person: true,
            meets_embassy_quality: false,
            quality_issues: ["blurry", "low_resolution", "pixelated"],
        });

        expect(result.isAccepted).toBe(false);
        expect(result.isCorrectType).toBe(true);
        expect(result.issues).toContain("blurry");
        expect(result.workerGuidance).toContain("sharper");
        expect(result.summary).toContain("pixelated");
    });

    it("accepts strong passport-style biometric photos", () => {
        const result = evaluateBiometricPhotoGuardrails({
            document_kind: "passport_style_photo",
            summary: "Strong passport-style biometric portrait with even lighting.",
            face_visible: true,
            exactly_one_person: true,
            meets_embassy_quality: true,
            quality_issues: [],
        });

        expect(result.isAccepted).toBe(true);
        expect(result.isCorrectType).toBe(true);
        expect(result.documentKind).toBe("passport_style_photo");
        expect(result.workerGuidance).toBeNull();
    });
});
