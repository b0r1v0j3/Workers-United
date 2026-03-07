import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import DocumentsClient from "./DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
    searchParams,
}: {
    searchParams: Promise<{ inspect?: string }>;
}) {
    const supabase = await createClient();
    const params = await searchParams;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType === "employer") {
        redirect("/profile/employer");
    }
    if (userType === "agency") {
        redirect("/profile/agency");
    }
    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    const targetProfileId = inspectProfileId || user.id;
    const dataClient = inspectProfileId ? createAdminClient() : supabase;

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
        .from("candidate_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", targetProfileId);

    return (
        <DocumentsClient
            candidateId={targetProfileId}
            email={profile?.email || user.email || ""}
            documents={documents || []}
            readOnlyPreview={isAdminPreview}
        />
    );
}
