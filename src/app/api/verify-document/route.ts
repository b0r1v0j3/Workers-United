import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPassportData, verifyBiometricPhoto, verifyDiploma } from "@/lib/openai";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { candidateId, docType } = await request.json();

        console.log(`[Verify] Starting verification for ${docType} of candidate ${candidateId}`);

        // 1. Fetch document data
        const { data: document, error: fetchError } = await supabase
            .from("candidate_documents")
            .select("*")
            .eq("user_id", candidateId)
            .eq("document_type", docType)
            .single();

        if (fetchError || !document) {
            console.error("[Verify] Document not found:", fetchError);
            return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
        }

        console.log(`[Verify] Found document with storage_path: ${document.storage_path}`);

        // 2. Get the public URL for the uploaded document
        const { data: urlData } = supabase.storage
            .from("candidate-docs")
            .getPublicUrl(document.storage_path);

        if (!urlData?.publicUrl) {
            console.error("[Verify] Could not get public URL");
            return NextResponse.json({ success: false, error: "Could not get document URL" }, { status: 500 });
        }

        const imageUrl = urlData.publicUrl;
        console.log(`[Verify] Document URL: ${imageUrl}`);

        // 3. Perform AI verification based on document type
        let status: 'verified' | 'rejected' | 'manual_review' = 'verified';
        let rejectReason: string | null = null;
        let ocrJson: Record<string, unknown> = {};
        let qualityIssues: string[] = [];

        try {
            switch (docType) {
                case 'passport': {
                    console.log("[Verify] Running passport extraction with GPT-4o Vision...");
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
                                rejectReason = "Passport has expired";
                            } else if (expiryDate < sixMonthsFromNow) {
                                qualityIssues.push("Passport expires within 6 months");
                            }
                        }
                    } else {
                        status = 'rejected';
                        rejectReason = result.issues?.join(", ") || "Could not read passport";
                        ocrJson = { issues: result.issues, confidence: result.confidence };
                    }
                    break;
                }

                case 'biometric_photo': {
                    console.log("[Verify] Running biometric photo analysis with GPT-4o Vision...");
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
                        rejectReason = result.qualityIssues?.join(", ") || "Photo does not meet requirements";
                        qualityIssues = result.qualityIssues || [];
                        ocrJson = { issues: result.qualityIssues, confidence: result.confidence };
                    }
                    break;
                }

                case 'diploma': {
                    console.log("[Verify] Running diploma verification with GPT-4o Vision...");
                    const result = await verifyDiploma(imageUrl);

                    if (result.success) {
                        status = 'verified';
                        ocrJson = {
                            ...result.extractedData,
                            confidence: result.confidence,
                            analyzed_at: new Date().toISOString()
                        };
                    } else {
                        // Diploma is optional, so just mark as manual review instead of reject
                        status = 'manual_review';
                        rejectReason = result.qualityIssues?.join(", ") || "Could not verify diploma";
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

            console.log(`[Verify] Verification complete: status=${status}`);

        } catch (aiError) {
            console.error("[Verify] AI processing error:", aiError);
            // If AI fails, mark for manual review rather than outright rejection
            status = 'manual_review';
            rejectReason = "AI verification temporarily unavailable";
            ocrJson = { error: aiError instanceof Error ? aiError.message : "Unknown AI error" };
        }

        // 4. Update database with results
        const { error: updateError } = await supabase
            .from("candidate_documents")
            .update({
                status: status,
                ocr_json: ocrJson,
                reject_reason: rejectReason,
                verified_at: status === 'verified' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", candidateId)
            .eq("document_type", docType);

        if (updateError) {
            console.error("[Verify] Database update error:", updateError);
            throw updateError;
        }

        return NextResponse.json({
            success: true,
            status,
            message: status === 'verified'
                ? 'Document verified successfully'
                : status === 'manual_review'
                    ? 'Document needs manual review'
                    : `Verification failed: ${rejectReason}`,
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
