import { sanitizeStorageFileName } from "@/lib/workers";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import { resolveWorkerStatusAfterEntryFee } from "@/lib/worker-status";
import {
    ADMIN_TEST_ROLES,
    buildAdminTestEmail,
    buildAdminTestLabel,
    type AdminTestOwnerProfile,
    type AdminTestPersonaRecord,
    type AdminTestRole,
    sortAdminTestPersonas,
} from "@/lib/admin-test-mode";

type AdminTestQueryError = { message?: string | null } | null;

type AdminTestQueryResponse<TData = unknown> = {
    data?: TData | null;
    error?: AdminTestQueryError;
};

type AdminTestQueryChain<TData = unknown> = PromiseLike<AdminTestQueryResponse<TData>> & {
    select: (...args: unknown[]) => AdminTestQueryChain<TData>;
    eq: (...args: unknown[]) => AdminTestQueryChain<TData>;
    order: (...args: unknown[]) => AdminTestQueryChain<TData>;
    single: () => PromiseLike<AdminTestQueryResponse<TData>>;
    maybeSingle: () => PromiseLike<AdminTestQueryResponse<TData>>;
    insert: (payload: unknown) => AdminTestQueryChain<TData>;
    update: (payload: unknown) => AdminTestQueryChain<TData>;
    upsert: (payload: unknown, options?: unknown) => AdminTestQueryChain<TData>;
    delete: () => AdminTestQueryChain<TData>;
};

type AdminTestStorageClient = {
    from: (bucket: string) => {
        upload: (
            path: string,
            file: File,
            options: { contentType?: string; upsert: boolean }
        ) => PromiseLike<{ error?: AdminTestQueryError }>;
    };
};

type AdminTestDataClient = {
    from: (table: string) => unknown;
    storage: AdminTestStorageClient;
};

function adminTable(admin: AdminTestDataClient, table: string) {
    return admin.from(table) as AdminTestQueryChain;
}

export interface AdminTestWorkerProfileRow {
    persona_id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    admin_approved?: boolean | null;
    nationality: string | null;
    current_country: string | null;
    preferred_job: string | null;
    desired_countries: string[] | null;
    date_of_birth: string | null;
    birth_country: string | null;
    birth_city: string | null;
    citizenship: string | null;
    original_citizenship: string | null;
    maiden_name: string | null;
    father_name: string | null;
    mother_name: string | null;
    marital_status: string | null;
    gender: string | null;
    address: string | null;
    family_data: Record<string, unknown> | null;
    passport_number: string | null;
    passport_issued_by: string | null;
    passport_issue_date: string | null;
    passport_expiry_date: string | null;
    lives_abroad: string | null;
    previous_visas: string | null;
    status: string | null;
    entry_fee_paid: boolean | null;
    job_search_active: boolean | null;
    queue_joined_at: string | null;
    job_search_activated_at: string | null;
    queue_position: number | null;
    created_at: string;
    updated_at: string;
}

export interface AdminTestWorkerDocumentRow {
    id: string;
    persona_id: string;
    document_type: string;
    file_name: string | null;
    storage_path: string | null;
    mime_type: string | null;
    status: string | null;
    reject_reason: string | null;
    verification_data: Record<string, unknown> | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminTestEmployerRow {
    persona_id: string;
    company_name: string | null;
    tax_id: string | null;
    company_registration_number: string | null;
    company_address: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    status: string | null;
    website: string | null;
    industry: string | null;
    company_size: string | null;
    founded_year: string | null;
    description: string | null;
    country: string | null;
    city: string | null;
    postal_code: string | null;
    founding_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminTestJobRequestRow {
    id: string;
    persona_id: string;
    title: string;
    description: string | null;
    industry: string | null;
    positions_count: number | null;
    positions_filled: number | null;
    work_city: string | null;
    salary_rsd: number | null;
    accommodation_address: string | null;
    work_schedule: string | null;
    contract_duration_months: number | null;
    experience_required_years: number | null;
    destination_country: string | null;
    status: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminTestAgencyRow {
    persona_id: string;
    display_name: string | null;
    legal_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    country: string | null;
    city: string | null;
    website_url: string | null;
    status: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminTestAgencyWorkerRow {
    id: string;
    persona_id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    admin_approved?: boolean | null;
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
    family_data: Record<string, unknown> | null;
    passport_number: string | null;
    passport_issued_by: string | null;
    passport_issue_date: string | null;
    passport_expiry_date: string | null;
    lives_abroad: string | null;
    previous_visas: string | null;
    status: string | null;
    entry_fee_paid: boolean | null;
    job_search_active: boolean | null;
    queue_joined_at: string | null;
    queue_position: number | null;
    created_at: string;
    updated_at: string;
}

export interface AdminTestAgencyWorkerDocumentRow {
    id: string;
    persona_id: string;
    agency_worker_id: string;
    document_type: string;
    file_name: string | null;
    storage_path: string | null;
    mime_type: string | null;
    status: string | null;
    reject_reason: string | null;
    verification_data: Record<string, unknown> | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
}

function nowIso() {
    return new Date().toISOString();
}

function asStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const normalized = value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);

    return normalized.length > 0 ? normalized : null;
}

function safeOwnerName(ownerProfile: AdminTestOwnerProfile) {
    return ownerProfile.full_name?.trim() || ownerProfile.email?.split("@")[0] || "Admin";
}

function workerDefaults(ownerProfile: AdminTestOwnerProfile) {
    const ownerName = safeOwnerName(ownerProfile);
    return {
        full_name: `${ownerName} Worker Test`,
        email: buildAdminTestEmail(ownerProfile.email, "worker"),
        preferred_job: "Construction",
        current_country: "Serbia",
        status: "NEW",
        entry_fee_paid: false,
        job_search_active: false,
    };
}

function employerDefaults(ownerProfile: AdminTestOwnerProfile) {
    const ownerName = safeOwnerName(ownerProfile);
    return {
        company_name: `${ownerName} Test Employer`,
        contact_email: buildAdminTestEmail(ownerProfile.email, "employer"),
        contact_phone: null,
        country: "",
        industry: "",
        status: "PENDING",
    };
}

function agencyDefaults(ownerProfile: AdminTestOwnerProfile) {
    const ownerName = safeOwnerName(ownerProfile);
    return {
        display_name: `${ownerName} Test Agency`,
        legal_name: `${ownerName} Test Agency`,
        contact_email: buildAdminTestEmail(ownerProfile.email, "agency"),
        contact_phone: null,
        country: "Serbia",
        city: "Belgrade",
        status: "active",
    };
}

async function ensurePersonaRecord(
    admin: AdminTestDataClient,
    ownerProfile: AdminTestOwnerProfile,
    role: AdminTestRole
): Promise<AdminTestPersonaRecord> {
    const { data: existing, error: existingError } = await adminTable(admin, "admin_test_personas")
        .select("*")
        .eq("owner_profile_id", ownerProfile.id)
        .eq("role", role)
        .maybeSingle();

    if (existingError) {
        throw existingError;
    }

    if (existing) {
        return existing as AdminTestPersonaRecord;
    }

    const { data: created, error: createError } = await adminTable(admin, "admin_test_personas")
        .insert({
            owner_profile_id: ownerProfile.id,
            role,
            label: buildAdminTestLabel(ownerProfile.full_name, role),
            description: `Sandbox ${role} workspace for mobile and QA testing.`,
            status: "active",
        })
        .select("*")
        .single();

    if (createError) {
        throw createError;
    }

    return created as AdminTestPersonaRecord;
}

async function ensureWorkerSeed(
    admin: AdminTestDataClient,
    ownerProfile: AdminTestOwnerProfile,
    persona: AdminTestPersonaRecord
): Promise<void> {
    const { data: existing, error: existingError } = await adminTable(admin, "admin_test_worker_profiles")
        .select("persona_id")
        .eq("persona_id", persona.id)
        .maybeSingle();

    if (existingError) {
        throw existingError;
    }

    if (existing) {
        return;
    }

    const { error: insertError } = await adminTable(admin, "admin_test_worker_profiles")
        .insert({
            persona_id: persona.id,
            ...workerDefaults(ownerProfile),
        });

    if (insertError) {
        throw insertError;
    }
}

async function ensureEmployerSeed(
    admin: AdminTestDataClient,
    ownerProfile: AdminTestOwnerProfile,
    persona: AdminTestPersonaRecord
): Promise<void> {
    const { data: existing, error: existingError } = await adminTable(admin, "admin_test_employers")
        .select("persona_id")
        .eq("persona_id", persona.id)
        .maybeSingle();

    if (existingError) {
        throw existingError;
    }

    if (existing) {
        return;
    }

    const { error: insertError } = await adminTable(admin, "admin_test_employers")
        .insert({
            persona_id: persona.id,
            ...employerDefaults(ownerProfile),
        });

    if (insertError) {
        throw insertError;
    }
}

async function ensureAgencySeed(
    admin: AdminTestDataClient,
    ownerProfile: AdminTestOwnerProfile,
    persona: AdminTestPersonaRecord
): Promise<void> {
    const { data: existing, error: existingError } = await adminTable(admin, "admin_test_agencies")
        .select("persona_id")
        .eq("persona_id", persona.id)
        .maybeSingle();

    if (existingError) {
        throw existingError;
    }

    if (existing) {
        return;
    }

    const { error: insertError } = await adminTable(admin, "admin_test_agencies")
        .insert({
            persona_id: persona.id,
            ...agencyDefaults(ownerProfile),
        });

    if (insertError) {
        throw insertError;
    }
}

export async function ensureAdminTestPersonas(
    admin: AdminTestDataClient,
    ownerProfile: AdminTestOwnerProfile
): Promise<AdminTestPersonaRecord[]> {
    const personas: AdminTestPersonaRecord[] = [];

    for (const role of ADMIN_TEST_ROLES) {
        const persona = await ensurePersonaRecord(admin, ownerProfile, role);

        if (role === "worker") {
            await ensureWorkerSeed(admin, ownerProfile, persona);
        } else if (role === "employer") {
            await ensureEmployerSeed(admin, ownerProfile, persona);
        } else {
            await ensureAgencySeed(admin, ownerProfile, persona);
        }

        personas.push(persona);
    }

    return sortAdminTestPersonas(personas);
}

export async function touchAdminTestPersona(admin: AdminTestDataClient, personaId: string) {
    const { error } = await adminTable(admin, "admin_test_personas")
        .update({
            last_used_at: nowIso(),
            updated_at: nowIso(),
        })
        .eq("id", personaId);

    if (error) {
        throw error;
    }
}

export async function getAdminTestWorkerWorkspace(admin: AdminTestDataClient, personaId: string) {
    const [{ data: worker, error: workerError }, { data: documents, error: documentsError }] = await Promise.all([
        adminTable(admin, "admin_test_worker_profiles").select("*").eq("persona_id", personaId).maybeSingle(),
        adminTable(admin, "admin_test_worker_documents").select("*").eq("persona_id", personaId).order("created_at", { ascending: true }),
    ]);

    if (workerError) {
        throw workerError;
    }
    if (documentsError) {
        throw documentsError;
    }

    return {
        worker: (worker as AdminTestWorkerProfileRow | null) ?? null,
        documents: (documents as AdminTestWorkerDocumentRow[] | null) ?? [],
    };
}

export async function saveAdminTestWorkerProfile(
    admin: AdminTestDataClient,
    personaId: string,
    updates: Partial<AdminTestWorkerProfileRow>
): Promise<AdminTestWorkerProfileRow> {
    const { data, error } = await adminTable(admin, "admin_test_worker_profiles")
        .update({
            ...updates,
            desired_countries: asStringArray(updates.desired_countries),
            updated_at: nowIso(),
        })
        .eq("persona_id", personaId)
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestWorkerProfileRow;
}

export async function uploadAdminTestWorkerDocument(input: {
    admin: AdminTestDataClient;
    personaId: string;
    ownerProfileId: string;
    docType: string;
    file: File;
}): Promise<AdminTestWorkerDocumentRow> {
    const { admin, personaId, ownerProfileId, docType, file } = input;
    const timestamp = Date.now();
    const fileName = sanitizeStorageFileName(file.name, docType);
    const storagePath = `admin-test/${ownerProfileId}/${personaId}/${docType}/${timestamp}_${fileName}`;

    const { error: uploadError } = await admin.storage
        .from(WORKER_DOCUMENTS_BUCKET)
        .upload(storagePath, file, {
            contentType: file.type || undefined,
            upsert: true,
        });

    if (uploadError) {
        throw uploadError;
    }

    const verifiedAt = nowIso();
    const { data, error } = await adminTable(admin, "admin_test_worker_documents")
        .upsert(
            {
                persona_id: personaId,
                document_type: docType,
                file_name: file.name,
                storage_path: storagePath,
                mime_type: file.type || null,
                status: "verified",
                reject_reason: null,
                verification_data: {
                    source: "admin_test_upload",
                    auto_verified: true,
                    size_bytes: file.size,
                },
                verified_at: verifiedAt,
                updated_at: verifiedAt,
            },
            { onConflict: "persona_id,document_type" }
        )
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestWorkerDocumentRow;
}

export async function markAdminTestWorkerEntryFeePaid(
    admin: AdminTestDataClient,
    personaId: string
): Promise<AdminTestWorkerProfileRow> {
    const current = await getAdminTestWorkerWorkspace(admin, personaId);
    const queueJoinedAt = current.worker?.queue_joined_at || nowIso();
    const nextStatus = resolveWorkerStatusAfterEntryFee(current.worker?.status);

    const { data, error } = await adminTable(admin, "admin_test_worker_profiles")
        .update({
            entry_fee_paid: true,
            job_search_active: true,
            job_search_activated_at: nowIso(),
            queue_joined_at: queueJoinedAt,
            status: nextStatus,
            updated_at: nowIso(),
        })
        .eq("persona_id", personaId)
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestWorkerProfileRow;
}

export async function getAdminTestEmployerWorkspace(admin: AdminTestDataClient, personaId: string) {
    const [{ data: employer, error: employerError }, { data: jobs, error: jobsError }] = await Promise.all([
        adminTable(admin, "admin_test_employers").select("*").eq("persona_id", personaId).maybeSingle(),
        adminTable(admin, "admin_test_job_requests").select("*").eq("persona_id", personaId).order("created_at", { ascending: false }),
    ]);

    if (employerError) {
        throw employerError;
    }
    if (jobsError) {
        throw jobsError;
    }

    return {
        employer: (employer as AdminTestEmployerRow | null) ?? null,
        jobs: (jobs as AdminTestJobRequestRow[] | null) ?? [],
    };
}

export async function saveAdminTestEmployerProfile(
    admin: AdminTestDataClient,
    personaId: string,
    updates: Partial<AdminTestEmployerRow>
): Promise<AdminTestEmployerRow> {
    const { data, error } = await adminTable(admin, "admin_test_employers")
        .update({
            ...updates,
            updated_at: nowIso(),
        })
        .eq("persona_id", personaId)
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestEmployerRow;
}

export async function createAdminTestEmployerJob(
    admin: AdminTestDataClient,
    personaId: string,
    payload: Omit<Partial<AdminTestJobRequestRow>, "id" | "persona_id" | "created_at" | "updated_at">
): Promise<AdminTestJobRequestRow> {
    const { data, error } = await adminTable(admin, "admin_test_job_requests")
        .insert({
            persona_id: personaId,
            title: payload.title || "Untitled job request",
            description: payload.description || null,
            industry: payload.industry || null,
            positions_count: payload.positions_count ?? 1,
            positions_filled: payload.positions_filled ?? 0,
            work_city: payload.work_city || null,
            salary_rsd: payload.salary_rsd ?? null,
            accommodation_address: payload.accommodation_address || null,
            work_schedule: payload.work_schedule || null,
            contract_duration_months: payload.contract_duration_months ?? null,
            experience_required_years: payload.experience_required_years ?? null,
            destination_country: payload.destination_country || null,
            status: payload.status || "open",
        })
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestJobRequestRow;
}

export async function updateAdminTestEmployerJob(
    admin: AdminTestDataClient,
    personaId: string,
    jobId: string,
    payload: Partial<AdminTestJobRequestRow>
): Promise<AdminTestJobRequestRow> {
    const { data, error } = await adminTable(admin, "admin_test_job_requests")
        .update({
            ...payload,
            updated_at: nowIso(),
        })
        .eq("persona_id", personaId)
        .eq("id", jobId)
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestJobRequestRow;
}

export async function deleteAdminTestEmployerJob(
    admin: AdminTestDataClient,
    personaId: string,
    jobId: string
): Promise<void> {
    const { error } = await adminTable(admin, "admin_test_job_requests")
        .delete()
        .eq("persona_id", personaId)
        .eq("id", jobId);

    if (error) {
        throw error;
    }
}

export async function getAdminTestAgencyWorkspace(admin: AdminTestDataClient, personaId: string) {
    const [
        { data: agency, error: agencyError },
        { data: workers, error: workersError },
        { data: documents, error: documentsError },
    ] = await Promise.all([
        adminTable(admin, "admin_test_agencies").select("*").eq("persona_id", personaId).maybeSingle(),
        adminTable(admin, "admin_test_agency_workers").select("*").eq("persona_id", personaId).order("created_at", { ascending: false }),
        adminTable(admin, "admin_test_agency_worker_documents")
            .select("*")
            .eq("persona_id", personaId)
            .order("created_at", { ascending: true }),
    ]);

    if (agencyError) {
        throw agencyError;
    }
    if (workersError) {
        throw workersError;
    }
    if (documentsError) {
        throw documentsError;
    }

    return {
        agency: (agency as AdminTestAgencyRow | null) ?? null,
        workers: (workers as AdminTestAgencyWorkerRow[] | null) ?? [],
        documents: (documents as AdminTestAgencyWorkerDocumentRow[] | null) ?? [],
    };
}

export async function getAdminTestAgencyWorker(
    admin: AdminTestDataClient,
    personaId: string,
    workerId: string
): Promise<AdminTestAgencyWorkerRow | null> {
    const { data, error } = await adminTable(admin, "admin_test_agency_workers")
        .select("*")
        .eq("persona_id", personaId)
        .eq("id", workerId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (data as AdminTestAgencyWorkerRow | null) ?? null;
}

export async function getAdminTestAgencyWorkerDocuments(
    admin: AdminTestDataClient,
    personaId: string,
    workerId: string
): Promise<AdminTestAgencyWorkerDocumentRow[]> {
    const { data, error } = await adminTable(admin, "admin_test_agency_worker_documents")
        .select("*")
        .eq("persona_id", personaId)
        .eq("agency_worker_id", workerId)
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }

    return (data as AdminTestAgencyWorkerDocumentRow[] | null) ?? [];
}

export async function createAdminTestAgencyWorker(
    admin: AdminTestDataClient,
    personaId: string,
    payload: Partial<AdminTestAgencyWorkerRow>
): Promise<AdminTestAgencyWorkerRow> {
    const { data, error } = await adminTable(admin, "admin_test_agency_workers")
        .insert({
            persona_id: personaId,
            full_name: payload.full_name || "Test Worker",
            email: payload.email || null,
            phone: payload.phone || null,
            admin_approved: payload.admin_approved ?? false,
            nationality: payload.nationality || null,
            current_country: payload.current_country || null,
            preferred_job: payload.preferred_job || null,
            desired_countries: asStringArray(payload.desired_countries),
            gender: payload.gender || null,
            marital_status: payload.marital_status || null,
            date_of_birth: payload.date_of_birth || null,
            birth_country: payload.birth_country || null,
            birth_city: payload.birth_city || null,
            citizenship: payload.citizenship || null,
            original_citizenship: payload.original_citizenship || null,
            maiden_name: payload.maiden_name || null,
            father_name: payload.father_name || null,
            mother_name: payload.mother_name || null,
            address: payload.address || null,
            family_data: payload.family_data || null,
            passport_number: payload.passport_number || null,
            passport_issued_by: payload.passport_issued_by || null,
            passport_issue_date: payload.passport_issue_date || null,
            passport_expiry_date: payload.passport_expiry_date || null,
            lives_abroad: payload.lives_abroad || null,
            previous_visas: payload.previous_visas || null,
            status: payload.status || "NEW",
            entry_fee_paid: false,
            job_search_active: false,
        })
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestAgencyWorkerRow;
}

export async function updateAdminTestAgencyWorker(
    admin: AdminTestDataClient,
    personaId: string,
    workerId: string,
    payload: Partial<AdminTestAgencyWorkerRow>
): Promise<AdminTestAgencyWorkerRow> {
    const { data, error } = await adminTable(admin, "admin_test_agency_workers")
        .update({
            ...payload,
            desired_countries: asStringArray(payload.desired_countries),
            updated_at: nowIso(),
        })
        .eq("persona_id", personaId)
        .eq("id", workerId)
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestAgencyWorkerRow;
}

export async function deleteAdminTestAgencyWorker(
    admin: AdminTestDataClient,
    personaId: string,
    workerId: string
): Promise<void> {
    const { error } = await adminTable(admin, "admin_test_agency_workers")
        .delete()
        .eq("persona_id", personaId)
        .eq("id", workerId);

    if (error) {
        throw error;
    }
}

export async function markAdminTestAgencyWorkerEntryFeePaid(
    admin: AdminTestDataClient,
    personaId: string,
    workerId: string
): Promise<AdminTestAgencyWorkerRow> {
    const worker = await getAdminTestAgencyWorker(admin, personaId, workerId);
    if (!worker) {
        throw new Error("Sandbox agency worker not found.");
    }

    const queueJoinedAt = worker.queue_joined_at || nowIso();
    const { data, error } = await adminTable(admin, "admin_test_agency_workers")
        .update({
            entry_fee_paid: true,
            job_search_active: true,
            queue_joined_at: queueJoinedAt,
            status: resolveWorkerStatusAfterEntryFee(worker.status),
            updated_at: nowIso(),
        })
        .eq("persona_id", personaId)
        .eq("id", workerId)
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestAgencyWorkerRow;
}

export async function uploadAdminTestAgencyWorkerDocument(input: {
    admin: AdminTestDataClient;
    personaId: string;
    ownerProfileId: string;
    workerId: string;
    docType: string;
    file: File;
}): Promise<AdminTestAgencyWorkerDocumentRow> {
    const { admin, personaId, ownerProfileId, workerId, docType, file } = input;
    const timestamp = Date.now();
    const fileName = sanitizeStorageFileName(file.name, docType);
    const storagePath = `admin-test/${ownerProfileId}/${personaId}/agency-workers/${workerId}/${docType}/${timestamp}_${fileName}`;

    const { error: uploadError } = await admin.storage
        .from(WORKER_DOCUMENTS_BUCKET)
        .upload(storagePath, file, {
            contentType: file.type || undefined,
            upsert: true,
        });

    if (uploadError) {
        throw uploadError;
    }

    const verifiedAt = nowIso();
    const { data, error } = await adminTable(admin, "admin_test_agency_worker_documents")
        .upsert(
            {
                persona_id: personaId,
                agency_worker_id: workerId,
                document_type: docType,
                file_name: file.name,
                storage_path: storagePath,
                mime_type: file.type || null,
                status: "verified",
                reject_reason: null,
                verification_data: {
                    source: "admin_test_agency_upload",
                    auto_verified: true,
                    size_bytes: file.size,
                },
                verified_at: verifiedAt,
                updated_at: verifiedAt,
            },
            { onConflict: "agency_worker_id,document_type" }
        )
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    return data as AdminTestAgencyWorkerDocumentRow;
}
