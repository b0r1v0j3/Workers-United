import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Tables, TablesInsert } from "@/lib/database.types";
import type { ContractDataForDocs } from "@/lib/pdf-generator";
import { normalizePlatformSupportEmail } from "@/lib/platform-contact";

type DBClient = SupabaseClient<Database>;
type WorkerRecord = Tables<"worker_onboarding">;
type WorkerDocument = Tables<"worker_documents">;
type ContractDataRow = Tables<"contract_data">;
type Employer = Tables<"employers">;
type JobRequest = Tables<"job_requests">;
type Profile = Tables<"profiles">;
type MatchSummary = Pick<Tables<"matches">, "id" | "worker_id" | "employer_id" | "status">;

type OfferWithJobRequest = {
    id: string;
    status: string | null;
    job_request_id: string | null;
    job_requests: JobRequest | JobRequest[] | null;
};

export interface ContractBuildResult {
    match: MatchSummary;
    worker: WorkerRecord;
    workerProfile: Profile | null;
    employer: Employer;
    employerProfile: Profile | null;
    jobRequest: JobRequest;
    documents: WorkerDocument[];
    passportDoc: WorkerDocument | null;
    storedContractData: ContractDataRow | null;
    durationMonths: number;
    contractData: ContractDataForDocs;
}

function asRecord(value: Json | null | undefined): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== "object") {
        return {};
    }

    return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
}

function toIsoDate(value: unknown): string | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString().split("T")[0];
}

function addMonths(isoDate: string, months: number): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().split("T")[0];
}

function subtractMonths(isoDate: string, months: number): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() - months);
    return date.toISOString().split("T")[0];
}

function getDefaultStartDate(): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 30);
    return date.toISOString().split("T")[0];
}

function getDurationMonths(jobRequest: JobRequest): number {
    if (typeof jobRequest.contract_duration_months === "number" && jobRequest.contract_duration_months > 0) {
        return Math.round(jobRequest.contract_duration_months);
    }

    return 12;
}

function getWorkerAddress(worker: WorkerRecord): string {
    return worker.address || worker.current_country || worker.country || "";
}

function getEmployerMb(employer: Employer): string {
    return employer.company_registration_number || employer.mb || employer.business_registry_number || "";
}

function getEmployerCity(employer: Employer): string {
    const value = [employer.city, employer.postal_code].filter(Boolean).join(", ");
    return value || "";
}

function firstJobRequest(value: JobRequest | JobRequest[] | null): JobRequest | null {
    if (!value) {
        return null;
    }

    return Array.isArray(value) ? value[0] || null : value;
}

function requireValue<T>(value: T | null | undefined, message: string): T {
    if (value === null || value === undefined) {
        throw new Error(message);
    }

    return value;
}

export function deriveStartDate(
    storedEndDate: string | null | undefined,
    durationMonths: number
): string {
    const normalizedEndDate = toIsoDate(storedEndDate);
    if (!normalizedEndDate) {
        return getDefaultStartDate();
    }

    return subtractMonths(normalizedEndDate, durationMonths);
}

function buildPersistedContractDataPayload(
    build: ContractBuildResult
): TablesInsert<"contract_data"> {
    const passportExtracted = asRecord(build.passportDoc?.extracted_data);
    const passportOcr = asRecord(build.passportDoc?.ocr_json);
    const defaultStartDate = getDefaultStartDate();
    const endDate = build.storedContractData?.end_date || addMonths(defaultStartDate, build.durationMonths);

    return {
        match_id: build.match.id,
        worker_passport_issue_date: toIsoDate(
            build.storedContractData?.worker_passport_issue_date ||
            passportOcr.date_of_issue ||
            build.worker.passport_issue_date
        ),
        worker_passport_issuer: asText(
            build.storedContractData?.worker_passport_issuer ||
            passportOcr.issuing_authority ||
            build.worker.passport_issued_by
        ),
        worker_place_of_birth: asText(
            build.storedContractData?.worker_place_of_birth ||
            passportOcr.place_of_birth ||
            build.worker.birth_city
        ),
        worker_gender: asText(
            build.storedContractData?.worker_gender ||
            passportExtracted.gender ||
            passportOcr.gender ||
            build.worker.gender
        ),
        employer_mb: asText(build.storedContractData?.employer_mb || getEmployerMb(build.employer)),
        employer_director: asText(
            build.storedContractData?.employer_director || build.employerProfile?.full_name
        ),
        job_description_sr: asText(
            build.storedContractData?.job_description_sr || build.jobRequest.description
        ),
        job_description_en: asText(
            build.storedContractData?.job_description_en || build.jobRequest.description_en
        ),
        end_date: toIsoDate(endDate),
        signing_date: toIsoDate(
            build.storedContractData?.signing_date || new Date()
        ),
        contact_email: asText(
            normalizePlatformSupportEmail(build.storedContractData?.contact_email)
        ),
        contact_phone: asText(
            build.storedContractData?.contact_phone || build.employer.contact_phone
        ),
        employer_city: asText(
            build.storedContractData?.employer_city || getEmployerCity(build.employer)
        ),
        signing_city: asText(
            build.storedContractData?.signing_city || build.employer.city
        ),
        employer_founding_date: asText(
            build.storedContractData?.employer_founding_date || build.employer.founding_date
        ),
        employer_apr_number: asText(
            build.storedContractData?.employer_apr_number || build.employer.business_registry_number
        ),
    };
}

function buildContractDocumentPayload(build: Omit<ContractBuildResult, "contractData">): ContractDataForDocs {
    const passportExtracted = asRecord(build.passportDoc?.extracted_data);
    const passportOcr = asRecord(build.passportDoc?.ocr_json);
    const durationMonths = build.durationMonths;
    const startDate = deriveStartDate(build.storedContractData?.end_date, durationMonths);
    const endDate = toIsoDate(build.storedContractData?.end_date) || addMonths(startDate, durationMonths);
    const signingDate = toIsoDate(build.storedContractData?.signing_date) || toIsoDate(new Date()) || startDate;

    return {
        worker_full_name: asText(passportExtracted.full_name) || build.workerProfile?.full_name || "",
        worker_passport_number: asText(passportExtracted.passport_number) || build.worker.passport_number || "",
        worker_nationality: asText(passportExtracted.nationality) || build.worker.nationality || build.worker.citizenship || "",
        worker_date_of_birth: toIsoDate(passportExtracted.date_of_birth) || build.worker.date_of_birth || "",
        worker_passport_expiry: toIsoDate(passportExtracted.expiry_date) || build.worker.passport_expiry_date || "",
        worker_address: getWorkerAddress(build.worker),
        worker_passport_issue_date: toIsoDate(
            build.storedContractData?.worker_passport_issue_date ||
            passportOcr.date_of_issue ||
            build.worker.passport_issue_date
        ),
        worker_passport_issuer: asText(
            build.storedContractData?.worker_passport_issuer ||
            passportOcr.issuing_authority ||
            build.worker.passport_issued_by
        ),
        worker_place_of_birth: asText(
            build.storedContractData?.worker_place_of_birth ||
            passportOcr.place_of_birth ||
            build.worker.birth_city
        ),
        worker_gender: asText(
            build.storedContractData?.worker_gender ||
            passportExtracted.gender ||
            passportOcr.gender ||
            build.worker.gender
        ),
        employer_company_name: build.employer.company_name || "",
        employer_pib: build.employer.tax_id || "",
        employer_address: build.employer.company_address || "",
        employer_representative_name: build.employerProfile?.full_name || "",
        employer_mb: asText(build.storedContractData?.employer_mb || getEmployerMb(build.employer)),
        employer_city: asText(build.storedContractData?.employer_city || getEmployerCity(build.employer)),
        employer_director: asText(
            build.storedContractData?.employer_director || build.employerProfile?.full_name
        ),
        employer_founding_date: asText(
            build.storedContractData?.employer_founding_date || build.employer.founding_date
        ),
        employer_apr_number: asText(
            build.storedContractData?.employer_apr_number || build.employer.business_registry_number
        ),
        job_title: build.jobRequest.title || "",
        job_description_sr: asText(
            build.storedContractData?.job_description_sr || build.jobRequest.description
        ),
        job_description_en: asText(
            build.storedContractData?.job_description_en || build.jobRequest.description_en
        ),
        salary_rsd: asNumber(build.jobRequest.salary_rsd) || 0,
        start_date: startDate,
        end_date: endDate,
        signing_date: signingDate,
        contact_email: asText(
            normalizePlatformSupportEmail(build.storedContractData?.contact_email)
        ),
        contact_phone: asText(
            build.storedContractData?.contact_phone || build.employer.contact_phone
        ),
        accommodation_address: asText(
            build.jobRequest.accommodation_address || build.employer.company_address
        ),
        signing_city: asText(
            build.storedContractData?.signing_city || build.employer.city
        ),
    };
}

export async function buildContractDataForMatch(
    supabase: DBClient,
    matchId: string
): Promise<ContractBuildResult> {
    const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("id, worker_id, employer_id, status")
        .eq("id", matchId)
        .maybeSingle();

    if (matchError) {
        throw new Error(`Failed to load match: ${matchError.message}`);
    }

    const currentMatch = requireValue(match, "Match not found");
    const workerId = requireValue(currentMatch.worker_id, "Match is missing worker reference");
    const employerId = requireValue(currentMatch.employer_id, "Match is missing employer reference");

    const [
        workerResult,
        employerResult,
        contractDataResult,
        offerResult,
    ] = await Promise.all([
        supabase
            .from("worker_onboarding")
            .select("*")
            .eq("id", workerId)
            .maybeSingle(),
        supabase
            .from("employers")
            .select("*")
            .eq("id", employerId)
            .maybeSingle(),
        supabase
            .from("contract_data")
            .select("*")
            .eq("match_id", matchId)
            .limit(1)
            .maybeSingle(),
        supabase
            .from("offers")
            .select(`
                id,
                status,
                job_request_id,
                job_requests (
                    id,
                    employer_id,
                    title,
                    description,
                    description_en,
                    salary_rsd,
                    accommodation_address,
                    contract_duration_months,
                    work_schedule,
                    status,
                    positions_count,
                    positions_filled,
                    created_at,
                    updated_at
                )
            `)
            .eq("worker_id", workerId)
            .in("status", ["accepted", "pending"])
            .limit(10),
    ]);

    if (workerResult.error) {
        throw new Error(`Failed to load worker data: ${workerResult.error.message}`);
    }

    if (employerResult.error) {
        throw new Error(`Failed to load employer data: ${employerResult.error.message}`);
    }

    if (contractDataResult.error) {
        throw new Error(`Failed to load contract data: ${contractDataResult.error.message}`);
    }

    if (offerResult.error) {
        throw new Error(`Failed to load offer/job data: ${offerResult.error.message}`);
    }

    const worker = requireValue(workerResult.data, "Worker record not found");
    const employer = requireValue(employerResult.data, "Employer record not found");
    const offers = (offerResult.data || []) as unknown as OfferWithJobRequest[];

    const matchedJobRequest = offers
        .map(offer => firstJobRequest(offer.job_requests))
        .find(jobRequest => jobRequest?.employer_id === employerId)
        || firstJobRequest(offers[0]?.job_requests || null);

    const jobRequest = requireValue(matchedJobRequest, "Accepted offer job data not found");
    const durationMonths = getDurationMonths(jobRequest);

    const [
        workerProfileResult,
        employerProfileResult,
        workerDocumentsResult,
    ] = await Promise.all([
        worker.profile_id
            ? supabase.from("profiles").select("id, full_name, email, first_name, last_name, user_type, created_at").eq("id", worker.profile_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        employer.profile_id
            ? supabase.from("profiles").select("id, full_name, email, first_name, last_name, user_type, created_at").eq("id", employer.profile_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        worker.profile_id
            ? supabase.from("worker_documents").select("*").eq("user_id", worker.profile_id)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (workerProfileResult.error) {
        throw new Error(`Failed to load worker profile: ${workerProfileResult.error.message}`);
    }

    if (employerProfileResult.error) {
        throw new Error(`Failed to load employer profile: ${employerProfileResult.error.message}`);
    }

    if (workerDocumentsResult.error) {
        throw new Error(`Failed to load worker documents: ${workerDocumentsResult.error.message}`);
    }

    const documents = workerDocumentsResult.data || [];
    const verifiedPassport = documents.find(
        document => document.document_type === "passport" && document.status === "verified"
    ) || null;
    const latestPassport = verifiedPassport || documents.find(
        document => document.document_type === "passport"
    ) || null;

    const storedContractData = contractDataResult.data || null;
    const buildWithoutPayload = {
        match: currentMatch,
        worker,
        workerProfile: workerProfileResult.data || null,
        employer,
        employerProfile: employerProfileResult.data || null,
        jobRequest,
        documents,
        passportDoc: latestPassport,
        storedContractData,
        durationMonths,
    };

    return {
        ...buildWithoutPayload,
        contractData: buildContractDocumentPayload(buildWithoutPayload),
    };
}

export async function ensureStoredContractData(
    supabase: DBClient,
    matchId: string
): Promise<ContractBuildResult> {
    const initialBuild = await buildContractDataForMatch(supabase, matchId);
    const payload = buildPersistedContractDataPayload(initialBuild);

    if (initialBuild.storedContractData) {
        const { error: updateError } = await supabase
            .from("contract_data")
            .update(payload)
            .eq("match_id", matchId);

        if (updateError) {
            throw new Error(`Failed to update contract data: ${updateError.message}`);
        }
    } else {
        const { error: insertError } = await supabase
            .from("contract_data")
            .insert(payload);

        if (insertError) {
            throw new Error(`Failed to create contract data: ${insertError.message}`);
        }
    }

    return buildContractDataForMatch(supabase, matchId);
}
