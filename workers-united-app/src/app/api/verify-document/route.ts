import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { candidateId, docType } = await request.json();

        // 1. Fetch document data
        const { data: document, error: fetchError } = await supabase
            .from("candidate_documents")
            .select("*")
            .eq("user_id", candidateId)
            .eq("document_type", docType)
            .single();

        if (fetchError || !document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // 2. Perform mock verification (Stub)
        // In a real pipeline, you would fetch from storage and call an OCR service here.
        console.log(`Starting server-side verification for ${docType} of candidate ${candidateId}`);

        // Simulating processing time
        await new Promise(resolve => setTimeout(resolve, 2000));

        let status: 'verified' | 'rejected' = 'verified';
        let rejectReason = null;
        let ocrJson = {
            extracted_text: "Sample OCR data extracted from document.",
            confidence: 0.98,
            timestamp: new Date().toISOString()
        };

        // 3. Update database
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

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            status,
            message: status === 'verified' ? 'Verification successful' : 'Verification failed'
        });

    } catch (err) {
        console.error("Verification pipeline error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
