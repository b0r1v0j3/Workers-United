import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDocumentFixAnnouncementEmails } from "@/lib/admin-announcements";
import { isGodModeUser } from "@/lib/godmode";

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;
        const isCronRequest = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
        let actorUserId: string | null = null;

        if (!isCronRequest) {
            const supabase = await createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            actorUserId = user.id;

            const { data: profile } = await supabase
                .from("profiles")
                .select("user_type")
                .eq("id", user.id)
                .single();

            if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
                return NextResponse.json({ error: "Admin access required" }, { status: 403 });
            }
        }

        // Optional: pass dryRun=true in body to just count
        let dryRun = false;
        try {
            const body = await request.json();
            dryRun = body?.dryRun === true;
        } catch { /* no body is fine */ }

        const supabase = createAdminClient();
        const result = await sendDocumentFixAnnouncementEmails({
            admin: supabase,
            actorUserId,
            dryRun,
        });

        const errors = result.failedDetails.map((detail) => `${detail.email}: ${detail.error}`);

        if (dryRun) {
            return NextResponse.json({
                dryRun: true,
                eligibleWorkers: result.total,
                message: `Would send document-fix announcement to ${result.total} workers.`,
            });
        }

        return NextResponse.json({
            success: true,
            sentCount: result.sent,
            queuedCount: result.queued,
            totalWorkers: result.total,
            errors: errors.length > 0 ? errors : undefined,
            message: `Successfully sent ${result.sent}/${result.total} document-fix announcement emails${result.queued > 0 ? ` and queued ${result.queued} for retry` : ""}.`
        });

    } catch (error: any) {
        console.error("Error triggering announcement:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
