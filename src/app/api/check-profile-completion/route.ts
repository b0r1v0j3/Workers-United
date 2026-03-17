import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { queueEmail } from "@/lib/email-templates";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import { getPendingApprovalTargetStatus } from "@/lib/worker-review";

export const dynamic = "force-dynamic";

/**
 * POST /api/check-profile-completion
 *
 * Called after a worker saves their profile or uploads a document.
 * If the profile reaches 100% for the first time and the worker
 * has NOT yet paid, sends a congratulatory email + WhatsApp
 * with a link to activate Job Finder.
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
        const targetStatus = getPendingApprovalTargetStatus({
            completion,
            entryFeePaid: workerRecord?.entry_fee_paid,
            adminApproved: !!workerRecord?.admin_approved,
            currentStatus: workerRecord?.status,
        });
        if (targetStatus && workerRecord?.id) {
            await admin
                .from("worker_onboarding")
                .update({
                    status: targetStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", workerRecord.id);
        }

        // If not 100%, just return the current status
        if (completion < 100) {
            return NextResponse.json({
                completion,
                missingFields,
                notificationSent: false,
                reviewQueued: false,
            });
        }

        // Already paid — no need to send "activate" notification
        if (workerRecord?.entry_fee_paid) {
            return NextResponse.json({
                completion,
                missingFields: [],
                notificationSent: false,
                reason: "already_paid",
                reviewQueued: false,
            });
        }

        // Check if we already sent a profile_complete email to avoid duplicates
        const { data: existingEmail } = await supabase
            .from("email_queue")
            .select("id")
            .eq("user_id", user.id)
            .eq("email_type", "profile_complete")
            .limit(1)
            .maybeSingle();

        if (existingEmail) {
            return NextResponse.json({
                completion,
                missingFields: [],
                notificationSent: false,
                reason: "already_notified",
                reviewQueued: targetStatus === "PENDING_APPROVAL" || workerRecord?.status === "PENDING_APPROVAL",
            });
        }

        // Send profile_complete email + WhatsApp
        const userName = profile?.full_name || user.user_metadata?.full_name || "there";
        const userEmail = profile?.email || user.email || "";
        const phone = workerRecord?.phone || undefined;
        const canNotifyWorkerDirectly = canSendWorkerDirectNotifications({
            email: userEmail,
            phone,
            worker: workerRecord,
            isHiddenDraftOwner: Boolean(user.user_metadata?.hidden_draft_owner),
        });

        if (!canNotifyWorkerDirectly) {
            return NextResponse.json({
                completion,
                missingFields: [],
                notificationSent: false,
                reason: "worker_direct_notifications_disabled",
                reviewQueued: targetStatus === "PENDING_APPROVAL" || workerRecord?.status === "PENDING_APPROVAL",
            });
        }

        await queueEmail(
            supabase,
            user.id,
            "profile_complete",
            userEmail,
            userName,
            {},
            undefined,
            phone
        );

        return NextResponse.json({
            completion,
            missingFields: [],
            notificationSent: true,
            reviewQueued: targetStatus === "PENDING_APPROVAL" || workerRecord?.status === "PENDING_APPROVAL",
        });

    } catch (error) {
        console.error("Check profile completion error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
