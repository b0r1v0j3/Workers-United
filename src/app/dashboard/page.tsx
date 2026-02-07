import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Redirect employers to employer dashboard
    const userType = user.user_metadata?.user_type;
    if (userType === 'employer') {
        redirect("/employer/dashboard");
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
        .single();

    // Fetch documents
    const { data: documents } = await supabase
        .from("candidate_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", user.id);

    // Fetch pending offers
    const { data: pendingOffers } = await supabase
        .from("offers")
        .select("*, job_request:job_requests(title, destination_country, employer:employers(company_name))")
        .eq("candidate_id", candidate?.id)
        .eq("status", "pending");

    // Calculate verified count from actual documents
    const verifiedDocs = documents?.filter(d => d.status === 'verified') || [];
    const verifiedCount = verifiedDocs.length;
    const isReady = verifiedCount >= 3;
    const inQueue = candidate?.status === "IN_QUEUE";

    // Calculate profile completion
    const profileFields = [
        candidate?.phone,
        candidate?.nationality,
        candidate?.current_country,
        candidate?.preferred_job,
        documents?.some(d => d.document_type === "passport"),
        documents?.some(d => d.document_type === "biometric_photo"),
        candidate?.signature_url
    ];
    const completedFields = profileFields.filter(Boolean).length;
    const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

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
        />
    );
}
