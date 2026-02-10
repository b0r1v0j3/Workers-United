import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
    const checks: Record<string, string> = {};

    // Check Supabase
    try {
        const adminClient = createAdminClient();
        const { error } = await adminClient.from("profiles").select("id").limit(1);
        checks.supabase = error ? `error: ${error.message}` : "ok";
    } catch {
        checks.supabase = "down";
    }

    checks.vercel = "ok";
    checks.timestamp = new Date().toISOString();

    const allOk = checks.supabase === "ok";
    return NextResponse.json(
        { status: allOk ? "healthy" : "degraded", checks },
        { status: allOk ? 200 : 503 }
    );
}
