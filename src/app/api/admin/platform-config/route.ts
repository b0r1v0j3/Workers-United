import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { invalidateConfigCache } from "@/lib/platform-config";

// GET /api/admin/platform-config — fetch all config values
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("platform_config")
        .select("*")
        .order("key");

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data });
}

// PUT /api/admin/platform-config — update a config value
export async function PUT(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { key, value } = body;

    if (!key || typeof value !== "string") {
        return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from("platform_config")
        .update({ value, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("key", key)
        .select("key")
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.key) {
        return NextResponse.json({ error: "Config key not found" }, { status: 404 });
    }

    // Clear the cached config so next read gets fresh data
    invalidateConfigCache();

    return NextResponse.json({ success: true, key, value });
}
