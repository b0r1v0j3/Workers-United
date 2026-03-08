import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyOwnedWorker, getAgencySchemaState } from "@/lib/agencies";
import { normalizeAgencyWorkerPayload } from "@/lib/agency-worker-payload";
import { normalizeUserType } from "@/lib/domain";

interface RouteContext {
    params: Promise<{ workerId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { workerId } = await context.params;
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
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();

        const userType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        const requestUrl = new URL(_request.url);
        const inspectProfileId = userType === "admin"
            ? requestUrl.searchParams.get("inspect")?.trim() || null
            : null;

        if (userType !== "agency" && !(userType === "admin" && inspectProfileId)) {
            return NextResponse.json({ error: "Agency access required" }, { status: 403 });
        }

        const targetAgencyProfileId = userType === "agency" ? user.id : inspectProfileId;
        const { worker } = await getAgencyOwnedWorker(admin, targetAgencyProfileId || user.id, workerId);
        if (!worker) {
            return NextResponse.json({ error: "Worker not found" }, { status: 404 });
        }

        const { data: detailedWorker, error: workerError } = await admin
            .from("worker_onboarding")
            .select(`
                id,
                submitted_full_name,
                submitted_email,
                phone,
                nationality,
                current_country,
                preferred_job,
                desired_countries,
                gender,
                marital_status,
                date_of_birth,
                birth_country,
                birth_city,
                citizenship,
                original_citizenship,
                maiden_name,
                father_name,
                mother_name,
                address,
                family_data,
                passport_number,
                passport_issued_by,
                passport_issue_date,
                passport_expiry_date,
                lives_abroad,
                previous_visas
            `)
            .eq("id", workerId)
            .eq("agency_id", worker.agency_id)
            .single();

        if (workerError || !detailedWorker) {
            console.error("[AgencyWorker GET] Worker fetch failed:", workerError);
            return NextResponse.json({ error: "Worker not found" }, { status: 404 });
        }

        return NextResponse.json({ worker: detailedWorker });
    } catch (error) {
        console.error("[AgencyWorker GET] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { workerId } = await context.params;
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
            .select("user_type")
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

        const targetAgencyProfileId = userType === "agency" ? user.id : inspectProfileId;
        const { worker } = await getAgencyOwnedWorker(admin, targetAgencyProfileId || user.id, workerId);
        if (!worker) {
            return NextResponse.json({ error: "Worker not found" }, { status: 404 });
        }

        const normalized = normalizeAgencyWorkerPayload(body);

        if (!normalized.fullName) {
            return NextResponse.json({ error: "Worker full name is required" }, { status: 400 });
        }

        if (normalized.phone && !/^\+\d{7,15}$/.test(normalized.phone)) {
            return NextResponse.json({ error: "Phone number must start with + and country code" }, { status: 400 });
        }

        const workerUpdatePayload = {
            ...normalized.workerFields,
            updated_at: new Date().toISOString(),
        };

        const { error: workerUpdateError } = await admin
            .from("worker_onboarding")
            .update(workerUpdatePayload)
            .eq("id", workerId)
            .eq("agency_id", worker.agency_id);

        if (workerUpdateError) {
            console.error("[AgencyWorker PATCH] Worker update failed:", workerUpdateError);
            return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
        }

        if (worker.profile_id) {
            const { error: profileUpdateError } = await admin
                .from("profiles")
                .update({ full_name: normalized.fullName })
                .eq("id", worker.profile_id);

            if (profileUpdateError) {
                console.error("[AgencyWorker PATCH] Profile update failed:", profileUpdateError);
                return NextResponse.json({ error: "Failed to sync worker profile" }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[AgencyWorker PATCH] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
