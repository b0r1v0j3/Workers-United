import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { queueEmail } from "@/lib/email-templates";
import { isEmailDeliveryAccepted } from "@/lib/email-queue";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { loadCanonicalWorkerRecord, normalizeWorkerPhone, type WorkerRecordSnapshot } from "@/lib/workers";
import { buildWorkerPaymentUnlockedEmailData, resolveWorkerApprovalNotificationRecipient } from "@/lib/worker-approval-notifications";

interface WorkerReviewInput {
    completion: number;
    entryFeePaid?: boolean | null;
    adminApproved?: boolean | null;
    currentStatus?: string | null;
    jobSearchActive?: boolean | null;
}

interface ReviewDocumentRow {
    document_type: string | null;
    status?: string | null;
}

interface PassportReviewDocumentRow {
    ocr_json?: unknown;
    status?: string | null;
}

type ReviewWorkerRecord = WorkerRecordSnapshot & {
    profile_id?: string | null;
    agency_id?: string | null;
    submitted_email?: string | null;
    admin_approved_at?: string | null;
    admin_approved_by?: string | null;
    family_data?: unknown;
    passport_issued_by?: string | null;
    passport_issue_date?: string | null;
    passport_expiry_date?: string | null;
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

type WorkerReviewNotificationReason =
    | "already_notified"
    | "worker_direct_notifications_disabled"
    | "missing_profile_email"
    | "notification_queue_failed";

interface SyncWorkerReviewStatusResult {
    completion: number;
    missingFields: string[];
    reviewQueued: boolean;
    targetStatus: string | null;
    allDocumentsVerified: boolean;
    notificationSent: boolean;
    notificationReason: WorkerReviewNotificationReason | null;
}

interface WorkerApprovalGuardState {
    worker: ReviewWorkerRecord;
    profileId: string | null;
    documentOwnerId: string | null;
    completion: number;
    missingFields: string[];
    allDocumentsVerified: boolean;
    hasPaidEntryFee: boolean;
    canApprove: boolean;
    canRevoke: boolean;
    displayName: string;
    notificationUserId: string | null;
    notificationRecipient: ReturnType<typeof resolveWorkerApprovalNotificationRecipient>;
}

type WorkerApprovalNotificationResult = {
    status: "sent" | "queued" | "failed" | "skipped";
    error?: string | null;
};

interface WorkerReviewEmailQueueRecord {
    status?: string | null;
}

const REQUIRED_WORKER_DOCUMENT_TYPES = ["passport", "biometric_photo", "diploma"] as const;
const WORKER_REVIEW_SELECT = "id, profile_id, submitted_full_name, status, admin_approved, admin_approved_at, admin_approved_by, entry_fee_paid, job_search_active, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, passport_issued_by, passport_issue_date, passport_expiry_date, lives_abroad, previous_visas, family_data";
const PASSPORT_REVIEW_STATUSES = ["manual_review", "verified"] as const;

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
    jobSearchActive = false,
}: WorkerReviewInput): string | null {
    const normalizedStatus = (currentStatus || "NEW").toUpperCase();

    if (entryFeePaid || jobSearchActive || POST_PAYMENT_STATUSES.has(normalizedStatus)) {
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

export function canRevokeWorkerApproval({
    entryFeePaid = false,
    jobSearchActive = false,
    currentStatus,
}: Pick<WorkerReviewInput, "entryFeePaid" | "currentStatus" | "jobSearchActive">) {
    const normalizedStatus = (currentStatus || "NEW").toUpperCase();
    return !(entryFeePaid || jobSearchActive || POST_PAYMENT_STATUSES.has(normalizedStatus));
}

export function shouldSuppressWorkerReviewNotification(existingEmail?: WorkerReviewEmailQueueRecord | null) {
    return existingEmail?.status === "sent";
}

export function canApproveWorkerProfile(completion: number) {
    return completion >= 100;
}

async function loadWorkerApprovalSourceRecord(
    adminClient: SupabaseClient<Database>,
    workerId: string,
    profileId: string | null
) {
    if (profileId) {
        return loadCanonicalWorkerRecord<ReviewWorkerRecord>(
            adminClient,
            profileId,
            WORKER_REVIEW_SELECT
        ).then((result) => result.data);
    }

    return adminClient
        .from("worker_onboarding")
        .select(WORKER_REVIEW_SELECT)
        .eq("id", workerId)
        .maybeSingle()
        .then((result) => result.data);
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

function parsePassportOcrPayload(ocrJson: unknown): Record<string, unknown> | null {
    if (ocrJson && typeof ocrJson === "object" && !Array.isArray(ocrJson)) {
        return ocrJson as Record<string, unknown>;
    }

    if (typeof ocrJson !== "string") {
        return null;
    }

    try {
        const parsed = JSON.parse(ocrJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        return null;
    }

    return null;
}

function normalizePassportTextValue(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function normalizePassportOcrDate(value: unknown): string | null {
    const rawValue = normalizePassportTextValue(value);
    if (!rawValue) {
        return null;
    }

    const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const enGbMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (enGbMatch) {
        const [, day, month, year] = enGbMatch;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    const textualMatch = rawValue.match(/^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/i);
    if (textualMatch) {
        const [, day, rawMonth, year] = textualMatch;
        const monthMap: Record<string, string> = {
            jan: "01",
            january: "01",
            feb: "02",
            february: "02",
            mar: "03",
            march: "03",
            apr: "04",
            april: "04",
            may: "05",
            jun: "06",
            june: "06",
            jul: "07",
            july: "07",
            aug: "08",
            august: "08",
            sep: "09",
            sept: "09",
            september: "09",
            oct: "10",
            october: "10",
            nov: "11",
            november: "11",
            dec: "12",
            december: "12",
        };
        const normalizedMonth = monthMap[rawMonth.toLowerCase()];
        if (normalizedMonth) {
            return `${year}-${normalizedMonth}-${day.padStart(2, "0")}`;
        }
    }

    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString().slice(0, 10);
}

export function buildWorkerPassportAutofillPatch(
    workerRecord: Pick<ReviewWorkerRecord, "passport_issued_by" | "passport_issue_date" | "passport_expiry_date">,
    ocrJson: unknown
) {
    const passportOcr = parsePassportOcrPayload(ocrJson);
    if (!passportOcr) {
        return {} as Partial<Pick<ReviewWorkerRecord, "passport_issued_by" | "passport_issue_date" | "passport_expiry_date">>;
    }

    const patch: Partial<Pick<ReviewWorkerRecord, "passport_issued_by" | "passport_issue_date" | "passport_expiry_date">> = {};
    const normalizedIssueDate = normalizePassportOcrDate(passportOcr.date_of_issue);
    const normalizedExpiryDate = normalizePassportOcrDate(passportOcr.expiry_date);
    const normalizedIssuingAuthority = normalizePassportTextValue(passportOcr.issuing_authority);

    if (!normalizePassportTextValue(workerRecord.passport_issue_date) && normalizedIssueDate) {
        patch.passport_issue_date = normalizedIssueDate;
    }

    if (!normalizePassportTextValue(workerRecord.passport_expiry_date) && normalizedExpiryDate) {
        patch.passport_expiry_date = normalizedExpiryDate;
    }

    if (!normalizePassportTextValue(workerRecord.passport_issued_by) && normalizedIssuingAuthority) {
        patch.passport_issued_by = normalizedIssuingAuthority;
    }

    return patch;
}

async function syncWorkerPassportFieldsFromOcr(
    adminClient: SupabaseClient<Database>,
    workerRecord: ReviewWorkerRecord,
    documentOwnerId: string
) {
    const { data: passportDocument, error } = await adminClient
        .from("worker_documents")
        .select("ocr_json, status")
        .eq("user_id", documentOwnerId)
        .eq("document_type", "passport")
        .in("status", [...PASSPORT_REVIEW_STATUSES])
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !passportDocument) {
        if (error) {
            console.warn("[WorkerReview] Passport OCR lookup failed:", error.message);
        }
        return {} as Partial<ReviewWorkerRecord>;
    }

    const patch = buildWorkerPassportAutofillPatch(workerRecord, (passportDocument as PassportReviewDocumentRow).ocr_json);
    if (Object.keys(patch).length === 0) {
        return {} as Partial<ReviewWorkerRecord>;
    }

    const { error: updateError } = await adminClient
        .from("worker_onboarding")
        .update({
            ...patch,
            updated_at: new Date().toISOString(),
        })
        .eq("id", workerRecord.id as string);

    if (updateError) {
        console.warn("[WorkerReview] Passport OCR autofill failed:", updateError.message);
        return {} as Partial<ReviewWorkerRecord>;
    }

    return patch;
}

export async function syncWorkerReviewStatus({
    adminClient,
    profileId = null,
    workerId = null,
    documentOwnerId = null,
    phoneOptional = false,
    fullNameFallback = null,
    notifyOnPendingApproval = false,
}: SyncWorkerReviewStatusOptions): Promise<SyncWorkerReviewStatusResult> {
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
            notificationSent: false,
            notificationReason: null,
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
            notificationSent: false,
            notificationReason: null,
        };
    }

    const passportAutofillPatch = await syncWorkerPassportFieldsFromOcr(
        adminClient,
        workerRecord,
        resolvedDocumentOwnerId
    );
    const hydratedWorkerRecord = Object.keys(passportAutofillPatch).length > 0
        ? { ...workerRecord, ...passportAutofillPatch }
        : workerRecord;

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
        worker: hydratedWorkerRecord,
        documents: verifiedDocuments.map((document) => ({
            document_type: document.document_type as string,
        })),
    }, {
        phoneOptional,
        fullNameFallback,
    });
    const effectiveCompletion = allDocumentsVerified
        ? completionResult.completion
        : Math.min(completionResult.completion, 99);

    const targetStatus = getPendingApprovalTargetStatus({
        completion: effectiveCompletion,
        entryFeePaid: hydratedWorkerRecord.entry_fee_paid,
        adminApproved: !!hydratedWorkerRecord.admin_approved,
        currentStatus: hydratedWorkerRecord.status,
        jobSearchActive: !!hydratedWorkerRecord.job_search_active,
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

    const effectiveStatus = (targetStatus || hydratedWorkerRecord.status || "NEW").toUpperCase();
    const reviewQueued = effectiveStatus === "PENDING_APPROVAL";
    let notificationSent = false;
    let notificationReason: WorkerReviewNotificationReason | null = null;

    if (
        notifyOnPendingApproval
        && reviewQueued
        && resolvedProfileId
        && !workerRecord.entry_fee_paid
    ) {
        if (!profile?.email) {
            notificationReason = "missing_profile_email";
        } else {
            const { data: existingEmail } = await adminClient
                .from("email_queue")
                .select("id, status")
                .eq("user_id", resolvedProfileId)
                .eq("email_type", "profile_complete")
                .eq("status", "sent")
                .limit(1)
                .maybeSingle();

            if (shouldSuppressWorkerReviewNotification(existingEmail)) {
                notificationReason = "already_notified";
            } else {
                const notificationName = profile.full_name?.trim()
                    || fullNameFallback?.trim()
                    || hydratedWorkerRecord.submitted_full_name?.trim()
                    || "there";
                const canNotifyWorkerDirectly = canSendWorkerDirectNotifications({
                    email: profile.email,
                    phone: hydratedWorkerRecord.phone || undefined,
                    worker: hydratedWorkerRecord,
                });

                if (!canNotifyWorkerDirectly) {
                    notificationReason = "worker_direct_notifications_disabled";
                } else {
                    try {
                        const notificationResult = await queueEmail(
                            adminClient,
                            resolvedProfileId,
                            "profile_complete",
                            profile.email,
                            notificationName,
                            {},
                            undefined,
                            hydratedWorkerRecord.phone || undefined
                        );
                        notificationSent = isEmailDeliveryAccepted(notificationResult);
                        if (!notificationSent) {
                            notificationReason = "notification_queue_failed";
                        }
                    } catch (error) {
                        console.error("[WorkerReview] Failed to queue pending-approval notification:", error);
                        notificationReason = "notification_queue_failed";
                    }
                }
            }
        }
    }

    return {
        completion: effectiveCompletion,
        missingFields: completionResult.missingFields,
        reviewQueued,
        targetStatus,
        allDocumentsVerified,
        notificationSent,
        notificationReason,
    };
}

export async function loadWorkerApprovalGuardState({
    adminClient,
    profileId = null,
    workerId = null,
    documentOwnerId = null,
    phoneOptional = false,
    fullNameFallback = null,
}: SyncWorkerReviewStatusOptions): Promise<WorkerApprovalGuardState | null> {
    if (!workerId && !profileId) {
        return null;
    }

    const syncResult = await syncWorkerReviewStatus({
        adminClient,
        profileId,
        workerId,
        documentOwnerId,
        phoneOptional,
        fullNameFallback,
        notifyOnPendingApproval: false,
    });

    const worker = await loadWorkerApprovalSourceRecord(adminClient, workerId || "", profileId || null);
    if (!worker?.id) {
        return null;
    }

    const resolvedProfileId = profileId || worker.profile_id || null;
    const resolvedDocumentOwnerId = documentOwnerId || resolvedProfileId;

    const [{ data: profile }, authUserResult] = await Promise.all([
        resolvedProfileId
            ? adminClient
                .from("profiles")
                .select("full_name, email")
                .eq("id", resolvedProfileId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        resolvedProfileId
            ? adminClient.auth.admin.getUserById(resolvedProfileId)
            : Promise.resolve({ data: { user: null } }),
    ]);

    const displayName = profile?.full_name?.trim()
        || fullNameFallback?.trim()
        || worker.submitted_full_name?.trim()
        || authUserResult.data.user?.user_metadata?.full_name?.trim()
        || authUserResult.data.user?.email
        || "Worker";

    const notificationRecipient = resolveWorkerApprovalNotificationRecipient({
        worker,
        workerProfileEmail: profile?.email || null,
        authEmail: authUserResult.data.user?.email || null,
        displayName,
    });

    const hasPaidEntryFee =
        !!worker.entry_fee_paid
        || !!worker.job_search_active
        || POST_PAYMENT_STATUSES.has((worker.status || "NEW").toUpperCase());

    return {
        worker,
        profileId: resolvedProfileId,
        documentOwnerId: resolvedDocumentOwnerId,
        completion: syncResult.completion,
        missingFields: syncResult.missingFields,
        allDocumentsVerified: syncResult.allDocumentsVerified,
        hasPaidEntryFee,
        canApprove: canApproveWorkerProfile(syncResult.completion),
        canRevoke: canRevokeWorkerApproval({
            entryFeePaid: !!worker.entry_fee_paid,
            jobSearchActive: !!worker.job_search_active,
            currentStatus: worker.status,
        }),
        displayName,
        notificationUserId: resolvedProfileId || worker.id || null,
        notificationRecipient,
    };
}

export async function applyWorkerApprovalAction({
    adminClient,
    actorUserId,
    action,
    profileId = null,
    workerId = null,
    documentOwnerId = null,
    phoneOptional = false,
    fullNameFallback = null,
}: SyncWorkerReviewStatusOptions & {
    actorUserId: string;
    action: "approve" | "revoke";
}) {
    const approvalState = await loadWorkerApprovalGuardState({
        adminClient,
        profileId,
        workerId,
        documentOwnerId,
        phoneOptional,
        fullNameFallback,
    });

    if (!approvalState?.worker?.id) {
        throw new Error("Worker record not found");
    }

    if (action === "approve" && !approvalState.canApprove) {
        throw new Error("Worker profile must be 100% complete before approval.");
    }

    if (action === "revoke" && !approvalState.canRevoke) {
        throw new Error("Cannot revoke approval after Job Finder is active.");
    }

    const approved = action === "approve";
    const nextStatus = approved
        ? "APPROVED"
        : approvalState.completion >= 100
            ? "PENDING_APPROVAL"
            : "NEW";
    const nowIso = new Date().toISOString();

    const { error: updateError } = await adminClient
        .from("worker_onboarding")
        .update({
            admin_approved: approved,
            admin_approved_at: approved ? nowIso : null,
            admin_approved_by: approved ? actorUserId : null,
            status: nextStatus,
            updated_at: nowIso,
        })
        .eq("id", approvalState.worker.id);

    if (updateError) {
        throw new Error(updateError.message);
    }

    let notificationQueued = false;
    let notification: WorkerApprovalNotificationResult = { status: "skipped", error: null };
    if (approved && approvalState.notificationRecipient && approvalState.notificationUserId) {
        const notificationResult = await queueEmail(
            adminClient,
            approvalState.notificationUserId,
            "admin_update",
            approvalState.notificationRecipient.email,
            approvalState.notificationRecipient.name,
            buildWorkerPaymentUnlockedEmailData(),
            undefined,
            normalizeWorkerPhone(approvalState.worker.phone) || undefined
        );
        notificationQueued = isEmailDeliveryAccepted(notificationResult);
        notification = notificationResult.sent
            ? { status: "sent", error: null }
            : notificationQueued
                ? { status: "queued", error: notificationResult.error || null }
                : { status: "failed", error: notificationResult.error || "Email send failed." };
    }

    return {
        approved,
        status: nextStatus,
        completion: approvalState.completion,
        notificationQueued,
        notification,
        workerId: approvalState.worker.id,
    };
}
