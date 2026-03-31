import { describe, it, expect } from "vitest";
import {
    getEntryFeeEligibility,
    getEntryFeeUnlockState,
    resolveEntryFeeEligibilityForWorker,
    WORKER_ENTRY_FEE_READINESS_COLUMNS,
} from "@/lib/payment-eligibility";

describe("getEntryFeeEligibility", () => {
    it("keeps the checkout readiness columns aligned with worker completion requirements", () => {
        const requiredWorkerFields = [
            "phone",
            "nationality",
            "current_country",
            "preferred_job",
            "gender",
            "date_of_birth",
            "birth_country",
            "birth_city",
            "citizenship",
            "marital_status",
            "passport_number",
            "passport_issued_by",
            "passport_issue_date",
            "passport_expiry_date",
            "lives_abroad",
            "previous_visas",
            "family_data",
        ];

        for (const field of requiredWorkerFields) {
            expect(WORKER_ENTRY_FEE_READINESS_COLUMNS).toContain(field);
        }
    });

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
        expect(result.error).toContain("required documents");
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

    it("allows payment when admin manually approves before the profile reaches 100%", () => {
        const unlockState = getEntryFeeUnlockState({
            entry_fee_paid: false,
            profile_completion: 72,
            admin_approved: true,
        });

        expect(unlockState.allowed).toBe(true);
        expect(unlockState.reason).toBe("ready");
        expect(unlockState.manualOverride).toBe(true);
    });

    it("resolves checkout eligibility from the full worker/profile/document snapshot", () => {
        const resolution = resolveEntryFeeEligibilityForWorker({
            profile: { full_name: "Sanae Benyoussef" },
            worker: {
                entry_fee_paid: false,
                admin_approved: false,
                phone: "+212656548490",
                nationality: "Moroccan",
                current_country: "Morocco",
                preferred_job: "Hospitality",
                gender: "Female",
                date_of_birth: "1996-01-01",
                birth_country: "Morocco",
                birth_city: "Casablanca",
                citizenship: "Moroccan",
                marital_status: "Single",
                passport_number: "AB123456",
                passport_issued_by: "Morocco",
                passport_issue_date: "2024-01-01",
                passport_expiry_date: "2034-01-01",
                lives_abroad: false,
                previous_visas: false,
            },
            documents: [
                { document_type: "passport" },
                { document_type: "biometric_photo" },
                { document_type: "diploma" },
            ],
        });

        expect(resolution.profileCompletion).toBe(100);
        expect(resolution.unlockState.allowed).toBe(false);
        expect(resolution.unlockState.reason).toBe("pending_admin_review");
    });

    it("marks the same full snapshot as ready once admin approval exists", () => {
        const resolution = resolveEntryFeeEligibilityForWorker({
            profile: { full_name: "Sanae Benyoussef" },
            worker: {
                entry_fee_paid: false,
                admin_approved: true,
                phone: "+212656548490",
                nationality: "Moroccan",
                current_country: "Morocco",
                preferred_job: "Hospitality",
                gender: "Female",
                date_of_birth: "1996-01-01",
                birth_country: "Morocco",
                birth_city: "Casablanca",
                citizenship: "Moroccan",
                marital_status: "Single",
                passport_number: "AB123456",
                passport_issued_by: "Morocco",
                passport_issue_date: "2024-01-01",
                passport_expiry_date: "2034-01-01",
                lives_abroad: false,
                previous_visas: false,
            },
            documents: [
                { document_type: "passport" },
                { document_type: "biometric_photo" },
                { document_type: "diploma" },
            ],
        });

        expect(resolution.profileCompletion).toBe(100);
        expect(resolution.unlockState.allowed).toBe(true);
        expect(resolution.unlockState.reason).toBe("ready");
    });
});
