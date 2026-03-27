import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildAdminTestUser, getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { getAdminTestWorkerWorkspace } from "@/lib/admin-test-data";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import { loadCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

interface WorkerDashboardPageRecord extends WorkerRecordSnapshot {
    id: string;
    profiles?: { full_name?: string | null } | null;
    full_name?: string | null;
    gender?: string | null;
    marital_status?: string | null;
    date_of_birth?: string | null;
    birth_city?: string | null;
    birth_country?: string | null;
    citizenship?: string | null;
    phone?: string | null;
    passport_issued_by?: string | null;
    passport_issue_date?: string | null;
    passport_expiry_date?: string | null;
    reject_reason?: string | null;
}

export default async function WorkerProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ inspect?: string }>;
}) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const params = await searchParams;
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
    const user = session.user;

    if (!user) {
        redirect("/login");
    }

    if (session.activePersona) {
        if (session.activePersona.role !== "worker") {
            redirect(getAdminTestWorkspaceHref(session.activePersona.role));
        }

        const workspace = await getAdminTestWorkerWorkspace(admin, session.activePersona.id);
        const sandboxWorker = workspace.worker;
        const sandboxDocuments = workspace.documents.map((document) => ({
            document_type: document.document_type,
            status: document.status,
            reject_reason: document.reject_reason,
        }));
        const sandboxProfile = {
            id: session.activePersona.id,
            email: sandboxWorker?.email || session.ownerProfile?.email || user.email || "",
            full_name: sandboxWorker?.full_name || session.activePersona.label,
            user_type: "worker",
        };
        const { completion: profileCompletion, missingFields: sandboxMissingFields } = getWorkerCompletion({
            profile: sandboxProfile,
            worker: sandboxWorker,
            documents: sandboxDocuments,
        });
        const hasPaidEntryFee =
            !!sandboxWorker?.entry_fee_paid ||
            !!sandboxWorker?.job_search_active ||
            isPostEntryFeeWorkerStatus(sandboxWorker?.status);

        return (
            <DashboardClient
                user={buildAdminTestUser(user, {
                    persona: session.activePersona,
                    displayName: sandboxProfile.full_name,
                    email: sandboxProfile.email,
                })}
                profile={sandboxProfile}
                worker={sandboxWorker}
                documents={sandboxDocuments}
                pendingOffers={[]}
                profileCompletion={profileCompletion}
                missingFields={sandboxMissingFields}
                inQueue={sandboxWorker?.status === "IN_QUEUE"}
                hasPaidEntryFee={hasPaidEntryFee}
                readOnlyPreview={false}
            />
        );
    }

    // Redirect employers to employer profile (admin can access for testing)
    const userType = normalizeUserType(session.liveUserType || user.user_metadata?.user_type);
    if (userType === 'employer') {
        redirect("/profile/employer");
    }
    if (userType === 'agency') {
        redirect("/profile/agency");
    }
    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    if (isAdminPreview && !inspectProfileId) {
        redirect("/admin");
    }
    const targetProfileId = inspectProfileId || user.id;
    const dataClient = inspectProfileId ? admin : supabase;

    // Fetch profile
    const { data: profile } = await dataClient
        .from("profiles")
        .select("*")
        .eq("id", targetProfileId)
        .maybeSingle();

    // Fetch canonical worker record
    const { data: workerRecord } = await loadCanonicalWorkerRecord<WorkerDashboardPageRecord>(
        dataClient,
        targetProfileId,
        "*"
    );

    if (inspectProfileId && !profile) {
        redirect("/admin/workers");
    }

    // Payment fallback guard: if the worker flag is stale, hide pay CTA when payment is already completed.
    const { data: completedEntryPayment } = await dataClient
        .from("payments")
        .select("id")
        .eq("payment_type", "entry_fee")
        .in("status", ["completed", "paid"])
        .or(`user_id.eq.${targetProfileId},profile_id.eq.${targetProfileId}`)
        .limit(1)
        .maybeSingle();

    // Fetch documents
    const { data: documents } = await dataClient
        .from("worker_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", targetProfileId);

    // Fetch pending offers
    const { data: pendingOffers } = workerRecord?.id
        ? await dataClient
            .from("offers")
            .select("*, job_request:job_requests(title, destination_country, employer:employers(company_name))")
            .eq("worker_id", workerRecord.id)
            .eq("status", "pending")
        : { data: [] as Array<Record<string, unknown>> };

    // Calculate verified count from actual documents
    const hasPaidEntryFee =
        !!workerRecord?.entry_fee_paid ||
        !!completedEntryPayment?.id ||
        isPostEntryFeeWorkerStatus(workerRecord?.status);
    const inQueue = workerRecord?.status === "IN_QUEUE";

    // Calculate profile completion using shared function
    const fullNameFallback = profile?.full_name || user.user_metadata?.full_name || null;
    const { completion: profileCompletion, missingFields } = getWorkerCompletion({
        profile, worker: workerRecord, documents: documents || []
    }, {
        fullNameFallback,
    });
    const previewUser = inspectProfileId
        ? {
            ...user,
            email: profile?.email || user.email,
            user_metadata: {
                ...user.user_metadata,
                full_name: profile?.full_name || user.user_metadata?.full_name,
            },
        }
        : user;

    return (
        <DashboardClient
            user={previewUser}
            profile={profile}
            worker={workerRecord}
            documents={documents || []}
            pendingOffers={pendingOffers || []}
            profileCompletion={profileCompletion}
            missingFields={missingFields}
            inQueue={inQueue}
            hasPaidEntryFee={hasPaidEntryFee}
            readOnlyPreview={isAdminPreview}
        />
    );
}
