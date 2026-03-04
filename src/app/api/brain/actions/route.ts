import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Brain Actions API ──────────────────────────────────────────────────────
// POST: Brain logs an action it has taken (called from Brain Monitor)
// GET:  Admin reads brain action history
//
// Auth: CRON_SECRET for POST (Brain Monitor), god mode for GET (admin panel)

export async function POST(request: NextRequest) {
    // Auth: Brain Monitor uses CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action_type, description, target_user_id, target_entity, metadata, result } = body;

    if (!action_type || !description) {
        return NextResponse.json({ error: "action_type and description required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("brain_actions")
        .insert({
            action_type,
            description,
            target_user_id: target_user_id || null,
            target_entity: target_entity || null,
            metadata: metadata || {},
            result: result || "completed",
        })
        .select()
        .single();

    if (error) {
        console.error("[Brain Actions] Insert failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: data });
}

export async function GET(request: NextRequest) {
    // Auth: CRON_SECRET (for Brain Monitor) or god mode user
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        // Check if it's a god mode user via cookie
        const { createClient } = await import("@/lib/supabase/server");
        const { isGodModeUser } = await import("@/lib/godmode");
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const supabase = createAdminClient();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const type = url.searchParams.get("type");

    let query = supabase
        .from("brain_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (type) {
        query = query.eq("action_type", type);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ actions: data, total: data?.length || 0 });
}
