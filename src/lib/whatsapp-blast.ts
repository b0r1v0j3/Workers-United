import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { buildPlatformUrl } from "@/lib/platform-contact";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { normalizeWorkerPhone, pickCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";
import { sendAnnouncement, sendStatusUpdate } from "@/lib/whatsapp";
import {
    resolveEntryFeeEligibilityForWorker,
    WORKER_ENTRY_FEE_READINESS_COLUMNS,
    type EntryFeeEligibilityDocumentState,
    type EntryFeeEligibilityWorkerRecord,
} from "@/lib/payment-eligibility";

type AdminDbClient = SupabaseClient<Database>;

const WORKER_JOB_FINDER_QUEUE_PATH = "/profile/worker/queue";
const WORKER_JOB_FINDER_QUEUE_URL = buildPlatformUrl(
    process.env.NEXT_PUBLIC_BASE_URL,
    WORKER_JOB_FINDER_QUEUE_PATH
);

interface WhatsAppBlastWorkerRow extends WorkerRecordSnapshot, EntryFeeEligibilityWorkerRecord {
    id: string;
    profile_id: string | null;
    agency_id: string | null;
    status: string | null;
}

interface WhatsAppBlastProfileRow {
    id: string;
    full_name: string | null;
    email: string | null;
}

interface WhatsAppBlastDocumentRow extends EntryFeeEligibilityDocumentState {
    user_id: string | null;
}

export interface WorkerWhatsAppBlastTarget {
    workerId: string;
    profileId: string | null;
    phone: string;
    status: string | null;
    fullName: string;
    firstName: string;
}

export interface WorkerWhatsAppBlastResult {
    total: number;
    sent: number;
    failed: number;
    failedDetails: Array<{ phone: string; name: string; error: string }>;
    targets: WorkerWhatsAppBlastTarget[];
    workerQueueUrl: string;
}

function isSandboxPhone(phone: string | null | undefined) {
    return !!phone && phone.startsWith("+381600000");
}

function personalizeBlastCopy(template: string, target: WorkerWhatsAppBlastTarget) {
    return template
        .replace(/\{name\}/g, target.firstName || "there")
        .replace(/\{link\}/g, WORKER_JOB_FINDER_QUEUE_URL);
}

function getDefaultBlastCopy(target: WorkerWhatsAppBlastTarget) {
    return `Hi ${target.firstName || "there"}! Your profile has been approved and Job Finder checkout is now unlocked in your dashboard. Open your dashboard to complete the $9 Job Finder checkout and we'll match you with employers in Europe. 90-day money-back guarantee. Dashboard: ${WORKER_JOB_FINDER_QUEUE_URL}`;
}

async function logWhatsAppBlastActivity(params: {
    actorUserId?: string | null;
    title: string;
    result: WorkerWhatsAppBlastResult;
    dryRun: boolean;
}) {
    try {
        await logServerActivity(
            params.actorUserId || null,
            params.dryRun ? "admin_whatsapp_blast_preview" : "admin_whatsapp_blast_sent",
            "messaging",
            {
                title: params.title,
                dry_run: params.dryRun,
                total: params.result.total,
                sent: params.result.sent,
                failed: params.result.failed,
                failed_details: params.result.failedDetails.slice(0, 20),
                target_preview: params.result.targets.slice(0, 20).map((target) => ({
                    phone: target.phone,
                    name: target.fullName,
                    status: target.status,
                    profile_id: target.profileId,
                })),
            },
            params.result.failed > 0 ? "warning" : "ok"
        );
    } catch (error) {
        console.warn("[WhatsApp Blast] Failed to log activity:", error);
    }
}

export async function loadWorkerWhatsAppBlastTargets(admin: AdminDbClient): Promise<WorkerWhatsAppBlastTarget[]> {
    const { data: workerRowsRaw, error: workerError } = await admin
        .from("worker_onboarding")
        .select(`${WORKER_ENTRY_FEE_READINESS_COLUMNS}, profile_id, agency_id` as "*")
        .eq("entry_fee_paid", false)
        .not("phone", "is", null)
        .gt("phone", "");

    if (workerError) {
        throw workerError;
    }

    const workerGroups = new Map<string, WhatsAppBlastWorkerRow[]>();
    const workerRows = (workerRowsRaw || []) as unknown as WhatsAppBlastWorkerRow[];
    for (const workerRecord of workerRows) {
        const normalizedPhone = normalizeWorkerPhone(workerRecord.phone);
        const dedupeKey = workerRecord.profile_id || normalizedPhone || workerRecord.id;
        if (!dedupeKey) {
            continue;
        }
        const group = workerGroups.get(dedupeKey) || [];
        group.push(workerRecord);
        workerGroups.set(dedupeKey, group);
    }

    const canonicalWorkers = Array.from(workerGroups.values())
        .map((group) => pickCanonicalWorkerRecord(group))
        .filter((workerRecord): workerRecord is WhatsAppBlastWorkerRow => !!workerRecord);

    const profileIds = canonicalWorkers
        .map((workerRecord) => workerRecord.profile_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

    const profileMap = new Map<string, WhatsAppBlastProfileRow>();
    const documentMap = new Map<string, EntryFeeEligibilityDocumentState[]>();
    if (profileIds.length > 0) {
        const [{ data: profiles, error: profileError }, { data: documents, error: documentError }] = await Promise.all([
            admin
                .from("profiles")
                .select("id, full_name, email")
                .in("id", profileIds),
            admin
                .from("worker_documents")
                .select("user_id, document_type")
                .in("user_id", profileIds),
        ]);

        if (profileError) {
            throw profileError;
        }
        if (documentError) {
            throw documentError;
        }

        for (const profileRecord of (profiles || []) as WhatsAppBlastProfileRow[]) {
            profileMap.set(profileRecord.id, profileRecord);
        }

        for (const documentRecord of (documents || []) as WhatsAppBlastDocumentRow[]) {
            if (!documentRecord.user_id) {
                continue;
            }
            const bucket = documentMap.get(documentRecord.user_id) || [];
            bucket.push({ document_type: documentRecord.document_type });
            documentMap.set(documentRecord.user_id, bucket);
        }
    }

    return canonicalWorkers.flatMap((workerRecord) => {
        const normalizedPhone = normalizeWorkerPhone(workerRecord.phone);
        if (!normalizedPhone || normalizedPhone.length <= 7 || isSandboxPhone(normalizedPhone)) {
            return [];
        }

        const profile = workerRecord.profile_id ? profileMap.get(workerRecord.profile_id) : null;
        if (!canSendWorkerDirectNotifications({
            email: profile?.email || workerRecord.submitted_email,
            phone: normalizedPhone,
            worker: {
                agency_id: workerRecord.agency_id,
                profile_id: workerRecord.profile_id,
                submitted_email: workerRecord.submitted_email,
                phone: workerRecord.phone,
            },
        })) {
            return [];
        }

        const entryFeeResolution = resolveEntryFeeEligibilityForWorker({
            profile: profile ? { full_name: profile.full_name } : null,
            worker: workerRecord,
            documents: workerRecord.profile_id ? (documentMap.get(workerRecord.profile_id) || []) : [],
            fullNameFallback: workerRecord.submitted_full_name,
        });

        if (!entryFeeResolution.unlockState.allowed) {
            return [];
        }

        const fullName = profile?.full_name?.trim()
            || workerRecord.submitted_full_name?.trim()
            || "";
        const firstName = fullName.split(" ")[0]?.trim() || "there";

        return [{
            workerId: workerRecord.id || normalizedPhone,
            profileId: workerRecord.profile_id,
            phone: normalizedPhone,
            status: workerRecord.status ?? null,
            fullName,
            firstName,
        }];
    });
}

export async function sendWorkerWhatsAppBlast(params: {
    admin: AdminDbClient;
    actorUserId?: string | null;
    title?: string;
    customMessage?: string | null;
    dryRun?: boolean;
}) : Promise<WorkerWhatsAppBlastResult> {
    const title = params.title?.trim() || "Job Finder Is Unlocked";
    const customMessage = params.customMessage?.trim() || null;
    const dryRun = params.dryRun === true;
    const targets = await loadWorkerWhatsAppBlastTargets(params.admin);

    const result: WorkerWhatsAppBlastResult = {
        total: targets.length,
        sent: 0,
        failed: 0,
        failedDetails: [],
        targets,
        workerQueueUrl: WORKER_JOB_FINDER_QUEUE_URL,
    };

    if (dryRun) {
        await logWhatsAppBlastActivity({
            actorUserId: params.actorUserId,
            title,
            result,
            dryRun: true,
        });
        return result;
    }

    for (const target of targets) {
        const messageBody = customMessage
            ? personalizeBlastCopy(customMessage, target)
            : getDefaultBlastCopy(target);

        try {
            const announcementResult = await sendAnnouncement(
                target.phone,
                title,
                messageBody,
                WORKER_JOB_FINDER_QUEUE_PATH,
                target.profileId || undefined
            );

            if (announcementResult.success) {
                result.sent += 1;
            } else {
                const fallbackResult = await sendStatusUpdate(
                    target.phone,
                    target.firstName,
                    `Your profile has been approved. Open your dashboard to complete the $9 Job Finder checkout — 90-day money-back guarantee: ${WORKER_JOB_FINDER_QUEUE_URL}`,
                    target.profileId || undefined
                );

                if (fallbackResult.success) {
                    result.sent += 1;
                } else {
                    result.failed += 1;
                    result.failedDetails.push({
                        phone: target.phone,
                        name: target.fullName || target.firstName,
                        error: announcementResult.error || fallbackResult.error || "Unknown error",
                    });
                }
            }
        } catch (error) {
            result.failed += 1;
            result.failedDetails.push({
                phone: target.phone,
                name: target.fullName || target.firstName,
                error: error instanceof Error ? error.message : "Exception",
            });
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await logWhatsAppBlastActivity({
        actorUserId: params.actorUserId,
        title,
        result,
        dryRun: false,
    });

    return result;
}
