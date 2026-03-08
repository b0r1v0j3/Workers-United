import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: Get pending offers for current user
export async function GET() {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get worker onboarding record for current user
        const { data: workerRecord } = await supabase
            .from("worker_onboarding")
            .select("id")
            .eq("profile_id", user.id)
            .single();

        if (!workerRecord) {
            return NextResponse.json({ error: "Worker profile not found" }, { status: 404 });
        }

        // Get offers with job details
        const { data: offers, error: offersError } = await supabase
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
            .eq("worker_id", workerRecord.id);

        if (offersError) {
            throw offersError;
        }

        // Calculate time remaining for pending offers
        const offersWithTimeLeft = (offers || []).map(offer => {
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
        }).sort((a, b) => {
            const statusRank = (status: string | null) => {
                if (status === "pending") return 0;
                if (status === "accepted") return 1;
                return 2;
            };

            const rankDiff = statusRank(a.status) - statusRank(b.status);
            if (rankDiff !== 0) {
                return rankDiff;
            }

            const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
            const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
            return aTime - bTime;
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

        // Verify offer belongs to the current worker record
        const { data: workerRecord, error: workerRecordError } = await supabase
            .from("worker_onboarding")
            .select("id, status")
            .eq("profile_id", user.id)
            .single();

        if (workerRecordError || !workerRecord) {
            return NextResponse.json({ error: "Worker profile not found" }, { status: 404 });
        }

        const { data: offer, error: offerError } = await supabase
            .from("offers")
            .select("*")
            .eq("id", offerId)
            .eq("worker_id", workerRecord.id)
            .single();

        if (offerError || !offer) {
            return NextResponse.json({ error: "Offer not found" }, { status: 404 });
        }

        // Check if offer is still valid
        if (offer.status !== "pending") {
            return NextResponse.json({ error: "Offer is no longer pending" }, { status: 400 });
        }

        const now = new Date();
        if (offer.expires_at && new Date(offer.expires_at) < now) {
            return NextResponse.json({ error: "Offer has expired" }, { status: 400 });
        }

        if (action === "accept") {
            // Payment finalization marks the offer as accepted.
            // This step only moves the worker into the pre-payment offer flow.
            const { error: workerStatusError } = await supabase
                .from("worker_onboarding")
                .update({ status: "OFFER_PENDING" })
                .eq("id", workerRecord.id);

            if (workerStatusError) {
                throw workerStatusError;
            }

            return NextResponse.json({
                success: true,
                message: "Offer confirmed. Please complete the payment.",
                next_step: "payment"
            });

        } else if (action === "decline") {
            // Call rejection handler
            const { error: rejectionError } = await supabase.rpc("handle_offer_rejection", { p_offer_id: offerId });

            if (rejectionError) {
                throw rejectionError;
            }

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
