import { describe, it, expect } from "vitest";
import { getEntryFeeEligibility } from "@/lib/payment-eligibility";

describe("getEntryFeeEligibility", () => {
    it("blocks when worker profile is missing", () => {
        const result = getEntryFeeEligibility(null);

        expect(result.allowed).toBe(false);
        expect(result.status).toBe(404);
        expect(result.error).toContain("Worker profile not found");
    });

    it("blocks when entry fee is already paid", () => {
        const result = getEntryFeeEligibility({ entry_fee_paid: true });

        expect(result.allowed).toBe(false);
        expect(result.status).toBe(400);
        expect(result.error).toContain("Entry fee already paid");
    });

    it("blocks payment until the profile is complete and admin approved", () => {
        const candidate = {
            entry_fee_paid: false,
            profile_completion: 100,
            admin_approved: false,
        };

        const result = getEntryFeeEligibility(candidate);

        expect(result.allowed).toBe(false);
        expect(result.status).toBe(400);
        expect(result.error).toContain("admin review");
    });

    it("allows payment only when the profile is complete and approved", () => {
        const candidate = {
            entry_fee_paid: false,
            profile_completion: 100,
            admin_approved: true,
        };

        const result = getEntryFeeEligibility(candidate);

        expect(result.allowed).toBe(true);
    });
});
