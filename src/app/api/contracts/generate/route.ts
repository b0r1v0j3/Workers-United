import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAllDocuments, validateContractData, type DocumentType, type ContractDataForDocs } from "@/lib/pdf-generator";

// POST: Generate all 4 PDF documents for a contract
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Auth check (admin only)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin") {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { matchId } = body;

        if (!matchId) {
            return NextResponse.json({ error: "Match ID required" }, { status: 400 });
        }

        // Get contract data
        const { data: contractData, error: fetchError } = await supabase
            .from("contract_data")
            .select("*")
            .eq("match_id", matchId)
            .single();

        if (fetchError || !contractData) {
            return NextResponse.json(
                { error: "Contract data not found. Run 'Prepare Contract Data' first." },
                { status: 404 }
            );
        }

        // Validate required fields before generating
        const missingFields = validateContractData(contractData as ContractDataForDocs);
        if (missingFields.length > 0) {
            return NextResponse.json(
                {
                    error: `Missing required fields: ${missingFields.join(", ")}`,
                    missingFields,
                },
                { status: 400 }
            );
        }

        // Generate all 4 documents
        const documents = await generateAllDocuments(contractData as ContractDataForDocs);

        // Upload to Supabase Storage
        const adminSupabase = createAdminClient();

        const workerName = (contractData.candidate_full_name || "unknown")
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .replace(/\s+/g, "_");

        const storagePath = `contracts/${matchId}`;
        const generatedDocs: Record<string, string> = {};

        const docTypeNames: Record<DocumentType, string> = {
            UGOVOR: "UGOVOR_O_RADU",
            IZJAVA: "IZJAVA_O_SAGLASNOSTI",
            OVLASCENJE: "OVLASCENJE",
            POZIVNO_PISMO: "POZIVNO_PISMO",
        };

        for (const [docType, buffer] of documents) {
            const fileName = `${docTypeNames[docType]}_${workerName}.pdf`;
            const fullPath = `${storagePath}/${fileName}`;

            // Upload to storage (upsert to overwrite if re-generating)
            const { error: uploadError } = await adminSupabase.storage
                .from("candidate-docs")
                .upload(fullPath, buffer, {
                    contentType: "application/pdf",
                    upsert: true,
                });

            if (uploadError) {
                console.error(`Upload error for ${docType}:`, uploadError);
                throw new Error(`Failed to upload ${docType}: ${uploadError.message}`);
            }

            // Get public URL
            const { data: urlData } = adminSupabase.storage
                .from("candidate-docs")
                .getPublicUrl(fullPath);

            generatedDocs[docType] = urlData.publicUrl;
        }

        // Update contract_data with generated document URLs and timestamp
        const { error: updateError } = await adminSupabase
            .from("contract_data")
            .update({
                generated_documents: generatedDocs,
                generated_at: new Date().toISOString(),
            })
            .eq("match_id", matchId);

        if (updateError) {
            console.error("Failed to update contract_data:", updateError);
        }

        return NextResponse.json({
            success: true,
            documents: generatedDocs,
            message: `Generated ${documents.size} documents for ${contractData.candidate_full_name}`,
        });
    } catch (error) {
        console.error("Document generation error:", error);
        return NextResponse.json(
            { error: `Document generation failed: ${error instanceof Error ? error.message : "Unknown error"}` },
            { status: 500 }
        );
    }
}

// GET: Check generation status / download URLs for a match
export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
        return NextResponse.json({ error: "Match ID required" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin-only check
    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: contractData, error } = await supabase
        .from("contract_data")
        .select("generated_documents, generated_at, candidate_full_name")
        .eq("match_id", matchId)
        .single();

    if (error || !contractData) {
        return NextResponse.json({ error: "Contract data not found" }, { status: 404 });
    }

    const hasDocuments = contractData.generated_documents &&
        Object.keys(contractData.generated_documents).length > 0;

    return NextResponse.json({
        generated: hasDocuments,
        documents: contractData.generated_documents || {},
        generatedAt: contractData.generated_at,
        workerName: contractData.candidate_full_name,
    });
}
