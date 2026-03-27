import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import { createClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { normalizeUserType } from "@/lib/domain";
import {
    getSuggestedEmailCorrection,
    hasKnownInvalidOnlyEmailDomain,
    hasKnownTypoEmailDomain,
    isLikelyUndeliverableEmailError,
} from "@/lib/reporting";
import { pickCanonicalWorkerRecord } from "@/lib/workers";
import EmailHealthClient, { type BounceIssue, type FlaggedEmailProfile } from "./EmailHealthClient";

type ProfileRow = {
    id: string;
    email: string;
    full_name: string | null;
    user_type: string | null;
    created_at: string | null;
};

type WorkerRow = {
    profile_id: string | null;
    status: string | null;
    entry_fee_paid: boolean | null;
    queue_joined_at: string | null;
    updated_at: string | null;
};

type EmployerRow = {
    profile_id: string;
    status: string | null;
};

type AgencyRow = {
    profile_id: string;
    status: string;
};

type PaymentRow = {
    profile_id: string | null;
    status: string | null;
    payment_type: string;
};

type DocumentRow = {
    user_id: string;
    status: string | null;
};

type ConversationRow = {
    worker_profile_id: string | null;
    employer_profile_id: string | null;
    agency_profile_id: string | null;
};

type EmailQueueRow = {
    id: string;
    user_id: string | null;
    recipient_email: string;
    status: string;
    error_message: string | null;
    email_type: string;
    subject: string;
    created_at: string | null;
};

function formatDate(value?: string | null) {
    if (!value) {
        return "—";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "—";
    }

    return parsed.toLocaleString("en-GB");
}

function getWorkspaceHref(profileId: string, role: string) {
    if (role === "employer") {
        return `/profile/employer?inspect=${profileId}`;
    }

    if (role === "agency") {
        return `/profile/agency?inspect=${profileId}`;
    }

    return `/profile/worker?inspect=${profileId}`;
}

export default async function EmailHealthPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (normalizeUserType(profile?.user_type) !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const admin = createTypedAdminClient();
    const now = new Date();
    const ninetyDaysAgoIso = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [
        { data: profiles },
        { data: workersRaw },
        { data: employers },
        { data: agencies },
        { data: payments },
        { data: documents },
        { data: conversations },
        { data: failedEmails },
    ] = await Promise.all([
        admin.from("profiles").select("id, email, full_name, user_type, created_at"),
        admin
            .from("worker_onboarding")
            .select("profile_id, status, entry_fee_paid, queue_joined_at, updated_at")
            .not("profile_id", "is", null)
            .order("updated_at", { ascending: false }),
        admin.from("employers").select("profile_id, status"),
        admin.from("agencies").select("profile_id, status"),
        admin.from("payments").select("profile_id, status, payment_type").not("profile_id", "is", null),
        admin.from("worker_documents").select("user_id, status"),
        admin.from("conversations").select("worker_profile_id, employer_profile_id, agency_profile_id"),
        admin
            .from("email_queue")
            .select("id, user_id, recipient_email, status, error_message, email_type, subject, created_at")
            .gte("created_at", ninetyDaysAgoIso)
            .range(0, 1999),
    ]);

    const typedProfiles = (profiles || []) as ProfileRow[];
    const typedEmployers = (employers || []) as EmployerRow[];
    const typedAgencies = (agencies || []) as AgencyRow[];
    const typedPayments = (payments || []) as PaymentRow[];
    const typedDocuments = (documents || []) as DocumentRow[];
    const typedConversations = (conversations || []) as ConversationRow[];
    const typedFailedEmails = ((failedEmails || []) as EmailQueueRow[]).filter(
        (email) => email.status === "failed" || !!email.error_message
    );

    const workerGroups = new Map<string, WorkerRow[]>();
    for (const worker of (workersRaw || []) as WorkerRow[]) {
        if (!worker.profile_id) continue;
        const current = workerGroups.get(worker.profile_id) || [];
        current.push(worker);
        workerGroups.set(worker.profile_id, current);
    }

    const workerMap = new Map<string, WorkerRow>();
    for (const [profileId, rows] of workerGroups.entries()) {
        const worker = pickCanonicalWorkerRecord(rows);
        if (worker) {
            workerMap.set(profileId, worker);
        }
    }

    const employerProfileIds = new Set(typedEmployers.map((entry) => entry.profile_id));
    const agencyProfileIds = new Set(typedAgencies.map((entry) => entry.profile_id));
    const paymentProfileIds = new Set(typedPayments.map((entry) => entry.profile_id).filter(Boolean) as string[]);
    const documentProfileIds = new Set(typedDocuments.map((entry) => entry.user_id));

    const conversationProfileIds = new Set<string>();
    for (const conversation of typedConversations) {
        if (conversation.worker_profile_id) conversationProfileIds.add(conversation.worker_profile_id);
        if (conversation.employer_profile_id) conversationProfileIds.add(conversation.employer_profile_id);
        if (conversation.agency_profile_id) conversationProfileIds.add(conversation.agency_profile_id);
    }

    const emailsByProfile = new Map<string, EmailQueueRow[]>();
    const emailsByRecipient = new Map<string, EmailQueueRow[]>();
    for (const email of typedFailedEmails) {
        if (email.user_id) {
            const current = emailsByProfile.get(email.user_id) || [];
            current.push(email);
            emailsByProfile.set(email.user_id, current);
        }

        const normalizedRecipient = email.recipient_email.trim().toLowerCase();
        const currentByRecipient = emailsByRecipient.get(normalizedRecipient) || [];
        currentByRecipient.push(email);
        emailsByRecipient.set(normalizedRecipient, currentByRecipient);
    }

    const flaggedProfiles: FlaggedEmailProfile[] = typedProfiles
        .map((entry) => {
            const normalizedEmail = entry.email.trim().toLowerCase();
            const typoDomain = hasKnownTypoEmailDomain(normalizedEmail);
            const invalidOnlyDomain = hasKnownInvalidOnlyEmailDomain(normalizedEmail);
            const deliveryFailures = [
                ...(emailsByProfile.get(entry.id) || []),
                ...(emailsByRecipient.get(normalizedEmail) || []),
            ].filter((failure, index, failures) => failures.findIndex((emailEntry) => emailEntry.id === failure.id) === index);
            const undeliverableFailures = deliveryFailures.filter((failure) => isLikelyUndeliverableEmailError(failure.error_message));

            if (!typoDomain && !invalidOnlyDomain && undeliverableFailures.length === 0) {
                return null;
            }

            const worker = workerMap.get(entry.id);
            const hasBusinessActivity = paymentProfileIds.has(entry.id)
                || documentProfileIds.has(entry.id)
                || conversationProfileIds.has(entry.id)
                || employerProfileIds.has(entry.id)
                || agencyProfileIds.has(entry.id)
                || !!worker?.entry_fee_paid
                || !!worker?.queue_joined_at
                || ["IN_QUEUE", "OFFER_PENDING", "OFFER_ACCEPTED", "VISA_PROCESS_STARTED", "VISA_APPROVED", "PLACED"].includes(worker?.status || "");

            const latestFailure = undeliverableFailures
                .slice()
                .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())[0];

            const reasons = [];
            if (typoDomain) reasons.push("Known typo domain");
            if (invalidOnlyDomain) reasons.push("Known invalid internal domain");
            if (undeliverableFailures.length > 0) reasons.push("Recent undeliverable deliveries");

            const role = normalizeUserType(entry.user_type) || (employerProfileIds.has(entry.id)
                ? "employer"
                : agencyProfileIds.has(entry.id)
                    ? "agency"
                    : "worker");

            return {
                id: entry.id,
                fullName: entry.full_name || "Unknown",
                email: entry.email,
                role,
                createdAt: formatDate(entry.created_at),
                reason: reasons.join(" • "),
                suggestedEmail: getSuggestedEmailCorrection(entry.email),
                bounceCount: undeliverableFailures.length,
                lastBounceAt: formatDate(latestFailure?.created_at),
                lastError: latestFailure?.error_message || null,
                safeToDelete: role !== "admin" && !hasBusinessActivity,
                activitySummary: hasBusinessActivity
                    ? "Has payments, documents, inbox, employer/agency data, or advanced worker status"
                    : "No payments, documents, inbox, or advanced activity detected",
                workspaceHref: getWorkspaceHref(entry.id, role),
            } satisfies FlaggedEmailProfile;
        })
        .filter(Boolean)
        .sort((left, right) => {
            if ((left?.safeToDelete ? 1 : 0) !== (right?.safeToDelete ? 1 : 0)) {
                return (left?.safeToDelete ? -1 : 1);
            }

            return (right?.bounceCount || 0) - (left?.bounceCount || 0);
        }) as FlaggedEmailProfile[];

    const orphanBounceIssues: BounceIssue[] = Array.from(emailsByRecipient.entries())
        .filter(([recipient, failures]) => {
            const hasProfile = typedProfiles.some((profileEntry) => profileEntry.email.trim().toLowerCase() === recipient);
            return !hasProfile && failures.some((failure) => isLikelyUndeliverableEmailError(failure.error_message));
        })
        .map(([recipient, failures]) => {
            const sortedFailures = failures
                .filter((failure) => isLikelyUndeliverableEmailError(failure.error_message))
                .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());

            return {
                recipientEmail: recipient,
                bounceCount: sortedFailures.length,
                lastBounceAt: formatDate(sortedFailures[0]?.created_at),
                lastError: sortedFailures[0]?.error_message || "Undeliverable email",
                emailTypes: [...new Set(sortedFailures.map((failure) => failure.email_type))],
            } satisfies BounceIssue;
        })
        .sort((left, right) => right.bounceCount - left.bounceCount);

    const typoDomainProfiles = flaggedProfiles.filter((entry) => !!entry.suggestedEmail).length;
    const safeDeletes = flaggedProfiles.filter((entry) => entry.safeToDelete).length;
    const bouncedProfiles = flaggedProfiles.filter((entry) => entry.bounceCount > 0).length;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Internal email health"
                    title="Invalid & Bounced Emails"
                    description="Internal hygiene screen for typo domains, known invalid addresses, and recent undeliverable deliveries. Delete obvious garbage safely, and inspect real accounts before touching anything with business activity."
                    metrics={[
                        { label: "Flagged", value: flaggedProfiles.length, meta: "Profiles with obvious email risk" },
                        { label: "Safe Delete", value: safeDeletes, meta: "No real activity detected" },
                        { label: "Bounced", value: bouncedProfiles, meta: "Profiles with undeliverable sends" },
                        { label: "Orphan Bounce", value: orphanBounceIssues.length, meta: "Failed recipients without a profile" },
                        { label: "Typo Domains", value: typoDomainProfiles, meta: "Suggested fix available" },
                    ]}
                />

                <EmailHealthClient flaggedProfiles={flaggedProfiles} orphanBounceIssues={orphanBounceIssues} />
            </div>
        </AppShell>
    );
}
