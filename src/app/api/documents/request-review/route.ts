import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyOwnedClaimedWorkerByProfileId, getAgencyOwnedWorker } from "@/lib/agencies";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { checkRateLimit, standardLimiter } from "@/lib/rate-limit";
import { AGENCY_DRAFT_DOCUMENT_OWNER_KEY, resolveAgencyWorkerDocumentOwnerId } from "@/lib/agency-draft-documents";
import { buildPlatformUrl } from "@/lib/platform-contact";

// ─── Request Manual Review ──────────────────────────────────────────────────
// When AI rejects a document but user believes it's correct,
// they can request manual admin review.

export async function POST(request: Request) {
    const blocked = checkRateLimit(request, standardLimiter);
    if (blocked) {
        return blocked;
    }

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { docType, workerId } = await request.json() as {
            docType?: string;
            workerId?: string;
        };
        const normalizedDocType = typeof docType === "string" ? docType.trim() : "";
        const requestedWorkerId =
            typeof workerId === "string" && workerId.trim()
                ? workerId.trim()
                : user.id;

        if (!normalizedDocType) {
            return NextResponse.json({ error: "docType required" }, { status: 400 });
        }

        const admin = createAdminClient();
        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type, full_name")
            .eq("id", user.id)
            .maybeSingle();

        const normalizedUserType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        const isAdmin = normalizedUserType === "admin" || isGodModeUser(user.email);
        let targetProfileId = user.id;
        let documentOwnerId = user.id;
        let requestedByAgency = false;
        let agencyName: string | null = null;
        let workerLabelOverride: string | null = null;

        if (isAdmin) {
            const { data: adminTargetWorker } = await admin
                .from("worker_onboarding")
                .select("id, profile_id, application_data, submitted_full_name")
                .eq("id", requestedWorkerId)
                .maybeSingle();

            if (adminTargetWorker) {
                targetProfileId = adminTargetWorker.profile_id || requestedWorkerId;
                documentOwnerId = resolveAgencyWorkerDocumentOwnerId(adminTargetWorker) || requestedWorkerId;
                workerLabelOverride = adminTargetWorker.submitted_full_name || null;
            } else {
                const { data: draftOwnerWorker } = await admin
                    .from("worker_onboarding")
                    .select("id, profile_id, submitted_full_name")
                    .contains("application_data", { [AGENCY_DRAFT_DOCUMENT_OWNER_KEY]: requestedWorkerId })
                    .maybeSingle();

                if (draftOwnerWorker) {
                    targetProfileId = draftOwnerWorker.profile_id || requestedWorkerId;
                    documentOwnerId = requestedWorkerId;
                    workerLabelOverride = draftOwnerWorker.submitted_full_name || null;
                } else {
                    targetProfileId = requestedWorkerId;
                    documentOwnerId = requestedWorkerId;
                }
            }
        } else if (normalizedUserType === "agency") {
            if (!workerId) {
                return NextResponse.json({ error: "workerId required for agency review requests" }, { status: 400 });
            }

            const { agency, worker } = await getAgencyOwnedClaimedWorkerByProfileId(admin, user.id, requestedWorkerId);
            if (worker) {
                targetProfileId = requestedWorkerId;
                documentOwnerId = requestedWorkerId;
                requestedByAgency = true;
                agencyName = agency?.display_name || agency?.legal_name || null;
            } else {
                const draftContext = await getAgencyOwnedWorker(admin, user.id, requestedWorkerId);
                if (!draftContext.worker) {
                    return NextResponse.json({ error: "Worker access denied" }, { status: 403 });
                }

                targetProfileId = draftContext.worker.profile_id || requestedWorkerId;
                documentOwnerId = resolveAgencyWorkerDocumentOwnerId(draftContext.worker) || "";
                requestedByAgency = true;
                agencyName = draftContext.agency?.display_name || draftContext.agency?.legal_name || null;
                workerLabelOverride = draftContext.worker.submitted_full_name || "Agency worker";
            }
        } else if (requestedWorkerId !== user.id) {
            return NextResponse.json({ error: "Worker access denied" }, { status: 403 });
        }

        if (!documentOwnerId) {
            return NextResponse.json({ error: "Document owner not found" }, { status: 404 });
        }

        const { data: document, error: documentError } = await admin
            .from("worker_documents")
            .select("id, status")
            .eq("user_id", documentOwnerId)
            .eq("document_type", normalizedDocType)
            .maybeSingle();

        if (documentError) {
            console.error("[RequestReview] Document lookup error:", documentError);
            return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
        }

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        if (document.status === "manual_review") {
            return NextResponse.json({ ok: true, state: "already_pending" });
        }

        if (document.status !== "rejected") {
            return NextResponse.json({ error: "Manual review is only available for rejected documents" }, { status: 400 });
        }

        // Update document status to manual_review
        const { error } = await admin
            .from("worker_documents")
            .update({
                status: "manual_review",
                updated_at: new Date().toISOString(),
            })
            .eq("id", document.id);

        if (error) {
            console.error("[RequestReview] DB error:", error);
            return NextResponse.json({ error: "Failed to update" }, { status: 500 });
        }

        await logServerActivity(targetProfileId, "document_manual_review_requested", "documents", {
            doc_type: normalizedDocType,
            requested_by_profile_id: user.id,
            requested_by_role: normalizedUserType,
            requested_by_agency: requestedByAgency,
        });

        // Notify admin via email
        try {
            const { data: targetProfile } = await admin
                .from("profiles")
                .select("full_name, email")
                .eq("id", targetProfileId)
                .maybeSingle();
            const { queueEmail } = await import("@/lib/email-templates");
            const workerLabel = workerLabelOverride || targetProfile?.full_name || targetProfile?.email || user.email || "Worker";
            const requesterLabel = profile?.full_name || user.email || "User";
            const docLabel = normalizedDocType.replace("_", " ");
            const requestContext = requestedByAgency
                ? `${requesterLabel}${agencyName ? ` (${agencyName})` : ""} requested manual review on behalf of ${workerLabel}.`
                : `${workerLabel} is requesting manual review for their ${docLabel}.`;

            await queueEmail(
                admin,
                targetProfileId,
                "admin_update",
                process.env.ADMIN_EMAIL || "contact@workersunited.eu",
                "Admin",
                {
                    subject: `Manual Review Needed: ${docLabel} for ${workerLabel}`,
                    title: "Document Review Request",
                    message: `${requestContext}\n\nThe AI verification rejected it and a manual review is now requested.\n\nPlease review it in the admin panel.`,
                    actionLink: buildPlatformUrl(process.env.NEXT_PUBLIC_BASE_URL, "/admin/review"),
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
