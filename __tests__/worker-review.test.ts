import { describe, expect, it } from "vitest";
import {
    getPendingApprovalTargetStatus,
    hasAllRequiredWorkerDocumentsVerified,
} from "@/lib/worker-review";

describe("worker-review helpers", () => {
    it("requires all three worker documents to be admin-verified", () => {
        expect(hasAllRequiredWorkerDocumentsVerified([
            { document_type: "passport", status: "verified" },
            { document_type: "biometric_photo", status: "verified" },
            { document_type: "diploma", status: "verified" },
        ])).toBe(true);
    });

    it("does not treat manual-review documents as verified", () => {
        expect(hasAllRequiredWorkerDocumentsVerified([
            { document_type: "passport", status: "verified" },
            { document_type: "biometric_photo", status: "manual_review" },
            { document_type: "diploma", status: "verified" },
        ])).toBe(false);
    });

    it("queues complete unpaid workers for pending approval", () => {
        expect(getPendingApprovalTargetStatus({
            completion: 100,
            entryFeePaid: false,
            adminApproved: false,
            currentStatus: "NEW",
        })).toBe("PENDING_APPROVAL");
    });

    it("drops workers out of pending approval when readiness falls below 100", () => {
        expect(getPendingApprovalTargetStatus({
            completion: 99,
            entryFeePaid: false,
            adminApproved: false,
            currentStatus: "PENDING_APPROVAL",
        })).toBe("NEW");
    });
});
