import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email-templates";

export async function POST(request: Request) {
    try {
        const supabase = createAdminClient();

        // Optional: pass dryRun=true in body to just count
        let dryRun = false;
        try {
            const body = await request.json();
            dryRun = body?.dryRun === true;
        } catch { /* no body is fine */ }

        // Get ALL workers (not just pending — send announcement to everyone)
        const { data: profiles, error: profileErr } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, user_type")
            .eq("user_type", "worker");

        if (profileErr) throw profileErr;

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ message: "No workers found", sentCount: 0 });
        }

        if (dryRun) {
            return NextResponse.json({
                dryRun: true,
                eligibleWorkers: profiles.length,
                message: `Would send announcement to ${profiles.length} workers.`
            });
        }

        let sentCount = 0;
        const errors: string[] = [];

        // Helper: delay to avoid Google SMTP rate limiting
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

        for (const profile of profiles) {
            try {
                // Get email from auth
                const { data: userAuth, error: userErr } = await supabase.auth.admin.getUserById(profile.id);
                if (userErr || !userAuth.user?.email) {
                    errors.push(`No email for ${profile.id}`);
                    continue;
                }

                const email = userAuth.user.email;
                const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "friend";

                // Use the proper queueEmail which also sends via SMTP
                await queueEmail(
                    supabase,
                    profile.id,
                    "announcement_document_fix",
                    email,
                    fullName,
                    {}
                );

                sentCount++;

                // Throttle: 1.5s between sends to avoid Gmail SMTP rate limits
                if (sentCount < profiles.length) {
                    await delay(1500);
                }
            } catch (err: any) {
                errors.push(`Failed for ${profile.id}: ${err.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            sentCount,
            totalWorkers: profiles.length,
            errors: errors.length > 0 ? errors : undefined,
            message: `Successfully sent ${sentCount}/${profiles.length} announcement emails.`
        });

    } catch (error: any) {
        console.error("Error triggering announcement:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
