import { NextResponse } from 'next/server';
import { hasValidCronBearerToken } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { queueEmail } from '@/lib/email-templates';
import { isEmailDeliveryAccepted } from '@/lib/email-queue';
import { buildPlatformUrl } from '@/lib/platform-contact';
import { hasKnownTypoEmailDomain, isInternalOrTestEmail } from '@/lib/reporting';
import { canSendWorkerDirectNotifications } from '@/lib/worker-notification-eligibility';
import { normalizeWorkerPhone, pickCanonicalWorkerRecord } from '@/lib/workers';

type ExpiringDocWorkerRow = {
    profile_id: string | null;
    agency_id: string | null;
    submitted_email: string | null;
    phone: string | null;
    updated_at?: string | null;
    entry_fee_paid?: boolean | null;
};

// Cron job to notify users about expiring documents
// Set this to run daily via Vercel Cron or external trigger
export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (!hasValidCronBearerToken(authHeader)) {
        console.warn("[Cron] Unauthorized access attempt.");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createAdminClient();

        // Check documents expiring between now and 6 months from now
        const today = new Date();
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(today.getMonth() + 6);

        // Query verified documents with expiry dates
        const { data: docs, error } = await supabase
            .from('worker_documents')
            .select(`
                *,
                profiles:user_id(
                    id,
                    email,
                    full_name
                )
            `)
            .eq('status', 'verified')
            .gt('expires_at', today.toISOString())
            .lte('expires_at', sixMonthsFromNow.toISOString());

        if (error) {
            console.error("[Cron] Database error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const profileIds = Array.from(new Set(
            (docs || [])
                .map((doc) => (doc as any).profiles?.id)
                .filter((value): value is string => typeof value === "string" && value.length > 0)
        ));
        const { data: workerRows } = profileIds.length > 0
            ? await supabase
                .from("worker_onboarding")
                .select("profile_id, agency_id, submitted_email, phone, updated_at, entry_fee_paid")
                .in("profile_id", profileIds)
            : { data: [] as ExpiringDocWorkerRow[] };

        const workersByProfileId = new Map<string, ExpiringDocWorkerRow[]>();
        for (const workerRow of (workerRows || []) as ExpiringDocWorkerRow[]) {
            if (!workerRow.profile_id) continue;
            if (!workersByProfileId.has(workerRow.profile_id)) {
                workersByProfileId.set(workerRow.profile_id, []);
            }
            workersByProfileId.get(workerRow.profile_id)?.push(workerRow);
        }

        let processed = 0;
        let failed = 0;

        // Check which users already got a document_expiring email in the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentEmails } = await supabase
            .from('email_queue')
            .select('user_id')
            .eq('email_type', 'document_expiring')
            .in('status', ['pending', 'sent'])
            .gte('created_at', thirtyDaysAgo);

        const recentlyNotified = new Set(recentEmails?.map(e => e.user_id) || []);

        for (const doc of docs || []) {
            const profile = (doc as any).profiles;

            if (!profile || !profile.email) {
                console.warn(`[Cron] Missing profile/email for document ${doc.id}`);
                continue;
            }

            const normalizedEmail = profile.email.trim().toLowerCase();
            if (!normalizedEmail || isInternalOrTestEmail(normalizedEmail) || hasKnownTypoEmailDomain(normalizedEmail)) {
                continue;
            }

            // Skip if user was already notified in the last 30 days
            if (recentlyNotified.has(profile.id)) {
                continue;
            }

            // Lookup phone for WhatsApp dual-send
            const workerRecord = pickCanonicalWorkerRecord(workersByProfileId.get(profile.id) || []);
            const phone = normalizeWorkerPhone(workerRecord?.phone) || undefined;
            if (!canSendWorkerDirectNotifications({
                email: normalizedEmail,
                phone,
                worker: workerRecord
                    ? {
                        agency_id: workerRecord.agency_id ?? null,
                        profile_id: workerRecord.profile_id ?? null,
                        submitted_email: workerRecord.submitted_email ?? null,
                        phone: workerRecord.phone ?? null,
                    }
                    : null,
            })) {
                continue;
            }

            // Send email via queue helper (which tries SMTP immediately)
            const emailResult = await queueEmail(
                supabase,
                profile.id,
                "document_expiring",
                normalizedEmail,
                profile.full_name || "User",
                {
                    documentType: (doc.document_type || "Document").toUpperCase(),
                    expirationDate: new Date(doc.expires_at).toLocaleDateString("en-GB"),
                    offerLink: buildPlatformUrl(process.env.NEXT_PUBLIC_BASE_URL, "/profile/worker/documents"),
                },
                undefined,
                phone
            );

            if (!isEmailDeliveryAccepted(emailResult)) {
                failed++;
                console.warn(`[Cron] Failed to queue/send document expiring notice for ${normalizedEmail}: ${emailResult.error || "Unknown email queue failure"}`);
                continue;
            }

            // Mark as notified so we don't send for another doc of the same user in this batch
            recentlyNotified.add(profile.id);
            processed++;
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${processed} expiring documents`,
            processed_count: processed,
            failed_count: failed,
        });

    } catch (err) {
        console.error("[Cron] Execution failed:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
