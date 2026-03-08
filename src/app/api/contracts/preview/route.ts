import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { buildPlaceholderData, validateContractData, type ContractDataForDocs } from "@/lib/pdf-generator";
import { buildContractDataForMatch } from "@/lib/contract-data";

// GET: Return preview of placeholder data for a worker's contract documents
export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
        return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

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

    // Find match for this worker
    const { data: workerRecord } = await supabase
        .from("worker_onboarding")
        .select("id")
        .eq("profile_id", profileId)
        .single();

    if (!workerRecord) {
        return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const { data: match } = await supabase
        .from("matches")
        .select("id")
        .eq("worker_id", workerRecord.id)
        .limit(1)
        .single();

    if (!match) {
        return NextResponse.json({
            hasData: false,
            message: "No match found for this worker",
        });
    }

    try {
        const admin = createAdminClient();
        const contractBuild = await buildContractDataForMatch(admin, match.id);
        const placeholders = buildPlaceholderData(contractBuild.contractData as ContractDataForDocs);
        const missingFields = validateContractData(contractBuild.contractData as ContractDataForDocs);

        return NextResponse.json({
            hasData: true,
            matchId: match.id,
            generatedAt: contractBuild.storedContractData?.generated_at || null,
            placeholders,
            missingFields,
            prepared: Boolean(contractBuild.storedContractData),
        });
    } catch (error) {
        return NextResponse.json({
            hasData: false,
            matchId: match.id,
            message: error instanceof Error
                ? error.message
                : "Failed to prepare contract preview",
        });
    }
}
