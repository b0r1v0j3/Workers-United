import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OfferClient from "./OfferClient";

interface OfferPageProps {
    params: Promise<{ id: string }>;
}

export default async function OfferDetailPage({ params }: OfferPageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Get offer with related data
    const { data: offer, error } = await supabase
        .from("offers")
        .select(`
      *,
      candidates(*),
      job_requests(*, employers(*, profiles(*)))
    `)
        .eq("id", id)
        .single();

    if (error || !offer) {
        notFound();
    }

    // Verify this offer belongs to the current user
    const { data: candidate } = await supabase
        .from("candidates")
        .select("id, signature_url")
        .eq("profile_id", user.id)
        .single();

    if (!candidate || offer.candidate_id !== candidate.id) {
        redirect("/profile/worker");
    }

    const expiresAt = new Date(offer.expires_at);
    const now = new Date();
    const isExpired = expiresAt < now;

    return (
        <OfferClient
            offer={offer}
            candidate={candidate}
            isExpired={isExpired}
            expiresAt={expiresAt.toISOString()}
        />
    );
}
