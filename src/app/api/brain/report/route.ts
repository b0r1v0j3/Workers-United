import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Brain Report Storage ───────────────────────────────────────────────────
// Stores weekly brain analysis reports in Supabase
// Called by n8n after GPT generates the report
//
// Auth: Requires CRON_SECRET bearer token

export async function POST(request: NextRequest) {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { report, model, findings_count } = body;

        if (!report) {
            return NextResponse.json({ error: "Missing report" }, { status: 400 });
        }

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from("brain_reports")
            .insert({
                report,
                model: model || "gpt-5.2",
                findings_count: findings_count || 0,
                created_at: new Date().toISOString(),
            })
            .select("id")
            .single();

        if (error) {
            console.error("[Brain Report] Save error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, reportId: data.id });

    } catch (error: any) {
        console.error("[Brain Report] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET: Fetch previous reports (for Brain to compare with last week)
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: reports } = await supabase
        .from("brain_reports")
        .select("id, report, model, findings_count, created_at")
        .order("created_at", { ascending: false })
        .limit(4); // Last 4 weeks

    return NextResponse.json({ reports: reports || [] });
}
