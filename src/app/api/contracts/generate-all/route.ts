import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAllDocuments, validateContractData, type DocumentType, type ContractDataForDocs } from "@/lib/pdf-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow 2 minutes for bulk generation

// POST: Generate all 4 PDF documents for ALL matched workers who have contract_data
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

        // Fetch ALL contract_data rows that haven't been generated yet (or force-regenerate)
        const body = await request.json().catch(() => ({}));
        const forceRegenerate = body.forceRegenerate === true;

        let query = supabase
            .from("contract_data")
            .select("*");

        if (!forceRegenerate) {
            query = query.is("generated_at", null);
        }

        const { data: contracts, error: fetchError } = await query;

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!contracts || contracts.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No contracts to generate",
                generated: 0,
                skipped: 0,
                errors: [],
            });
        }

        const adminSupabase = createAdminClient();

        const results = {
            generated: 0,
            skipped: 0,
            errors: [] as { matchId: string; worker: string; error: string }[],
        };

        const docTypeNames: Record<DocumentType, string> = {
            UGOVOR: "UGOVOR_O_RADU",
            IZJAVA: "IZJAVA_O_SAGLASNOSTI",
            OVLASCENJE: "OVLASCENJE",
            POZIVNO_PISMO: "POZIVNO_PISMO",
        };

        for (const contractData of contracts) {
            const workerLabel = contractData.candidate_full_name || contractData.match_id;

            try {
                // Validate
                const missing = validateContractData(contractData as ContractDataForDocs);
                if (missing.length > 0) {
                    results.skipped++;
                    results.errors.push({
                        matchId: contractData.match_id,
                        worker: workerLabel,
                        error: `Missing fields: ${missing.join(", ")}`,
                    });
                    continue;
                }

                // Generate
                const documents = await generateAllDocuments(contractData as ContractDataForDocs);

                const workerName = (contractData.candidate_full_name || "unknown")
                    .replace(/[^\p{L}\p{N}\s]/gu, "")
                    .replace(/\s+/g, "_");

                const storagePath = `contracts/${contractData.match_id}`;
                const generatedDocs: Record<string, string> = {};

                for (const [docType, buffer] of documents) {
                    const fileName = `${docTypeNames[docType]}_${workerName}.pdf`;
                    const fullPath = `${storagePath}/${fileName}`;

                    const { error: uploadError } = await adminSupabase.storage
                        .from("candidate-docs")
                        .upload(fullPath, buffer, {
                            contentType: "application/pdf",
                            upsert: true,
                        });

                    if (uploadError) {
                        throw new Error(`Upload failed for ${docType}: ${uploadError.message}`);
                    }

                    const { data: urlData } = adminSupabase.storage
                        .from("candidate-docs")
                        .getPublicUrl(fullPath);

                    generatedDocs[docType] = urlData.publicUrl;
                }

                // Update contract_data
                await adminSupabase
                    .from("contract_data")
                    .update({
                        generated_documents: generatedDocs,
                        generated_at: new Date().toISOString(),
                    })
                    .eq("match_id", contractData.match_id);

                results.generated++;
            } catch (err) {
                results.errors.push({
                    matchId: contractData.match_id,
                    worker: workerLabel,
                    error: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Bulk generation complete: ${results.generated} generated, ${results.skipped} skipped`,
            ...results,
        });
    } catch (error) {
        console.error("[Bulk Generate] System error:", error);
        return NextResponse.json(
            { error: `Bulk generation failed: ${error instanceof Error ? error.message : "Unknown error"}` },
            { status: 500 }
        );
    }
}
