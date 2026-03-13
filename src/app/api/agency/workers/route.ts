import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import { createAdminTestAgencyWorker } from "@/lib/admin-test-data";
import { ensureAgencyRecord, getAgencyRecordByProfileId, getAgencySchemaState } from "@/lib/agencies";
import { normalizeAgencyWorkerPayload } from "@/lib/agency-worker-payload";
import { normalizeUserType } from "@/lib/domain";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();
        const adminTestSession = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
        const body = await request.json();

        if (!adminTestSession.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (adminTestSession.activePersona?.role === "agency") {
            const normalized = normalizeAgencyWorkerPayload(body);

            if (!normalized.fullName) {
                return NextResponse.json({ error: "Worker full name is required" }, { status: 400 });
            }

            if (normalized.phone && !/^\+\d{7,15}$/.test(normalized.phone)) {
                return NextResponse.json({ error: "Phone number must start with + and country code" }, { status: 400 });
            }

            const sandboxWorker = await createAdminTestAgencyWorker(admin, adminTestSession.activePersona.id, {
                full_name: normalized.fullName,
                email: normalized.email,
                phone: normalized.phone,
                nationality: normalized.workerFields.nationality,
                current_country: normalized.workerFields.current_country,
                preferred_job: normalized.workerFields.preferred_job,
                desired_countries: normalized.workerFields.desired_countries,
                gender: normalized.workerFields.gender,
                marital_status: normalized.workerFields.marital_status,
                date_of_birth: normalized.workerFields.date_of_birth,
                birth_country: normalized.workerFields.birth_country,
                birth_city: normalized.workerFields.birth_city,
                citizenship: normalized.workerFields.citizenship,
                original_citizenship: normalized.workerFields.original_citizenship,
                maiden_name: normalized.workerFields.maiden_name,
                father_name: normalized.workerFields.father_name,
                mother_name: normalized.workerFields.mother_name,
                address: normalized.workerFields.address,
                family_data: normalized.workerFields.family_data,
                passport_number: normalized.workerFields.passport_number,
                passport_issued_by: normalized.workerFields.passport_issued_by,
                passport_issue_date: normalized.workerFields.passport_issue_date,
                passport_expiry_date: normalized.workerFields.passport_expiry_date,
                lives_abroad: normalized.workerFields.lives_abroad,
                previous_visas: normalized.workerFields.previous_visas,
                status: "NEW",
            });

            return NextResponse.json({ success: true, workerId: sandboxWorker.id, sandbox: true });
        }

        const schemaState = await getAgencySchemaState(admin);
        if (!schemaState.ready) {
            return NextResponse.json({ error: "Agency workspace setup is not active yet." }, { status: 503 });
        }

        const user = adminTestSession.user;
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await admin
            .from("profiles")
            .select("full_name, user_type")
            .eq("id", user.id)
            .maybeSingle();

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
