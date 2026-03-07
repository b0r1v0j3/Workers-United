import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function WorkerProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ inspect?: string }>;
}) {
    const supabase = await createClient();
    const params = await searchParams;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Redirect employers to employer profile (admin can access for testing)
    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType === 'employer') {
        redirect("/profile/employer");
    }
    if (userType === 'agency') {
        redirect("/profile/agency");
    }
    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    const targetProfileId = inspectProfileId || user.id;
    const dataClient = inspectProfileId ? createAdminClient() : supabase;

    // Fetch profile
    const { data: profile } = await dataClient
        .from("profiles")
        .select("*")
        .eq("id", targetProfileId)
        .maybeSingle();

    // Fetch candidate data
    const { data: candidate } = await dataClient
        .from("candidates")
        .select("*")
        .eq("profile_id", targetProfileId)
        .maybeSingle();

    if (inspectProfileId && !profile) {
        redirect("/admin/workers");
    }

    // Payment fallback guard: if candidate flag is stale, hide pay CTA when payment is already completed.
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
        .from("candidate_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", targetProfileId);

    // Fetch pending offers
    const { data: pendingOffers } = candidate?.id
        ? await dataClient
            .from("offers")
            .select("*, job_request:job_requests(title, destination_country, employer:employers(company_name))")
            .eq("candidate_id", candidate.id)
            .eq("status", "pending")
        : { data: [] as Array<Record<string, unknown>> };

    // Calculate verified count from actual documents
    const verifiedDocs = documents?.filter(d => d.status === 'verified') || [];
    const verifiedCount = verifiedDocs.length;
    const hasPaidEntryFee =
        !!candidate?.entry_fee_paid ||
        !!completedEntryPayment?.id ||
        isPostEntryFeeWorkerStatus(candidate?.status);
    const inQueue = candidate?.status === "IN_QUEUE";

    // Calculate profile completion using shared function
    const { completion: profileCompletion } = getWorkerCompletion({
        profile, candidate, documents: documents || []
    });
    const isReady = profileCompletion === 100 && verifiedCount >= 3;
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
            candidate={candidate}
            documents={documents || []}
            pendingOffers={pendingOffers || []}
            profileCompletion={profileCompletion}
            isReady={isReady}
            inQueue={inQueue}
            hasPaidEntryFee={hasPaidEntryFee}
            readOnlyPreview={isAdminPreview}
        />
    );
}
