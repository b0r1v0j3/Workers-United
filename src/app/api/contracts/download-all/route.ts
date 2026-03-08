import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import { createAdminClient } from "@/lib/supabase/admin";
import JSZip from "jszip";
import { getWorkerDocumentPublicUrl } from "@/lib/worker-documents";

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
        const workerIds: string[] = body.workerIds || [];

        const admin = createAdminClient();

        // Fetch all matches with contract_data that have generated documents
        const matchQuery = admin
            .from("contract_data")
            .select("*, matches!inner(id, worker_id, employer_id)")
            .not("generated_documents", "is", null);

        const { data: contracts, error: fetchError } = await matchQuery;

        if (fetchError) {
            console.error("[Download All] Fetch error:", fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!contracts || contracts.length === 0) {
            return NextResponse.json({ error: "No generated documents found" }, { status: 404 });
        }

        // Get worker record IDs from matches
        const workerRecordIds = contracts
            .map((c: any) => c.matches?.worker_id)
            .filter(Boolean);

        // Fetch worker records
        const { data: workerRecords } = await admin
            .from("worker_onboarding")
            .select("id, profile_id")
            .in("id", workerRecordIds.length > 0 ? workerRecordIds : ["__none__"]);

        const workerProfileIds = (workerRecords || []).map((workerRecord) => workerRecord.profile_id);

        // Fetch profiles for names
        const { data: profiles } = await admin
            .from("profiles")
            .select("id, full_name")
            .in("id", workerProfileIds.length > 0 ? workerProfileIds : ["__none__"]);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const workerRecordMap = new Map((workerRecords || []).map((workerRecord) => [workerRecord.id, workerRecord]));

        // Fetch worker uploaded documents (passport, photo, diploma)
        const { data: workerDocs } = await admin
            .from("worker_documents")
            .select("*")
            .in("user_id", workerProfileIds.length > 0 ? workerProfileIds : ["__none__"])
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
            const workerRecordId = contract.matches?.worker_id;
            const workerRecord = workerRecordMap.get(workerRecordId);
            if (!workerRecord) continue;

            // Filter by specific worker IDs if provided
            if (workerIds.length > 0 && !workerIds.includes(workerRecord.profile_id)) {
                continue;
            }

            const profileData = profileMap.get(workerRecord.profile_id);
            const folderName = (profileData?.full_name || "Unknown")
                .toUpperCase()
                .replace(/[^\p{L}\p{N}\s]/gu, "")
                .trim();

            const folder = zip.folder(folderName);
            if (!folder) continue;

            // 1. Fetch all generated PDF documents in parallel
            const generatedDocs = contract.generated_documents || {};
            const docFileNames: Record<string, string> = {
                UGOVOR: "UGOVOR_O_RADU.pdf",
                IZJAVA: "IZJAVA_O_SAGLASNOSTI.pdf",
                OVLASCENJE: "OVLASCENJE.pdf",
                POZIVNO_PISMO: "POZIVNO_PISMO.pdf",
            };

            const generatedFetches = Object.entries(generatedDocs)
                .filter(([, url]) => url)
                .map(async ([docType, url]) => {
                    try {
                        const response = await fetch(url as string);
                        if (response.ok) {
                            const buffer = await response.arrayBuffer();
                            folder.file(docFileNames[docType] || `${docType}.pdf`, buffer);
                        }
                    } catch (err) {
                        console.warn(`[Download All] Failed to fetch ${docType} for ${folderName}:`, err);
                    }
                });

            // 2. Fetch all uploaded documents in parallel
            const userDocs = docsByUser.get(workerRecord.profile_id) || [];

            const uploadedFetches = userDocs
                .filter(doc => doc.storage_path)
                .map(async (doc) => {
                    try {
                        const fileUrl = getWorkerDocumentPublicUrl(doc.storage_path);
                        if (!fileUrl) return;
                        const response = await fetch(fileUrl);
                        if (response.ok) {
                            const buffer = await response.arrayBuffer();
                            const ext = doc.storage_path.split(".").pop()?.toLowerCase() || "pdf";
                            let fileName = `${doc.document_type}.${ext}`;
                            if (doc.document_type === "biometric_photo") fileName = `Photo.${ext}`;
                            else if (doc.document_type === "passport") fileName = `Passport.${ext}`;
                            else if (doc.document_type === "diploma") fileName = `Diploma.${ext}`;
                            folder.file(fileName, buffer);
                        }
                    } catch (err) {
                        console.warn(`[Download All] Failed to fetch ${doc.document_type} for ${folderName}:`, err);
                    }
                });

            // Fetch all files for this worker in parallel
            await Promise.all([...generatedFetches, ...uploadedFetches]);
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
