import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function WorkerProfilePage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Redirect employers to employer profile (admin can access for testing)
    const userType = user.user_metadata?.user_type;
    if (userType === 'employer') {
        redirect("/profile/employer");
    }

    // Fetch profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    // Fetch candidate data
    const { data: candidate } = await supabase
        .from("candidates")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

    // Payment fallback guard: if candidate flag is stale, hide pay CTA when payment is already completed.
    const { data: completedEntryPayment } = await supabase
        .from("payments")
        .select("id")
        .eq("payment_type", "entry_fee")
        .in("status", ["completed", "paid"])
        .or(`user_id.eq.${user.id},profile_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();

    // Fetch documents
    const { data: documents } = await supabase
        .from("candidate_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", user.id);

    // Fetch pending offers
    const { data: pendingOffers } = candidate?.id
        ? await supabase
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

    return (
        <DashboardClient
            user={user}
            profile={profile}
            candidate={candidate}
            documents={documents || []}
            pendingOffers={pendingOffers || []}
            profileCompletion={profileCompletion}
            isReady={isReady}
            inQueue={inQueue}
            hasPaidEntryFee={hasPaidEntryFee}
        />
    );
}
