import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import { getN8nHealth, listWorkflows, getExecutions } from "@/lib/n8n";

// ─── n8n Dashboard API ──────────────────────────────────────────────────────
// Provides n8n health data for the admin panel
// GET: Returns workflow list, execution stats, and system health

export async function GET(request: NextRequest) {
    // Auth: only god mode users
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [health, workflows, recentExecutions] = await Promise.all([
            getN8nHealth(),
            listWorkflows(),
            getExecutions({ limit: 20 }),
        ]);

        return NextResponse.json({
            health,
            workflows: workflows.map(w => ({
                id: w.id,
                name: w.name,
                active: w.active,
                updatedAt: w.updatedAt,
            })),
            recentExecutions: recentExecutions.map(e => ({
                id: e.id,
                workflowId: e.workflowId,
                status: e.status,
                startedAt: e.startedAt,
                stoppedAt: e.stoppedAt,
                mode: e.mode,
            })),
        });
    } catch (error: any) {
        console.error("[n8n API] Health check failed:", error);
        return NextResponse.json({
            error: "n8n API unreachable",
            message: error.message,
            hint: "Check N8N_BASE_URL and N8N_API_KEY env vars",
        }, { status: 502 });
    }
}
