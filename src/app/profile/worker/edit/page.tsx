import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { getAdminTestWorkerWorkspace } from "@/lib/admin-test-data";
import { loadCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

interface WorkerEditPageFamilySpouse {
    first_name?: string | null;
    last_name?: string | null;
    dob?: string | null;
    birth_country?: string | null;
    birth_city?: string | null;
}

interface WorkerEditPageFamilyChild {
    first_name?: string | null;
    last_name?: string | null;
    dob?: string | null;
}

interface WorkerEditPageFamilyData {
    spouse?: WorkerEditPageFamilySpouse | null;
    children?: WorkerEditPageFamilyChild[] | null;
}

interface WorkerEditPageRecord extends WorkerRecordSnapshot {
    id: string;
    nationality: string;
    date_of_birth: string;
    phone: string;
    address: string;
    current_country: string;
    preferred_job: string;
    desired_countries: string[];
    desired_industries: string[];
    birth_country: string;
    birth_city: string;
    citizenship: string;
    original_citizenship: string;
    maiden_name: string;
    father_name: string;
    mother_name: string;
    marital_status: string;
    gender: string;
    family_data: WorkerEditPageFamilyData | null;
    passport_number: string;
    passport_issued_by: string;
    passport_issue_date: string;
    passport_expiry_date: string;
    lives_abroad: string;
    previous_visas: string;
}

export default async function ProfilePage({
    searchParams,
}: {
    searchParams: Promise<{ inspect?: string }>;
}) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const params = await searchParams;
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
    const user = session.user;

    if (!user) {
        redirect("/login");
    }

    if (session.activePersona) {
        if (session.activePersona.role !== "worker") {
            redirect(getAdminTestWorkspaceHref(session.activePersona.role));
        }

        const workspace = await getAdminTestWorkerWorkspace(admin, session.activePersona.id);
        const profile = {
            id: session.activePersona.id,
            email: workspace.worker?.email || session.ownerProfile?.email || user.email || "",
            full_name: workspace.worker?.full_name || session.activePersona.label,
            user_type: "worker",
        };
        const sandboxWorkerRecord = workspace.worker
            ? {
                id: workspace.worker.persona_id,
                nationality: workspace.worker.nationality || "",
                date_of_birth: workspace.worker.date_of_birth || "",
                phone: workspace.worker.phone || "",
                address: workspace.worker.address || "",
                current_country: workspace.worker.current_country || "",
                preferred_job: workspace.worker.preferred_job || "",
                desired_countries: workspace.worker.desired_countries || [],
                desired_industries: [] as string[],
                birth_country: workspace.worker.birth_country || "",
                birth_city: workspace.worker.birth_city || "",
                citizenship: workspace.worker.citizenship || "",
                original_citizenship: workspace.worker.original_citizenship || "",
                maiden_name: workspace.worker.maiden_name || "",
                father_name: workspace.worker.father_name || "",
                mother_name: workspace.worker.mother_name || "",
                marital_status: workspace.worker.marital_status || "",
                gender: workspace.worker.gender || "",
                family_data: workspace.worker.family_data || null,
                passport_number: workspace.worker.passport_number || "",
                passport_issued_by: workspace.worker.passport_issued_by || "",
                passport_issue_date: workspace.worker.passport_issue_date || "",
                passport_expiry_date: workspace.worker.passport_expiry_date || "",
                lives_abroad: workspace.worker.lives_abroad || "",
                previous_visas: workspace.worker.previous_visas || "",
            }
            : null;

        return (
            <ProfileClient
                adminTestMode
                readOnlyPreview={false}
                initialProfile={profile}
                initialWorkerRecord={sandboxWorkerRecord}
            />
        );
    }

    const userType = normalizeUserType(session.liveUserType || user.user_metadata?.user_type);
    if (userType === "employer") {
        redirect("/profile/employer");
    }
    if (userType === "agency") {
        redirect("/profile/agency");
    }

    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    if (isAdminPreview && !inspectProfileId) {
        redirect("/admin");
    }
    const dataClient = inspectProfileId ? admin : supabase;
    const targetProfileId = inspectProfileId || user.id;

    const { data: profile } = await dataClient
        .from("profiles")
        .select("id, email, full_name, user_type")
        .eq("id", targetProfileId)
        .maybeSingle();

    const { data: workerRecord } = await loadCanonicalWorkerRecord<WorkerEditPageRecord>(
        dataClient,
        targetProfileId,
        "*"
    );

    if (inspectProfileId && !profile) {
        redirect("/admin/workers");
    }

    return (
        <ProfileClient
            readOnlyPreview={isAdminPreview}
            initialProfile={profile}
            initialWorkerRecord={workerRecord}
        />
    );
}
