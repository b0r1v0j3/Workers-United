interface AgencyFamilyPersonInput {
    first_name?: unknown;
    last_name?: unknown;
    dob?: unknown;
    birth_country?: unknown;
    birth_city?: unknown;
}

interface AgencyChildInput {
    first_name?: unknown;
    last_name?: unknown;
    dob?: unknown;
}

export interface AgencyWorkerPayload {
    fullName: string;
    email: string | null;
    phone: string | null;
    workerFields: {
        submitted_full_name: string;
        submitted_email: string | null;
        phone: string | null;
        nationality: string | null;
        current_country: string | null;
        preferred_job: string | null;
        desired_countries: string[] | null;
        gender: string | null;
        marital_status: string | null;
        date_of_birth: string | null;
        birth_country: string | null;
        birth_city: string | null;
        citizenship: string | null;
        original_citizenship: string | null;
        maiden_name: string | null;
        father_name: string | null;
        mother_name: string | null;
        address: string | null;
        family_data: {
            spouse?: {
                first_name: string | null;
                last_name: string | null;
                dob: string | null;
                birth_country: string | null;
                birth_city: string | null;
            };
            children?: Array<{
                first_name: string | null;
                last_name: string | null;
                dob: string | null;
            }>;
        } | null;
        passport_number: string | null;
        passport_issued_by: string | null;
        passport_issue_date: string | null;
        passport_expiry_date: string | null;
        lives_abroad: string | null;
        previous_visas: string | null;
    };
}

function normalizePhone(phone: string | null | undefined): string | null {
    if (!phone?.trim()) return null;
    return phone.replace(/[\s\-()]/g, "");
}

function normalizeDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function normalizeText(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function normalizeSelect(value: unknown): string | null {
    return normalizeText(value);
}

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
}

function normalizeCountries(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const normalized = value
        .filter((country): country is string => typeof country === "string")
        .map((country) => country.trim())
        .filter(Boolean);

    return normalized.length > 0 ? normalized : null;
}

function normalizeFamilyPerson(value: AgencyFamilyPersonInput | null | undefined) {
    if (!value || typeof value !== "object") {
        return null;
    }

    const person = {
        first_name: normalizeText(value.first_name),
        last_name: normalizeText(value.last_name),
        dob: normalizeDate(typeof value.dob === "string" ? value.dob : null),
        birth_country: normalizeText(value.birth_country),
        birth_city: normalizeText(value.birth_city),
    };

    return person.first_name || person.last_name || person.dob || person.birth_country || person.birth_city
        ? person
        : null;
}

function normalizeFamilyChildren(value: unknown) {
    if (!Array.isArray(value)) {
        return null;
    }

    const children = value
        .filter((child): child is AgencyChildInput => Boolean(child) && typeof child === "object")
        .map((child) => ({
            first_name: normalizeText(child.first_name),
            last_name: normalizeText(child.last_name),
            dob: normalizeDate(typeof child.dob === "string" ? child.dob : null),
        }))
        .filter((child) => child.first_name || child.last_name || child.dob);

    return children.length > 0 ? children : null;
}

function normalizeFamilyData(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const familyValue = value as {
        spouse?: AgencyFamilyPersonInput | null;
        children?: unknown;
    };

    const spouse = normalizeFamilyPerson(familyValue.spouse);
    const children = normalizeFamilyChildren(familyValue.children);

    if (!spouse && !children) {
        return null;
    }

    return {
        ...(spouse ? { spouse } : {}),
        ...(children ? { children } : {}),
    };
}

export function normalizeAgencyWorkerPayload(body: Record<string, unknown>): AgencyWorkerPayload {
    const fullName = normalizeText(body.fullName) || "";
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(typeof body.phone === "string" ? body.phone : null);

    return {
        fullName,
        email,
        phone,
        workerFields: {
            submitted_full_name: fullName,
            submitted_email: email,
            phone,
            nationality: normalizeText(body.nationality),
            current_country: normalizeText(body.currentCountry),
            preferred_job: normalizeText(body.preferredJob),
            desired_countries: normalizeCountries(body.desiredCountries),
            gender: normalizeSelect(body.gender),
            marital_status: normalizeSelect(body.maritalStatus),
            date_of_birth: normalizeDate(typeof body.dateOfBirth === "string" ? body.dateOfBirth : null),
            birth_country: normalizeText(body.birthCountry),
            birth_city: normalizeText(body.birthCity),
            citizenship: normalizeText(body.citizenship),
            original_citizenship: normalizeText(body.originalCitizenship),
            maiden_name: normalizeText(body.maidenName),
            father_name: normalizeText(body.fatherName),
            mother_name: normalizeText(body.motherName),
            address: normalizeText(body.address),
            family_data: normalizeFamilyData(body.familyData),
            passport_number: normalizeText(body.passportNumber),
            passport_issued_by: normalizeText(body.passportIssuedBy),
            passport_issue_date: normalizeDate(typeof body.passportIssueDate === "string" ? body.passportIssueDate : null),
            passport_expiry_date: normalizeDate(typeof body.passportExpiryDate === "string" ? body.passportExpiryDate : null),
            lives_abroad: normalizeSelect(body.livesAbroad),
            previous_visas: normalizeSelect(body.previousVisas),
        },
    };
}
