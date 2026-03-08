import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKER_DOMAIN } from "@/lib/domain";

interface EnsureWorkerRecordInput {
    userId: string;
    email?: string | null;
    fullName?: string | null;
}

interface EnsureWorkerRecordResult {
    profileCreated: boolean;
    workerCreated: boolean;
}

export interface WorkerRecordSnapshot {
    id?: string | null;
    updated_at?: string | null;
    entry_fee_paid?: boolean | null;
    job_search_active?: boolean | null;
    queue_joined_at?: string | null;
    phone?: string | null;
    nationality?: string | null;
    current_country?: string | null;
    preferred_job?: string | null;
    status?: string | null;
    passport_number?: string | null;
}

function scoreWorkerRecord(record: WorkerRecordSnapshot): number {
    let score = 0;

    if (record.entry_fee_paid) score += 400;
    if (record.job_search_active) score += 200;
    if (record.queue_joined_at) score += 150;
    if (record.phone?.trim()) score += 30;
    if (record.nationality?.trim()) score += 20;
    if (record.current_country?.trim()) score += 15;
    if (record.preferred_job?.trim()) score += 10;
    if (record.status && record.status !== "NEW") score += 40;

    const updatedAtScore = record.updated_at ? Date.parse(record.updated_at) : 0;
    return score * 1_000_000_000_000 + (Number.isFinite(updatedAtScore) ? updatedAtScore : 0);
}

export function pickCanonicalWorkerRecord<T extends WorkerRecordSnapshot>(
    records: T[] | null | undefined
): T | null {
    if (!records || records.length === 0) {
        return null;
    }

    return [...records].sort((left, right) => {
        const scoreDiff = scoreWorkerRecord(right) - scoreWorkerRecord(left);
        if (scoreDiff !== 0) {
            return scoreDiff;
        }

        return (right.id || "").localeCompare(left.id || "");
    })[0] ?? null;
}

export async function loadCanonicalWorkerRecord<T extends WorkerRecordSnapshot = WorkerRecordSnapshot>(
    supabase: any,
    profileId: string,
    columns = "*",
    limit = 25
): Promise<{
    data: T | null;
    rows: T[];
    duplicates: number;
    error: { message: string } | null;
}> {
    const { data, error } = await supabase
        .from(WORKER_DOMAIN.table)
        .select(columns)
        .eq("profile_id", profileId)
        .order("updated_at", { ascending: false })
        .limit(limit);

    if (error) {
        return { data: null, rows: [], duplicates: 0, error };
    }

    const rows = Array.isArray(data) ? (data as T[]) : [];
    return {
        data: pickCanonicalWorkerRecord(rows),
        rows,
        duplicates: Math.max(rows.length - 1, 0),
        error: null,
    };
}

export function normalizeWorkerPhone(phone: string | null | undefined): string | null {
    if (!phone) {
        return null;
    }

    const trimmed = phone.trim();
    if (!trimmed) {
        return null;
    }

    const digits = trimmed.replace(/[\s\-()]/g, "");
    if (!digits) {
        return null;
    }

    return digits.startsWith("+") ? digits : `+${digits}`;
}

export function sanitizeStorageFileName(fileName: string, fallbackBase = "document"): string {
    const trimmed = fileName.trim();
    const lastDot = trimmed.lastIndexOf(".");
    const rawBase = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
    const rawExtension = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";

    const safeBase = rawBase
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);

    const safeExtension = rawExtension
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9]+/g, "")
        .toLowerCase()
        .slice(0, 10);

    const base = safeBase || fallbackBase;
    return safeExtension ? `${base}.${safeExtension}` : base;
}

export async function ensureWorkerProfileRecord(
    supabase: SupabaseClient,
    input: EnsureWorkerRecordInput
): Promise<{ profileCreated: boolean }> {
    const { userId, email, fullName } = input;

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
            throw new Error("Cannot create worker profile without email.");
        }

        const { error: profileInsertError } = await supabase.from("profiles").insert({
            id: userId,
            email,
            full_name: fullName || email.split("@")[0] || "",
            user_type: "worker",
        });

        if (profileInsertError) {
            throw profileInsertError;
        }

        profileCreated = true;
    } else {
        const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({ user_type: "worker" })
            .eq("id", userId);

        if (profileUpdateError) {
            throw profileUpdateError;
        }
    }

    return { profileCreated };
}

export async function ensureWorkerRecord(
    supabase: SupabaseClient,
    input: EnsureWorkerRecordInput
): Promise<EnsureWorkerRecordResult> {
    const { userId } = input;
    const { profileCreated } = await ensureWorkerProfileRecord(supabase, input);

    const { data: existingWorker, error: workerLookupError } = await supabase
        .from(WORKER_DOMAIN.table)
        .select("id")
        .eq("profile_id", userId)
        .maybeSingle();

    if (workerLookupError) {
        throw workerLookupError;
    }

    let workerCreated = false;
    if (!existingWorker) {
        const { error: workerInsertError } = await supabase.from(WORKER_DOMAIN.table).insert({
            profile_id: userId,
            status: "NEW",
        });

        if (workerInsertError) {
            throw workerInsertError;
        }

        workerCreated = true;
    }

    return {
        profileCreated,
        workerCreated,
    };
}
