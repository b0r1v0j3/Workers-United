import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

// ─── WhatsApp Nudge Cron ────────────────────────────────────────────────────
// Runs daily. Finds ALL users who haven't paid yet.
// Sends them a WhatsApp template message encouraging them to complete signup.
// Max 1 nudge per 7 days per user — no spam.
//
// Auth: CRON_SECRET bearer token

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const results = { found: 0, nudged: 0, skipped: 0, errors: 0 };

    try {
        // Find ALL candidates who haven't paid and have a phone number
        const { data: unpaidCandidates } = await supabase
            .from("candidates")
            .select("id, profile_id, phone, status, created_at, entry_fee_paid")
            .eq("entry_fee_paid", false)
            .not("phone", "is", null);

        if (!unpaidCandidates || unpaidCandidates.length === 0) {
            return NextResponse.json({ status: "no_workers_to_nudge", ...results });
        }

        results.found = unpaidCandidates.length;

        // Get phones that received a nudge in the last 7 days (avoid spam)
        const { data: recentNudges } = await supabase
            .from("whatsapp_messages")
            .select("phone_number")
            .eq("template_name", "profile_incomplete")
            .gte("created_at", weekAgo.toISOString());

        const alreadyNudgedPhones = new Set(
            (recentNudges || []).map((n: { phone_number: string }) => n.phone_number)
        );

        // Get profile names
        const profileIds = unpaidCandidates.map(c => c.profile_id).filter(Boolean);
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", profileIds);

        const profileMap = new Map(
            (profiles || []).map(p => [p.id, p.full_name])
        );

        // Send nudges
        for (const candidate of unpaidCandidates) {
            if (!candidate.phone) continue;

            // Normalize phone
            const phone = candidate.phone.replace(/[\s\-()]/g, "");
            if (alreadyNudgedPhones.has(phone) || alreadyNudgedPhones.has("+" + phone)) {
                results.skipped++;
                continue;
            }

            const name = profileMap.get(candidate.profile_id)?.split(" ")[0] || "there";

            try {
                await sendWhatsAppTemplate({
                    to: phone,
                    templateName: "profile_incomplete",
                    bodyParams: [
                        name,
                        "almost ready",
                        "complete your registration and join the job queue"
                    ],
                    buttonParams: [{ type: "url", url: "/profile/worker" }],
                    userId: candidate.profile_id,
                });
                results.nudged++;
            } catch (err) {
                console.error(`[Nudge] Failed for ${phone}:`, err);
                results.errors++;
            }

            // Small delay between messages to respect rate limits
            await new Promise(r => setTimeout(r, 500));
        }

        // Log the cron run
        await supabase.from("activity_log").insert({
            user_id: "system",
            action: "whatsapp_nudge_cron",
            category: "system",
            status: "success",
            details: results,
        });

        return NextResponse.json({ status: "success", ...results });

    } catch (error) {
        console.error("[Nudge] Cron error:", error);
        return NextResponse.json({
            status: "error",
            error: error instanceof Error ? error.message : "Unknown",
            ...results,
        }, { status: 500 });
    }
}
