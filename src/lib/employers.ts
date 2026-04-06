import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables, TablesUpdate } from "@/lib/database.types";
import { normalizeUserType } from "@/lib/domain";
import { isInternalOrTestEmail } from "@/lib/reporting";

type EmployerProfileRow = Pick<Tables<"profiles">, "id" | "email" | "full_name" | "user_type">;

type EmployerRecordQueryResult = PromiseLike<{
    data?: unknown[] | null;
    error?: { message: string } | null;
}>;

type EmployerRecordQueryClient = {
    from: (table: string) => unknown;
};

interface EnsureEmployerRecordInput {
    userId: string;
    email?: string | null;
    fullName?: string | null;
    companyName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
}

export interface EnsureEmployerRecordResult {
    profileCreated: boolean;
    employerCreated: boolean;
    employer: Tables<"employers"> | null;
    duplicates: number;
}

export interface EmployerRecordSnapshot {
    id?: string | null;
    profile_id?: string | null;
    company_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    country?: string | null;
    industry?: string | null;
    company_registration_number?: string | null;
    company_address?: string | null;
    city?: string | null;
    postal_code?: string | null;
    website?: string | null;
    description?: string | null;
    status?: string | null;
    admin_approved?: boolean | null;
    created_at?: string | null;
    updated_at?: string | null;
}

function scoreEmployerRecord(record: EmployerRecordSnapshot): number {
    let score = 0;

    if (record.admin_approved) score += 400;
    if (record.contact_phone?.trim()) score += 60;
    if (record.contact_email?.trim()) score += 40;
    if (record.country?.trim()) score += 20;
    if (record.industry?.trim()) score += 20;
    if (record.company_registration_number?.trim()) score += 20;
    if (record.company_address?.trim()) score += 18;
    if (record.city?.trim()) score += 10;
    if (record.postal_code?.trim()) score += 8;
    if (record.website?.trim()) score += 10;
    if (record.description?.trim()) score += 10;
    if (record.status && record.status !== "PENDING") score += 80;
    if (record.company_name?.trim()) score += 5;

    const updatedAtScore = record.updated_at ? Date.parse(record.updated_at) : 0;
    const createdAtScore = record.created_at ? Date.parse(record.created_at) : 0;
    const timestampScore = Number.isFinite(updatedAtScore) && updatedAtScore > 0
        ? updatedAtScore
        : Number.isFinite(createdAtScore)
            ? createdAtScore
            : 0;

    return score * 1_000_000_000_000 + timestampScore;
}

export function pickCanonicalEmployerRecord<T extends EmployerRecordSnapshot>(
    records: T[] | null | undefined
): T | null {
    if (!records || records.length === 0) {
        return null;
    }

    return [...records].sort((left, right) => {
        const scoreDiff = scoreEmployerRecord(right) - scoreEmployerRecord(left);
        if (scoreDiff !== 0) {
            return scoreDiff;
        }

        return (right.id || "").localeCompare(left.id || "");
    })[0] ?? null;
}

export async function loadCanonicalEmployerRecord<T extends EmployerRecordSnapshot = Tables<"employers">>(
    supabase: EmployerRecordQueryClient,
    profileId: string,
    columns = "*",
    limit = 25
): Promise<{
    data: T | null;
    rows: T[];
    duplicates: number;
    error: { message: string } | null;
}> {
    const employerTable = supabase.from("employers") as {
        select: (selectedColumns: string) => {
            eq: (column: string, value: string) => {
                order: (orderColumn: string, options: { ascending: boolean }) => {
                    limit: (count: number) => EmployerRecordQueryResult;
                };
            };
        };
    };

    const { data, error } = await employerTable
        .select(columns)
        .eq("profile_id", profileId)
        .order("updated_at", { ascending: false })
        .limit(limit);

    if (error) {
        return { data: null, rows: [], duplicates: 0, error };
    }

    const rows = Array.isArray(data) ? (data as T[]) : [];
    return {
        data: pickCanonicalEmployerRecord(rows),
        rows,
        duplicates: Math.max(rows.length - 1, 0),
        error: null,
    };
}

export function isInternalEmployerProfile(profile?: EmployerProfileRow | null): boolean {
    if (!profile) {
        return false;
    }

    if (profile.email && isInternalOrTestEmail(profile.email)) {
        return true;
    }

    return normalizeUserType(profile.user_type) === "admin";
}

export function shouldHideEmployerFromBusinessViews(input: {
    employer?: Pick<EmployerRecordSnapshot, "profile_id" | "contact_email"> | null;
    profile?: EmployerProfileRow | null;
}): boolean {
    const { employer, profile } = input;

    if (profile && isInternalEmployerProfile(profile)) {
        return true;
    }

    const normalizedProfileType = normalizeUserType(profile?.user_type);
    if (normalizedProfileType && normalizedProfileType !== "employer") {
        return true;
    }

    if (employer?.contact_email && isInternalOrTestEmail(employer.contact_email)) {
        return true;
    }

    return false;
}

async function ensureEmployerProfileRecord(
    supabase: SupabaseClient,
    input: EnsureEmployerRecordInput
): Promise<{ profileCreated: boolean }> {
    const { userId, email, fullName } = input;

    const { data: existingProfile, error: profileLookupError } = await supabase
        .from("profiles")
        .select("id, user_type")
        .eq("id", userId)
        .maybeSingle();

    if (profileLookupError) {
        throw profileLookupError;
    }

    const normalizedExistingType = normalizeUserType(existingProfile?.user_type);
    if (normalizedExistingType === "admin") {
        throw new Error("Admin profiles cannot create live employer records.");
    }

    let profileCreated = false;
    if (!existingProfile) {
        if (!email) {
            throw new Error("Cannot create employer profile without email.");
        }

        const { error: profileInsertError } = await supabase.from("profiles").insert({
            id: userId,
            email,
            full_name: fullName || email.split("@")[0] || "",
            user_type: "employer",
        });

        if (profileInsertError) {
            throw profileInsertError;
        }

        profileCreated = true;
    } else if (normalizedExistingType !== "employer") {
        const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({ user_type: "employer" })
            .eq("id", userId);

        if (profileUpdateError) {
            throw profileUpdateError;
        }
    }

    return { profileCreated };
}

export async function ensureEmployerRecord(
    supabase: SupabaseClient,
    input: EnsureEmployerRecordInput
): Promise<EnsureEmployerRecordResult> {
    const { userId, companyName, contactEmail, contactPhone } = input;
    const { profileCreated } = await ensureEmployerProfileRecord(supabase, input);

    const canonicalResult = await loadCanonicalEmployerRecord<Tables<"employers">>(supabase, userId);
    if (canonicalResult.error) {
        throw canonicalResult.error;
    }

    if (canonicalResult.data) {
        const patch: TablesUpdate<"employers"> = {};

        if (!canonicalResult.data.company_name && companyName?.trim()) {
            patch.company_name = companyName.trim();
        }
        if (!canonicalResult.data.contact_email && contactEmail?.trim()) {
            patch.contact_email = contactEmail.trim().toLowerCase();
        }
        if (!canonicalResult.data.contact_phone && contactPhone?.trim()) {
            patch.contact_phone = contactPhone.trim();
        }

        if (Object.keys(patch).length > 0) {
            const { data: updatedEmployer, error: employerUpdateError } = await supabase
                .from("employers")
                .update(patch)
                .eq("id", canonicalResult.data.id)
                .select("*")
                .single();

            if (employerUpdateError) {
                throw employerUpdateError;
            }

            return {
                profileCreated,
                employerCreated: false,
                employer: updatedEmployer as Tables<"employers">,
                duplicates: canonicalResult.duplicates,
            };
        }

        return {
            profileCreated,
            employerCreated: false,
            employer: canonicalResult.data,
            duplicates: canonicalResult.duplicates,
        };
    }

    const { data: createdEmployer, error: employerInsertError } = await supabase
        .from("employers")
        .insert({
            profile_id: userId,
            company_name: companyName?.trim() || null,
            contact_email: contactEmail?.trim().toLowerCase() || null,
            contact_phone: contactPhone?.trim() || null,
            status: "PENDING",
        })
        .select("*")
        .single();

    if (employerInsertError) {
        throw employerInsertError;
    }

    return {
        profileCreated,
        employerCreated: true,
        employer: createdEmployer as Tables<"employers">,
        duplicates: 0,
    };
}
