import { describe, it, expect } from "vitest";
import { getEntryFeeEligibility } from "@/lib/payment-eligibility";

describe("getEntryFeeEligibility", () => {
    it("blocks when candidate profile is missing", () => {
        const result = getEntryFeeEligibility(null);

        expect(result.allowed).toBe(false);
        expect(result.status).toBe(404);
        expect(result.error).toContain("Candidate profile not found");
    });

    it("blocks when entry fee is already paid", () => {
        const result = getEntryFeeEligibility({ entry_fee_paid: true });

        expect(result.allowed).toBe(false);
        expect(result.status).toBe(400);
        expect(result.error).toContain("Entry fee already paid");
    });

    it("allows payment for unpaid profiles regardless of admin approval or status fields", () => {
        const candidate = {
            entry_fee_paid: false,
            admin_approved: false,
            status: "PENDING_APPROVAL",
        };

        const result = getEntryFeeEligibility(candidate);

        expect(result.allowed).toBe(true);
    });
});
