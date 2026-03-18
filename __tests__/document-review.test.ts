import { describe, expect, it } from "vitest";
import { buildDocumentAiSummary, buildDocumentRequestReason, humanizeDocumentType } from "@/lib/document-review";

describe("document-review helpers", () => {
    it("builds a specific re-upload instruction for passport covers", () => {
        const reason = buildDocumentRequestReason("passport", {
            document_kind: "passport_cover",
            issues: ["passport_cover_only"],
        });

        expect(reason).toContain("identity page");
        expect(reason).toContain("closed passport cover");
    });

    it("prefers stored worker guidance when AI already generated one", () => {
        const reason = buildDocumentRequestReason("passport", {
            worker_guidance: "Upload the inside passport biodata page.",
        });

        expect(reason).toBe("Upload the inside passport biodata page.");
    });

    it("creates a readable passport summary from OCR data", () => {
        const summary = buildDocumentAiSummary("passport", {
            full_name: "ISLAM MD TOWHIDUL",
            passport_number: "B00083114",
            expiry_date: "2032-01-29",
        });

        expect(summary).toContain("ISLAM MD TOWHIDUL");
        expect(summary).toContain("B00083114");
        expect(summary).toContain("2032-01-29");
    });

    it("humanizes snake_case document names", () => {
        expect(humanizeDocumentType("biometric_photo")).toBe("Biometric Photo");
    });

    it("gives strict diploma guidance for short-course certificates", () => {
        const reason = buildDocumentRequestReason("diploma", {
            document_kind: "short_course_certificate",
            issues: ["short_course_not_accepted"],
        });

        expect(reason).toContain("formal vocational diploma");
        expect(reason).toContain("certificate of completion");
    });

    it("creates a short-course summary for rejected diploma uploads", () => {
        const summary = buildDocumentAiSummary("diploma", {
            document_kind: "short_course_certificate",
            institution_name: "VM Academy",
        });

        expect(summary).toContain("Short course certificate");
        expect(summary).toContain("VM Academy");
    });
});
