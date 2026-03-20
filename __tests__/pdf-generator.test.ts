import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_SUPPORT_EMAIL } from "@/lib/platform-contact";
import { buildPlaceholderData, type ContractDataForDocs } from "@/lib/pdf-generator";

function makeContractData(overrides: Partial<ContractDataForDocs> = {}): ContractDataForDocs {
    return {
        worker_full_name: "Marko Markovic",
        worker_passport_number: "P1234567",
        worker_nationality: "Serbian",
        worker_date_of_birth: "1990-01-02",
        worker_passport_expiry: "2030-12-31",
        worker_address: "Main Street 1",
        employer_company_name: "Workers United d.o.o.",
        employer_pib: "12345678",
        employer_address: "Company Street 10",
        employer_representative_name: "Ana Jovanovic",
        job_title: "Welder",
        salary_rsd: 120000,
        start_date: "2026-04-01",
        ...overrides,
    };
}

describe("buildPlaceholderData", () => {
    it("normalizes missing support email to the canonical Workers United contact", () => {
        const placeholderData = buildPlaceholderData(
            makeContractData({ contact_email: "   " })
        );

        expect(placeholderData.CONTACT_EMAIL).toBe(DEFAULT_PLATFORM_SUPPORT_EMAIL);
    });

    it("trims an explicitly provided support email", () => {
        const placeholderData = buildPlaceholderData(
            makeContractData({ contact_email: "  support@workersunited.eu  " })
        );

        expect(placeholderData.CONTACT_EMAIL).toBe("support@workersunited.eu");
    });
});
