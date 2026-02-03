import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: Get pending offers for current user
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get candidate ID for user
        const { data: candidate } = await supabase
            .from("candidates")
            .select("id")
            .eq("profile_id", user.id)
            .single();

        if (!candidate) {
            return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
        }

        // Get offers with job details
        const { data: offers } = await supabase
            .from("offers")
            .select(`
                *,
                job_request:job_requests(
                    id,
                    title,
                    description,
                    destination_country,
                    salary_min,
                    salary_max,
                    salary_currency,
                    employer:employers(company_name, country)
                )
            `)
            .eq("candidate_id", candidate.id)
            .order("created_at", { ascending: false });

        // Calculate time remaining for pending offers
        const offersWithTimeLeft = offers?.map(offer => {
            if (offer.status === "pending" && offer.expires_at) {
                const expiresAt = new Date(offer.expires_at).getTime();
                const now = Date.now();
                const hoursLeft = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60 * 60)));
                const minutesLeft = Math.max(0, Math.floor(((expiresAt - now) % (1000 * 60 * 60)) / (1000 * 60)));
                return {
                    ...offer,
                    time_left: `${hoursLeft}h ${minutesLeft}m`,
                    is_expired: now > expiresAt
                };
            }
            return offer;
        });

        return NextResponse.json({ offers: offersWithTimeLeft || [] });

    } catch (error) {
        console.error("Offers GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST: Accept an offer
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { offerId, action } = body;

        if (!offerId || !action) {
            return NextResponse.json(
                { error: "Missing required fields: offerId, action" },
                { status: 400 }
            );
        }

        // Verify offer belongs to user's candidate profile
        const { data: candidate } = await supabase
            .from("candidates")
            .select("id")
            .eq("profile_id", user.id)
            .single();

        const { data: offer } = await supabase
            .from("offers")
            .select("*")
            .eq("id", offerId)
            .eq("candidate_id", candidate?.id)
            .single();

        if (!offer) {
            return NextResponse.json({ error: "Offer not found" }, { status: 404 });
        }

        // Check if offer is still valid
        if (offer.status !== "pending") {
            return NextResponse.json({ error: "Offer is no longer pending" }, { status: 400 });
        }

        const now = new Date();
        if (new Date(offer.expires_at) < now) {
            return NextResponse.json({ error: "Offer has expired" }, { status: 400 });
        }

        if (action === "accept") {
            // Update offer status
            await supabase
                .from("offers")
                .update({
                    status: "accepted",
                    accepted_at: now.toISOString()
                })
                .eq("id", offerId);

            // Update candidate status
            await supabase
                .from("candidates")
                .update({ status: "OFFER_ACCEPTED" })
                .eq("id", candidate?.id);

            // Update job request positions filled
            await supabase.rpc("increment_positions_filled", {
                job_request_id: offer.job_request_id
            });

            return NextResponse.json({
                success: true,
                message: "Offer accepted! Please complete the payment.",
                next_step: "payment"
            });

        } else if (action === "decline") {
            // Call rejection handler
            await supabase.rpc("handle_offer_rejection", { p_offer_id: offerId });

            return NextResponse.json({
                success: true,
                message: "Offer declined. You have been moved in the queue.",
                warning: "Note: Declining offers may affect your refund eligibility."
            });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error) {
        console.error("Offers POST error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
