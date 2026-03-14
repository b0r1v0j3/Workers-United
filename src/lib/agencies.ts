import type { SupabaseClient } from "@supabase/supabase-js";

interface EnsureAgencyRecordInput {
    userId: string;
    email?: string | null;
    fullName?: string | null;
    agencyName?: string | null;
    contactPhone?: string | null;
}

interface AgencyRecord {
    id: string;
    profile_id: string;
    display_name: string | null;
    legal_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    country: string | null;
    city: string | null;
    website_url: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

interface EnsureAgencyRecordResult {
    profileCreated: boolean;
    agencyCreated: boolean;
    agency: AgencyRecord | null;
}

interface AgencyWorkerRecord {
    id: string;
    profile_id: string | null;
    agency_id: string | null;
    submitted_full_name?: string | null;
    submitted_email?: string | null;
    phone?: string | null;
    status?: string | null;
}

interface AgencyOwnedClaimedWorkerRecord {
    id: string;
    profile_id: string;
    agency_id: string | null;
    status?: string | null;
}

export interface AgencySchemaState {
    ready: boolean;
    reason: string | null;
}

export interface AgencyClaimContext {
    workerId: string;
    workerName: string;
    workerEmail: string | null;
    agencyName: string | null;
    claimed: boolean;
    claimable: boolean;
    reason: "ok" | "already_claimed" | "missing_email";
}

export interface AgencyWorkerClaimResult {
    ok: boolean;
    reason: "linked" | "already_linked" | "already_claimed" | "missing_email" | "email_mismatch" | "not_found";
    workerId: string | null;
}

function resolveAgencyName(input: EnsureAgencyRecordInput): string {
    if (input.agencyName?.trim()) return input.agencyName.trim();
    if (input.fullName?.trim()) return input.fullName.trim();
    if (input.email?.includes("@")) return input.email.split("@")[0];
    return "Agency";
}

function normalizeEmail(email: string | null | undefined): string | null {
    const trimmed = email?.trim().toLowerCase();
    return trimmed ? trimmed : null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (!value) {
        return null;
    }

    return Array.isArray(value) ? value[0] || null : value;
}

export function isMissingAgencySchemaError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }

    const code = "code" in error ? String(error.code || "") : "";
    const message = "message" in error ? String(error.message || "") : "";
    const details = "details" in error ? String(error.details || "") : "";
    const haystack = `${message} ${details}`.toLowerCase();

    if (code === "PGRST205" && haystack.includes("agencies")) {
        return true;
    }

    return (
        haystack.includes("public.agencies") ||
        haystack.includes("column workers.agency_id does not exist") ||
        haystack.includes("column workers.source_type does not exist") ||
        haystack.includes("column workers.submitted_by_profile_id does not exist") ||
        haystack.includes("column workers.submitted_full_name does not exist") ||
        haystack.includes("column workers.submitted_email does not exist") ||
        haystack.includes("column workers.claimed_by_worker_at does not exist")
    );
}

export async function getAgencySchemaState(
    supabase: SupabaseClient
): Promise<AgencySchemaState> {
    const [agencyTableResult, workerColumnsResult] = await Promise.all([
        supabase.from("agencies").select("id").limit(1),
        supabase
            .from("worker_onboarding")
            .select("id, agency_id, source_type, submitted_by_profile_id, submitted_full_name, submitted_email, claimed_by_worker_at")
            .limit(1),
    ]);

    const error = agencyTableResult.error || workerColumnsResult.error;
    if (!error) {
        return { ready: true, reason: null };
    }

    if (isMissingAgencySchemaError(error)) {
        return {
            ready: false,
            reason: "Agency workspace setup is not active yet.",
        };
    }

    throw error;
}

export async function ensureAgencyRecord(
    supabase: SupabaseClient,
    input: EnsureAgencyRecordInput
): Promise<EnsureAgencyRecordResult> {
    const { userId, email, fullName, contactPhone } = input;
    const agencyName = resolveAgencyName(input);

    const { data: existingProfile, error: profileLookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

    if (profileLookupError) {
        throw profileLookupError;
    }

    let profileCreated = false;
    if (!existingProfile) {
        if (!email) {
            throw new Error("Cannot create agency profile without email.");
        }

        const { error: profileInsertError } = await supabase.from("profiles").insert({
            id: userId,
            email,
            full_name: fullName || agencyName,
            user_type: "agency",
        });

        if (profileInsertError) {
            throw profileInsertError;
        }

        profileCreated = true;
    } else {
        const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({ user_type: "agency" })
            .eq("id", userId);

        if (profileUpdateError) {
            throw profileUpdateError;
        }
    }

    const { data: existingAgency, error: agencyLookupError } = await supabase
        .from("agencies")
        .select("*")
        .eq("profile_id", userId)
        .maybeSingle();

    if (agencyLookupError) {
        throw agencyLookupError;
    }

    let agencyCreated = false;
    if (!existingAgency) {
        const { data: createdAgency, error: agencyInsertError } = await supabase
            .from("agencies")
            .insert({
                profile_id: userId,
                display_name: agencyName,
                legal_name: agencyName,
                contact_email: email || null,
                contact_phone: contactPhone || null,
                status: "active",
            })
            .select("*")
            .single();

        if (agencyInsertError) {
            throw agencyInsertError;
        }

        agencyCreated = true;
        return {
            profileCreated,
            agencyCreated,
            agency: createdAgency as AgencyRecord,
        };
    }

    const { data: updatedAgency, error: agencyUpdateError } = await supabase
        .from("agencies")
        .update({
            display_name: existingAgency.display_name || agencyName,
            legal_name: existingAgency.legal_name || agencyName,
            contact_email: existingAgency.contact_email || email || null,
            contact_phone: existingAgency.contact_phone || contactPhone || null,
        })
        .eq("id", existingAgency.id)
        .select("*")
        .single();

    if (agencyUpdateError) {
        throw agencyUpdateError;
    }

    return {
        profileCreated,
        agencyCreated,
        agency: updatedAgency as AgencyRecord,
    };
}

export async function getAgencyRecordByProfileId(
    supabase: SupabaseClient,
    profileId: string
): Promise<AgencyRecord | null> {
    const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (data as AgencyRecord | null) ?? null;
}

export async function getAgencyOwnedWorker(
    supabase: SupabaseClient,
    agencyProfileId: string,
    workerId: string
): Promise<{ agency: AgencyRecord | null; worker: AgencyWorkerRecord | null }> {
    const agency = await getAgencyRecordByProfileId(supabase, agencyProfileId);
    if (!agency) {
        return { agency: null, worker: null };
    }

    const { data: worker, error: workerError } = await supabase
        .from("worker_onboarding")
        .select("id, profile_id, agency_id, submitted_full_name, submitted_email, phone, status")
        .eq("id", workerId)
        .eq("agency_id", agency.id)
        .maybeSingle();

    if (workerError) {
        throw workerError;
    }

    return {
        agency,
        worker: (worker as AgencyWorkerRecord | null) ?? null,
    };
}

export async function getAgencyOwnedClaimedWorkerByProfileId(
    supabase: SupabaseClient,
    agencyProfileId: string,
    workerProfileId: string
): Promise<{ agency: AgencyRecord | null; worker: AgencyOwnedClaimedWorkerRecord | null }> {
    const agency = await getAgencyRecordByProfileId(supabase, agencyProfileId);
    if (!agency) {
        return { agency: null, worker: null };
    }

    const { data: worker, error: workerError } = await supabase
        .from("worker_onboarding")
        .select("id, profile_id, agency_id, status")
        .eq("agency_id", agency.id)
        .eq("profile_id", workerProfileId)
        .maybeSingle();

    if (workerError) {
        throw workerError;
    }

    return {
        agency,
        worker: (worker as AgencyOwnedClaimedWorkerRecord | null) ?? null,
    };
}

export function getAgencyWorkerName(worker: {
    submitted_full_name?: string | null;
    profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
}): string {
    const profile = firstRelation(worker.profiles);
    return profile?.full_name || worker.submitted_full_name || "Unnamed worker";
}

export function getAgencyWorkerEmail(worker: {
    submitted_email?: string | null;
    profiles?: { email?: string | null } | Array<{ email?: string | null }> | null;
}): string | null {
    const profile = firstRelation(worker.profiles);
    return profile?.email || worker.submitted_email || null;
}

export function isAgencyWorkerClaimed(worker: { profile_id?: string | null }): boolean {
    return Boolean(worker.profile_id);
}

export async function getAgencyClaimContext(
    supabase: SupabaseClient,
    workerId: string
): Promise<AgencyClaimContext | null> {
    const schemaState = await getAgencySchemaState(supabase);
    if (!schemaState.ready) {
        return null;
    }

    const { data, error } = await supabase
        .from("worker_onboarding")
        .select(`
            id,
            profile_id,
            submitted_full_name,
            submitted_email,
            agencies(display_name, legal_name)
        `)
        .eq("id", workerId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    const agencyRecord = firstRelation(data.agencies);
    const agencyName = agencyRecord?.display_name || agencyRecord?.legal_name || null;
    const workerEmail = normalizeEmail(data.submitted_email);
    const claimed = Boolean(data.profile_id);

    return {
        workerId: data.id,
        workerName: data.submitted_full_name || "Worker",
        workerEmail,
        agencyName,
        claimed,
        claimable: !claimed && Boolean(workerEmail),
        reason: claimed ? "already_claimed" : workerEmail ? "ok" : "missing_email",
    };
}

export async function claimAgencyWorkerDraft(
    supabase: SupabaseClient,
    input: {
        workerId: string;
        profileId: string;
        email: string | null | undefined;
        fullName?: string | null;
    }
): Promise<AgencyWorkerClaimResult> {
    const normalizedEmail = normalizeEmail(input.email);

    const { data: worker, error: workerError } = await supabase
        .from("worker_onboarding")
        .select("id, profile_id, submitted_full_name, submitted_email")
        .eq("id", input.workerId)
        .maybeSingle();

    if (workerError) {
        throw workerError;
    }

    if (!worker) {
        return { ok: false, reason: "not_found", workerId: null };
    }

    if (worker.profile_id === input.profileId) {
        return { ok: true, reason: "already_linked", workerId: worker.id };
    }

    if (worker.profile_id) {
        return { ok: false, reason: "already_claimed", workerId: worker.id };
    }

    const invitedEmail = normalizeEmail(worker.submitted_email);
    if (!invitedEmail) {
        return { ok: false, reason: "missing_email", workerId: worker.id };
    }

    if (!normalizedEmail || normalizedEmail !== invitedEmail) {
        return { ok: false, reason: "email_mismatch", workerId: worker.id };
    }

    const nowIso = new Date().toISOString();
    const { data: linkedWorker, error: workerUpdateError } = await supabase
        .from("worker_onboarding")
        .update({
            profile_id: input.profileId,
            claimed_by_worker_at: nowIso,
            updated_at: nowIso,
        })
        .eq("id", input.workerId)
        .is("profile_id", null)
        .select("id, profile_id")
        .maybeSingle();

    if (workerUpdateError) {
        throw workerUpdateError;
    }

    if (!linkedWorker) {
        const { data: freshWorker, error: freshWorkerError } = await supabase
            .from("worker_onboarding")
            .select("id, profile_id")
            .eq("id", input.workerId)
            .maybeSingle();

        if (freshWorkerError) {
            throw freshWorkerError;
        }

        if (freshWorker?.profile_id === input.profileId) {
            return { ok: true, reason: "already_linked", workerId: input.workerId };
        }

        if (freshWorker?.profile_id) {
            return { ok: false, reason: "already_claimed", workerId: input.workerId };
        }

        return { ok: false, reason: "not_found", workerId: null };
    }

    const { error: documentsRelinkError } = await supabase
        .from("worker_documents")
        .update({ user_id: input.profileId })
        .eq("user_id", input.workerId);

    if (documentsRelinkError) {
        throw documentsRelinkError;
    }

    const resolvedName = input.fullName?.trim() || worker.submitted_full_name || null;
    if (resolvedName) {
        const { data: existingProfile, error: profileLookupError } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", input.profileId)
            .maybeSingle();

        if (profileLookupError) {
            throw profileLookupError;
        }

        if (!existingProfile?.full_name?.trim()) {
            const { error: profileUpdateError } = await supabase
                .from("profiles")
                .update({ full_name: resolvedName })
                .eq("id", input.profileId);

            if (profileUpdateError) {
                throw profileUpdateError;
            }
        }
    }

    return { ok: true, reason: "linked", workerId: worker.id };
}
