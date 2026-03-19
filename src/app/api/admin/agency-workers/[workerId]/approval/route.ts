import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import { resolveAgencyWorkerDocumentOwnerId } from "@/lib/agency-draft-documents";
import { syncWorkerReviewStatus } from "@/lib/worker-review";
import { queueEmail } from "@/lib/email-templates";
import { getAgencyWorkerEmail } from "@/lib/agencies";
import { buildWorkerPaymentUnlockedEmailData } from "@/lib/worker-approval-notifications";

interface RouteContext {
    params: Promise<{ workerId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { workerId } = await context.params;
        const { action } = await request.json() as { action?: string };
        if (action !== "approve" && action !== "revoke") {
            return NextResponse.json({ error: "Invalid approval action" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();
        const normalizedUserType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        if (normalizedUserType !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const admin = createAdminClient();
        const { data: worker, error: workerError } = await admin
            .from("worker_onboarding")
            .select(`
                id,
                agency_id,
                profile_id,
                submitted_email,
                application_data,
                submitted_full_name,
                status,
                admin_approved,
                entry_fee_paid,
                phone,
                nationality,
                current_country,
                preferred_job,
                gender,
                marital_status,
                date_of_birth,
                birth_country,
                birth_city,
                citizenship,
                family_data,
                passport_number,
                passport_issued_by,
                passport_issue_date,
                passport_expiry_date,
                lives_abroad,
                previous_visas
            `)
            .eq("id", workerId)
            .maybeSingle();

        if (workerError || !worker || !worker.agency_id) {
            return NextResponse.json({ error: "Agency worker not found" }, { status: 404 });
        }

        const documentOwnerId = resolveAgencyWorkerDocumentOwnerId(worker);
        const syncResult = await syncWorkerReviewStatus({
            adminClient: admin,
            profileId: worker.profile_id || null,
            workerId: worker.id,
            documentOwnerId,
            phoneOptional: true,
            fullNameFallback: worker.submitted_full_name || null,
        });
        const completion = syncResult.completion;

        if (action === "approve" && completion < 100) {
            return NextResponse.json({ error: "This profile must be 100% complete before approval." }, { status: 400 });
        }

        if (action === "revoke" && (worker.entry_fee_paid || isPostEntryFeeWorkerStatus(worker.status))) {
            return NextResponse.json({ error: "Approval can no longer be revoked after Job Finder is active." }, { status: 400 });
        }

        const approved = action === "approve";
        const nextStatus = approved ? "APPROVED" : completion >= 100 ? "PENDING_APPROVAL" : "NEW";
        const nowIso = new Date().toISOString();

        const { error: updateError } = await admin
            .from("worker_onboarding")
            .update({
                admin_approved: approved,
                admin_approved_at: approved ? nowIso : null,
                admin_approved_by: approved ? user.id : null,
                status: nextStatus,
                updated_at: nowIso,
            })
            .eq("id", worker.id);

        if (updateError) {
            console.error("[AdminAgencyWorkerApproval] Update failed:", updateError);
            return NextResponse.json({ error: "Failed to update approval state" }, { status: 500 });
        }

        if (approved && worker.profile_id) {
            const { data: profileData } = await admin
                .from("profiles")
                .select("full_name, email")
                .eq("id", worker.profile_id)
                .maybeSingle();

            const notificationEmail = getAgencyWorkerEmail({
                submitted_email: worker.submitted_email ?? null,
                profiles: profileData ? [profileData] : null,
            });

            if (notificationEmail) {
                await queueEmail(
                    admin,
                    worker.profile_id,
                    "admin_update",
                    notificationEmail,
                    profileData?.full_name || worker.submitted_full_name || "there",
                    buildWorkerPaymentUnlockedEmailData()
                );
            }
        }

        return NextResponse.json({
            success: true,
            approved,
            completion,
            status: nextStatus,
        });
    } catch (error) {
        console.error("[AdminAgencyWorkerApproval] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
