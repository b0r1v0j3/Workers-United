import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocumentsClient from "./DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch documents
    const { data: documents } = await supabase
        .from("candidate_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", user.id);

    return (
        <DocumentsClient
            candidateId={user.id}
            email={user.email || ""}
            documents={documents || []}
        />
    );
}
