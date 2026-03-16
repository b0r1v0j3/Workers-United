import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import {
    deleteAdminTestAgencyWorker,
    getAdminTestAgencyWorker,
    updateAdminTestAgencyWorker,
} from "@/lib/admin-test-data";
import { getAgencyOwnedWorker, getAgencySchemaState } from "@/lib/agencies";
import { normalizeAgencyWorkerPayload } from "@/lib/agency-worker-payload";
import { normalizeUserType } from "@/lib/domain";
import { deleteUserData } from "@/lib/user-management";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { getPendingApprovalTargetStatus } from "@/lib/worker-review";
import { resolveAgencyWorkerDocumentOwnerId } from "@/lib/agency-draft-documents";

interface RouteContext {
    params: Promise<{ workerId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { workerId } = await context.params;
        const supabase = await createClient();
        const admin = createAdminClient();
        const adminTestSession = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (!adminTestSession.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (adminTestSession.activePersona?.role === "agency") {
            const worker = await getAdminTestAgencyWorker(admin, adminTestSession.activePersona.id, workerId);
            if (!worker) {
                return NextResponse.json({ error: "Worker not found" }, { status: 404 });
            }

            return NextResponse.json({
                worker: {
                    id: worker.id,
                    submitted_full_name: worker.full_name,
                    submitted_email: worker.email,
                    phone: worker.phone,
                    nationality: worker.nationality,
                    current_country: worker.current_country,
                    preferred_job: worker.preferred_job,
                    desired_countries: worker.desired_countries,
                    gender: worker.gender,
                    marital_status: worker.marital_status,
                    date_of_birth: worker.date_of_birth,
                    birth_country: worker.birth_country,
                    birth_city: worker.birth_city,
                    citizenship: worker.citizenship,
                    original_citizenship: worker.original_citizenship,
                    maiden_name: worker.maiden_name,
                    father_name: worker.father_name,
                    mother_name: worker.mother_name,
                    address: worker.address,
                    family_data: worker.family_data,
                    passport_number: worker.passport_number,
                    passport_issued_by: worker.passport_issued_by,
                    passport_issue_date: worker.passport_issue_date,
                    passport_expiry_date: worker.passport_expiry_date,
                    lives_abroad: worker.lives_abroad,
                    previous_visas: worker.previous_visas,
                },
                sandbox: true,
            });
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
        const adminTestSession = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
        const body = await request.json();

        if (!adminTestSession.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (adminTestSession.activePersona?.role === "agency") {
            const existingWorker = await getAdminTestAgencyWorker(admin, adminTestSession.activePersona.id, workerId);
            if (!existingWorker) {
                return NextResponse.json({ error: "Worker not found" }, { status: 404 });
            }

            const normalized = normalizeAgencyWorkerPayload(body);

            if (!normalized.fullName) {
                return NextResponse.json({ error: "Worker full name is required" }, { status: 400 });
            }

            if (normalized.phone && !/^\+\d{7,15}$/.test(normalized.phone)) {
                return NextResponse.json({ error: "Phone number must start with + and country code" }, { status: 400 });
            }

            await updateAdminTestAgencyWorker(admin, adminTestSession.activePersona.id, workerId, {
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
            });

            return NextResponse.json({ success: true, sandbox: true });
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
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();

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

        const { data: refreshedWorker, error: refreshedWorkerError } = await admin
            .from("worker_onboarding")
            .select(`
                id,
                profile_id,
                application_data,
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
            .eq("agency_id", worker.agency_id)
            .single();

        if (refreshedWorkerError || !refreshedWorker) {
            console.error("[AgencyWorker PATCH] Refresh failed:", refreshedWorkerError);
            return NextResponse.json({ error: "Worker updated but completion refresh failed" }, { status: 500 });
        }

        const documentOwnerId = resolveAgencyWorkerDocumentOwnerId(refreshedWorker);
        const { data: documents, error: documentsError } = documentOwnerId
            ? await admin
                .from("worker_documents")
                .select("document_type, status")
                .eq("user_id", documentOwnerId)
            : { data: [], error: null };
        if (documentsError) {
            console.error("[AgencyWorker PATCH] Document refresh failed:", documentsError);
            return NextResponse.json({ error: "Worker updated but document refresh failed" }, { status: 500 });
        }

        const completion = getWorkerCompletion({
            profile: { full_name: normalized.fullName },
            worker: refreshedWorker,
            documents: documents || [],
        }, { phoneOptional: true }).completion;
        const targetStatus = getPendingApprovalTargetStatus({
            completion,
            entryFeePaid: refreshedWorker.entry_fee_paid,
            adminApproved: !!refreshedWorker.admin_approved,
            currentStatus: refreshedWorker.status,
        });

        if (targetStatus && targetStatus !== refreshedWorker.status) {
            const { error: statusError } = await admin
                .from("worker_onboarding")
                .update({
                    status: targetStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", refreshedWorker.id);

            if (statusError) {
                console.error("[AgencyWorker PATCH] Status update failed:", statusError);
                return NextResponse.json({ error: "Worker updated but review status failed" }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            completion,
            reviewQueued: targetStatus === "PENDING_APPROVAL" || refreshedWorker.status === "PENDING_APPROVAL",
        });
    } catch (error) {
        console.error("[AgencyWorker PATCH] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    try {
        const { workerId } = await context.params;
        const supabase = await createClient();
        const admin = createAdminClient();
        const adminTestSession = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (!adminTestSession.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (adminTestSession.activePersona?.role === "agency") {
            const worker = await getAdminTestAgencyWorker(admin, adminTestSession.activePersona.id, workerId);
            if (!worker) {
                return NextResponse.json({ error: "Worker not found" }, { status: 404 });
            }

            await deleteAdminTestAgencyWorker(admin, adminTestSession.activePersona.id, workerId);
            return NextResponse.json({ success: true, deletedClaimedAccount: false, sandbox: true });
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
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();

        const userType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        if (userType !== "agency") {
            return NextResponse.json({ error: "Agency access required" }, { status: 403 });
        }

        const { agency, worker } = await getAgencyOwnedWorker(admin, user.id, workerId);
        if (!agency || !worker) {
            return NextResponse.json({ error: "Worker not found" }, { status: 404 });
        }

        if (worker.profile_id) {
            await deleteUserData(admin, worker.profile_id);
            return NextResponse.json({ success: true, deletedClaimedAccount: true });
        }

        const { error: deleteError } = await admin
            .from("worker_onboarding")
            .delete()
            .eq("id", worker.id)
            .eq("agency_id", agency.id);

        if (deleteError) {
            console.error("[AgencyWorker DELETE] Worker delete failed:", deleteError);
            return NextResponse.json({ error: "Failed to delete worker" }, { status: 500 });
        }

        return NextResponse.json({ success: true, deletedClaimedAccount: false });
    } catch (error) {
        console.error("[AgencyWorker DELETE] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
