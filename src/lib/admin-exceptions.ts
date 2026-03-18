import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/database.types";
import { normalizeUserType } from "@/lib/domain";
import { getWorkerCompletion } from "@/lib/profile-completion";
import {
    isInternalOrTestEmail,
    hasKnownInvalidOnlyEmailDomain,
    hasKnownTypoEmailDomain,
    isLikelyUndeliverableEmailError,
    isReportablePaymentProfile,
} from "@/lib/reporting";
import { getWorkerDocumentProgress } from "@/lib/worker-documents";
import { pickCanonicalWorkerRecord } from "@/lib/workers";

type ProfileRow = Pick<Tables<"profiles">, "id" | "email" | "full_name" | "user_type" | "created_at">;
type WorkerRow = Tables<"worker_onboarding">;
type DocumentRow = Pick<Tables<"worker_documents">, "user_id" | "document_type" | "status" | "updated_at" | "created_at">;
type PaymentRow = Pick<
    Tables<"payments">,
    | "id"
    | "profile_id"
    | "status"
    | "payment_type"
    | "stripe_checkout_session_id"
    | "deadline_at"
    | "metadata"
    | "paid_at"
>;
type EmployerRow = Pick<Tables<"employers">, "id" | "profile_id" | "company_name" | "status" | "created_at">;
type AgencyRow = Pick<Tables<"agencies">, "id" | "profile_id" | "display_name" | "legal_name" | "status" | "created_at">;
type JobRequestRow = Pick<
    Tables<"job_requests">,
    "id" | "title" | "status" | "created_at" | "employer_id" | "positions_count" | "positions_filled"
>;
type OfferRow = Pick<Tables<"offers">, "id" | "job_request_id" | "worker_id" | "status">;
type EmailQueueRow = Pick<
    Tables<"email_queue">,
    "id" | "user_id" | "recipient_email" | "status" | "error_message" | "created_at" | "email_type"
>;
type ActivityRow = Pick<Tables<"user_activity">, "user_id" | "action" | "created_at" | "details">;

const POST_ENTRY_WORKER_STATUSES = new Set([
    "IN_QUEUE",
    "OFFER_PENDING",
    "OFFER_ACCEPTED",
    "VISA_PROCESS_STARTED",
    "VISA_APPROVED",
    "PLACED",
]);

const ACTIVE_JOB_REQUEST_STATUSES = new Set(["open", "matching"]);
const CHECKOUT_RECOVERY_STEPS = [
    { step: 1, afterHours: 1 },
    { step: 2, afterHours: 24 },
    { step: 3, afterHours: 72 },
] as const;

interface ExceptionWorkerBase {
    profileId: string;
    fullName: string;
    email: string;
    workerStatus: string;
    workspaceHref: string;
    caseHref: string;
}

export interface InvalidEmailException extends ExceptionWorkerBase {
    role: "worker" | "employer" | "agency";
    reason: string;
    bounceCount: number;
    lastBounceAt: string | null;
    emailHealthHref: string;
}

export interface CheckoutException extends ExceptionWorkerBase {
    paymentId: string;
    checkoutStartedAt: string;
    hoursSinceCheckout: number;
    nextStepLabel: string;
    deadlineAt: string | null;
}

export interface ManualReviewException extends ExceptionWorkerBase {
    manualReviewCount: number;
    latestReviewAt: string | null;
    reviewHref: string;
    documentsHref: string;
}

export interface WorkerReadinessException extends ExceptionWorkerBase {
    completion: number;
    verifiedDocs: number;
    queueHref: string;
}

export interface PendingApprovalException extends ExceptionWorkerBase {
    completion: number;
    verifiedDocs: number;
    waitingHours: number;
    latestReadyAt: string | null;
    reviewHref: string;
}

export interface QueueDriftException extends ExceptionWorkerBase {
    paidAt: string | null;
    queueHref: string;
}

export interface JobRequestException {
    id: string;
    title: string;
    status: string;
    openPositions: number;
    createdAt: string | null;
    offersCount: number;
    companyName: string;
    employerProfileId: string | null;
    employerWorkspaceHref: string | null;
    jobsHref: string;
}

export interface AdminExceptionSnapshot {
    generatedAt: string;
    totalSignals: number;
    invalidEmailProfiles: InvalidEmailException[];
    openedCheckoutButUnpaid: CheckoutException[];
    stalePendingPayments: CheckoutException[];
    manualReviewProfiles: ManualReviewException[];
    pendingAdminApproval: PendingApprovalException[];
    verifiedButUnpaid: WorkerReadinessException[];
    paidButNotInQueue: QueueDriftException[];
    openJobRequestsWithoutOffers: JobRequestException[];
}

function asObject(value: Json | null | undefined): Record<string, Json> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, Json>;
}

function extractStringField(value: Json | null | undefined, key: string): string | null {
    const objectValue = asObject(value);
    if (!objectValue) {
        return null;
    }

    const field = objectValue[key];
    return typeof field === "string" && field.trim() ? field.trim() : null;
}

function parseIsoDate(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveWorkerStatus(worker: WorkerRow | null) {
    return worker?.status || "NEW";
}

function getWorkerWorkspaceHref(profileId: string) {
    return `/profile/worker?inspect=${profileId}`;
}

function getWorkerCaseHref(profileId: string) {
    return `/admin/workers/${profileId}`;
}

function getCheckoutCreatedAt(payment: PaymentRow, activities: ActivityRow[]) {
    const metadataStartedAt = parseIsoDate(extractStringField(payment.metadata, "checkout_started_at"));
    if (metadataStartedAt) {
        return metadataStartedAt;
    }

    const activityByPayment = activities.find((activity) =>
        activity.action === "checkout_session_created"
        && extractStringField(activity.details, "payment_id") === payment.id
    );
    if (activityByPayment?.created_at) {
        return parseIsoDate(activityByPayment.created_at);
    }

    if (payment.stripe_checkout_session_id) {
        const activityBySession = activities.find((activity) =>
            activity.action === "checkout_session_created"
            && extractStringField(activity.details, "stripe_session_id") === payment.stripe_checkout_session_id
        );
        if (activityBySession?.created_at) {
            return parseIsoDate(activityBySession.created_at);
        }
    }

    const deadlineAt = parseIsoDate(payment.deadline_at);
    if (deadlineAt) {
        return new Date(deadlineAt.getTime() - CHECKOUT_RECOVERY_STEPS[2].afterHours * 60 * 60 * 1000);
    }

    return null;
}

function getNextRecoveryStepLabel(hoursSinceCheckout: number) {
    if (hoursSinceCheckout < CHECKOUT_RECOVERY_STEPS[0].afterHours) {
        return "First follow-up pending";
    }

    if (hoursSinceCheckout < CHECKOUT_RECOVERY_STEPS[1].afterHours) {
        return "1h recovery window";
    }

    if (hoursSinceCheckout < CHECKOUT_RECOVERY_STEPS[2].afterHours) {
        return "24h recovery window";
    }

    return "72h abandonment window";
}

function getRoleFromProfile(
    profile: ProfileRow,
    employerProfileIds: Set<string>,
    agencyProfileIds: Set<string>
): "worker" | "employer" | "agency" {
    const normalized = normalizeUserType(profile.user_type);
    if (normalized === "employer" || employerProfileIds.has(profile.id)) {
        return "employer";
    }
    if (normalized === "agency" || agencyProfileIds.has(profile.id)) {
        return "agency";
    }
    return "worker";
}

function buildWorkerBase(profile: ProfileRow, worker: WorkerRow | null): ExceptionWorkerBase {
    return {
        profileId: profile.id,
        fullName: profile.full_name || profile.email.split("@")[0] || "Worker",
        email: profile.email,
        workerStatus: resolveWorkerStatus(worker),
        workspaceHref: getWorkerWorkspaceHref(profile.id),
        caseHref: getWorkerCaseHref(profile.id),
    };
}

export async function getAdminExceptionSnapshot() {
    const admin = createTypedAdminClient();
    const ninetyDaysAgoIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [
        { data: profiles, error: profilesError },
        { data: workerRows, error: workerRowsError },
        { data: documents, error: documentsError },
        { data: payments, error: paymentsError },
        { data: employers, error: employersError },
        { data: agencies, error: agenciesError },
        { data: jobRequests, error: jobRequestsError },
        { data: offers, error: offersError },
        { data: failedEmails, error: failedEmailsError },
        { data: paymentActivities, error: paymentActivitiesError },
    ] = await Promise.all([
        admin.from("profiles").select("id, email, full_name, user_type, created_at"),
        admin
            .from("worker_onboarding")
            .select("*")
            .not("profile_id", "is", null)
            .order("updated_at", { ascending: false }),
        admin.from("worker_documents").select("user_id, document_type, status, updated_at, created_at"),
        admin.from("payments").select("id, profile_id, status, payment_type, stripe_checkout_session_id, deadline_at, metadata, paid_at"),
        admin.from("employers").select("id, profile_id, company_name, status, created_at"),
        admin.from("agencies").select("id, profile_id, display_name, legal_name, status, created_at"),
        admin.from("job_requests").select("id, title, status, created_at, employer_id, positions_count, positions_filled"),
        admin.from("offers").select("id, job_request_id, worker_id, status"),
        admin
            .from("email_queue")
            .select("id, user_id, recipient_email, status, error_message, created_at, email_type")
            .gte("created_at", ninetyDaysAgoIso)
            .range(0, 1999),
        admin
            .from("user_activity")
            .select("user_id, action, created_at, details")
            .in("action", ["checkout_session_created", "payment_completed"])
            .range(0, 3999),
    ]);

    if (profilesError) throw profilesError;
    if (workerRowsError) throw workerRowsError;
    if (documentsError) throw documentsError;
    if (paymentsError) throw paymentsError;
    if (employersError) throw employersError;
    if (agenciesError) throw agenciesError;
    if (jobRequestsError) throw jobRequestsError;
    if (offersError) throw offersError;
    if (failedEmailsError) throw failedEmailsError;
    if (paymentActivitiesError) throw paymentActivitiesError;

    const typedProfiles = (profiles || []) as ProfileRow[];
    const typedWorkers = (workerRows || []) as WorkerRow[];
    const typedDocuments = (documents || []) as DocumentRow[];
    const typedPayments = (payments || []) as PaymentRow[];
    const typedEmployers = (employers || []) as EmployerRow[];
    const typedAgencies = (agencies || []) as AgencyRow[];
    const typedJobRequests = (jobRequests || []) as JobRequestRow[];
    const typedOffers = (offers || []) as OfferRow[];
    const typedFailedEmails = ((failedEmails || []) as EmailQueueRow[]).filter(
        (entry) => entry.status === "failed" || !!entry.error_message
    );
    const typedActivities = (paymentActivities || []) as ActivityRow[];

    const profileMap = new Map(typedProfiles.map((profile) => [profile.id, profile]));
    const employerById = new Map(typedEmployers.map((employer) => [employer.id, employer]));
    const employerProfileIds = new Set(typedEmployers.map((employer) => employer.profile_id).filter(Boolean) as string[]);
    const agencyProfileIds = new Set(typedAgencies.map((agency) => agency.profile_id));

    const workersByProfile = new Map<string, WorkerRow[]>();
    for (const worker of typedWorkers) {
        if (!worker.profile_id) continue;
        const current = workersByProfile.get(worker.profile_id) || [];
        current.push(worker);
        workersByProfile.set(worker.profile_id, current);
    }

    const workerMap = new Map<string, WorkerRow>();
    for (const [profileId, rows] of workersByProfile.entries()) {
        const worker = pickCanonicalWorkerRecord(rows);
        if (worker) {
            workerMap.set(profileId, worker);
        }
    }

    const docsByUser = new Map<string, DocumentRow[]>();
    for (const document of typedDocuments) {
        if (!document.user_id) continue;
        const current = docsByUser.get(document.user_id) || [];
        current.push(document);
        docsByUser.set(document.user_id, current);
    }

    const failedEmailsByProfile = new Map<string, EmailQueueRow[]>();
    const failedEmailsByRecipient = new Map<string, EmailQueueRow[]>();
    for (const failure of typedFailedEmails) {
        if (failure.user_id) {
            const current = failedEmailsByProfile.get(failure.user_id) || [];
            current.push(failure);
            failedEmailsByProfile.set(failure.user_id, current);
        }

        const normalizedRecipient = failure.recipient_email.trim().toLowerCase();
        const currentByRecipient = failedEmailsByRecipient.get(normalizedRecipient) || [];
        currentByRecipient.push(failure);
        failedEmailsByRecipient.set(normalizedRecipient, currentByRecipient);
    }

    const paymentActivitiesByProfile = new Map<string, ActivityRow[]>();
    for (const activity of typedActivities) {
        if (!activity.user_id) continue;
        const current = paymentActivitiesByProfile.get(activity.user_id) || [];
        current.push(activity);
        paymentActivitiesByProfile.set(activity.user_id, current);
    }

    const completedEntryFeeProfiles = new Set(
        typedPayments
            .filter((payment) => payment.payment_type === "entry_fee" && ["paid", "completed"].includes(payment.status || ""))
            .map((payment) => payment.profile_id)
            .filter(Boolean) as string[]
    );

    const invalidEmailProfiles: InvalidEmailException[] = typedProfiles
        .filter((profile) =>
            normalizeUserType(profile.user_type) !== "admin"
            && !isInternalOrTestEmail(profile.email)
        )
        .map((profile) => {
            const normalizedEmail = profile.email.trim().toLowerCase();
            const bounceFailures = [
                ...(failedEmailsByProfile.get(profile.id) || []),
                ...(failedEmailsByRecipient.get(normalizedEmail) || []),
            ].filter((failure, index, failures) => failures.findIndex((entry) => entry.id === failure.id) === index);
            const undeliverableFailures = bounceFailures.filter((failure) => isLikelyUndeliverableEmailError(failure.error_message));
            const reasons: string[] = [];

            if (hasKnownTypoEmailDomain(profile.email)) reasons.push("Known typo domain");
            if (hasKnownInvalidOnlyEmailDomain(profile.email)) reasons.push("Known invalid domain");
            if (undeliverableFailures.length > 0) reasons.push("Recent undeliverable send");

            if (reasons.length === 0) {
                return null;
            }

            const latestBounce = undeliverableFailures
                .slice()
                .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())[0];
            const worker = workerMap.get(profile.id) || null;

            return {
                ...buildWorkerBase(profile, worker),
                role: getRoleFromProfile(profile, employerProfileIds, agencyProfileIds),
                reason: reasons.join(" • "),
                bounceCount: undeliverableFailures.length,
                lastBounceAt: latestBounce?.created_at || null,
                emailHealthHref: "/internal/email-health",
            } satisfies InvalidEmailException;
        })
        .filter(Boolean)
        .sort((left, right) => {
            const bounceDiff = (right?.bounceCount || 0) - (left?.bounceCount || 0);
            if (bounceDiff !== 0) return bounceDiff;
            return new Date(right?.lastBounceAt || 0).getTime() - new Date(left?.lastBounceAt || 0).getTime();
        }) as InvalidEmailException[];

    const latestPendingByProfile = new Map<string, { payment: PaymentRow; checkoutCreatedAt: Date }>();
    for (const payment of typedPayments.filter((entry) => entry.payment_type === "entry_fee" && entry.status === "pending" && entry.profile_id)) {
        const checkoutCreatedAt = getCheckoutCreatedAt(payment, paymentActivitiesByProfile.get(payment.profile_id as string) || []);
        if (!checkoutCreatedAt) {
            continue;
        }

        const current = latestPendingByProfile.get(payment.profile_id as string);
        if (!current || checkoutCreatedAt > current.checkoutCreatedAt) {
            latestPendingByProfile.set(payment.profile_id as string, { payment, checkoutCreatedAt });
        }
    }

    const openedCheckoutButUnpaid: CheckoutException[] = [];
    const stalePendingPayments: CheckoutException[] = [];

    for (const [profileId, pendingEntry] of latestPendingByProfile.entries()) {
        const profile = profileMap.get(profileId);
        if (!profile || !isReportablePaymentProfile(profile)) {
            continue;
        }

        const worker = workerMap.get(profileId) || null;
        const workerActivated = !!worker?.entry_fee_paid || !!worker?.job_search_active || !!worker?.queue_joined_at;
        const checkoutException = {
            ...buildWorkerBase(profile, worker),
            paymentId: pendingEntry.payment.id,
            checkoutStartedAt: pendingEntry.checkoutCreatedAt.toISOString(),
            hoursSinceCheckout: Math.max(1, Math.floor((Date.now() - pendingEntry.checkoutCreatedAt.getTime()) / (1000 * 60 * 60))),
            nextStepLabel: getNextRecoveryStepLabel((Date.now() - pendingEntry.checkoutCreatedAt.getTime()) / (1000 * 60 * 60)),
            deadlineAt: pendingEntry.payment.deadline_at,
        } satisfies CheckoutException;

        if (completedEntryFeeProfiles.has(profileId) || workerActivated) {
            stalePendingPayments.push(checkoutException);
            continue;
        }

        openedCheckoutButUnpaid.push(checkoutException);
    }

    openedCheckoutButUnpaid.sort((left, right) => right.hoursSinceCheckout - left.hoursSinceCheckout);
    stalePendingPayments.sort((left, right) => right.hoursSinceCheckout - left.hoursSinceCheckout);

    const manualReviewProfiles: ManualReviewException[] = Array.from(docsByUser.entries())
        .map(([profileId, documentsForUser]) => {
            const manualDocs = documentsForUser.filter((document) => document.status === "manual_review");
            if (manualDocs.length === 0) {
                return null;
            }

            const profile = profileMap.get(profileId);
            if (!profile) {
                return null;
            }

            const worker = workerMap.get(profileId) || null;
            const latestReviewAt = manualDocs
                .map((document) => document.updated_at || document.created_at)
                .filter(Boolean)
                .sort()
                .at(-1) || null;

            return {
                ...buildWorkerBase(profile, worker),
                manualReviewCount: manualDocs.length,
                latestReviewAt,
                reviewHref: "/admin/review",
                documentsHref: `/profile/worker/documents?inspect=${profileId}`,
            } satisfies ManualReviewException;
        })
        .filter(Boolean)
        .sort((left, right) => right!.manualReviewCount - left!.manualReviewCount) as ManualReviewException[];

    const pendingAdminApproval: PendingApprovalException[] = [];
    const verifiedButUnpaid: WorkerReadinessException[] = [];
    const paidButNotInQueue: QueueDriftException[] = [];

    for (const profile of typedProfiles) {
        if (normalizeUserType(profile.user_type) !== "worker") {
            continue;
        }

        const worker = workerMap.get(profile.id) || null;
        if (!worker) {
            continue;
        }

        const workerDocuments = docsByUser.get(profile.id) || [];
        const documentProgress = getWorkerDocumentProgress(workerDocuments);
        const completionResult = getWorkerCompletion({
            profile,
            worker,
            documents: workerDocuments
                .filter((document) => Boolean(document.document_type))
                .map((document) => ({
                    document_type: document.document_type as string,
                })),
        });

        const hasCompletedEntryFee = completedEntryFeeProfiles.has(profile.id)
            || !!worker.entry_fee_paid
            || !!worker.job_search_active
            || !!worker.queue_joined_at;

        if (completionResult.completion === 100 && documentProgress.verifiedCount >= documentProgress.requiredCount && !worker.admin_approved) {
            const latestReadyAt = [
                worker.updated_at,
                ...workerDocuments.map((document) => document.updated_at || document.created_at).filter(Boolean),
            ]
                .filter(Boolean)
                .sort()
                .at(-1) || null;
            const waitingHours = latestReadyAt
                ? Math.max(1, Math.floor((Date.now() - new Date(latestReadyAt).getTime()) / (1000 * 60 * 60)))
                : 0;

            pendingAdminApproval.push({
                ...buildWorkerBase(profile, worker),
                completion: completionResult.completion,
                verifiedDocs: documentProgress.verifiedCount,
                waitingHours,
                latestReadyAt,
                reviewHref: getWorkerCaseHref(profile.id),
            });
        }

        if (completionResult.completion === 100 && documentProgress.verifiedCount >= documentProgress.requiredCount && !!worker.admin_approved && !hasCompletedEntryFee) {
            verifiedButUnpaid.push({
                ...buildWorkerBase(profile, worker),
                completion: completionResult.completion,
                verifiedDocs: documentProgress.verifiedCount,
                queueHref: `/profile/worker/queue?inspect=${profile.id}`,
            });
        }

        if (hasCompletedEntryFee && !POST_ENTRY_WORKER_STATUSES.has(worker.status || "")) {
            const latestPaidAt = typedPayments
                .filter((payment) =>
                    payment.profile_id === profile.id
                    && payment.payment_type === "entry_fee"
                    && ["paid", "completed"].includes(payment.status || "")
                )
                .map((payment) => payment.paid_at)
                .filter(Boolean)
                .sort()
                .at(-1) || null;

            paidButNotInQueue.push({
                ...buildWorkerBase(profile, worker),
                paidAt: latestPaidAt,
                queueHref: `/profile/worker/queue?inspect=${profile.id}`,
            });
        }
    }

    const offersByJobRequest = new Map<string, number>();
    for (const offer of typedOffers) {
        if (!offer.job_request_id) continue;
        offersByJobRequest.set(offer.job_request_id, (offersByJobRequest.get(offer.job_request_id) || 0) + 1);
    }

    const openJobRequestsWithoutOffers: JobRequestException[] = typedJobRequests
        .filter((jobRequest) => ACTIVE_JOB_REQUEST_STATUSES.has(jobRequest.status || ""))
        .map((jobRequest) => {
            const openPositions = Math.max(0, (jobRequest.positions_count || 0) - (jobRequest.positions_filled || 0));
            const offersCount = offersByJobRequest.get(jobRequest.id) || 0;
            if (openPositions <= 0 || offersCount > 0) {
                return null;
            }

            const employer = jobRequest.employer_id ? employerById.get(jobRequest.employer_id) || null : null;
            const employerProfileId = employer?.profile_id || null;

            return {
                id: jobRequest.id,
                title: jobRequest.title,
                status: jobRequest.status || "open",
                openPositions,
                createdAt: jobRequest.created_at,
                offersCount,
                companyName: employer?.company_name || "Unknown employer",
                employerProfileId,
                employerWorkspaceHref: employerProfileId ? `/profile/employer?inspect=${employerProfileId}&tab=jobs` : null,
                jobsHref: "/admin/jobs",
            } satisfies JobRequestException;
        })
        .filter(Boolean)
        .sort((left, right) => (right!.openPositions || 0) - (left!.openPositions || 0)) as JobRequestException[];

    const totalSignals =
        invalidEmailProfiles.length
        + openedCheckoutButUnpaid.length
        + stalePendingPayments.length
        + manualReviewProfiles.length
        + pendingAdminApproval.length
        + verifiedButUnpaid.length
        + paidButNotInQueue.length
        + openJobRequestsWithoutOffers.length;

    return {
        generatedAt: new Date().toISOString(),
        totalSignals,
        invalidEmailProfiles,
        openedCheckoutButUnpaid,
        stalePendingPayments,
        manualReviewProfiles,
        pendingAdminApproval,
        verifiedButUnpaid,
        paidButNotInQueue,
        openJobRequestsWithoutOffers,
    } satisfies AdminExceptionSnapshot;
}
