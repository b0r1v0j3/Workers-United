import { NextResponse } from "next/server";
import { hasValidCronBearerToken } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectRecentRecipientSideBlockedPhones, sendProfileIncomplete } from "@/lib/whatsapp";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import { normalizeWorkerPhone, pickCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";

// ─── WhatsApp Nudge Cron ────────────────────────────────────────────────────
// Runs daily. Finds ALL users who haven't paid yet.
// Sends them a WhatsApp template message only while they are still incomplete and pre-review.
// Max 1 nudge per 7 days per user — no spam.
//
// Auth: CRON_SECRET bearer token

export const dynamic = "force-dynamic";

const PROFILE_INCOMPLETE_STATUS_PARAM = "finish your profile";
const PROFILE_INCOMPLETE_NEXT_STEP_PARAM = "finish your profile and required documents so we can review your case";

interface NudgeWorkerRecord extends WorkerRecordSnapshot {
    id: string;
    profile_id: string | null;
    agency_id: string | null;
    submitted_email: string | null;
    phone: string | null;
    status: string | null;
    admin_approved: boolean | null;
    entry_fee_paid: boolean | null;
    job_search_active: boolean | null;
    queue_joined_at: string | null;
}

function shouldSkipProfileIncompleteNudge(workerRecord: NudgeWorkerRecord) {
    const normalizedStatus = (workerRecord.status || "NEW").toUpperCase();

    if (workerRecord.entry_fee_paid || workerRecord.job_search_active || workerRecord.queue_joined_at) {
        return true;
    }

    if (workerRecord.admin_approved || normalizedStatus === "PENDING_APPROVAL" || normalizedStatus === "APPROVED") {
        return true;
    }

    if (isPostEntryFeeWorkerStatus(normalizedStatus)) {
        return true;
    }

    return false;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (!hasValidCronBearerToken(authHeader)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const results = { found: 0, nudged: 0, skipped: 0, errors: 0 };

    try {
        // Find all worker records that still haven't paid and have a phone number
        const { data: unpaidWorkerRows } = await supabase
            .from("worker_onboarding")
            .select("id, profile_id, agency_id, submitted_email, phone, status, admin_approved, entry_fee_paid, updated_at, queue_joined_at, job_search_active, nationality, current_country, preferred_job")
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

        const { data: recentFailedNudges } = await supabase
            .from("whatsapp_messages")
            .select("phone_number, status, error_message, created_at")
            .eq("template_name", "profile_incomplete")
            .eq("direction", "outbound")
            .eq("status", "failed")
            .gte("created_at", monthAgo.toISOString());

        const blockedRecipientPhones = collectRecentRecipientSideBlockedPhones(recentFailedNudges || []);

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

            if (shouldSkipProfileIncompleteNudge(workerRecord)) {
                results.skipped++;
                continue;
            }

            if (alreadyNudgedPhones.has(phone)) {
                results.skipped++;
                continue;
            }

            if (blockedRecipientPhones.has(phone)) {
                results.skipped++;
                continue;
            }

            const profile = workerRecord.profile_id ? profileMap.get(workerRecord.profile_id) : null;
            if (!canSendWorkerDirectNotifications({
                email: profile?.email || workerRecord.submitted_email,
                phone,
                worker: {
                    agency_id: workerRecord.agency_id,
                    profile_id: workerRecord.profile_id,
                    submitted_email: workerRecord.submitted_email,
                    phone: workerRecord.phone,
                },
            })) {
                results.skipped++;
                continue;
            }

            const name = profile?.full_name?.split(" ")[0] || "there";

            try {
                const sendResult = await sendProfileIncomplete(
                    phone,
                    name,
                    PROFILE_INCOMPLETE_STATUS_PARAM,
                    PROFILE_INCOMPLETE_NEXT_STEP_PARAM,
                    workerRecord.profile_id || undefined
                );

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
