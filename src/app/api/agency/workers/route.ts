import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAgencyRecord, getAgencyRecordByProfileId, getAgencySchemaState } from "@/lib/agencies";
import { normalizeAgencyWorkerPayload } from "@/lib/agency-worker-payload";
import { normalizeUserType } from "@/lib/domain";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();

        const schemaState = await getAgencySchemaState(admin);
        if (!schemaState.ready) {
            return NextResponse.json({ error: "Agency workspace setup is not active yet." }, { status: 503 });
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await admin
            .from("profiles")
            .select("full_name, user_type")
            .eq("id", user.id)
            .maybeSingle();

        const body = await request.json();
        const userType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        const inspectProfileId = userType === "admin" && typeof body.inspectProfileId === "string"
            ? body.inspectProfileId.trim() || null
            : null;
        if (userType !== "agency" && !(userType === "admin" && inspectProfileId)) {
            return NextResponse.json({ error: "Agency access required" }, { status: 403 });
        }

        let agency = userType === "agency"
            ? await getAgencyRecordByProfileId(admin, user.id)
            : inspectProfileId
                ? await getAgencyRecordByProfileId(admin, inspectProfileId)
                : null;

        if (userType === "agency" && !agency) {
            const provisioned = await ensureAgencyRecord(admin, {
                userId: user.id,
                email: user.email,
                fullName: profile?.full_name || user.user_metadata?.full_name,
                agencyName: user.user_metadata?.company_name,
            });
            agency = provisioned.agency;
        }

        if (!agency) {
            return NextResponse.json({ error: "Agency profile not found" }, { status: 404 });
        }

        const normalized = normalizeAgencyWorkerPayload(body);

        if (!normalized.fullName) {
            return NextResponse.json({ error: "Worker full name is required" }, { status: 400 });
        }

        if (normalized.phone && !/^\+\d{7,15}$/.test(normalized.phone)) {
            return NextResponse.json({ error: "Phone number must start with + and country code" }, { status: 400 });
        }

        const workerFieldValues = normalized.workerFields;

        const { data: worker, error: workerError } = await admin
            .from("worker_onboarding")
            .insert({
                status: "NEW",
                source_type: "agency",
                agency_id: agency.id,
                submitted_by_profile_id: user.id,
                ...workerFieldValues,
                updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();

        if (workerError) {
            console.error("[AgencyWorkers POST] Insert failed:", workerError);
            return NextResponse.json({ error: "Failed to create worker draft" }, { status: 500 });
        }

        return NextResponse.json({ success: true, workerId: worker.id });
    } catch (error) {
        console.error("[AgencyWorkers POST] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
