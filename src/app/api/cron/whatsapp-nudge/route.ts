import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { isInternalOrTestEmail } from "@/lib/reporting";
import { normalizeWorkerPhone, pickCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";

// ─── WhatsApp Nudge Cron ────────────────────────────────────────────────────
// Runs daily. Finds ALL users who haven't paid yet.
// Sends them a WhatsApp template message encouraging them to complete signup.
// Max 1 nudge per 7 days per user — no spam.
//
// Auth: CRON_SECRET bearer token

export const dynamic = "force-dynamic";

interface NudgeWorkerRecord extends WorkerRecordSnapshot {
    id: string;
    profile_id: string | null;
    phone: string | null;
    status: string | null;
    entry_fee_paid: boolean | null;
}

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
        // Find all worker records that still haven't paid and have a phone number
        const { data: unpaidWorkerRows } = await supabase
            .from("worker_onboarding")
            .select("id, profile_id, phone, status, entry_fee_paid, updated_at, queue_joined_at, job_search_active, nationality, current_country, preferred_job")
            .eq("entry_fee_paid", false)
            .not("phone", "is", null);

        if (!unpaidWorkerRows || unpaidWorkerRows.length === 0) {
            return NextResponse.json({ status: "no_workers_to_nudge", ...results });
        }

        const workerGroups = new Map<string, NudgeWorkerRecord[]>();
        for (const rawWorkerRecord of unpaidWorkerRows as NudgeWorkerRecord[]) {
            const normalizedPhone = normalizeWorkerPhone(rawWorkerRecord.phone);
            const dedupeKey = rawWorkerRecord.profile_id || normalizedPhone || rawWorkerRecord.id;
            const existing = workerGroups.get(dedupeKey) || [];
            existing.push(rawWorkerRecord);
            workerGroups.set(dedupeKey, existing);
        }

        const canonicalWorkerRows = Array.from(workerGroups.values())
            .map(group => pickCanonicalWorkerRecord(group))
            .filter((workerRecord): workerRecord is NudgeWorkerRecord => !!workerRecord);

        results.found = canonicalWorkerRows.length;

        // Get phones that received a nudge in the last 7 days (avoid spam)
        const { data: recentNudges } = await supabase
            .from("whatsapp_messages")
            .select("phone_number")
            .eq("template_name", "profile_incomplete")
            .in("status", ["sent", "delivered", "read"])
            .gte("created_at", weekAgo.toISOString());

        const alreadyNudgedPhones = new Set(
            (recentNudges || [])
                .map((n: { phone_number: string }) => normalizeWorkerPhone(n.phone_number))
                .filter((phone): phone is string => !!phone)
        );

        // Get profile names
        const profileIds = canonicalWorkerRows.map(workerRecord => workerRecord.profile_id).filter((value): value is string => !!value);
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds);

        const profileMap = new Map(
            (profiles || []).map(p => [p.id, p])
        );

        // Send nudges
        for (const workerRecord of canonicalWorkerRows) {
            const phone = normalizeWorkerPhone(workerRecord.phone);
            if (!phone) {
                results.skipped++;
                continue;
            }

            if (alreadyNudgedPhones.has(phone)) {
                results.skipped++;
                continue;
            }

            const profile = workerRecord.profile_id ? profileMap.get(workerRecord.profile_id) : null;
            if (isInternalOrTestEmail(profile?.email)) {
                results.skipped++;
                continue;
            }

            const name = profile?.full_name?.split(" ")[0] || "there";

            try {
                const sendResult = await sendWhatsAppTemplate({
                    to: phone,
                    templateName: "profile_incomplete",
                    bodyParams: [
                        name,
                        "almost ready",
                        "complete your registration and join the job queue"
                    ],
                    buttonParams: [{ type: "url", url: "/profile/worker" }],
                    userId: workerRecord.profile_id || undefined,
                });

                if (sendResult.success) {
                    results.nudged++;
                    alreadyNudgedPhones.add(phone);
                } else {
                    console.error(`[Nudge] Failed for ${phone}:`, sendResult.error);
                    results.errors++;
                }
            } catch (err) {
                console.error(`[Nudge] Failed for ${phone}:`, err);
                results.errors++;
            }

            // Small delay between messages to respect rate limits
            await new Promise(r => setTimeout(r, 500));
        }

        // Log the cron run
        const { error: logError } = await supabase.from("user_activity").insert({
            user_id: null,
            action: "whatsapp_nudge_cron",
            category: "system",
            status: "ok",
            details: results,
        });

        if (logError) {
            console.warn("[Nudge] Failed to log cron run:", logError.message);
        }

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
