import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AgencySetupRequired from "@/components/AgencySetupRequired";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyOwnedWorker, getAgencySchemaState, getAgencyWorkerEmail, getAgencyWorkerName, isAgencyWorkerClaimed } from "@/lib/agencies";
import { normalizeUserType } from "@/lib/domain";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import AgencyWorkerClient from "./AgencyWorkerClient";

export const dynamic = "force-dynamic";

interface WorkerPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ inspect?: string }>;
}

export default async function AgencyWorkerPage({ params, searchParams }: WorkerPageProps) {
    const { id } = await params;
    const query = await searchParams;
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType !== "agency" && userType !== "admin") {
        redirect(userType === "employer" ? "/profile/employer" : "/profile/worker");
    }
    const inspectProfileId = userType === "admin" ? query?.inspect?.trim() || null : null;
    const targetAgencyProfileId = inspectProfileId || user.id;
    const agencyDashboardHref = inspectProfileId ? `/profile/agency?inspect=${inspectProfileId}` : "/profile/agency";

    const agencySchemaState = await getAgencySchemaState(admin);
    if (!agencySchemaState.ready) {
        return (
            <AppShell user={user} variant="dashboard">
                <AgencySetupRequired />
            </AppShell>
        );
    }

    const { agency, worker } = await getAgencyOwnedWorker(admin, targetAgencyProfileId, id);
    if (!agency || !worker) {
        redirect(agencyDashboardHref);
    }

    const { data: workerRecord, error: workerError } = await admin
        .from("worker_onboarding")
        .select(`
            id,
            profile_id,
            phone,
            nationality,
            current_country,
            preferred_job,
            desired_countries,
            status,
            updated_at,
            queue_joined_at,
            submitted_full_name,
            submitted_email,
            entry_fee_paid,
            gender,
            marital_status,
            date_of_birth,
            birth_country,
            birth_city,
            citizenship,
            original_citizenship,
            maiden_name,
            father_name,
            mother_name,
            address,
            family_data,
            passport_number,
            passport_issued_by,
            passport_issue_date,
            passport_expiry_date,
            lives_abroad,
            previous_visas
        `)
        .eq("id", id)
        .eq("agency_id", agency.id)
        .single();

    if (workerError || !workerRecord) {
        redirect(agencyDashboardHref);
    }

    const { data: linkedProfile } = workerRecord.profile_id
        ? await admin
            .from("profiles")
            .select("full_name, email")
            .eq("id", workerRecord.profile_id)
            .maybeSingle()
        : { data: null as { full_name: string | null; email: string | null } | null };

    const claimed = isAgencyWorkerClaimed(workerRecord);
    const profileId = workerRecord.profile_id || null;
    const { data: documents } = claimed && profileId
        ? await admin
            .from("worker_documents")
            .select("document_type, status, reject_reason")
            .eq("user_id", profileId)
        : { data: [] as Array<{ document_type: string; status: string | null; reject_reason: string | null }> };

    const { data: payments } = claimed && profileId
        ? await admin
            .from("payments")
            .select("payment_type, status")
            .eq("profile_id", profileId)
        : { data: [] as Array<{ payment_type: string | null; status: string | null }> };

    const completionResult = getWorkerCompletion({
        profile: { full_name: getAgencyWorkerName(workerRecord) },
        worker: workerRecord,
        documents: documents || [],
    }, { phoneOptional: true });

    const verifiedDocuments = (documents || []).filter((doc) => doc.status === "verified").length;
    const hasPaidEntryFee =
        !!workerRecord.entry_fee_paid ||
        isPostEntryFeeWorkerStatus(workerRecord.status) ||
        (payments || []).some((payment) => payment.payment_type === "entry_fee" && ["completed", "paid"].includes(payment.status || ""));
    const hasPendingEntryFee = (payments || []).some((payment) => payment.payment_type === "entry_fee" && payment.status === "pending");

    return (
        <AppShell user={user} variant="dashboard">
            <div className="mb-4">
                <Link href={agencyDashboardHref} className="text-sm font-semibold text-[#57534e] hover:text-[#18181b]">
                    ← Back to agency dashboard
                </Link>
            </div>

            <AgencyWorkerClient
                initialWorker={{
                    id: workerRecord.id,
                    profileId,
                    claimed,
                    fullName: getAgencyWorkerName({
                        submitted_full_name: workerRecord.submitted_full_name,
                        profiles: linkedProfile,
                    }),
                    email: getAgencyWorkerEmail({
                        submitted_email: workerRecord.submitted_email,
                        profiles: linkedProfile,
                    }) || "",
                    phone: workerRecord.phone || "",
                    nationality: workerRecord.nationality || "",
                    currentCountry: workerRecord.current_country || "",
                    preferredJob: workerRecord.preferred_job || "",
                    desiredCountries: workerRecord.desired_countries || [],
                    gender: workerRecord.gender || "",
                    maritalStatus: workerRecord.marital_status || "",
                    dateOfBirth: workerRecord.date_of_birth || "",
                    birthCountry: workerRecord.birth_country || "",
                    birthCity: workerRecord.birth_city || "",
                    citizenship: workerRecord.citizenship || "",
                    originalCitizenship: workerRecord.original_citizenship || "",
                    maidenName: workerRecord.maiden_name || "",
                    fatherName: workerRecord.father_name || "",
                    motherName: workerRecord.mother_name || "",
                    address: workerRecord.address || "",
                    familyData: workerRecord.family_data,
                    passportNumber: workerRecord.passport_number || "",
                    passportIssuedBy: workerRecord.passport_issued_by || "",
                    passportIssueDate: workerRecord.passport_issue_date || "",
                    passportExpiryDate: workerRecord.passport_expiry_date || "",
                    livesAbroad: workerRecord.lives_abroad || "",
                    previousVisas: workerRecord.previous_visas || "",
                    status: workerRecord.status || "NEW",
                    updatedAt: workerRecord.updated_at || null,
                    completion: completionResult.completion,
                    missingFields: completionResult.missingFields,
                    verifiedDocuments,
                    documents: documents || [],
                    claimPath: claimed || !workerRecord.submitted_email
                        ? null
                        : `/signup?type=worker&claim=${workerRecord.id}`,
                    claimLabel: claimed
                        ? "Claimed by worker"
                        : workerRecord.submitted_email
                            ? "Ready to claim"
                            : "Worker email required before claim",
                    paymentLabel: claimed ? hasPaidEntryFee ? "Paid" : hasPendingEntryFee ? "Pending" : "Not paid" : "Awaiting claim",
                }}
                readOnlyPreview={userType === "admin"}
            />
        </AppShell>
    );
}
