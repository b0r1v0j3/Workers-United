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
    passport_issued_by: "Passport Issuing Authority",
    passport_issue_date: "Passport Issue Date",
    passport_expiry_date: "Passport Expiry Date",
    lives_abroad: "Lives Abroad",
    previous_visas: "Previous Visas",
    passport_doc: "Passport Document",
    biometric_photo_doc: "Biometric Photo",
    diploma_doc: "Diploma / Certificate",
    spouse_data: "Spouse Details (required if married)",
};

const EMPLOYER_FIELD_LABELS: Record<string, string> = {
    company_name: "Company Name",
    company_registration_number: "Registration Number",
    company_address: "Company Address",
    contact_phone: "Contact Phone",
    country: "Country",
    city: "City",
    postal_code: "Postal Code",
    industry: "Industry",
    description: "Company Description",
    business_registry_number: "Business Registry Number",
    founding_date: "Company Founding Date",
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
        passport_issued_by?: string | null;
        passport_issue_date?: string | null;
        passport_expiry_date?: string | null;
        lives_abroad?: boolean | null;
        previous_visas?: boolean | null;
        family_data?: {
            spouse?: { first_name?: string; last_name?: string; dob?: string } | null;
            children?: any[] | null;
        } | null;
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
        postal_code?: string | null;
        industry?: string | null;
        description?: string | null;
        business_registry_number?: string | null;
        founding_date?: string | null;
    } | null;
}

// ─── Main Functions ──────────────────────────────────────────────

export function getWorkerCompletion(data: WorkerData): ProfileCompletionResult {
    const { profile, candidate, documents } = data;
    const docTypes = (documents || []).map(d => d.document_type);

    // Fields where `false` is a valid user answer (they chose "No")
    const BOOLEAN_ANSWER_FIELDS = new Set(['lives_abroad', 'previous_visas']);

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
        passport_issued_by: candidate?.passport_issued_by,
        passport_issue_date: candidate?.passport_issue_date,
        passport_expiry_date: candidate?.passport_expiry_date,
        lives_abroad: candidate?.lives_abroad,
        previous_visas: candidate?.previous_visas,
        passport_doc: docTypes.includes("passport"),
        biometric_photo_doc: docTypes.includes("biometric_photo"),
        diploma_doc: docTypes.includes("diploma"),
    };

    // Conditional: married workers must have spouse data
    const isMarried = candidate?.marital_status?.toLowerCase() === 'married';
    if (isMarried) {
        const spouse = candidate?.family_data?.spouse;
        fields.spouse_data = !!(spouse?.first_name && spouse?.last_name);
    }

    // For boolean answer fields, `false` counts as filled (user answered "No")
    // For everything else, use truthiness (so passport_doc: false = not uploaded)
    const isFieldFilled = (key: string, value: any): boolean => {
        if (BOOLEAN_ANSWER_FIELDS.has(key)) {
            return value !== null && value !== undefined;
        }
        return !!value;
    };

    const totalFields = Object.keys(fields).length;
    const completedFields = Object.entries(fields).filter(([k, v]) => isFieldFilled(k, v)).length;
    const completion = Math.round((completedFields / totalFields) * 100);

    const missingFields = Object.entries(fields)
        .filter(([k, v]) => !isFieldFilled(k, v))
        .map(([k]) => WORKER_FIELD_LABELS[k] || k);

    return { completion, missingFields, totalFields, completedFields };
}

export function getEmployerCompletion(data: EmployerData): ProfileCompletionResult {
    const { employer } = data;

    const isSerbia = employer?.country?.trim().toLowerCase() === 'serbia';

    // Base fields required for everyone
    const baseFields: Record<string, any> = {
        company_name: employer?.company_name,
        contact_phone: employer?.contact_phone,
        country: employer?.country,
        industry: employer?.industry,
        // Website is optional for now in the form, but let's keep it consistent with what we ask
    };

    // Serbia specific fields
    const serbiaFields: Record<string, any> = {
        company_registration_number: employer?.company_registration_number,
        company_address: employer?.company_address,
        city: employer?.city,
        postal_code: employer?.postal_code,
        description: employer?.description,
        business_registry_number: employer?.business_registry_number,
        founding_date: employer?.founding_date,
        // Tax ID is technically stored in tax_id (PIB) but not in this helper? 
        // Wait, the previous version didn't have tax_id in the list! 
        // Let's check the previous version. It had: company_name, registration_number, address, phone, country, city, postal_code, industry, description, apr, founding.
        // It did NOT have tax_id. Let's stick to what was there + new fields.
    };

    // Construct the fields object based on country
    const fields = isSerbia
        ? { ...baseFields, ...serbiaFields }
        : baseFields;

    const totalFields = Object.keys(fields).length;
    const completedFields = Object.values(fields).filter(v => v !== null && v !== undefined && v !== '').length;
    const completion = Math.round((completedFields / totalFields) * 100);

    const missingFields = Object.entries(fields)
        .filter(([_, v]) => v === null || v === undefined || v === '')
        .map(([k]) => EMPLOYER_FIELD_LABELS[k] || k);

    return { completion, missingFields, totalFields, completedFields };
}
