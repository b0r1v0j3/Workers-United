// Shared profile completion logic — single source of truth
// Used by: worker dashboard (page.tsx), profile-reminders cron, check-incomplete-profiles cron

// ─── Field Labels ────────────────────────────────────────────────

const WORKER_FIELD_LABELS: Record<string, string> = {
    full_name: "Full Name",
    phone: "Phone Number",
    nationality: "Nationality",
    current_country: "Current Country",
    preferred_job: "Preferred Job",
    gender: "Gender",
    date_of_birth: "Date of Birth",
    birth_country: "Birth Country",
    birth_city: "Birth City",
    citizenship: "Citizenship",
    marital_status: "Marital Status",
    passport_number: "Passport Number",
    lives_abroad: "Lives Abroad",
    previous_visas: "Previous Visas",
    passport_doc: "Passport Document",
    biometric_photo_doc: "Biometric Photo",
};

const EMPLOYER_FIELD_LABELS: Record<string, string> = {
    company_name: "Company Name",
    company_registration_number: "Registration Number",
    company_address: "Company Address",
    contact_phone: "Contact Phone",
    country: "Country",
    city: "City",
    industry: "Industry",
    description: "Company Description",
};

// ─── Types ───────────────────────────────────────────────────────

export interface ProfileCompletionResult {
    /** 0-100 percentage */
    completion: number;
    /** Human-readable labels for missing fields */
    missingFields: string[];
    /** Total number of required fields */
    totalFields: number;
    /** Number of completed fields */
    completedFields: number;
}

interface WorkerData {
    profile: { full_name?: string | null } | null;
    candidate: {
        phone?: string | null;
        nationality?: string | null;
        current_country?: string | null;
        preferred_job?: string | null;
        gender?: string | null;
        date_of_birth?: string | null;
        birth_country?: string | null;
        birth_city?: string | null;
        citizenship?: string | null;
        marital_status?: string | null;
        passport_number?: string | null;
        lives_abroad?: boolean | null;
        previous_visas?: boolean | null;
    } | null;
    documents: { document_type: string }[];
}

interface EmployerData {
    employer: {
        company_name?: string | null;
        company_registration_number?: string | null;
        company_address?: string | null;
        contact_phone?: string | null;
        country?: string | null;
        city?: string | null;
        industry?: string | null;
        description?: string | null;
    } | null;
}

// ─── Main Functions ──────────────────────────────────────────────

export function getWorkerCompletion(data: WorkerData): ProfileCompletionResult {
    const { profile, candidate, documents } = data;
    const docTypes = (documents || []).map(d => d.document_type);

    const fields: Record<string, any> = {
        full_name: profile?.full_name,
        phone: candidate?.phone,
        nationality: candidate?.nationality,
        current_country: candidate?.current_country,
        preferred_job: candidate?.preferred_job,
        gender: candidate?.gender,
        date_of_birth: candidate?.date_of_birth,
        birth_country: candidate?.birth_country,
        birth_city: candidate?.birth_city,
        citizenship: candidate?.citizenship,
        marital_status: candidate?.marital_status,
        passport_number: candidate?.passport_number,
        lives_abroad: candidate?.lives_abroad,
        previous_visas: candidate?.previous_visas,
        passport_doc: docTypes.includes("passport"),
        biometric_photo_doc: docTypes.includes("biometric_photo"),
    };

    const totalFields = Object.keys(fields).length;
    const completedFields = Object.values(fields).filter(Boolean).length;
    const completion = Math.round((completedFields / totalFields) * 100);

    const missingFields = Object.entries(fields)
        .filter(([_, v]) => !v)
        .map(([k]) => WORKER_FIELD_LABELS[k] || k);

    return { completion, missingFields, totalFields, completedFields };
}

export function getEmployerCompletion(data: EmployerData): ProfileCompletionResult {
    const { employer } = data;

    const fields: Record<string, any> = {
        company_name: employer?.company_name,
        company_registration_number: employer?.company_registration_number,
        company_address: employer?.company_address,
        contact_phone: employer?.contact_phone,
        country: employer?.country,
        city: employer?.city,
        industry: employer?.industry,
        description: employer?.description,
    };

    const totalFields = Object.keys(fields).length;
    const completedFields = Object.values(fields).filter(Boolean).length;
    const completion = Math.round((completedFields / totalFields) * 100);

    const missingFields = Object.entries(fields)
        .filter(([_, v]) => !v)
        .map(([k]) => EMPLOYER_FIELD_LABELS[k] || k);

    return { completion, missingFields, totalFields, completedFields };
}
