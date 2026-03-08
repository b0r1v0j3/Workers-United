import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { buildContractDataForMatch, ensureStoredContractData } from "@/lib/contract-data";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

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

        const admin = createAdminClient();
        const contractBuild = await buildContractDataForMatch(admin, matchId);

        if (!contractBuild.passportDoc || contractBuild.passportDoc.status !== "verified") {
            return NextResponse.json(
                { error: "No verified passport document found" },
                { status: 400 }
            );
        }

        const { completion, missingFields } = getWorkerCompletion({
            profile: contractBuild.workerProfile,
            worker: contractBuild.worker,
            documents: contractBuild.documents
                .filter((document) => Boolean(document.document_type))
                .map((document) => ({
                    document_type: document.document_type as string,
                })),
        });

        if (completion < 100) {
            return NextResponse.json(
                {
                    error: `Worker profile is ${completion}% complete. Must be 100% before generating documents.`,
                    missingFields,
                    completion,
                },
                { status: 400 }
            );
        }

        const prepared = await ensureStoredContractData(admin, matchId);

        return NextResponse.json({
            success: true,
            contractData: prepared.contractData,
            storedContractData: prepared.storedContractData,
            message: "Contract data prepared successfully. Ready for PDF generation.",
        });
    } catch (error) {
        console.error("Contract data API error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : "Failed to process contract data",
            },
            { status: 500 }
        );
    }
}

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

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    try {
        const admin = createAdminClient();
        const contractBuild = await buildContractDataForMatch(admin, matchId);

        return NextResponse.json({
            prepared: Boolean(contractBuild.storedContractData),
            contractData: contractBuild.contractData,
            storedContractData: contractBuild.storedContractData,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Contract data not found",
            },
            { status: 404 }
        );
    }
}
