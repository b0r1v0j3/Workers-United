import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";

export const dynamic = "force-dynamic";

// GET: List all workers with their document generation status
export async function GET() {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Admin check
        const { data: userProfile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (userProfile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }

        const admin = createAdminClient();

        // Fetch all matches with contract_data
        const { data: contracts } = await admin
            .from("contract_data")
            .select("match_id, generated_at, generated_documents");

        // Fetch all matches to get worker record IDs
        const matchIds = (contracts || []).map(c => c.match_id);

        const { data: matches } = await admin
            .from("matches")
            .select("id, worker_id, employer_id, status")
            .in("id", matchIds.length > 0 ? matchIds : ["__none__"]);

        const workerRecordIds = (matches || []).map(m => m.worker_id);

        const { data: workerRecords } = await admin
            .from("worker_onboarding")
            .select("id, profile_id")
            .in("id", workerRecordIds.length > 0 ? workerRecordIds : ["__none__"]);

        const workerRecordMap = new Map((workerRecords || []).map(workerRecord => [workerRecord.id, workerRecord]));
        const matchMap = new Map((matches || []).map(m => [m.id, m]));

        // Get profile IDs for names
        const profileIds = (workerRecords || []).map(workerRecord => workerRecord.profile_id);
        const { data: profiles } = await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds.length > 0 ? profileIds : ["__none__"]);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        // Also fetch uploaded docs count per worker
        const { data: uploadedDocs } = await admin
            .from("worker_documents")
            .select("user_id, document_type, status")
            .in("user_id", profileIds.length > 0 ? profileIds : ["__none__"]);

        const docsByUser = new Map<string, { total: number; verified: number }>();
        for (const doc of uploadedDocs || []) {
            const existing = docsByUser.get(doc.user_id) || { total: 0, verified: 0 };
            existing.total++;
            if (doc.status === "verified") existing.verified++;
            docsByUser.set(doc.user_id, existing);
        }

        // Build the response
        const workers = (contracts || []).map(contract => {
            const match = matchMap.get(contract.match_id);
            const workerRecord = match ? workerRecordMap.get(match.worker_id) : null;
            const profile = workerRecord ? profileMap.get(workerRecord.profile_id) : null;
            const docs = workerRecord ? docsByUser.get(workerRecord.profile_id) : null;
            const generatedDocs = contract.generated_documents || {};
            const generatedCount = Object.keys(generatedDocs).length;

            return {
                matchId: contract.match_id,
                profileId: workerRecord?.profile_id || null,
                name: profile?.full_name || "Unknown",
                email: profile?.email || null,
                matchStatus: match?.status || "unknown",
                generatedAt: contract.generated_at,
                generatedDocsCount: generatedCount,
                uploadedDocsTotal: docs?.total || 0,
                uploadedDocsVerified: docs?.verified || 0,
                isReady: generatedCount >= 4,
            };
        });

        return NextResponse.json({ workers });

    } catch (error) {
        console.error("[Document Status] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
