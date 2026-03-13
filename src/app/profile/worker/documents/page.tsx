import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { getAdminTestWorkerWorkspace } from "@/lib/admin-test-data";
import DocumentsClient from "./DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
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
        return (
            <DocumentsClient
                adminTestMode
                workerProfileId={session.activePersona.id}
                email={workspace.worker?.email || session.ownerProfile?.email || user.email || ""}
                documents={workspace.documents.map((document) => ({
                    document_type: document.document_type,
                    status: document.status,
                    reject_reason: document.reject_reason,
                }))}
                readOnlyPreview={false}
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
    const targetProfileId = inspectProfileId || user.id;
    const dataClient = inspectProfileId ? admin : supabase;

    const { data: profile } = await dataClient
        .from("profiles")
        .select("email")
        .eq("id", targetProfileId)
        .maybeSingle();

    if (inspectProfileId && !profile) {
        redirect("/admin/workers");
    }

    // Fetch documents
    const { data: documents } = await dataClient
        .from("worker_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", targetProfileId);

    return (
        <DocumentsClient
            workerProfileId={targetProfileId}
            email={profile?.email || user.email || ""}
            documents={documents || []}
            readOnlyPreview={isAdminPreview}
        />
    );
}
