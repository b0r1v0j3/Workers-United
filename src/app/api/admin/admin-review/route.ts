import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { queueEmail } from "@/lib/email-templates";

// ─── Admin Document Review ──────────────────────────────────────────────────
// Admin approves or rejects a document with optional feedback.
// Sends email notification to the user.

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Admin check
        const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { userId, docType, action, feedback } = await request.json();
        if (!userId || !docType || !action) {
            return NextResponse.json({ error: "userId, docType, action required" }, { status: 400 });
        }

        const admin = createAdminClient();

        if (action === "approve") {
            // Set to verified
            await admin.from("worker_documents").update({
                status: "verified",
                reject_reason: null,
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq("user_id", userId).eq("document_type", docType);

            await logServerActivity(userId, "document_admin_approved", "documents", {
                doc_type: docType,
                admin_id: user.id,
            });

            // Check if all 3 docs are now verified → update worker status
            const { data: allDocs } = await admin.from("worker_documents")
                .select("document_type, status").eq("user_id", userId);
            const verifiedTypes = new Set((allDocs || []).filter(d => d.status === "verified").map(d => d.document_type));
            if (verifiedTypes.has("passport") && verifiedTypes.has("biometric_photo") && verifiedTypes.has("diploma")) {
                await admin.from("worker_onboarding").update({ status: "VERIFIED" }).eq("profile_id", userId);
                await logServerActivity(userId, "all_documents_verified", "documents", { via: "admin_review" });
            }

            // Email the user
            const { data: userProfile } = await admin.from("profiles").select("full_name, email").eq("id", userId).single();
            if (userProfile?.email) {
                const docName = docType.replace(/_/g, " ");
                await queueEmail(
                    admin, userId, "document_review_result",
                    userProfile.email,
                    userProfile.full_name || "there",
                    {
                        approved: true,
                        docType: docName,
                        feedback: null,
                    }
                );
            }

        } else if (action === "reject") {
            // Set to rejected with admin feedback
            await admin.from("worker_documents").update({
                status: "rejected",
                reject_reason: feedback || "Document not accepted by admin.",
                updated_at: new Date().toISOString(),
            }).eq("user_id", userId).eq("document_type", docType);

            await logServerActivity(userId, "document_admin_rejected", "documents", {
                doc_type: docType,
                admin_id: user.id,
                feedback,
            });

            // Email the user with feedback
            const { data: userProfile } = await admin.from("profiles").select("full_name, email").eq("id", userId).single();
            if (userProfile?.email) {
                const docName = docType.replace(/_/g, " ");
                await queueEmail(
                    admin, userId, "document_review_result",
                    userProfile.email,
                    userProfile.full_name || "there",
                    {
                        approved: false,
                        docType: docName,
                        feedback: feedback || "Your document does not meet requirements. Please upload a new one.",
                    }
                );
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[AdminReview] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
