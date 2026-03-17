import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { queueEmail } from "@/lib/email-templates";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { loadCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";

interface WorkerReviewInput {
    completion: number;
    entryFeePaid?: boolean | null;
    adminApproved?: boolean | null;
    currentStatus?: string | null;
}

interface ReviewDocumentRow {
    document_type: string | null;
    status?: string | null;
}

type ReviewWorkerRecord = WorkerRecordSnapshot & {
    profile_id?: string | null;
    agency_id?: string | null;
    submitted_email?: string | null;
    family_data?: unknown;
};

interface SyncWorkerReviewStatusOptions {
    adminClient: SupabaseClient<Database>;
    profileId?: string | null;
    workerId?: string | null;
    documentOwnerId?: string | null;
    phoneOptional?: boolean;
    fullNameFallback?: string | null;
    notifyOnPendingApproval?: boolean;
}

const REQUIRED_WORKER_DOCUMENT_TYPES = ["passport", "biometric_photo", "diploma"] as const;
const WORKER_REVIEW_SELECT = "id, profile_id, submitted_full_name, status, admin_approved, entry_fee_paid, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, passport_issued_by, passport_issue_date, passport_expiry_date, lives_abroad, previous_visas, family_data";

const POST_PAYMENT_STATUSES = new Set([
    "IN_QUEUE",
    "OFFER_PENDING",
    "OFFER_ACCEPTED",
    "VISA_PROCESS_STARTED",
    "VISA_APPROVED",
    "PLACED",
    "REFUND_FLAGGED",
]);

export function getPendingApprovalTargetStatus({
    completion,
    entryFeePaid = false,
    adminApproved = false,
    currentStatus,
}: WorkerReviewInput): string | null {
    const normalizedStatus = (currentStatus || "NEW").toUpperCase();

    if (entryFeePaid || POST_PAYMENT_STATUSES.has(normalizedStatus)) {
        return null;
    }

    if (completion >= 100 && !adminApproved) {
        return normalizedStatus === "PENDING_APPROVAL" ? null : "PENDING_APPROVAL";
    }

    if (completion < 100 && !adminApproved && normalizedStatus === "PENDING_APPROVAL") {
        return "NEW";
    }

    return null;
}

export function canApproveWorkerProfile(completion: number) {
    return completion >= 100;
}

export function getVerifiedWorkerDocuments(documents: ReviewDocumentRow[]) {
    return documents.filter((document) =>
        typeof document.document_type === "string"
        && document.document_type.trim().length > 0
        && document.status === "verified"
    );
}

export function hasAllRequiredWorkerDocumentsVerified(documents: ReviewDocumentRow[]) {
    const verifiedTypes = new Set(
        getVerifiedWorkerDocuments(documents).map((document) => document.document_type as string)
    );

    return REQUIRED_WORKER_DOCUMENT_TYPES.every((documentType) => verifiedTypes.has(documentType));
}

export async function syncWorkerReviewStatus({
    adminClient,
    profileId = null,
    workerId = null,
    documentOwnerId = null,
    phoneOptional = false,
    fullNameFallback = null,
    notifyOnPendingApproval = false,
}: SyncWorkerReviewStatusOptions) {
    const workerRecord = profileId
        ? await loadCanonicalWorkerRecord<ReviewWorkerRecord>(adminClient, profileId, WORKER_REVIEW_SELECT).then((result) => result.data)
        : workerId
            ? await adminClient
                .from("worker_onboarding")
                .select(WORKER_REVIEW_SELECT)
                .eq("id", workerId)
                .maybeSingle()
                .then((result) => result.data)
            : null;

    if (!workerRecord?.id) {
        return {
            completion: 0,
            missingFields: [] as string[],
            reviewQueued: false,
            targetStatus: null as string | null,
            allDocumentsVerified: false,
        };
    }

    const resolvedProfileId = profileId || workerRecord.profile_id || null;
    const resolvedDocumentOwnerId = documentOwnerId || resolvedProfileId;

    if (!resolvedDocumentOwnerId) {
        return {
            completion: 0,
            missingFields: [] as string[],
            reviewQueued: false,
            targetStatus: null as string | null,
            allDocumentsVerified: false,
        };
    }

    const [{ data: documents }, { data: profile }] = await Promise.all([
        adminClient
            .from("worker_documents")
            .select("document_type, status")
            .eq("user_id", resolvedDocumentOwnerId),
        resolvedProfileId
            ? adminClient
                .from("profiles")
                .select("full_name, email")
                .eq("id", resolvedProfileId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
    ]);

    const allDocuments = (documents || []) as ReviewDocumentRow[];
    const verifiedDocuments = getVerifiedWorkerDocuments(allDocuments);
    const allDocumentsVerified = hasAllRequiredWorkerDocumentsVerified(allDocuments);
    const completionResult = getWorkerCompletion({
        profile: profile
            ? {
                ...profile,
                full_name: profile.full_name || fullNameFallback || null,
            }
            : {
                full_name: fullNameFallback || workerRecord.submitted_full_name || null,
            },
        worker: workerRecord,
        documents: verifiedDocuments.map((document) => ({
            document_type: document.document_type as string,
        })),
    }, {
        phoneOptional,
        fullNameFallback,
    });

    const targetStatus = getPendingApprovalTargetStatus({
        completion: allDocumentsVerified ? completionResult.completion : Math.min(completionResult.completion, 99),
        entryFeePaid: workerRecord.entry_fee_paid,
        adminApproved: !!workerRecord.admin_approved,
        currentStatus: workerRecord.status,
    });

    if (targetStatus) {
        await adminClient
            .from("worker_onboarding")
            .update({
                status: targetStatus,
                updated_at: new Date().toISOString(),
            })
            .eq("id", workerRecord.id);
    }

    const effectiveStatus = (targetStatus || workerRecord.status || "NEW").toUpperCase();
    const reviewQueued = effectiveStatus === "PENDING_APPROVAL";

    if (
        notifyOnPendingApproval
        && reviewQueued
        && resolvedProfileId
        && !workerRecord.entry_fee_paid
        && profile?.email
    ) {
        const { data: existingEmail } = await adminClient
            .from("email_queue")
            .select("id")
            .eq("user_id", resolvedProfileId)
            .eq("email_type", "profile_complete")
            .limit(1)
            .maybeSingle();

        if (!existingEmail) {
            const notificationName = profile.full_name?.trim()
                || fullNameFallback?.trim()
                || workerRecord.submitted_full_name?.trim()
                || "there";
            const canNotifyWorkerDirectly = canSendWorkerDirectNotifications({
                email: profile.email,
                phone: workerRecord.phone || undefined,
                worker: workerRecord,
            });

            if (!canNotifyWorkerDirectly) {
                return {
                    completion: completionResult.completion,
                    missingFields: completionResult.missingFields,
                    reviewQueued,
                    targetStatus,
                    allDocumentsVerified,
                };
            }

            await queueEmail(
                adminClient,
                resolvedProfileId,
                "profile_complete",
                profile.email,
                notificationName,
                {},
                undefined,
                workerRecord.phone || undefined
            );
        }
    }

    return {
        completion: completionResult.completion,
        missingFields: completionResult.missingFields,
        reviewQueued,
        targetStatus,
        allDocumentsVerified,
    };
}
