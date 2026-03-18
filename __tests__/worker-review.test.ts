import { describe, expect, it } from "vitest";
import {
    buildWorkerPassportAutofillPatch,
    getPendingApprovalTargetStatus,
    hasAllRequiredWorkerDocumentsVerified,
    normalizePassportOcrDate,
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

    it("normalizes OCR passport dates from common formats", () => {
        expect(normalizePassportOcrDate("2024-10-23T00:00:00.000Z")).toBe("2024-10-23");
        expect(normalizePassportOcrDate("23/10/2024")).toBe("2024-10-23");
        expect(normalizePassportOcrDate("23 OCT 2024")).toBe("2024-10-23");
    });

    it("builds a worker passport autofill patch only for empty fields", () => {
        expect(buildWorkerPassportAutofillPatch(
            {
                passport_issued_by: null,
                passport_issue_date: null,
                passport_expiry_date: "",
            },
            {
                issuing_authority: "BELAKANG PADANG",
                date_of_issue: "23 OCT 2024",
                expiry_date: "23/10/2034",
            }
        )).toEqual({
            passport_issued_by: "BELAKANG PADANG",
            passport_issue_date: "2024-10-23",
            passport_expiry_date: "2034-10-23",
        });
    });

    it("never overwrites existing worker passport fields during OCR autofill", () => {
        expect(buildWorkerPassportAutofillPatch(
            {
                passport_issued_by: "DHAKA",
                passport_issue_date: "2024-01-01",
                passport_expiry_date: "2034-01-01",
            },
            {
                issuing_authority: "BELAKANG PADANG",
                date_of_issue: "23 OCT 2024",
                expiry_date: "23/10/2034",
            }
        )).toEqual({});
    });
});
