import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyOwnedClaimedWorkerByProfileId, getAgencyOwnedWorker } from "@/lib/agencies";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import {
    buildDocumentOrientationOcrPatch,
    detectDocumentBounds,
    detectDocumentOrientation,
    extractPassportData,
    fetchImageAsBase64,
    shouldTrustPassportExpiryExtraction,
    verifyBiometricPhoto,
    verifyDiploma,
} from "@/lib/document-ai";
import sharp from "sharp";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import { buildDocumentRequestReason } from "@/lib/document-review";
import { syncWorkerReviewStatus } from "@/lib/worker-review";
import {
    AGENCY_DRAFT_DOCUMENT_OWNER_KEY,
    resolveAgencyWorkerDocumentOwnerId,
} from "@/lib/agency-draft-documents";
import {
    buildAiOriginalBackupPath,
    buildAutoCropOcrPatch,
    processDocumentImageBuffer,
    resolveDocumentRotationToApply,
    sanitizeDocumentCrop,
    shouldApplyAutoCropForDocument,
} from "@/lib/document-image-processing";

export async function POST(request: Request) {
    // Rate limit: 10 requests per minute per IP (AI verification is expensive)
    const blocked = checkRateLimit(request, strictLimiter);
    if (blocked) return blocked;

    try {
        const supabase = await createClient();
        const { workerId, docType } = await request.json() as {
            workerId?: string;
            docType?: string;
        };
        const requestedWorkerId =
            typeof workerId === "string" && workerId.trim()
                ? workerId.trim()
                : null;
        const normalizedDocType = typeof docType === "string" ? docType.trim() : "";

        if (!requestedWorkerId || !normalizedDocType) {
            return NextResponse.json({ success: false, error: "workerId and docType are required" }, { status: 400 });
        }

        // Auth check: must be logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const adminClient = createAdminClient();
        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        const normalizedUserType = normalizeUserType(profile?.user_type || user.user_metadata?.user_type);
        const isAdmin = normalizedUserType === "admin" || isGodModeUser(user.email);
        let isAgencyOwnedVerification = false;
        let targetWorkerProfileId: string | null = user.id;
        let targetWorkerRecordId: string | null = null;
        let documentOwnerId = user.id;

        if (isAdmin) {
            const { data: adminTargetWorker } = await adminClient
                .from("worker_onboarding")
                .select("id, profile_id, application_data")
                .eq("id", requestedWorkerId)
                .maybeSingle();

            if (adminTargetWorker) {
                targetWorkerRecordId = adminTargetWorker.id;
                targetWorkerProfileId = adminTargetWorker.profile_id || null;
                documentOwnerId = resolveAgencyWorkerDocumentOwnerId(adminTargetWorker)
                    || adminTargetWorker.profile_id
                    || requestedWorkerId;
            } else {
                const { data: draftOwnerWorker } = await adminClient
                    .from("worker_onboarding")
                    .select("id, profile_id")
                    .contains("application_data", { [AGENCY_DRAFT_DOCUMENT_OWNER_KEY]: requestedWorkerId })
                    .maybeSingle();

                if (draftOwnerWorker) {
                    targetWorkerRecordId = draftOwnerWorker.id;
                    targetWorkerProfileId = draftOwnerWorker.profile_id || null;
                    documentOwnerId = requestedWorkerId;
                } else {
                    targetWorkerProfileId = requestedWorkerId;
                    documentOwnerId = requestedWorkerId;
                }
            }
        } else if (normalizedUserType === "agency") {
            if (requestedWorkerId === user.id) {
                return NextResponse.json({ success: false, error: "Use a claimed worker profile for agency verification" }, { status: 400 });
            }

            const { worker: claimedWorker } = await getAgencyOwnedClaimedWorkerByProfileId(adminClient, user.id, requestedWorkerId);
            if (claimedWorker) {
                targetWorkerProfileId = requestedWorkerId;
                targetWorkerRecordId = claimedWorker.id;
                documentOwnerId = requestedWorkerId;
                isAgencyOwnedVerification = true;
            } else {
                const { worker: draftWorker } = await getAgencyOwnedWorker(adminClient, user.id, requestedWorkerId);
                if (!draftWorker) {
                    return NextResponse.json({ success: false, error: "Worker access denied" }, { status: 403 });
                }

                targetWorkerProfileId = draftWorker.profile_id || null;
                targetWorkerRecordId = draftWorker.id;
                documentOwnerId = resolveAgencyWorkerDocumentOwnerId(draftWorker) || "";
                isAgencyOwnedVerification = true;
            }
        } else if (requestedWorkerId !== user.id) {
            return NextResponse.json({ success: false, error: "Worker access denied" }, { status: 403 });
        }
        const activityTargetId = targetWorkerProfileId || targetWorkerRecordId || requestedWorkerId;

        // Use admin client for storage/DB ops when admin is acting on another user's docs
        // This bypasses RLS which would block cross-user storage operations
        const storageClient = isAdmin || isAgencyOwnedVerification ? adminClient : supabase;
        const readClient = isAdmin || isAgencyOwnedVerification ? adminClient : supabase;

        if (!documentOwnerId) {
            return NextResponse.json({ success: false, error: "Document owner not found" }, { status: 404 });
        }

        // 1. Fetch document data
        const { data: document, error: fetchError } = await readClient
            .from("worker_documents")
            .select("*")
            .eq("user_id", documentOwnerId)
            .eq("document_type", normalizedDocType)
            .single();

        if (fetchError || !document) {
            console.error("[Verify] Document not found:", fetchError);
            await logServerActivity(activityTargetId, "verify_document_not_found", "documents", { doc_type: normalizedDocType, error: fetchError?.message }, "error");
            return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
        }

        // 2. Get a signed URL for the uploaded document (short TTL for security)
        const { data: urlData } = await storageClient.storage
            .from(WORKER_DOCUMENTS_BUCKET)
            .createSignedUrl(document.storage_path, 600);

        if (!urlData?.signedUrl) {
            console.error("[Verify] Could not get signed URL");
            return NextResponse.json({ success: false, error: "Could not get document URL" }, { status: 500 });
        }

        let imageUrl = urlData.signedUrl;
        let orientationOcrPatch: Record<string, unknown> = {};

        // 2.5. Convert PDF to image if needed
        try {
            const fileData = await fetchImageAsBase64(imageUrl);
            if (fileData.mimeType === 'application/pdf' || document.storage_path.toLowerCase().endsWith('.pdf')) {
                const pdfBuffer = Buffer.from(fileData.data, 'base64');

                // Convert first page of PDF to JPEG using sharp
                const jpegBuffer = await sharp(pdfBuffer, { density: 200 })
                    .jpeg({ quality: 92 })
                    .toBuffer();

                // Replace PDF with JPEG in storage
                const jpegPath = document.storage_path.replace(/\.pdf$/i, '.jpg');
                await storageClient.storage
                    .from(WORKER_DOCUMENTS_BUCKET)
                    .upload(jpegPath, jpegBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                // Delete old PDF
                await storageClient.storage.from(WORKER_DOCUMENTS_BUCKET).remove([document.storage_path]);

                // Update DB with new path
                await storageClient.from("worker_documents")
                    .update({ storage_path: jpegPath, updated_at: new Date().toISOString() })
                    .eq("id", document.id);

                // Refresh URL
                const { data: jpegUrlData } = await storageClient.storage
                    .from(WORKER_DOCUMENTS_BUCKET)
                    .createSignedUrl(jpegPath, 600);
                imageUrl = jpegUrlData?.signedUrl || imageUrl;
            }
        } catch (pdfErr) {
            console.warn("[Verify] PDF conversion failed, continuing with original:", pdfErr);
        }

        // 2.6. Smart auto-crop + auto-rotate: detect document boundaries and rotation
        try {
            const imageData = await fetchImageAsBase64(imageUrl);
            const orientation = await detectDocumentOrientation(imageData, normalizedDocType);
            const bounds = await detectDocumentBounds(imageData, normalizedDocType);
            const detectedCrop = bounds.found ? sanitizeDocumentCrop(bounds.crop) : null;
            const crop = detectedCrop && shouldApplyAutoCropForDocument(normalizedDocType, detectedCrop)
                ? detectedCrop
                : undefined;
            const autoCropSkippedReason = detectedCrop && !crop
                ? "suspicious_passport_spread_crop"
                : null;
            const rotationToApply = resolveDocumentRotationToApply(
                orientation.rotationDegrees,
                orientation.confidence,
                bounds.rotationDegrees
            );
            const imageBuffer = Buffer.from(imageData.data, "base64");
            const shouldRewriteImage = rotationToApply !== 0 || !!crop;
            let cropApplied = false;
            let aiOriginalStoragePath =
                document.ocr_json
                && typeof document.ocr_json === "object"
                && !Array.isArray(document.ocr_json)
                && typeof (document.ocr_json as Record<string, unknown>).ai_original_storage_path === "string"
                    ? String((document.ocr_json as Record<string, unknown>).ai_original_storage_path).trim() || null
                    : null;

            if (shouldRewriteImage) {
                const { data: currentDoc } = await readClient
                    .from("worker_documents")
                    .select("storage_path")
                    .eq("id", document.id)
                    .single();

                const storagePath = currentDoc?.storage_path || document.storage_path;
                if (!aiOriginalStoragePath) {
                    aiOriginalStoragePath = buildAiOriginalBackupPath(storagePath);
                    const { error: backupError } = await storageClient.storage
                        .from(WORKER_DOCUMENTS_BUCKET)
                        .upload(aiOriginalStoragePath, imageBuffer, {
                            contentType: imageData.mimeType,
                            upsert: true,
                        });

                    if (backupError) {
                        console.warn("[Verify] Failed to preserve AI original before rewrite:", backupError);
                        aiOriginalStoragePath = null;
                    }
                }

                const processed = await processDocumentImageBuffer(imageBuffer, imageData.mimeType, rotationToApply, crop);
                cropApplied = processed.cropApplied;

                await storageClient.storage
                    .from(WORKER_DOCUMENTS_BUCKET)
                    .update(storagePath, processed.buffer, {
                        contentType: processed.contentType,
                        upsert: true
                    });

                const { data: newUrlData } = await storageClient.storage
                    .from(WORKER_DOCUMENTS_BUCKET)
                    .createSignedUrl(storagePath, 600);
                imageUrl = newUrlData?.signedUrl || imageUrl;
            }

            orientationOcrPatch = {
                ...buildDocumentOrientationOcrPatch({
                    detectedRotationDegrees: rotationToApply,
                    appliedRotationDegrees: shouldRewriteImage ? rotationToApply : 0,
                    confidence: orientation.confidence,
                    summary: orientation.summary,
                    cropApplied,
                }),
                ...buildAutoCropOcrPatch({
                    cropApplied,
                    crop: cropApplied ? crop : undefined,
                    backupStoragePath: aiOriginalStoragePath,
                    skipReason: autoCropSkippedReason,
                }),
            };
        } catch (cropErr) {
            console.warn("[Verify] Auto-crop/rotate failed, continuing with original:", cropErr);
        }

        // 3. Perform AI verification based on document type
        let status: 'verified' | 'rejected' | 'manual_review' = 'manual_review';
        let rejectReason: string | null = null;
        let ocrJson: Record<string, unknown> = {};
        let qualityIssues: string[] = [];

        try {
            switch (normalizedDocType) {
                case 'passport': {
                    const result = await extractPassportData(imageUrl);

                    if (result.success && result.data) {
                        status = 'manual_review';
                        ocrJson = {
                            ...result.data,
                            confidence: result.confidence,
                            extracted_at: new Date().toISOString(),
                            ai_recommendation: "approve",
                            review_state: "awaiting_admin_approval",
                            ...(result.documentKind ? { document_kind: result.documentKind } : {}),
                            ...(result.summary ? { summary: result.summary } : {}),
                            ...(result.workerGuidance ? { worker_guidance: result.workerGuidance } : {}),
                            ...(result.issues.length > 0 ? { issues: result.issues } : {}),
                        };
                        qualityIssues = result.issues;

                        // Check passport expiry
                        if (result.data.expiry_date) {
                            const expiryDate = new Date(result.data.expiry_date);
                            const sixMonthsFromNow = new Date();
                            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
                            const autoCropSkippedReason =
                                typeof orientationOcrPatch.auto_crop_skip_reason === "string"
                                    ? orientationOcrPatch.auto_crop_skip_reason
                                    : null;
                            const expiryIsTrusted = shouldTrustPassportExpiryExtraction({
                                confidence: result.confidence,
                                issues: qualityIssues,
                                documentKind: result.documentKind,
                                fullName: result.data.full_name,
                                passportNumber: result.data.passport_number,
                                expiryDate: result.data.expiry_date,
                                autoCropSkippedReason,
                            });

                            if (expiryDate < new Date()) {
                                if (expiryIsTrusted) {
                                    status = 'rejected';
                                    rejectReason = "Your passport has expired. Please upload a valid, non-expired passport.";
                                } else {
                                    status = 'rejected';
                                    qualityIssues = Array.from(new Set([
                                        ...qualityIssues,
                                        autoCropSkippedReason ? "cropped" : "unreadable_fields",
                                    ]));
                                    rejectReason = "Please upload a clearer passport identity page. Place the page flat, avoid glare, and make sure the full page is visible and readable.";
                                }
                            } else if (expiryDate < sixMonthsFromNow && expiryIsTrusted) {
                                qualityIssues.push("Your passport expires within 6 months — this may cause issues with visa processing.");
                            }
                        }

                        // Age check: must be 18 or older
                        if (status !== 'rejected' && result.data.date_of_birth) {
                            try {
                                const dob = new Date(result.data.date_of_birth);
                                const today = new Date();
                                let age = today.getFullYear() - dob.getFullYear();
                                const monthDiff = today.getMonth() - dob.getMonth();
                                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                                    age--;
                                }
                                if (age < 18) {
                                    status = 'rejected';
                                    rejectReason = "You must be at least 18 years old to apply.";
                                }
                            } catch { /* skip age check if date parse fails */ }
                        }

                        // Cross-check passport number: OCR vs manually entered
                        if (status !== 'rejected') {
                            const workerRecord = targetWorkerRecordId
                                ? await adminClient
                                    .from("worker_onboarding")
                                    .select("id, passport_number, updated_at")
                                    .eq("id", targetWorkerRecordId)
                                    .maybeSingle()
                                    .then((result) => result.data)
                                : targetWorkerProfileId
                                    ? await loadCanonicalWorkerRecord(
                                        readClient,
                                        targetWorkerProfileId,
                                        "id, passport_number, updated_at"
                                    ).then((queryResult) => queryResult.data as { id?: string | null; passport_number?: string | null; updated_at?: string | null } | null)
                                    : null;

                            if (workerRecord?.passport_number && result.data.passport_number) {
                                const ocrNum = result.data.passport_number.replace(/\s/g, '').toUpperCase();
                                const manualNum = workerRecord.passport_number.replace(/\s/g, '').toUpperCase();
                                if (ocrNum !== manualNum) {
                                    status = 'manual_review';
                                    qualityIssues.push(`Passport number mismatch: scanned="${ocrNum}" vs entered="${manualNum}"`);
                                    ocrJson.passport_number_verified = false;
                                } else {
                                    ocrJson.passport_number_verified = true;
                                }
                            }
                        }
                    } else {
                        status = 'rejected';
                        qualityIssues = result.issues || [];
                        ocrJson = {
                            issues: result.issues,
                            confidence: result.confidence,
                            ...(result.documentKind ? { document_kind: result.documentKind } : {}),
                            ...(result.summary ? { summary: result.summary } : {}),
                            ...(result.workerGuidance ? { worker_guidance: result.workerGuidance } : {}),
                        };
                        rejectReason = buildDocumentRequestReason("passport", ocrJson);
                    }
                    break;
                }

                case 'biometric_photo': {
                    const result = await verifyBiometricPhoto(imageUrl);

                    if (result.success) {
                        status = 'manual_review';
                        ocrJson = {
                            is_valid: true,
                            confidence: result.confidence,
                            analyzed_at: new Date().toISOString(),
                            ai_recommendation: "approve",
                            review_state: "awaiting_admin_approval",
                            ...(result.documentKind ? { document_kind: result.documentKind } : {}),
                            ...(result.summary ? { summary: result.summary } : {}),
                            ...(result.workerGuidance ? { worker_guidance: result.workerGuidance } : {}),
                            ...(result.qualityIssues.length > 0 ? { issues: result.qualityIssues } : {}),
                        };
                        qualityIssues = result.qualityIssues || [];
                    } else {
                        status = 'rejected';
                        qualityIssues = result.qualityIssues || [];
                        ocrJson = {
                            issues: result.qualityIssues,
                            confidence: result.confidence,
                            ...(result.documentKind ? { document_kind: result.documentKind } : {}),
                            ...(result.summary ? { summary: result.summary } : {}),
                            ...(result.workerGuidance ? { worker_guidance: result.workerGuidance } : {}),
                        };
                        rejectReason = buildDocumentRequestReason("biometric_photo", ocrJson);
                    }
                    break;
                }

                case 'diploma': {
                    const result = await verifyDiploma(imageUrl);

                    if (result.success) {
                        status = 'manual_review';
                        ocrJson = {
                            ...result.extractedData,
                            confidence: result.confidence,
                            analyzed_at: new Date().toISOString(),
                            ai_recommendation: "approve",
                            review_state: "awaiting_admin_approval",
                            ...(result.documentKind ? { document_kind: result.documentKind } : {}),
                            ...(result.summary ? { summary: result.summary } : {}),
                            ...(result.workerGuidance ? { worker_guidance: result.workerGuidance } : {}),
                            ...(result.qualityIssues.length > 0 ? { issues: result.qualityIssues } : {}),
                        };
                    } else {
                        status = 'rejected';
                        qualityIssues = result.qualityIssues || [];
                        ocrJson = {
                            issues: result.qualityIssues,
                            confidence: result.confidence,
                            ...(result.extractedData ? result.extractedData : {}),
                            ...(result.documentKind ? { document_kind: result.documentKind } : {}),
                            ...(result.summary ? { summary: result.summary } : {}),
                            ...(result.workerGuidance ? { worker_guidance: result.workerGuidance } : {}),
                        };
                        rejectReason = buildDocumentRequestReason("diploma", ocrJson);
                    }
                    break;
                }

                default:
                    status = 'manual_review';
                    ocrJson = {
                        note: "No specific verification for this document type",
                        ai_recommendation: "review",
                        review_state: "awaiting_admin_approval",
                    };
            }

        } catch (aiError) {
            console.error("[Verify] AI processing error:", aiError);
            await logServerActivity(activityTargetId, "verify_ai_error", "documents", { doc_type: normalizedDocType, error: aiError instanceof Error ? aiError.message : "Unknown" }, "error");
            // If AI fails, mark for manual review rather than outright rejection
            status = 'manual_review';
            rejectReason = "AI verification temporarily unavailable";
            ocrJson = { error: aiError instanceof Error ? aiError.message : "Unknown AI error" };
        }

        if (Object.keys(orientationOcrPatch).length > 0) {
            ocrJson = {
                ...orientationOcrPatch,
                ...ocrJson,
            };
        }

        // 4. Handle verification result
        if (status === 'rejected') {
            // Keep the file in storage for admin review — do NOT delete
            // Update DB record to rejected so user can re-upload (upsert will overwrite)
            await storageClient
                .from("worker_documents")
                .update({
                    status: 'rejected',
                    reject_reason: rejectReason,
                    ocr_json: ocrJson,
                    updated_at: new Date().toISOString()
                })
                .eq("id", document.id);

            await syncWorkerReviewStatus({
                adminClient,
                profileId: targetWorkerProfileId,
                workerId: targetWorkerRecordId,
                documentOwnerId,
                phoneOptional: isAgencyOwnedVerification && !targetWorkerProfileId,
                notifyOnPendingApproval: true,
            });

            await logServerActivity(activityTargetId, "document_rejected_server", "documents", { doc_type: normalizedDocType, reason: rejectReason, quality_issues: qualityIssues }, "warning");

            return NextResponse.json({
                success: false,
                status: 'rejected',
                message: rejectReason || "Document could not be verified.",
                qualityIssues,
                extractedData: ocrJson
            });
        }

        // 5. Update database with results (AI only ever returns manual_review here; admin approval sets verified later)
        const updateData: Record<string, unknown> = {
            status: status,
            ocr_json: ocrJson,
            reject_reason: rejectReason,
            verified_at: null,
            updated_at: new Date().toISOString()
        };

        // Save structured extracted data for passport
        if (normalizedDocType === 'passport' && ocrJson) {
            updateData.extracted_data = {
                full_name: ocrJson.full_name || '',
                surname: ocrJson.surname || '',
                given_names: ocrJson.given_names || '',
                nationality: ocrJson.nationality || '',
                date_of_birth: ocrJson.date_of_birth || '',
                passport_number: ocrJson.passport_number || '',
                expiry_date: ocrJson.expiry_date || '',
                gender: ocrJson.gender || '',
                place_of_birth: ocrJson.place_of_birth || '',
                extracted_at: new Date().toISOString()
            };
        }

        const { error: updateError } = await storageClient
            .from("worker_documents")
            .update(updateData)
            .eq("id", document.id);

        if (updateError) {
            console.error("[Verify] Database update error:", updateError);
            throw updateError;
        }

        await logServerActivity(
            activityTargetId,
            status === "manual_review" ? "document_review_queued_server" : "document_verified_server",
            "documents",
            { doc_type: normalizedDocType, status, has_quality_issues: qualityIssues.length > 0 }
        );

        let reviewQueued = false;
        try {
            const syncResult = await syncWorkerReviewStatus({
                adminClient,
                profileId: targetWorkerProfileId,
                workerId: targetWorkerRecordId,
                documentOwnerId,
                phoneOptional: isAgencyOwnedVerification && !targetWorkerProfileId,
                notifyOnPendingApproval: true,
            });
            reviewQueued = syncResult.reviewQueued;
        } catch (syncError) {
            console.warn("[Verify] Review status sync failed:", syncError);
        }

        return NextResponse.json({
            success: true,
            status,
            message: status === 'manual_review'
                ? 'AI review complete. Your document is now waiting for admin approval.'
                : 'Document verified successfully! ✓',
            qualityIssues,
            extractedData: ocrJson,
            reviewQueued,
        });

    } catch (err) {
        console.error("[Verify] Pipeline error:", err);
        return NextResponse.json({
            success: false,
            error: "Internal server error",
            details: err instanceof Error ? err.message : "Unknown error"
        }, { status: 500 });
    }
}
