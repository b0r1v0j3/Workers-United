import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPassportData, compareNames } from "@/lib/gemini";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { documentId } = body;

        if (!documentId) {
            return NextResponse.json({ error: "Document ID required" }, { status: 400 });
        }

        // Get document
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
            const { data: profile } = await supabase
                .from("profiles")
                .select("user_type")
                .eq("id", user.id)
                .single();

            if (profile?.user_type !== "admin") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        // Update status to processing
        await supabase
            .from("documents")
            .update({ verification_status: "processing" })
            .eq("id", documentId);

        // Call GPT-4o Vision
        const result = await extractPassportData(document.file_url);

        if (!result.success || !result.data) {
            // Mark for manual review
            await supabase
                .from("documents")
                .update({
                    verification_status: "manual_review",
                    ai_extracted_data: {},
                    ai_confidence_score: result.confidence,
                    ai_notes: result.issues.join("; "),
                    ai_processed_at: new Date().toISOString(),
                })
                .eq("id", documentId);

            return NextResponse.json({
                status: "manual_review",
                issues: result.issues,
                confidence: result.confidence,
            });
        }

        // Compare with signup data
        const signupName = document.candidates?.profiles?.full_name || "";
        const aiName = result.data.full_name;
        const nameMatches = compareNames(aiName, signupName);

        // Determine discrepancies
        const discrepancies: Record<string, { expected: string; found: string }> = {};

        if (!nameMatches) {
            discrepancies.full_name = {
                expected: signupName,
                found: aiName,
            };
        }

        // Check if passport is expired
        const expiryDate = new Date(result.data.expiry_date);
        const isExpired = expiryDate < new Date();

        if (isExpired) {
            discrepancies.expiry = {
                expected: "Valid passport",
                found: `Expired on ${result.data.expiry_date}`,
            };
        }

        // Determine final status
        const hasDiscrepancies = Object.keys(discrepancies).length > 0;
        const highConfidence = result.confidence >= 0.85;

        let verificationStatus: string;
        if (hasDiscrepancies || !highConfidence) {
            verificationStatus = "manual_review";
        } else {
            verificationStatus = "verified";
        }

        // Update document with results
        await supabase
            .from("documents")
            .update({
                verification_status: verificationStatus,
                ai_extracted_data: result.data,
                ai_confidence_score: result.confidence,
                ai_notes: result.issues.length > 0 ? result.issues.join("; ") : null,
                ai_processed_at: new Date().toISOString(),
                name_matches: nameMatches,
                data_discrepancies: discrepancies,
            })
            .eq("id", documentId);

        // If verified, update candidate status
        if (verificationStatus === "verified") {
            // Check if candidate has all required docs verified
            const { data: allDocs } = await supabase
                .from("documents")
                .select("document_type, verification_status")
                .eq("candidate_id", document.candidate_id);

            const passportVerified = allDocs?.some(
                d => d.document_type === "passport" && d.verification_status === "verified"
            );

            // Update candidate record with extracted data if passport verified
            if (passportVerified) {
                await supabase
                    .from("candidates")
                    .update({
                        // Store verified passport data in metadata or specific fields if available
                    })
                    .eq("id", document.candidate_id);
            }
        }

        return NextResponse.json({
            status: verificationStatus,
            extractedData: result.data,
            confidence: result.confidence,
            nameMatches,
            discrepancies,
        });
    } catch (error) {
        console.error("Passport verification error:", error);
        return NextResponse.json(
            { error: "Verification failed" },
            { status: 500 }
        );
    }
}
