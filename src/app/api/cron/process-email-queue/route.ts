import { NextResponse } from "next/server";
import { hasValidCronBearerToken } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPendingEmailQueue } from "@/lib/email-queue";

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (!hasValidCronBearerToken(authHeader)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const admin = createAdminClient();
        const result = await processPendingEmailQueue(admin, 100);
        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[Email Queue Processor] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
