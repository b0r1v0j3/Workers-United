import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildPlaceholderData, validateContractData, type ContractDataForDocs } from "@/lib/pdf-generator";

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

    if (profile?.user_type !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Find match for this worker
    const { data: candidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("profile_id", profileId)
        .single();

    if (!candidate) {
        return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const { data: match } = await supabase
        .from("matches")
        .select("id")
        .eq("candidate_id", candidate.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (!match) {
        return NextResponse.json({
            hasData: false,
            message: "No match found for this worker",
        });
    }

    // Get contract_data
    const { data: contractData } = await supabase
        .from("contract_data")
        .select("*")
        .eq("match_id", match.id)
        .single();

    if (!contractData) {
        return NextResponse.json({
            hasData: false,
            matchId: match.id,
            message: "Match found but contract data not yet prepared. Use 'Prepare Data' first.",
        });
    }

    // Build the same placeholder data that goes into DOCX
    const placeholders = buildPlaceholderData(contractData as ContractDataForDocs);
    const missingFields = validateContractData(contractData as ContractDataForDocs);

    return NextResponse.json({
        hasData: true,
        matchId: match.id,
        generatedAt: contractData.generated_at,
        placeholders,
        missingFields,
    });
}
