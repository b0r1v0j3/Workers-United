import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_SUPPORT_EMAIL } from "@/lib/platform-contact";
import { ensureStoredContractData } from "@/lib/contract-data";

type QueryArgs = Array<[string, string, unknown]>;

function createMockSupabase() {
    const state = {
        insertedPayload: null as Record<string, unknown> | null,
    };

    const matchRecord = {
        id: "match-1",
        worker_id: "worker-1",
        employer_id: "employer-1",
        status: "active",
    };

    const workerRecord = {
        id: "worker-1",
        profile_id: "worker-profile-1",
        address: "Worker Address 1",
        current_country: null,
        country: null,
        passport_number: "P1234567",
        nationality: "Serbian",
        citizenship: null,
        date_of_birth: "1990-01-02",
        passport_expiry_date: "2030-12-31",
        passport_issue_date: "2020-01-01",
        passport_issued_by: "Ministry of Interior",
        birth_city: "Belgrade",
        gender: "Male",
    };

    const employerRecord = {
        id: "employer-1",
        profile_id: "employer-profile-1",
        company_name: "Workers United d.o.o.",
        tax_id: "12345678",
        company_registration_number: "12345678",
        company_address: "Company Street 10",
        city: "Belgrade",
        postal_code: "11000",
        founding_date: "2020-01-01",
        contact_phone: "+381641234567",
    };

    const workerProfile = {
        id: "worker-profile-1",
        full_name: "Marko Markovic",
        email: "marko@example.com",
        first_name: "Marko",
        last_name: "Markovic",
        user_type: "worker",
        created_at: "2026-01-01T00:00:00.000Z",
    };

    const employerProfile = {
        id: "employer-profile-1",
        full_name: "Ana Jovanovic",
        email: "ana@example.com",
        first_name: "Ana",
        last_name: "Jovanovic",
        user_type: "employer",
        created_at: "2026-01-01T00:00:00.000Z",
    };

    const workerDocuments = [
        {
            id: "doc-1",
            user_id: "worker-profile-1",
            document_type: "passport",
            status: "verified",
            extracted_data: {
                full_name: "Marko Markovic",
                passport_number: "P1234567",
                nationality: "Serbian",
                date_of_birth: "1990-01-02",
                expiry_date: "2030-12-31",
                gender: "Male",
            },
            ocr_json: {
                date_of_issue: "2020-01-01",
                issuing_authority: "Ministry of Interior",
                place_of_birth: "Belgrade",
                gender: "Male",
            },
        },
    ];

    const offers = [
        {
            id: "offer-1",
            status: "accepted",
            job_request_id: "job-1",
            job_requests: {
                id: "job-1",
                employer_id: "employer-1",
                title: "Welder",
                description: "Weld steel components",
                description_en: "Weld steel components",
                salary_rsd: 120000,
                accommodation_address: "Company Street 10",
                contract_duration_months: 12,
                work_schedule: null,
                status: "open",
                positions_count: 1,
                positions_filled: 1,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
            },
        },
    ];

    class MockBuilder {
        private readonly table: string;
        private readonly args: QueryArgs = [];

        constructor(table: string) {
            this.table = table;
        }

        select() {
            return this;
        }

        eq(field: string, value: unknown) {
            this.args.push(["eq", field, value]);
            return this;
        }

        in(field: string, value: unknown) {
            this.args.push(["in", field, value]);
            return this;
        }

        limit(value: number) {
            this.args.push(["limit", "limit", value]);
            return this;
        }

        maybeSingle() {
            return Promise.resolve({ data: this.resolveSingle(), error: null });
        }

        then<TResult1 = unknown, TResult2 = never>(
            onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
            return Promise.resolve({ data: this.resolveMany(), error: null }).then(onfulfilled, onrejected);
        }

        insert(payload: Record<string, unknown>) {
            state.insertedPayload = payload;
            return Promise.resolve({ error: null });
        }

        update(payload: Record<string, unknown>) {
            state.insertedPayload = payload;
            return Promise.resolve({ error: null });
        }

        private resolveSingle() {
            switch (this.table) {
                case "matches":
                    return matchRecord;
                case "worker_onboarding":
                    return workerRecord;
                case "employers":
                    return employerRecord;
                case "contract_data":
                    return null;
                case "profiles": {
                    const profileId = this.args.find(([method, field]) => method === "eq" && field === "id")?.[2];
                    if (profileId === workerProfile.id) {
                        return workerProfile;
                    }
                    if (profileId === employerProfile.id) {
                        return employerProfile;
                    }
                    return null;
                }
                default:
                    return null;
            }
        }

        private resolveMany() {
            switch (this.table) {
                case "worker_documents":
                    return workerDocuments;
                case "offers":
                    return offers;
                default:
                    return [];
            }
        }
    }

    const supabase = {
        from(table: string) {
            return new MockBuilder(table);
        },
    };

    return { supabase, state };
}

describe("ensureStoredContractData", () => {
    it("normalizes blank support email in stored and generated contract outputs", async () => {
        const { supabase, state } = createMockSupabase();

        const result = await ensureStoredContractData(supabase as never, "match-1");

        expect(state.insertedPayload).not.toBeNull();
        expect(state.insertedPayload?.contact_email).toBe(DEFAULT_PLATFORM_SUPPORT_EMAIL);
        expect(result.contractData.contact_email).toBe(DEFAULT_PLATFORM_SUPPORT_EMAIL);
    });
});
