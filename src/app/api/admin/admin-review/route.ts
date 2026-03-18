import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { isGodModeUser } from "@/lib/godmode";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { queueEmail } from "@/lib/email-templates";
import { syncWorkerReviewStatus } from "@/lib/worker-review";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import {
    AGENCY_DRAFT_DOCUMENT_OWNER_KEY,
    resolveAgencyWorkerDocumentOwnerId,
} from "@/lib/agency-draft-documents";

async function resolveAdminReviewContext(admin: ReturnType<typeof createAdminClient>, userId: string) {
    const canonicalWorker = await loadCanonicalWorkerRecord<{
        id: string;
        profile_id?: string | null;
        submitted_full_name?: string | null;
        application_data?: Json | null;
    }>(
        admin,
        userId,
        "id, profile_id, submitted_full_name, application_data"
    ).then((result) => result.data);

    if (canonicalWorker?.id) {
        return {
            workerId: canonicalWorker.id,
            profileId: canonicalWorker.profile_id || userId,
            documentOwnerId: resolveAgencyWorkerDocumentOwnerId(canonicalWorker) || userId,
            fullNameFallback: canonicalWorker.submitted_full_name || null,
        };
    }

    const { data: draftWorker } = await admin
        .from("worker_onboarding")
        .select("id, profile_id, submitted_full_name, application_data")
        .contains("application_data", { [AGENCY_DRAFT_DOCUMENT_OWNER_KEY]: userId })
        .maybeSingle();

    if (draftWorker?.id) {
        return {
            workerId: draftWorker.id,
            profileId: draftWorker.profile_id || null,
            documentOwnerId: userId,
            fullNameFallback: draftWorker.submitted_full_name || null,
        };
    }

    return {
        workerId: null,
        profileId: userId,
        documentOwnerId: userId,
        fullNameFallback: null,
    };
}

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
        const reviewContext = await resolveAdminReviewContext(admin, userId);
        const notificationProfileId = reviewContext.profileId || null;

        if (action === "approve") {
            // Set to verified
            const { error: approveError } = await admin.from("worker_documents").update({
                status: "verified",
                reject_reason: null,
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq("user_id", reviewContext.documentOwnerId).eq("document_type", docType);
            if (approveError) {
                return NextResponse.json({ error: "Failed to update document status" }, { status: 500 });
            }

            await syncWorkerReviewStatus({
                adminClient: admin,
                profileId: reviewContext.profileId,
                workerId: reviewContext.workerId,
                documentOwnerId: reviewContext.documentOwnerId,
                phoneOptional: !!reviewContext.workerId && !reviewContext.profileId,
                fullNameFallback: reviewContext.fullNameFallback,
                notifyOnPendingApproval: true,
            });

            await logServerActivity(notificationProfileId || reviewContext.documentOwnerId, "document_admin_approved", "documents", {
                doc_type: docType,
                admin_id: user.id,
            });

            // Email the user
            const userProfile = notificationProfileId
                ? await admin.from("profiles").select("full_name, email").eq("id", notificationProfileId).maybeSingle().then((result) => result.data)
                : null;
            if (userProfile?.email && notificationProfileId) {
                const docName = docType.replace(/_/g, " ");
                await queueEmail(
                    admin, notificationProfileId, "document_review_result",
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
            const { error: rejectError } = await admin.from("worker_documents").update({
                status: "rejected",
                reject_reason: feedback || "Document not accepted by admin.",
                updated_at: new Date().toISOString(),
            }).eq("user_id", reviewContext.documentOwnerId).eq("document_type", docType);
            if (rejectError) {
                return NextResponse.json({ error: "Failed to update document status" }, { status: 500 });
            }

            await syncWorkerReviewStatus({
                adminClient: admin,
                profileId: reviewContext.profileId,
                workerId: reviewContext.workerId,
                documentOwnerId: reviewContext.documentOwnerId,
                phoneOptional: !!reviewContext.workerId && !reviewContext.profileId,
                fullNameFallback: reviewContext.fullNameFallback,
                notifyOnPendingApproval: true,
            });

            await logServerActivity(notificationProfileId || reviewContext.documentOwnerId, "document_admin_rejected", "documents", {
                doc_type: docType,
                admin_id: user.id,
                feedback,
            });

            // Email the user with feedback
            const userProfile = notificationProfileId
                ? await admin.from("profiles").select("full_name, email").eq("id", notificationProfileId).maybeSingle().then((result) => result.data)
                : null;
            if (userProfile?.email && notificationProfileId) {
                const docName = docType.replace(/_/g, " ");
                await queueEmail(
                    admin, notificationProfileId, "document_review_result",
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
