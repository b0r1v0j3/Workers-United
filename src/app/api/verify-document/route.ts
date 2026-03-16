import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyOwnedClaimedWorkerByProfileId, getAgencyOwnedWorker } from "@/lib/agencies";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import { extractPassportData, verifyBiometricPhoto, verifyDiploma, detectDocumentBounds, fetchImageAsBase64 } from "@/lib/document-ai";
import sharp from "sharp";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { getPendingApprovalTargetStatus } from "@/lib/worker-review";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";
import {
    AGENCY_DRAFT_DOCUMENT_OWNER_KEY,
    resolveAgencyWorkerDocumentOwnerId,
} from "@/lib/agency-draft-documents";

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
            const bounds = await detectDocumentBounds(imageUrl, normalizedDocType);
            const needsRotation = bounds.found && bounds.rotationDegrees && bounds.rotationDegrees !== 0;
            const needsCropping = bounds.found && bounds.crop;

            if (needsRotation || needsCropping) {
                // Download the image
                const imageData = await fetchImageAsBase64(imageUrl);
                const imageBuffer = Buffer.from(imageData.data, 'base64');

                let pipeline = sharp(imageBuffer).rotate(); // EXIF auto-rotate first

                // Apply content rotation if AI detected sideways/upside-down
                if (needsRotation) {
                    pipeline = sharp(await pipeline.toBuffer()).rotate(bounds.rotationDegrees!);
                }

                // Apply crop if needed
                if (needsCropping) {
                    // Get dimensions AFTER rotation
                    const rotatedBuffer = await pipeline.toBuffer();
                    const metadata = await sharp(rotatedBuffer).metadata();
                    const imgW = metadata.width || 1;
                    const imgH = metadata.height || 1;

                    const cropX = Math.round((bounds.crop!.x / 100) * imgW);
                    const cropY = Math.round((bounds.crop!.y / 100) * imgH);
                    const cropW = Math.min(Math.round((bounds.crop!.width / 100) * imgW), imgW - cropX);
                    const cropH = Math.min(Math.round((bounds.crop!.height / 100) * imgH), imgH - cropY);

                    if (cropW > 50 && cropH > 50) {
                        pipeline = sharp(rotatedBuffer).extract({
                            left: cropX, top: cropY, width: cropW, height: cropH
                        });
                    } else {
                        pipeline = sharp(rotatedBuffer);
                    }
                }

                const processedBuffer = await pipeline.jpeg({ quality: 92 }).toBuffer();

                // Get current storage path (may have changed from PDF conversion)
                const { data: currentDoc } = await readClient
                    .from("worker_documents")
                    .select("storage_path")
                    .eq("id", document.id)
                    .single();

                const storagePath = currentDoc?.storage_path || document.storage_path;

                // Replace in storage
                await storageClient.storage
                    .from(WORKER_DOCUMENTS_BUCKET)
                    .update(storagePath, processedBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                // Refresh URL
                const { data: newUrlData } = await storageClient.storage
                    .from(WORKER_DOCUMENTS_BUCKET)
                    .createSignedUrl(storagePath, 600);
                imageUrl = newUrlData?.signedUrl || imageUrl;
            }
        } catch (cropErr) {
            console.warn("[Verify] Auto-crop/rotate failed, continuing with original:", cropErr);
        }

        // 3. Perform AI verification based on document type
        let status: 'verified' | 'rejected' | 'manual_review' = 'verified';
        let rejectReason: string | null = null;
        let ocrJson: Record<string, unknown> = {};
        let qualityIssues: string[] = [];

        try {
            switch (normalizedDocType) {
                case 'passport': {
                    const result = await extractPassportData(imageUrl);

                    if (result.success && result.data) {
                        status = 'verified';
                        ocrJson = {
                            ...result.data,
                            confidence: result.confidence,
                            extracted_at: new Date().toISOString()
                        };

                        // Check passport expiry
                        if (result.data.expiry_date) {
                            const expiryDate = new Date(result.data.expiry_date);
                            const sixMonthsFromNow = new Date();
                            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

                            if (expiryDate < new Date()) {
                                status = 'rejected';
                                rejectReason = "Your passport has expired. Please upload a valid, non-expired passport.";
                            } else if (expiryDate < sixMonthsFromNow) {
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
                                    ).then((result) => result.data)
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
                        // Provide helpful guidance instead of raw error
                        const issues = result.issues || [];
                        if (issues.some((i: string) => i.toLowerCase().includes('not a passport'))) {
                            rejectReason = "This doesn't appear to be a passport photo page. Please upload a clear photo of the page with your name, photo, and passport number.";
                        } else if (issues.some((i: string) => i.toLowerCase().includes('blurry') || i.toLowerCase().includes('unclear'))) {
                            rejectReason = "The image is too blurry. Please take a clear, well-lit photo of your passport flat on a surface.";
                        } else {
                            rejectReason = "We couldn't read your passport. Tips: place it flat on a surface, ensure good lighting, and capture the full page with your photo and details.";
                        }
                        ocrJson = { issues: result.issues, confidence: result.confidence };
                    }
                    break;
                }

                case 'biometric_photo': {
                    const result = await verifyBiometricPhoto(imageUrl);

                    if (result.success) {
                        status = 'verified';
                        ocrJson = {
                            is_valid: true,
                            confidence: result.confidence,
                            analyzed_at: new Date().toISOString()
                        };
                    } else {
                        status = 'rejected';
                        // Provide helpful guidance for biometric photo
                        const issues = result.qualityIssues || [];
                        if (issues.some((i: string) => i.toLowerCase().includes('no face'))) {
                            rejectReason = "We couldn't detect a face in your photo. Please take a clear front-facing selfie or passport-style photo with your face clearly visible.";
                        } else if (issues.some((i: string) => i.toLowerCase().includes('multiple'))) {
                            rejectReason = "Multiple people detected. Please upload a photo of only yourself.";
                        } else if (issues.some((i: string) => i.toLowerCase().includes('blurry') || i.toLowerCase().includes('dark'))) {
                            rejectReason = "Photo is too blurry or dark. Please take it in good lighting and hold your phone steady.";
                        } else {
                            rejectReason = "Photo doesn't meet requirements. Please take a clear front-facing photo with good lighting and a plain background.";
                        }
                        qualityIssues = issues;
                        ocrJson = { issues: result.qualityIssues, confidence: result.confidence };
                    }
                    break;
                }

                case 'diploma': {
                    const result = await verifyDiploma(imageUrl);

                    if (result.success) {
                        status = 'verified';
                        ocrJson = {
                            ...result.extractedData,
                            confidence: result.confidence,
                            analyzed_at: new Date().toISOString()
                        };
                    } else {
                        // Reject wrong document types — worker must upload a real school diploma
                        status = 'rejected';
                        rejectReason = !result.isCorrectType
                            ? "This does not appear to be a school diploma. Please upload your high school or university diploma."
                            : result.qualityIssues?.join(", ") || "Could not verify diploma";
                        qualityIssues = result.qualityIssues || [];
                        ocrJson = { issues: result.qualityIssues, confidence: result.confidence };
                    }
                    break;
                }

                default:
                    // Unknown document types - accept by default
                    status = 'verified';
                    ocrJson = { note: "No specific verification for this document type" };
            }

        } catch (aiError) {
            console.error("[Verify] AI processing error:", aiError);
            await logServerActivity(activityTargetId, "verify_ai_error", "documents", { doc_type: normalizedDocType, error: aiError instanceof Error ? aiError.message : "Unknown" }, "error");
            // If AI fails, mark for manual review rather than outright rejection
            status = 'manual_review';
            rejectReason = "AI verification temporarily unavailable";
            ocrJson = { error: aiError instanceof Error ? aiError.message : "Unknown AI error" };
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

            await logServerActivity(activityTargetId, "document_rejected_server", "documents", { doc_type: normalizedDocType, reason: rejectReason, quality_issues: qualityIssues }, "warning");

            return NextResponse.json({
                success: false,
                status: 'rejected',
                message: rejectReason || "Document could not be verified.",
                qualityIssues,
                extractedData: ocrJson
            });
        }

        // 5. Update database with results (only for verified/manual_review)
        const updateData: Record<string, unknown> = {
            status: status,
            ocr_json: ocrJson,
            reject_reason: rejectReason,
            verified_at: status === 'verified' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        };

        // Save structured extracted data for passport
        if (normalizedDocType === 'passport' && ocrJson && status === 'verified') {
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

        await logServerActivity(activityTargetId, "document_verified_server", "documents", { doc_type: normalizedDocType, status, has_quality_issues: qualityIssues.length > 0 });

        // Auto-check: if all 3 docs are verified, update worker status to VERIFIED
        let reviewQueued = false;
        if (status === 'verified') {
            try {
                const { data: allDocs, error: allDocsError } = await readClient
                    .from("worker_documents")
                    .select("document_type, status")
                    .eq("user_id", documentOwnerId);
                if (allDocsError) throw allDocsError;

                const verifiedTypes = new Set((allDocs || []).filter(d => d.status === 'verified').map(d => d.document_type));
                const allThreeVerified = verifiedTypes.has('passport') && verifiedTypes.has('biometric_photo') && verifiedTypes.has('diploma');

                if (allThreeVerified) {
                    const workerRecord = targetWorkerRecordId
                        ? await adminClient
                            .from("worker_onboarding")
                            .select("id, profile_id, submitted_full_name, status, admin_approved, entry_fee_paid, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, passport_issued_by, passport_issue_date, passport_expiry_date, lives_abroad, previous_visas, family_data")
                            .eq("id", targetWorkerRecordId)
                            .maybeSingle()
                            .then((result) => result.data)
                        : targetWorkerProfileId
                            ? await loadCanonicalWorkerRecord(
                                adminClient,
                                targetWorkerProfileId,
                                "id, profile_id, submitted_full_name, status, admin_approved, entry_fee_paid, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, passport_issued_by, passport_issue_date, passport_expiry_date, lives_abroad, previous_visas, family_data"
                            ).then((result) => result.data)
                            : null;

                    const profileLike = targetWorkerProfileId
                        ? await readClient
                            .from("profiles")
                            .select("full_name, email")
                            .eq("id", targetWorkerProfileId)
                            .maybeSingle()
                            .then((result) => result.data)
                        : { full_name: workerRecord?.submitted_full_name || "Worker", email: null };

                    const completion = getWorkerCompletion({
                        profile: profileLike,
                        worker: workerRecord,
                        documents: allDocs || [],
                    }, { phoneOptional: isAgencyOwnedVerification && !targetWorkerProfileId }).completion;
                    const targetStatus = getPendingApprovalTargetStatus({
                        completion,
                        entryFeePaid: workerRecord?.entry_fee_paid,
                        adminApproved: !!workerRecord?.admin_approved,
                        currentStatus: workerRecord?.status,
                    });
                    const nextStatus = targetStatus || "VERIFIED";
                    reviewQueued = nextStatus === "PENDING_APPROVAL";

                    if (targetWorkerRecordId) {
                        await storageClient
                            .from("worker_onboarding")
                            .update({ status: nextStatus, updated_at: new Date().toISOString() })
                            .eq("id", targetWorkerRecordId);
                    } else if (targetWorkerProfileId) {
                        await storageClient
                            .from("worker_onboarding")
                            .update({ status: nextStatus, updated_at: new Date().toISOString() })
                            .eq("profile_id", targetWorkerProfileId);
                    }

                    await logServerActivity(activityTargetId, "all_documents_verified", "documents", {
                        message: nextStatus === "PENDING_APPROVAL"
                            ? "All 3 documents verified and profile is ready for admin review."
                            : "All 3 documents verified — worker status updated to VERIFIED",
                    });
                }
            } catch (checkErr) {
                console.warn("[Verify] All-docs check failed:", checkErr);
            }
        }

        return NextResponse.json({
            success: true,
            status,
            message: status === 'verified'
                ? 'Document verified successfully! ✓'
                : 'Document needs manual review',
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
