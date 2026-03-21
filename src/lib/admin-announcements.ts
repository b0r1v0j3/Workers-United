import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getAllAuthUsers } from "@/lib/supabase/admin";
import { normalizeUserType, type CanonicalUserType } from "@/lib/domain";
import { queueEmail, type EmailType, type TemplateData } from "@/lib/email-templates";
import { isEmailDeliveryAccepted } from "@/lib/email-queue";
import { hasKnownTypoEmailDomain, isInternalOrTestEmail } from "@/lib/reporting";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { pickCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";
import { logServerActivity } from "@/lib/activityLoggerServer";

type AdminDbClient = SupabaseClient<Database>;

type AnnouncementRecipientRole = Exclude<CanonicalUserType, "admin">;

interface AnnouncementWorkerRow extends WorkerRecordSnapshot {
    profile_id: string | null;
    agency_id: string | null;
    submitted_email: string | null;
    phone: string | null;
}

export type AnnouncementAudience = "workers" | "employers" | "agencies" | "all";

export interface AdminAnnouncementTarget {
    userId: string;
    email: string;
    name: string;
    recipientRole: AnnouncementRecipientRole;
}

export interface AdminAnnouncementResult {
    total: number;
    sent: number;
    queued: number;
    failed: number;
    failedDetails: Array<{ email: string; name: string; error: string }>;
    targets: AdminAnnouncementTarget[];
}

const ANNOUNCEMENT_EMAIL_THROTTLE_MS = 1500;

function normalizeDeliverableEmail(email?: string | null) {
    const normalized = email?.trim().toLowerCase() || "";
    if (!normalized) {
        return null;
    }

    if (isInternalOrTestEmail(normalized) || hasKnownTypoEmailDomain(normalized)) {
        return null;
    }

    return normalized;
}

function normalizeAudienceRole(rawRole: string | null | undefined): AnnouncementRecipientRole {
    const normalizedRole = normalizeUserType(rawRole);
    if (normalizedRole === "employer" || normalizedRole === "agency") {
        return normalizedRole;
    }

    return "worker";
}

function matchesAnnouncementAudience(role: AnnouncementRecipientRole, audience: AnnouncementAudience) {
    switch (audience) {
        case "workers":
            return role === "worker";
        case "employers":
            return role === "employer";
        case "agencies":
            return role === "agency";
        case "all":
        default:
            return true;
    }
}

function getRecipientName(fullName: string | undefined, email: string) {
    const normalizedName = fullName?.trim();
    if (normalizedName) {
        return normalizedName;
    }

    return email.split("@")[0] || "User";
}

async function logAnnouncementActivity(params: {
    actorUserId?: string | null;
    audience: AnnouncementAudience;
    subject: string;
    result: AdminAnnouncementResult;
    dryRun: boolean;
}) {
    try {
        await logServerActivity(
            params.actorUserId || null,
            params.dryRun ? "admin_announcement_preview" : "admin_announcement_sent",
            "messaging",
            {
                audience: params.audience,
                subject: params.subject,
                dry_run: params.dryRun,
                total: params.result.total,
                sent: params.result.sent,
                queued: params.result.queued,
                failed: params.result.failed,
                failed_details: params.result.failedDetails.slice(0, 20),
                target_preview: params.result.targets.slice(0, 20).map((target) => ({
                    email: target.email,
                    name: target.name,
                    recipient_role: target.recipientRole,
                    user_id: target.userId,
                })),
            },
            params.result.failed > 0 || params.result.queued > 0 ? "warning" : "ok"
        );
    } catch (error) {
        console.warn("[Admin Announcements] Failed to log activity:", error);
    }
}

async function logDocumentFixAnnouncementActivity(params: {
    actorUserId?: string | null;
    result: AdminAnnouncementResult;
    dryRun: boolean;
}) {
    try {
        await logServerActivity(
            params.actorUserId || null,
            params.dryRun ? "admin_document_fix_announcement_preview" : "admin_document_fix_announcement_sent",
            "messaging",
            {
                audience: "workers",
                template: "announcement_document_fix",
                dry_run: params.dryRun,
                total: params.result.total,
                sent: params.result.sent,
                queued: params.result.queued,
                failed: params.result.failed,
                failed_details: params.result.failedDetails.slice(0, 20),
                target_preview: params.result.targets.slice(0, 20).map((target) => ({
                    email: target.email,
                    name: target.name,
                    recipient_role: target.recipientRole,
                    user_id: target.userId,
                })),
            },
            params.result.failed > 0 || params.result.queued > 0 ? "warning" : "ok"
        );
    } catch (error) {
        console.warn("[Document Fix Announcement] Failed to log activity:", error);
    }
}

async function waitForAnnouncementThrottle() {
    await new Promise((resolve) => setTimeout(resolve, ANNOUNCEMENT_EMAIL_THROTTLE_MS));
}

async function sendAudienceTemplateEmail(params: {
    admin: AdminDbClient;
    targets: AdminAnnouncementTarget[];
    emailType: EmailType;
    buildTemplateData: (target: AdminAnnouncementTarget) => TemplateData;
    fallbackError: string;
    dryRun: boolean;
}) {
    const result: AdminAnnouncementResult = {
        total: params.targets.length,
        sent: 0,
        queued: 0,
        failed: 0,
        failedDetails: [],
        targets: params.targets,
    };

    if (params.dryRun) {
        return result;
    }

    for (const [index, target] of params.targets.entries()) {
        const emailResult = await queueEmail(
            params.admin,
            target.userId,
            params.emailType,
            target.email,
            target.name,
            params.buildTemplateData(target)
        );

        if (emailResult.sent) {
            result.sent += 1;
        } else if (isEmailDeliveryAccepted(emailResult)) {
            result.queued += 1;
        } else {
            result.failed += 1;
            result.failedDetails.push({
                email: target.email,
                name: target.name,
                error: emailResult.error || params.fallbackError,
            });
        }

        if (index < params.targets.length - 1) {
            await waitForAnnouncementThrottle();
        }
    }

    return result;
}

export async function loadAnnouncementTargets(
    admin: AdminDbClient,
    audience: AnnouncementAudience
): Promise<AdminAnnouncementTarget[]> {
    const authUsers = await getAllAuthUsers(admin);

    const candidateUsers = authUsers.filter((authUser) => {
        if (authUser.user_metadata?.hidden_draft_owner) {
            return false;
        }

        const recipientRole = normalizeAudienceRole(authUser.user_metadata?.user_type);
        return matchesAnnouncementAudience(recipientRole, audience);
    });

    const workerProfileIds = candidateUsers
        .filter((authUser) => normalizeAudienceRole(authUser.user_metadata?.user_type) === "worker")
        .map((authUser) => authUser.id);

    const workerMap = new Map<string, AnnouncementWorkerRow>();
    if (workerProfileIds.length > 0) {
        const { data: workerRows, error: workerError } = await admin
            .from("worker_onboarding")
            .select("profile_id, agency_id, submitted_email, phone, updated_at, queue_joined_at, job_search_active, nationality, current_country, preferred_job")
            .in("profile_id", workerProfileIds);

        if (workerError) {
            throw workerError;
        }

        const workerGroups = new Map<string, AnnouncementWorkerRow[]>();
        for (const workerRow of (workerRows || []) as AnnouncementWorkerRow[]) {
            if (!workerRow.profile_id) {
                continue;
            }

            const current = workerGroups.get(workerRow.profile_id) || [];
            current.push(workerRow);
            workerGroups.set(workerRow.profile_id, current);
        }

        for (const [profileId, rows] of workerGroups.entries()) {
            const canonicalWorker = pickCanonicalWorkerRecord(rows);
            if (canonicalWorker) {
                workerMap.set(profileId, canonicalWorker as AnnouncementWorkerRow);
            }
        }
    }

    const recipientsByEmail = new Map<string, AdminAnnouncementTarget>();
    for (const authUser of candidateUsers) {
        const email = normalizeDeliverableEmail(authUser.email);
        if (!email) {
            continue;
        }

        const recipientRole = normalizeAudienceRole(authUser.user_metadata?.user_type);
        const workerRecord = recipientRole === "worker" ? workerMap.get(authUser.id) || null : null;

        if (recipientRole === "worker") {
            const canSend = canSendWorkerDirectNotifications({
                email,
                phone: workerRecord?.phone,
                worker: workerRecord
                    ? {
                        agency_id: workerRecord.agency_id,
                        profile_id: workerRecord.profile_id,
                        submitted_email: workerRecord.submitted_email,
                        phone: workerRecord.phone,
                    }
                    : null,
            });

            if (!canSend) {
                continue;
            }
        }

        if (recipientsByEmail.has(email)) {
            continue;
        }

        recipientsByEmail.set(email, {
            userId: authUser.id,
            email,
            name: getRecipientName(authUser.user_metadata?.full_name, email),
            recipientRole,
        });
    }

    return Array.from(recipientsByEmail.values());
}

export async function sendAdminAnnouncement(params: {
    admin: AdminDbClient;
    actorUserId?: string | null;
    audience: AnnouncementAudience;
    subject: string;
    message: string;
    actionText?: string | null;
    actionLink?: string | null;
    dryRun?: boolean;
}) : Promise<AdminAnnouncementResult> {
    const subject = params.subject.trim();
    const message = params.message.trim();
    const actionLink = params.actionLink?.trim() || undefined;
    const actionText = actionLink ? (params.actionText?.trim() || "View Details") : undefined;
    const dryRun = params.dryRun === true;
    const targets = await loadAnnouncementTargets(params.admin, params.audience);
    const result = await sendAudienceTemplateEmail({
        admin: params.admin,
        targets,
        emailType: "announcement",
        buildTemplateData: (target) => ({
            title: subject,
            message,
            subject,
            actionText,
            actionLink,
            recipientRole: target.recipientRole,
        }),
        fallbackError: "Announcement email failed",
        dryRun,
    });

    await logAnnouncementActivity({
        actorUserId: params.actorUserId,
        audience: params.audience,
        subject,
        result,
        dryRun,
    });

    return result;
}

export async function sendDocumentFixAnnouncementEmails(params: {
    admin: AdminDbClient;
    actorUserId?: string | null;
    dryRun?: boolean;
}): Promise<AdminAnnouncementResult> {
    const dryRun = params.dryRun === true;
    const targets = await loadAnnouncementTargets(params.admin, "workers");
    const result = await sendAudienceTemplateEmail({
        admin: params.admin,
        targets,
        emailType: "announcement_document_fix",
        buildTemplateData: (target) => ({
            recipientRole: target.recipientRole,
        }),
        fallbackError: "Document-fix announcement email failed",
        dryRun,
    });

    await logDocumentFixAnnouncementActivity({
        actorUserId: params.actorUserId,
        result,
        dryRun,
    });

    return result;
}
