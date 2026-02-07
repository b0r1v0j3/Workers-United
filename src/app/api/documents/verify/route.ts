import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    extractPassportData,
    compareNames,
    verifyDiploma,
    verifyBiometricPhoto
} from "@/lib/gemini";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { documentId, documentType } = body;

        if (!documentId) {
            return NextResponse.json({ error: "Document ID required" }, { status: 400 });
        }

        // Get document with candidate info
        const { data: document, error: docError } = await supabase
            .from("documents")
            .select(`
                *,
                candidates(*, profiles(*))
            `)
            .eq("id", documentId)
            .single();

        if (docError || !document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // Verify ownership
        if (document.candidates?.profile_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Update status to processing
        await supabase
            .from("documents")
            .update({ verification_status: "processing" })
            .eq("id", documentId);

        let verificationResult;
        let qualityIssues: string[] = [];
        let extractedData: Record<string, unknown> = {};
        let confidence = 0;

        // Route to appropriate verification based on document type
        switch (documentType || document.document_type) {
            case "passport":
                verificationResult = await verifyPassport(document, supabase);
                break;

            case "biometric_photo":
                verificationResult = await verifyPhoto(document);
                break;

            case "diploma":
                verificationResult = await verifyEducation(document);
                break;

            default:
                // Generic acceptance for unknown types
                verificationResult = {
                    status: "verified",
                    qualityIssues: [],
                    extractedData: {},
                    confidence: 1.0
                };
        }

        qualityIssues = verificationResult.qualityIssues || [];
        extractedData = verificationResult.extractedData || {};
        confidence = verificationResult.confidence || 0;

        // Update document with results
        await supabase
            .from("documents")
            .update({
                verification_status: verificationResult.status,
                ai_extracted_data: extractedData,
                ai_confidence_score: confidence,
                ai_notes: qualityIssues.length > 0 ? qualityIssues.join("; ") : null,
                ai_processed_at: new Date().toISOString(),
            })
            .eq("id", documentId);

        // Return quality issues if any (for immediate user feedback)
        if (qualityIssues.length > 0 && verificationResult.status !== "verified") {
            return NextResponse.json({
                status: verificationResult.status,
                qualityIssues,
                confidence
            });
        }

        return NextResponse.json({
            status: verificationResult.status,
            extractedData,
            confidence,
        });

    } catch (error) {
        console.error("Document verification error:", error);
        return NextResponse.json(
            { error: "Verification failed" },
            { status: 500 }
        );
    }
}

// Passport verification with expiry check
async function verifyPassport(
    document: { file_url: string; candidate_id: string; candidates?: { profiles?: { full_name?: string } } },
    supabase: Awaited<ReturnType<typeof createClient>>
) {
    const result = await extractPassportData(document.file_url);

    if (!result.success || !result.data) {
        return {
            status: "manual_review",
            qualityIssues: result.issues,
            extractedData: {},
            confidence: result.confidence
        };
    }

    const qualityIssues: string[] = [];

    // Check passport expiry (must be valid for at least 6 months)
    const expiryDate = new Date(result.data.expiry_date);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    if (expiryDate < new Date()) {
        qualityIssues.push("Passport has expired");
    } else if (expiryDate < sixMonthsFromNow) {
        qualityIssues.push("Passport expires within 6 months - may cause visa issues");
    }

    // Check name match
    const signupName = document.candidates?.profiles?.full_name || "";
    const nameMatches = compareNames(result.data.full_name, signupName);

    if (!nameMatches && signupName) {
        qualityIssues.push("Name does not match your profile");
    }

    // Determine status
    const isVerified = qualityIssues.length === 0 && result.confidence >= 0.85;

    return {
        status: isVerified ? "verified" : "manual_review",
        qualityIssues,
        extractedData: result.data,
        confidence: result.confidence
    };
}

// Biometric photo verification
async function verifyPhoto(document: { file_url: string }) {
    const result = await verifyBiometricPhoto(document.file_url);

    return {
        status: result.success ? "verified" : "manual_review",
        qualityIssues: result.qualityIssues,
        extractedData: {},
        confidence: result.confidence
    };
}

// Diploma/certificate verification with quality check
async function verifyEducation(document: { file_url: string }) {
    const result = await verifyDiploma(document.file_url);

    const qualityIssues = [...result.qualityIssues];

    // Add specific flags for wrong document type
    if (!result.isCorrectType) {
        qualityIssues.unshift("This does not appear to be a diploma or certificate");
    }

    return {
        status: result.success ? "verified" : "manual_review",
        qualityIssues,
        extractedData: result.extractedData || {},
        confidence: result.confidence
    };
}
