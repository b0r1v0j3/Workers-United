import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { isEmailDeliveryAccepted } from "@/lib/email-queue";
import { isGodModeUser } from "@/lib/godmode";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { queueEmail } from "@/lib/email-templates";
import { syncWorkerReviewStatus } from "@/lib/worker-review";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import { revalidatePath } from "next/cache";
import { collectDocumentStoragePathsForCleanup } from "@/lib/document-image-processing";
import { buildDocumentRequestReason, humanizeDocumentType } from "@/lib/document-review";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import {
    AGENCY_DRAFT_DOCUMENT_OWNER_KEY,
    resolveAgencyWorkerDocumentOwnerId,
} from "@/lib/agency-draft-documents";

type EmailNotificationResult = {
    status: "sent" | "queued" | "failed" | "skipped";
    error?: string | null;
};

type DocumentMutationResult = {
    data?: { id?: string | null } | { id?: string | null }[] | null;
    error?: { message?: string | null } | null;
};

function getMatchedDocumentId(result: DocumentMutationResult): string | null {
    if (Array.isArray(result.data)) {
        const firstRow = result.data[0];
        return typeof firstRow?.id === "string" ? firstRow.id : null;
    }

    return typeof result.data?.id === "string" ? result.data.id : null;
}

function getEmailNotificationResult(
    result: Awaited<ReturnType<typeof queueEmail>> | null | undefined,
    recipientEmail?: string | null,
    recipientUserId?: string | null
): EmailNotificationResult {
    if (!recipientEmail || !recipientUserId) {
        return { status: "skipped", error: null };
    }

    if (!result) {
        return { status: "failed", error: "Email dispatch did not run." };
    }

    if (result.sent) {
        return { status: "sent", error: null };
    }
    if (isEmailDeliveryAccepted(result)) {
        return { status: "queued", error: result.error || null };
    }

    return { status: "failed", error: result.error || "Email send failed." };
}

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

async function resolveNotificationProfile(admin: ReturnType<typeof createAdminClient>, profileId: string | null) {
    if (!profileId) {
        return null;
    }

    return admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", profileId)
        .maybeSingle()
        .then((result) => result.data);
}

function redirectWithAction(
    request: Request,
    redirectTo: string | null | undefined,
    action: string,
    error?: string,
    notification?: EmailNotificationResult
) {
    const url = new URL(redirectTo || "/admin/workers", request.url);
    url.searchParams.set("documentAction", action);
    url.searchParams.set("ts", Date.now().toString());
    if (error) {
        url.searchParams.set("documentError", error);
    }
    if (notification?.status) {
        url.searchParams.set("documentNotification", notification.status);
    }
    return NextResponse.redirect(url, { status: 303 });
}

async function handleStructuredFormAction(
    request: Request,
    admin: ReturnType<typeof createAdminClient>,
    currentUserId: string,
    formData: FormData
) {
    const mode = String(formData.get("mode") || "").trim();
    const workerId = String(formData.get("worker_id") || "").trim();
    const docId = String(formData.get("doc_id") || "").trim();
    const docType = String(formData.get("doc_type") || "").trim();
    const redirectTo = String(formData.get("redirect_to") || "").trim() || "/admin/workers";

    if (!mode || !workerId || !docId || !docType) {
        return redirectWithAction(request, redirectTo, "error", "Missing document action payload.");
    }

    const reviewContext = await resolveAdminReviewContext(admin, workerId);
    const notificationProfileId = reviewContext.profileId || null;
    const userProfile = await resolveNotificationProfile(admin, notificationProfileId);

    if (mode === "update_status") {
        const status = String(formData.get("status") || "").trim();
        const feedback = String(formData.get("feedback") || "").trim();

        if (!status) {
            return redirectWithAction(request, redirectTo, "error", "Missing document status.");
        }

        const rejectReason = status === "rejected"
            ? (feedback || buildDocumentRequestReason(docType, null, null))
            : null;

        const updatePayload: Record<string, string | null> = {
            status,
            reject_reason: rejectReason,
            updated_at: new Date().toISOString(),
            verified_at: status === "verified" ? new Date().toISOString() : null,
        };

        const updateResult = await admin
            .from("worker_documents")
            .update(updatePayload)
            .eq("id", docId)
            .select("id")
            .maybeSingle();

        if (updateResult.error) {
            return redirectWithAction(request, redirectTo, "error", updateResult.error.message || "Failed to update document status.");
        }

        if (!getMatchedDocumentId(updateResult)) {
            return redirectWithAction(request, redirectTo, "error", "Document not found.");
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

        if (status === "verified" || status === "rejected") {
            await logServerActivity(notificationProfileId || reviewContext.documentOwnerId, status === "verified" ? "document_admin_approved" : "document_admin_rejected", "documents", {
                doc_type: docType,
                admin_id: currentUserId,
                ...(status === "rejected" && rejectReason ? { feedback: rejectReason } : {}),
            });
        }

        let notificationResult: Awaited<ReturnType<typeof queueEmail>> | null = null;
        if ((status === "verified" || status === "rejected") && userProfile?.email && notificationProfileId) {
            notificationResult = await queueEmail(
                admin,
                notificationProfileId,
                "document_review_result",
                userProfile.email,
                userProfile.full_name || "there",
                {
                    approved: status === "verified",
                    docType: humanizeDocumentType(docType),
                    feedback: status === "verified" ? null : rejectReason,
                }
            );
        }

        revalidatePath(redirectTo);
        return redirectWithAction(
            request,
            redirectTo,
            "updated",
            undefined,
            getEmailNotificationResult(notificationResult, userProfile?.email, notificationProfileId)
        );
    }

    if (mode === "request_new_document" || mode === "delete_document") {
        const { data: existingDocument, error: existingDocumentError } = await admin
            .from("worker_documents")
            .select("storage_path, ocr_json")
            .eq("id", docId)
            .maybeSingle();

        if (existingDocumentError) {
            return redirectWithAction(request, redirectTo, "error", existingDocumentError.message);
        }

        if (!existingDocument) {
            return redirectWithAction(request, redirectTo, "error", "Document not found.");
        }

        const storagePathsToDelete = collectDocumentStoragePathsForCleanup(
            existingDocument?.storage_path,
            existingDocument?.ocr_json && typeof existingDocument.ocr_json === "object"
                ? existingDocument.ocr_json as Record<string, unknown>
                : null
        );

        if (storagePathsToDelete.length > 0) {
            await admin.storage
                .from(WORKER_DOCUMENTS_BUCKET)
                .remove(storagePathsToDelete);
        }

        const deleteResult = await admin
            .from("worker_documents")
            .delete()
            .eq("id", docId)
            .select("id")
            .maybeSingle();

        if (deleteResult.error) {
            return redirectWithAction(request, redirectTo, "error", deleteResult.error.message || "Failed to delete document.");
        }

        if (!getMatchedDocumentId(deleteResult)) {
            return redirectWithAction(request, redirectTo, "error", "Document not found.");
        }

        await syncWorkerReviewStatus({
            adminClient: admin,
            profileId: reviewContext.profileId,
            workerId: reviewContext.workerId,
            documentOwnerId: reviewContext.documentOwnerId,
            phoneOptional: !!reviewContext.workerId && !reviewContext.profileId,
            fullNameFallback: reviewContext.fullNameFallback,
        });

        if (mode === "request_new_document") {
            const requestedReason = String(formData.get("reason") || "").trim() || buildDocumentRequestReason(docType, null, null);

            if (notificationProfileId) {
                await logServerActivity(notificationProfileId, "document_reupload_requested", "documents", {
                    doc_type: docType,
                    reason: requestedReason,
                    admin_id: currentUserId,
                }, "warning");
            }

            let notificationResult: Awaited<ReturnType<typeof queueEmail>> | null = null;
            if (userProfile?.email && notificationProfileId) {
                notificationResult = await queueEmail(
                    admin,
                    notificationProfileId,
                    "document_review_result",
                    userProfile.email,
                    userProfile.full_name || "there",
                    {
                        approved: false,
                        docType: humanizeDocumentType(docType),
                        feedback: requestedReason,
                    }
                );
            }

            revalidatePath(redirectTo);
            return redirectWithAction(
                request,
                redirectTo,
                "requested",
                undefined,
                getEmailNotificationResult(notificationResult, userProfile?.email, notificationProfileId)
            );
        }

        revalidatePath(redirectTo);
        return redirectWithAction(request, redirectTo, "deleted");
    }

    return redirectWithAction(request, redirectTo, "error", "Unknown document action.");
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

        const admin = createAdminClient();
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
            const formData = await request.formData();
            return handleStructuredFormAction(request, admin, user.id, formData);
        }

        const { userId, docType, action, feedback } = await request.json();
        if (!userId || !docType || !action) {
            return NextResponse.json({ error: "userId, docType, action required" }, { status: 400 });
        }

        const reviewContext = await resolveAdminReviewContext(admin, userId);
        const notificationProfileId = reviewContext.profileId || null;

        if (action === "approve") {
            // Set to verified
            const approveResult = await admin.from("worker_documents").update({
                status: "verified",
                reject_reason: null,
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq("user_id", reviewContext.documentOwnerId).eq("document_type", docType).select("id").maybeSingle();
            if (approveResult.error) {
                return NextResponse.json({ error: "Failed to update document status" }, { status: 500 });
            }
            if (!getMatchedDocumentId(approveResult)) {
                return NextResponse.json({ error: "Document not found" }, { status: 404 });
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
            const userProfile = await resolveNotificationProfile(admin, notificationProfileId);
            let notificationResult: Awaited<ReturnType<typeof queueEmail>> | null = null;
            if (userProfile?.email && notificationProfileId) {
                const docName = docType.replace(/_/g, " ");
                notificationResult = await queueEmail(
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

            return NextResponse.json({
                ok: true,
                notification: getEmailNotificationResult(notificationResult, userProfile?.email, notificationProfileId),
            });

        } else if (action === "reject") {
            // Set to rejected with admin feedback
            const rejectResult = await admin.from("worker_documents").update({
                status: "rejected",
                reject_reason: feedback || "Document not accepted by admin.",
                updated_at: new Date().toISOString(),
            }).eq("user_id", reviewContext.documentOwnerId).eq("document_type", docType).select("id").maybeSingle();
            if (rejectResult.error) {
                return NextResponse.json({ error: "Failed to update document status" }, { status: 500 });
            }
            if (!getMatchedDocumentId(rejectResult)) {
                return NextResponse.json({ error: "Document not found" }, { status: 404 });
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
            const userProfile = await resolveNotificationProfile(admin, notificationProfileId);
            let notificationResult: Awaited<ReturnType<typeof queueEmail>> | null = null;
            if (userProfile?.email && notificationProfileId) {
                const docName = docType.replace(/_/g, " ");
                notificationResult = await queueEmail(
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

            return NextResponse.json({
                ok: true,
                notification: getEmailNotificationResult(notificationResult, userProfile?.email, notificationProfileId),
            });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[AdminReview] Error:", err);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
