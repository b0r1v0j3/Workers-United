import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { normalizeWorkerPhone, pickCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";
import { sendAnnouncement, sendStatusUpdate } from "@/lib/whatsapp";

type AdminDbClient = SupabaseClient<Database>;

const STRIPE_PAYMENT_LINK =
    process.env.STRIPE_JOB_FINDER_PAYMENT_LINK ||
    "https://buy.stripe.com/fZueVcdG1bglfgr1nc0ZW00";

interface WhatsAppBlastWorkerRow extends WorkerRecordSnapshot {
    id: string;
    profile_id: string | null;
    agency_id: string | null;
    submitted_email: string | null;
    phone: string | null;
    status: string | null;
    entry_fee_paid: boolean | null;
}

interface WhatsAppBlastProfileRow {
    id: string;
    full_name: string | null;
    email: string | null;
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
    stripeLink: string;
}

function isSandboxPhone(phone: string | null | undefined) {
    return !!phone && phone.startsWith("+381600000");
}

function personalizeBlastCopy(template: string, target: WorkerWhatsAppBlastTarget) {
    return template
        .replace(/\{name\}/g, target.firstName || "there")
        .replace(/\{link\}/g, STRIPE_PAYMENT_LINK);
}

function getDefaultBlastCopy(target: WorkerWhatsAppBlastTarget) {
    return `Hi ${target.firstName || "there"}! Your profile is ready. Activate Job Finder for $9 and we'll match you with employers in Europe. 90-day money-back guarantee. Pay: ${STRIPE_PAYMENT_LINK}`;
}

async function logWhatsAppBlastActivity(params: {
    admin: AdminDbClient;
    actorUserId?: string | null;
    title: string;
    result: WorkerWhatsAppBlastResult;
    dryRun: boolean;
}) {
    try {
        await params.admin.from("user_activity").insert({
            user_id: params.actorUserId || null,
            action: params.dryRun ? "admin_whatsapp_blast_preview" : "admin_whatsapp_blast_sent",
            category: "messaging",
            status: params.result.failed > 0 ? "warning" : "ok",
            details: {
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
        });
    } catch (error) {
        console.warn("[WhatsApp Blast] Failed to log activity:", error);
    }
}

export async function loadWorkerWhatsAppBlastTargets(admin: AdminDbClient): Promise<WorkerWhatsAppBlastTarget[]> {
    const { data: workerRows, error: workerError } = await admin
        .from("worker_onboarding")
        .select("id, profile_id, agency_id, submitted_email, phone, status, entry_fee_paid, updated_at, queue_joined_at, job_search_active, nationality, current_country, preferred_job")
        .eq("entry_fee_paid", false)
        .not("phone", "is", null)
        .gt("phone", "");

    if (workerError) {
        throw workerError;
    }

    const workerGroups = new Map<string, WhatsAppBlastWorkerRow[]>();
    for (const workerRecord of (workerRows || []) as WhatsAppBlastWorkerRow[]) {
        const normalizedPhone = normalizeWorkerPhone(workerRecord.phone);
        const dedupeKey = workerRecord.profile_id || normalizedPhone || workerRecord.id;
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
    if (profileIds.length > 0) {
        const { data: profiles, error: profileError } = await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds);

        if (profileError) {
            throw profileError;
        }

        for (const profileRecord of (profiles || []) as WhatsAppBlastProfileRow[]) {
            profileMap.set(profileRecord.id, profileRecord);
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

        const fullName = profile?.full_name?.trim() || "";
        const firstName = fullName.split(" ")[0]?.trim() || "there";

        return [{
            workerId: workerRecord.id,
            profileId: workerRecord.profile_id,
            phone: normalizedPhone,
            status: workerRecord.status,
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
    const title = params.title?.trim() || "Activate Job Finder";
    const customMessage = params.customMessage?.trim() || null;
    const dryRun = params.dryRun === true;
    const targets = await loadWorkerWhatsAppBlastTargets(params.admin);

    const result: WorkerWhatsAppBlastResult = {
        total: targets.length,
        sent: 0,
        failed: 0,
        failedDetails: [],
        targets,
        stripeLink: STRIPE_PAYMENT_LINK,
    };

    if (dryRun) {
        await logWhatsAppBlastActivity({
            admin: params.admin,
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
                "/profile/worker/queue",
                target.profileId || undefined
            );

            if (announcementResult.success) {
                result.sent += 1;
            } else {
                const fallbackResult = await sendStatusUpdate(
                    target.phone,
                    target.firstName,
                    `Activate Job Finder for $9 — 90-day money-back guarantee. Pay here: ${STRIPE_PAYMENT_LINK}`,
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
        admin: params.admin,
        actorUserId: params.actorUserId,
        title,
        result,
        dryRun: false,
    });

    return result;
}
