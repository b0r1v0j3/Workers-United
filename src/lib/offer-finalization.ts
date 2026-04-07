import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ensureMatchConversationForOffer } from "@/lib/messaging";

interface OfferRow {
    id: string;
    job_request_id: string | null;
    status: string | null;
    worker_id: string | null;
}

function assertNoError(error: { message: string } | null | undefined, context: string): void {
    if (error) {
        throw new Error(`${context}: ${error.message}`);
    }
}

export async function finalizeConfirmationFeeOffer(
    admin: Pick<SupabaseClient<Database>, "from" | "rpc">,
    profileId: string,
    offerId: string
): Promise<{ offerId: string; transitionedToAccepted: boolean }> {
    const { data: currentOffer, error: offerFetchError } = await admin
        .from("offers")
        .select("id, status, worker_id, job_request_id")
        .eq("id", offerId)
        .single();

    assertNoError(offerFetchError, "Failed to load offer for confirmation fee");

    const offer = currentOffer as OfferRow | null;
    if (!offer) {
        throw new Error("Offer not found");
    }

    let transitionedToAccepted = false;

    if (offer.status === "pending") {
        const { data: acceptedOffer, error: acceptOfferError } = await admin
            .from("offers")
            .update({ status: "accepted" })
            .eq("id", offerId)
            .eq("status", "pending")
            .select("id, status, worker_id, job_request_id")
            .single();

        assertNoError(acceptOfferError, "Failed to mark offer as accepted");

        const accepted = acceptedOffer as OfferRow | null;
        if (!accepted) {
            throw new Error("Offer acceptance did not return an updated row");
        }

        transitionedToAccepted = true;
        offer.status = accepted.status;
        offer.job_request_id = accepted.job_request_id;
        offer.worker_id = accepted.worker_id;
    } else if (offer.status !== "accepted") {
        throw new Error(`Offer is not payable in status: ${offer.status || "unknown"}`);
    }

    const { error: workerStatusError } = await admin
        .from("worker_onboarding")
        .update({ status: "OFFER_ACCEPTED" })
        .eq("profile_id", profileId);

    assertNoError(workerStatusError, "Failed to update worker status after confirmation fee");

    if (transitionedToAccepted && offer.job_request_id) {
        const { error: positionsError } = await admin.rpc("increment_positions_filled", {
            job_request_id: offer.job_request_id,
        });

        assertNoError(positionsError, "Failed to increment positions filled");
    }

    try {
        await ensureMatchConversationForOffer(admin, {
            offerId: offer.id,
            workerProfileId: profileId,
        });
    } catch (error) {
        console.error("[OfferFinalization] Failed to ensure match conversation:", error);
    }

    return {
        offerId: offer.id,
        transitionedToAccepted,
    };
}
