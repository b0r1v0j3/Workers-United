import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import { syncWorkerReviewStatus } from "@/lib/worker-review";

export const dynamic = "force-dynamic";

/**
 * POST /api/check-profile-completion
 *
 * Called after a worker saves their profile or uploads a document.
 * Returns the worker's base completion snapshot and lets the
 * canonical review-sync helper decide whether review is truly
 * ready and whether the "profile_complete" notification should fire.
 */
export async function POST() {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", user.id)
            .maybeSingle();

        // Fetch canonical worker record
        const { data: workerRecord } = await loadCanonicalWorkerRecord(
            supabase,
            user.id,
            "*, phone, entry_fee_paid, queue_joined_at, status"
        );

        // Fetch documents
        const { data: documents } = await supabase
            .from("worker_documents")
            .select("document_type, status")
            .eq("user_id", user.id);

        // Calculate completion
        const { completion, missingFields } = getWorkerCompletion({
            profile,
            worker: workerRecord,
            documents: documents || [],
        }, {
            fullNameFallback: user.user_metadata?.full_name,
        });
        const syncResult = await syncWorkerReviewStatus({
            adminClient: admin,
            profileId: user.id,
            fullNameFallback: user.user_metadata?.full_name,
            notifyOnPendingApproval: true,
        });

        // If not 100%, just return the current status
        if (completion < 100) {
            return NextResponse.json({
                completion,
                missingFields,
                notificationSent: false,
                reviewQueued: syncResult.reviewQueued,
            });
        }

        // Already paid — no need to send "activate" notification
        if (workerRecord?.entry_fee_paid) {
            return NextResponse.json({
                completion,
                missingFields: [],
                notificationSent: false,
                reason: "already_paid",
                reviewQueued: syncResult.reviewQueued,
            });
        }

        return NextResponse.json({
            completion,
            missingFields: [],
            notificationSent: syncResult.notificationSent,
            reason: syncResult.notificationSent ? undefined : syncResult.notificationReason || undefined,
            reviewQueued: syncResult.reviewQueued,
        });

    } catch (error) {
        console.error("Check profile completion error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
