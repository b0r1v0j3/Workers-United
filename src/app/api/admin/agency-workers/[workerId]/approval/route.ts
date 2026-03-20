import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import { resolveAgencyWorkerDocumentOwnerId } from "@/lib/agency-draft-documents";
import { applyWorkerApprovalAction } from "@/lib/worker-review";

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

        const approvalResult = await applyWorkerApprovalAction({
            adminClient: admin,
            actorUserId: user.id,
            action,
            profileId: worker.profile_id || null,
            workerId: worker.id,
            documentOwnerId: resolveAgencyWorkerDocumentOwnerId(worker),
            phoneOptional: true,
            fullNameFallback: worker.submitted_full_name || null,
        });

        return NextResponse.json({
            success: true,
            approved: approvalResult.approved,
            completion: approvalResult.completion,
            status: approvalResult.status,
            notificationQueued: approvalResult.notificationQueued,
        });
    } catch (error) {
        console.error("[AdminAgencyWorkerApproval] Error:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal server error",
        }, {
            status: error instanceof Error && /100% complete|Cannot revoke approval/.test(error.message) ? 400 : 500,
        });
    }
}
