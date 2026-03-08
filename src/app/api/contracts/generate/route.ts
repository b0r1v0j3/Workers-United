import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAllDocuments, validateContractData, type DocumentType, type ContractDataForDocs } from "@/lib/pdf-generator";
import { buildContractDataForMatch, ensureStoredContractData } from "@/lib/contract-data";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";

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

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { matchId } = body;

        if (!matchId) {
            return NextResponse.json({ error: "Match ID required" }, { status: 400 });
        }

        const adminSupabase = createAdminClient();
        const prepared = await ensureStoredContractData(adminSupabase, matchId);
        const contractData = prepared.contractData as ContractDataForDocs;

        // Validate required fields before generating
        const missingFields = validateContractData(contractData);
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
        const documents = await generateAllDocuments(contractData);

        // Upload to Supabase Storage
        const workerName = (contractData.worker_full_name || "unknown")
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
                .from(WORKER_DOCUMENTS_BUCKET)
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
                .from(WORKER_DOCUMENTS_BUCKET)
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
            message: `Generated ${documents.size} documents for ${contractData.worker_full_name}`,
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

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    try {
        const adminSupabase = createAdminClient();
        const contractBuild = await buildContractDataForMatch(adminSupabase, matchId);
        const generatedDocuments = contractBuild.storedContractData?.generated_documents;
        const hasDocuments = Boolean(
            generatedDocuments &&
            typeof generatedDocuments === "object" &&
            !Array.isArray(generatedDocuments) &&
            Object.keys(generatedDocuments).length > 0
        );

        return NextResponse.json({
            generated: hasDocuments,
            documents: generatedDocuments || {},
            generatedAt: contractBuild.storedContractData?.generated_at || null,
            workerName: contractBuild.contractData.worker_full_name || null,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Contract data not found" },
            { status: 404 }
        );
    }
}
