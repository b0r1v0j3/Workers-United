import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AgencySetupRequired from "@/components/AgencySetupRequired";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    ensureAgencyRecord,
    getAgencyRecordByProfileId,
    getAgencySchemaState,
    getAgencyWorkerEmail,
    getAgencyWorkerName,
    isAgencyWorkerClaimed,
} from "@/lib/agencies";
import { normalizeUserType } from "@/lib/domain";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import AgencyDashboardClient, { type AgencyDashboardProps } from "./AgencyDashboardClient";

export const dynamic = "force-dynamic";

interface AgencyWorkerQueryRow {
    id: string;
    profile_id: string | null;
    phone: string | null;
    nationality: string | null;
    current_country: string | null;
    preferred_job: string | null;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
    queue_joined_at: string | null;
    entry_fee_paid: boolean | null;
    job_search_active: boolean | null;
    submitted_full_name: string | null;
    submitted_email: string | null;
}

type PaymentQueryRow = {
    profile_id: string | null;
    payment_type: string | null;
    status: string | null;
    paid_at: string | null;
    refund_status: string | null;
    metadata: Record<string, unknown> | null;
};

function getPaymentMetadataString(payment: PaymentQueryRow, key: string) {
    const value = payment.metadata?.[key];
    return typeof value === "string" && value.trim() ? value : null;
}

export default async function AgencyProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ inspect?: string }>;
}) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const params = await searchParams;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType === "employer") {
        redirect("/profile/employer");
    }
    if (userType !== "agency" && userType !== "admin") {
        redirect("/profile/worker");
    }

    const agencySchemaState = await getAgencySchemaState(admin);
    if (!agencySchemaState.ready) {
        return (
            <AppShell user={user} variant="dashboard">
                <AgencySetupRequired />
            </AppShell>
        );
    }

    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    const targetAgencyProfileId = inspectProfileId || user.id;

    const { data: profile } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", targetAgencyProfileId)
        .maybeSingle();

    if (inspectProfileId && !profile) {
        redirect("/admin/agencies");
    }

    const agency = userType === "agency"
        ? (await ensureAgencyRecord(admin, {
            userId: user.id,
            email: user.email,
            fullName: profile?.full_name || user.user_metadata?.full_name,
            agencyName: user.user_metadata?.company_name,
        })).agency
        : await getAgencyRecordByProfileId(admin, targetAgencyProfileId);

    if (userType === "agency" && !agency) {
        redirect("/profile");
    }
    if (inspectProfileId && !agency) {
        redirect("/admin/agencies");
    }

    const agencyId = agency?.id || null;
    const { data: workersRaw, error: workersError } = agencyId
        ? await admin
            .from("worker_onboarding")
            .select(`
                id,
                profile_id,
                phone,
                nationality,
                current_country,
                preferred_job,
                status,
                created_at,
                updated_at,
                queue_joined_at,
                entry_fee_paid,
                job_search_active,
                submitted_full_name,
                submitted_email
            `)
            .eq("agency_id", agencyId)
            .order("created_at", { ascending: false })
        : { data: [] as AgencyWorkerQueryRow[], error: null };

    if (workersError) {
        console.error("[AgencyDashboard] Worker fetch failed:", workersError);
    }

    const workers: AgencyWorkerQueryRow[] = workersRaw || [];
    const workerIds = workers.map((worker) => worker.id);
    const claimedProfileIds = workers
        .map((worker) => worker.profile_id)
        .filter((profileId): profileId is string => Boolean(profileId));

    const { data: linkedProfiles } = claimedProfileIds.length > 0
        ? await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", claimedProfileIds)
        : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };

    const { data: documents } = claimedProfileIds.length > 0
        ? await admin
            .from("worker_documents")
            .select("user_id, document_type, status")
            .in("user_id", claimedProfileIds)
        : { data: [] as Array<{ user_id: string; document_type: string; status: string | null }> };

    const { data: profilePayments } = claimedProfileIds.length > 0
        ? await admin
            .from("payments")
            .select("profile_id, payment_type, status, paid_at, refund_status, metadata")
            .eq("payment_type", "entry_fee")
            .in("profile_id", claimedProfileIds)
        : { data: [] as PaymentQueryRow[] };

    const { data: agencyTargetPayments } = workerIds.length > 0
        ? await admin
            .from("payments")
            .select("profile_id, payment_type, status, paid_at, refund_status, metadata")
            .eq("payment_type", "entry_fee")
            .contains("metadata", { paid_by_profile_id: targetAgencyProfileId })
        : { data: [] as PaymentQueryRow[] };

    const docsByUser = new Map<string, Array<{ user_id: string; document_type: string; status: string | null }>>();
    for (const doc of documents || []) {
        const current = docsByUser.get(doc.user_id) || [];
        current.push(doc);
        docsByUser.set(doc.user_id, current);
    }

    const paymentsByProfile = new Map<string, PaymentQueryRow[]>();
    for (const payment of profilePayments || []) {
        if (!payment.profile_id) continue;
        const current = paymentsByProfile.get(payment.profile_id) || [];
        current.push(payment);
        paymentsByProfile.set(payment.profile_id, current);
    }

    const paymentsByWorkerId = new Map<string, PaymentQueryRow[]>();
    for (const payment of agencyTargetPayments || []) {
        const targetWorkerId = getPaymentMetadataString(payment, "target_worker_id");
        if (!targetWorkerId || !workerIds.includes(targetWorkerId)) continue;
        const current = paymentsByWorkerId.get(targetWorkerId) || [];
        current.push(payment);
        paymentsByWorkerId.set(targetWorkerId, current);
    }

    const profilesById = new Map(
        (linkedProfiles || []).map((linkedProfile) => [linkedProfile.id, linkedProfile])
    );

    const workerRows: AgencyDashboardProps["workers"] = workers.map((worker) => {
        const claimed = isAgencyWorkerClaimed(worker);
        const profileId = worker.profile_id || null;
        const linkedProfile = profileId ? profilesById.get(profileId) || null : null;
        const workerDocuments = claimed && profileId ? docsByUser.get(profileId) || [] : [];
        const verifiedDocuments = workerDocuments.filter((doc) => doc.status === "verified").length;
        const workerIdentity = {
            submitted_full_name: worker.submitted_full_name,
            submitted_email: worker.submitted_email,
            profiles: linkedProfile,
        };
        const profileLike = { full_name: getAgencyWorkerName(workerIdentity) };
        const completion = getWorkerCompletion({
            profile: profileLike,
            worker,
            documents: workerDocuments,
        }, { phoneOptional: true }).completion;

        const workerPayments = [
            ...(claimed && profileId ? paymentsByProfile.get(profileId) || [] : []),
            ...(paymentsByWorkerId.get(worker.id) || []),
        ];
        const hasPaidEntryFee =
            !!worker.entry_fee_paid ||
            !!worker.job_search_active ||
            isPostEntryFeeWorkerStatus(worker.status) ||
            workerPayments.some((payment) => payment.payment_type === "entry_fee" && ["completed", "paid"].includes(payment.status || ""));
        const hasPendingEntryFee = workerPayments.some((payment) => payment.payment_type === "entry_fee" && payment.status === "pending");
        const latestCompletedEntryFee = workerPayments.find((payment) =>
            payment.payment_type === "entry_fee" && ["completed", "paid"].includes(payment.status || "")
        );
        const latestRefundSignal = workerPayments.find((payment) =>
            payment.payment_type === "entry_fee" && payment.refund_status
        );
        const paymentState = hasPaidEntryFee
            ? "paid"
            : hasPendingEntryFee
                ? "pending"
                : "not_paid";

        return {
            id: worker.id,
            name: getAgencyWorkerName(workerIdentity),
            email: getAgencyWorkerEmail(workerIdentity),
            phone: worker.phone || null,
            nationality: worker.nationality || null,
            currentCountry: worker.current_country || null,
            preferredJob: worker.preferred_job || null,
            status: worker.status || "NEW",
            completion,
            claimed,
            accessLabel: claimed ? "Worker account ready" : "Managed by agency",
            verifiedDocuments,
            documentsLabel: claimed ? `${verifiedDocuments}/3 verified` : "Not uploaded",
            paymentLabel: paymentState === "paid"
                ? "Paid"
                : paymentState === "pending"
                    ? "Pending"
                    : "Not paid",
            paymentState,
            queueJoinedAt: worker.queue_joined_at || null,
            entryFeePaidAt: latestCompletedEntryFee?.paid_at || null,
            refundStatus: latestRefundSignal?.refund_status || null,
            createdAt: worker.created_at || worker.updated_at || null,
            updatedAt: worker.updated_at || null,
        };
    });

    const stats: AgencyDashboardProps["stats"] = {
        totalWorkers: workerRows.length,
        claimedWorkers: workerRows.filter((worker) => worker.claimed).length,
        readyWorkers: workerRows.filter((worker) => worker.completion === 100 && worker.verifiedDocuments >= 3).length,
        paidWorkers: workerRows.filter((worker) => worker.paymentLabel === "Paid").length,
        draftWorkers: workerRows.filter((worker) => !worker.claimed).length,
    };

    return (
        <AppShell user={user} variant="dashboard">
            <AgencyDashboardClient
                agency={{
                    displayName: agency?.display_name || agency?.legal_name || (isAdminPreview ? "Agency Preview" : "Agency Dashboard"),
                    contactEmail: agency?.contact_email || profile?.email || user.email || "",
                }}
                stats={stats}
                workers={workerRows}
                readOnlyPreview={isAdminPreview}
                inspectProfileId={inspectProfileId}
            />
        </AppShell>
    );
}
