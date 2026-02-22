import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import { createAdminClient } from "@/lib/supabase/admin";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST: Download all documents for matched workers as a ZIP
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

        const body = await request.json().catch(() => ({}));
        const workerIds: string[] = body.workerIds || []; // Optional: specific worker IDs

        const admin = createAdminClient();

        // Fetch all matches with contract_data that have generated documents
        let matchQuery = admin
            .from("contract_data")
            .select("*, matches!inner(id, candidate_id, employer_id)")
            .not("generated_documents", "is", null);

        const { data: contracts, error: fetchError } = await matchQuery;

        if (fetchError) {
            console.error("[Download All] Fetch error:", fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!contracts || contracts.length === 0) {
            return NextResponse.json({ error: "No generated documents found" }, { status: 404 });
        }

        // Get candidate IDs from matches
        const candidateIds = contracts
            .map((c: any) => c.matches?.candidate_id)
            .filter(Boolean);

        // Fetch candidate info
        const { data: candidates } = await admin
            .from("candidates")
            .select("id, profile_id")
            .in("id", candidateIds.length > 0 ? candidateIds : ["__none__"]);

        const candidateProfileIds = (candidates || []).map(c => c.profile_id);

        // Fetch profiles for names
        const { data: profiles } = await admin
            .from("profiles")
            .select("id, full_name")
            .in("id", candidateProfileIds.length > 0 ? candidateProfileIds : ["__none__"]);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const candidateMap = new Map((candidates || []).map(c => [c.id, c]));

        // Fetch worker uploaded documents (passport, photo, diploma)
        const { data: workerDocs } = await admin
            .from("candidate_documents")
            .select("*")
            .in("user_id", candidateProfileIds.length > 0 ? candidateProfileIds : ["__none__"])
            .in("document_type", ["passport", "biometric_photo", "diploma"]);

        const docsByUser = new Map<string, any[]>();
        for (const doc of workerDocs || []) {
            const existing = docsByUser.get(doc.user_id) || [];
            existing.push(doc);
            docsByUser.set(doc.user_id, existing);
        }

        // Build ZIP
        const zip = new JSZip();

        for (const contract of contracts) {
            const candidateId = contract.matches?.candidate_id;
            const candidate = candidateMap.get(candidateId);
            if (!candidate) continue;

            // Filter by specific worker IDs if provided
            if (workerIds.length > 0 && !workerIds.includes(candidate.profile_id)) {
                continue;
            }

            const profileData = profileMap.get(candidate.profile_id);
            const folderName = (profileData?.full_name || "Unknown")
                .toUpperCase()
                .replace(/[^\p{L}\p{N}\s]/gu, "")
                .trim();

            const folder = zip.folder(folderName);
            if (!folder) continue;

            // 1. Add generated PDF documents
            const generatedDocs = contract.generated_documents || {};
            const docFileNames: Record<string, string> = {
                UGOVOR: "UGOVOR_O_RADU.pdf",
                IZJAVA: "IZJAVA_O_SAGLASNOSTI.pdf",
                OVLASCENJE: "OVLASCENJE.pdf",
                POZIVNO_PISMO: "POZIVNO_PISMO.pdf",
            };

            for (const [docType, url] of Object.entries(generatedDocs)) {
                if (!url) continue;
                try {
                    const response = await fetch(url as string);
                    if (response.ok) {
                        const buffer = await response.arrayBuffer();
                        folder.file(
                            docFileNames[docType] || `${docType}.pdf`,
                            buffer
                        );
                    }
                } catch (err) {
                    console.warn(`[Download All] Failed to fetch ${docType} for ${folderName}:`, err);
                }
            }

            // 2. Add uploaded documents (passport, photo, diploma)
            const userDocs = docsByUser.get(candidate.profile_id) || [];
            const docTypeFileNames: Record<string, string> = {
                passport: "Passport.pdf",
                biometric_photo: "Photo.jpg",
                diploma: "Diploma.pdf",
            };

            for (const doc of userDocs) {
                if (!doc.storage_path) continue;
                try {
                    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/candidate-docs/${doc.storage_path}`;
                    const response = await fetch(fileUrl);
                    if (response.ok) {
                        const buffer = await response.arrayBuffer();
                        const ext = doc.storage_path.split(".").pop()?.toLowerCase() || "pdf";
                        let fileName = docTypeFileNames[doc.document_type] ||
                            `${doc.document_type}.${ext}`;
                        // Use actual extension from storage
                        if (doc.document_type === "biometric_photo") {
                            fileName = `Photo.${ext}`;
                        } else if (doc.document_type === "passport") {
                            fileName = `Passport.${ext}`;
                        } else if (doc.document_type === "diploma") {
                            fileName = `Diploma.${ext}`;
                        }
                        folder.file(fileName, buffer);
                    }
                } catch (err) {
                    console.warn(`[Download All] Failed to fetch ${doc.document_type} for ${folderName}:`, err);
                }
            }
        }

        // Generate ZIP buffer
        const zipBuffer = await zip.generateAsync({
            type: "arraybuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
        });

        // Return ZIP as download
        return new NextResponse(zipBuffer, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="WorkersUnited_Documents_${new Date().toISOString().split("T")[0]}.zip"`,
                "Content-Length": String(zipBuffer.byteLength),
            },
        });

    } catch (error) {
        console.error("[Download All] System error:", error);
        return NextResponse.json(
            { error: `Download failed: ${error instanceof Error ? error.message : "Unknown error"}` },
            { status: 500 }
        );
    }
}
