import { NextRequest, NextResponse } from "next/server";
import { claimAgencyWorkerDraft, getAgencySchemaState } from "@/lib/agencies";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkerProfileRecord } from "@/lib/workers";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const normalizedUserType = normalizeUserType(user.user_metadata?.user_type);
        if (normalizedUserType === "agency" || normalizedUserType === "employer" || normalizedUserType === "admin") {
            return NextResponse.json({ error: "Worker account required" }, { status: 403 });
        }

        const schemaState = await getAgencySchemaState(admin);
        if (!schemaState.ready) {
            return NextResponse.json(
                { error: "Agency workspace setup is not active yet." },
                { status: 503 }
            );
        }

        const { workerId } = (await request.json()) as { workerId?: string };
        if (!workerId) {
            return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
        }

        await ensureWorkerProfileRecord(admin, {
            userId: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name,
        });

        const result = await claimAgencyWorkerDraft(admin, {
            workerId,
            profileId: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name,
        });

        await logServerActivity(user.id, "agency_worker_claim_attempt", "auth", {
            worker_id: workerId,
            result: result.reason,
        }, result.ok ? "ok" : "warning");

        if (result.ok) {
            await admin.auth.admin.updateUserById(user.id, {
                user_metadata: {
                    ...user.user_metadata,
                    claimed_worker_id: null,
                },
            });
        }

        if (!result.ok && result.reason !== "already_linked") {
            const errorMap: Record<string, string> = {
                already_claimed: "This worker profile has already been claimed.",
                missing_email: "This worker profile is missing the invited email address.",
                email_mismatch: "Please use the same email address the agency entered for you.",
                not_found: "Worker profile not found.",
            };

            return NextResponse.json(
                { error: errorMap[result.reason] || "Unable to claim worker profile.", reason: result.reason },
                { status: result.reason === "not_found" ? 404 : 400 }
            );
        }

        return NextResponse.json({
            success: true,
            workerId: result.workerId,
            reason: result.reason,
        });
    } catch (error) {
        console.error("[AgencyClaim] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
