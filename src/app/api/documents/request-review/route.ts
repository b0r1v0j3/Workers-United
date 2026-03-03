import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerActivity } from "@/lib/activityLoggerServer";

// ─── Request Manual Review ──────────────────────────────────────────────────
// When AI rejects a document but user believes it's correct,
// they can request manual admin review.

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { docType } = await request.json();
        if (!docType) {
            return NextResponse.json({ error: "docType required" }, { status: 400 });
        }

        const admin = createAdminClient();

        // Update document status to manual_review
        const { error } = await admin
            .from("candidate_documents")
            .update({
                status: "manual_review",
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
            .eq("document_type", docType);

        if (error) {
            console.error("[RequestReview] DB error:", error);
            return NextResponse.json({ error: "Failed to update" }, { status: 500 });
        }

        await logServerActivity(user.id, "document_manual_review_requested", "documents", { doc_type: docType });

        // Notify admin via email
        try {
            const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
            const { queueEmail } = await import("@/lib/email-templates");
            await queueEmail(
                admin,
                user.id,
                "admin_update",
                process.env.ADMIN_EMAIL || "contact@workersunited.eu",
                "Admin",
                {
                    subject: `Manual Review Needed: ${docType} from ${profile?.full_name || user.email}`,
                    title: "Document Review Request",
                    message: `${profile?.full_name || user.email} is requesting manual review for their ${docType.replace("_", " ")}. The AI verification rejected it but the user believes it's correct.\n\nPlease review it in the admin panel.`,
                    actionLink: `${process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu"}/admin/review`,
                    actionText: "Review Documents",
                }
            );
        } catch { /* email is best-effort */ }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[RequestReview] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
