import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { extractPassportData, verifyBiometricPhoto, verifyDiploma, detectDocumentBounds, fetchImageAsBase64 } from "@/lib/gemini";
import sharp from "sharp";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";

export async function POST(request: Request) {
    // Rate limit: 10 requests per minute per IP (AI verification is expensive)
    const blocked = checkRateLimit(request, strictLimiter);
    if (blocked) return blocked;

    try {
        const supabase = await createClient();
        const { candidateId, docType } = await request.json();

        // Auth check: must be logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // IDOR fix: check if user is admin; if not, force candidateId to authenticated user
        let isAdmin = false;
        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type === "admin" || isGodModeUser(user.email)) {
            isAdmin = true;
        }

        // Non-admin users can ONLY verify their own documents
        const safeCandidateId = isAdmin ? candidateId : user.id;

        // Use admin client for storage/DB ops when admin is acting on another user's docs
        // This bypasses RLS which would block cross-user storage operations
        const storageClient = isAdmin ? createAdminClient() : supabase;

        // 1. Fetch document data
        const { data: document, error: fetchError } = await supabase
            .from("candidate_documents")
            .select("*")
            .eq("user_id", safeCandidateId)
            .eq("document_type", docType)
            .single();

        if (fetchError || !document) {
            console.error("[Verify] Document not found:", fetchError);
            await logServerActivity(safeCandidateId, "verify_document_not_found", "documents", { doc_type: docType, error: fetchError?.message }, "error");
            return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
        }

        // 2. Get a signed URL for the uploaded document (short TTL for security)
        const { data: urlData } = await supabase.storage
            .from("candidate-docs")
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
                    .from("candidate-docs")
                    .upload(jpegPath, jpegBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                // Delete old PDF
                await storageClient.storage.from("candidate-docs").remove([document.storage_path]);

                // Update DB with new path
                await storageClient.from("candidate_documents")
                    .update({ storage_path: jpegPath, updated_at: new Date().toISOString() })
                    .eq("user_id", safeCandidateId)
                    .eq("document_type", docType);

                // Refresh URL
                const { data: jpegUrlData } = await supabase.storage
                    .from("candidate-docs")
                    .createSignedUrl(jpegPath, 600);
                imageUrl = jpegUrlData?.signedUrl || imageUrl;
            }
        } catch (pdfErr) {
            console.warn("[Verify] PDF conversion failed, continuing with original:", pdfErr);
        }

        // 2.6. Smart auto-crop + auto-rotate: detect document boundaries and rotation
        try {
            const bounds = await detectDocumentBounds(imageUrl, docType);
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
                const { data: currentDoc } = await supabase
                    .from("candidate_documents")
                    .select("storage_path")
                    .eq("user_id", safeCandidateId)
                    .eq("document_type", docType)
                    .single();

                const storagePath = currentDoc?.storage_path || document.storage_path;

                // Replace in storage
                await storageClient.storage
                    .from("candidate-docs")
                    .update(storagePath, processedBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                // Refresh URL
                const { data: newUrlData } = await supabase.storage
                    .from("candidate-docs")
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
            switch (docType) {
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
                            const { data: candidate } = await supabase
                                .from("candidates")
                                .select("passport_number")
                                .eq("user_id", safeCandidateId)
                                .single();

                            if (candidate?.passport_number && result.data.passport_number) {
                                const ocrNum = result.data.passport_number.replace(/\s/g, '').toUpperCase();
                                const manualNum = candidate.passport_number.replace(/\s/g, '').toUpperCase();
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
            await logServerActivity(safeCandidateId, "verify_ai_error", "documents", { doc_type: docType, error: aiError instanceof Error ? aiError.message : "Unknown" }, "error");
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
                .from("candidate_documents")
                .update({
                    status: 'rejected',
                    reject_reason: rejectReason,
                    ocr_json: ocrJson,
                    updated_at: new Date().toISOString()
                })
                .eq("user_id", safeCandidateId)
                .eq("document_type", docType);

            await logServerActivity(safeCandidateId, "document_rejected_server", "documents", { doc_type: docType, reason: rejectReason, quality_issues: qualityIssues }, "warning");

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
        if (docType === 'passport' && ocrJson && status === 'verified') {
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
            .from("candidate_documents")
            .update(updateData)
            .eq("user_id", safeCandidateId)
            .eq("document_type", docType);

        if (updateError) {
            console.error("[Verify] Database update error:", updateError);
            throw updateError;
        }

        await logServerActivity(safeCandidateId, "document_verified_server", "documents", { doc_type: docType, status, has_quality_issues: qualityIssues.length > 0 });

        // Auto-check: if all 3 docs are verified, update candidate status to VERIFIED
        if (status === 'verified') {
            try {
                const { data: allDocs } = await supabase
                    .from("candidate_documents")
                    .select("document_type, status")
                    .eq("user_id", safeCandidateId);

                const verifiedTypes = new Set((allDocs || []).filter(d => d.status === 'verified').map(d => d.document_type));
                const allThreeVerified = verifiedTypes.has('passport') && verifiedTypes.has('biometric_photo') && verifiedTypes.has('diploma');

                if (allThreeVerified) {
                    // Update candidate status
                    await storageClient.from("candidates").update({
                        status: 'VERIFIED',
                    }).eq('profile_id', safeCandidateId);

                    await logServerActivity(safeCandidateId, "all_documents_verified", "documents", { message: "All 3 documents verified — worker status updated to VERIFIED" });

                    // Notify admin via email
                    try {
                        const { data: userProfile } = await supabase.from("profiles").select("full_name, email").eq("id", safeCandidateId).single();
                        const { queueEmail } = await import("@/lib/email-templates");
                        await queueEmail(
                            storageClient,
                            safeCandidateId,
                            "admin_update",
                            process.env.ADMIN_EMAIL || "contact@workersunited.eu",
                            "Workers United Admin",
                            {
                                subject: `New worker ready: ${userProfile?.full_name || userProfile?.email || "Unknown"}`,
                                message: `${userProfile?.full_name || "A worker"} (${userProfile?.email}) has completed all 3 document verifications and is ready for admin approval.`,
                                actionLink: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://workersunited.eu'}/admin/workers`,
                                actionText: "Review in Admin Panel"
                            }
                        );
                    } catch (emailErr) {
                        console.warn("[Verify] Could not notify admin:", emailErr);
                    }
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
            extractedData: ocrJson
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
