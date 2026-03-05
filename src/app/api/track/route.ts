import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── Lightweight Activity Tracker ────────────────────────────────────────────
// Accepts page views and funnel events from the client side.
// Stores them in user_activity for brain analysis.

export async function POST(request: NextRequest) {
    try {
        const { action, category, details } = await request.json();
        if (!action) {
            return NextResponse.json({ error: "action required" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Use admin client to insert since anonymous users won't have RLS access
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const anonymous = !user;

        await admin.from("user_activity").insert({
            user_id: user?.id ?? null,
            action,
            category: category || "tracking",
            status: "ok",
            details: { ...(details || {}), anonymous },
        });

        return NextResponse.json({ ok: true });
    } catch {
        // Never fail — tracking is best-effort
        return NextResponse.json({ ok: true });
    }
}
