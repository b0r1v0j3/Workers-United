import { describe, expect, it } from "vitest";

import { getWorkerDocumentProgress } from "@/lib/worker-documents";

describe("getWorkerDocumentProgress", () => {
    it("counts required uploaded and verified document types uniquely", () => {
        const progress = getWorkerDocumentProgress([
            { document_type: "passport", status: "uploaded" },
            { document_type: "passport", status: "verified" },
            { document_type: "biometric_photo", status: "manual_review" },
            { document_type: "diploma", status: "rejected" },
            { document_type: "diploma", status: "uploaded" },
        ]);

        expect(progress.requiredCount).toBe(3);
        expect(progress.uploadedCount).toBe(3);
        expect(progress.verifiedCount).toBe(1);
        expect(progress.pendingCount).toBe(2);
        expect(progress.rejectedCount).toBe(1);
    });

    it("ignores unknown document types", () => {
        const progress = getWorkerDocumentProgress([
            { document_type: "police_record", status: "verified" },
            { document_type: "passport", status: "verified" },
        ]);

        expect(progress.uploadedCount).toBe(1);
        expect(progress.verifiedCount).toBe(1);
        expect(progress.pendingCount).toBe(0);
    });
});
