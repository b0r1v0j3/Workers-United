import { NextResponse } from "next/server";
import { hasValidCronBearerToken } from "@/lib/cron-auth";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { shouldProvisionWorkerRecords } from "@/lib/domain";
import { ensureWorkerRecord } from "@/lib/workers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/backfill-records
 * 
 * One-shot admin endpoint that creates missing profiles + worker records
 * for all auth users whose role should map to the worker domain.
 * 
 * Auth: CRON_SECRET bearer token
 */
export async function POST(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (!hasValidCronBearerToken(authHeader)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const allUsers = await getAllAuthUsers(supabase);

    // Filter to worker-like users only (exclude employers and admins)
    const workers = allUsers.filter((u) => {
        return shouldProvisionWorkerRecords(u.user_metadata?.user_type);
    });

    let profilesCreated = 0;
    let workersCreated = 0;
    let errors = 0;

    for (const user of workers) {
        try {
            const result = await ensureWorkerRecord(supabase, {
                userId: user.id,
                email: user.email,
                fullName: user.user_metadata?.full_name,
            });

            if (result.profileCreated) profilesCreated++;
            if (result.workerCreated) workersCreated++;
        } catch (err) {
            console.error(`[Backfill] Error for user ${user.id}:`, err);
            errors++;
        }
    }

    return NextResponse.json({
        success: true,
        totalWorkers: workers.length,
        profilesCreated,
        workersCreated,
        errors,
    });
}
