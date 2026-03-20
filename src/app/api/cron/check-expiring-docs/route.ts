import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { queueEmail } from '@/lib/email-templates';
import { normalizeWorkerPhone, pickCanonicalWorkerRecord } from '@/lib/workers';

// Cron job to notify users about expiring documents
// Set this to run daily via Vercel Cron or external trigger
export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
                .select("profile_id, phone, updated_at, entry_fee_paid")
                .in("profile_id", profileIds)
            : { data: [] as Array<{ profile_id: string | null; phone: string | null; updated_at?: string | null; entry_fee_paid?: boolean | null }> };

        const workersByProfileId = new Map<string, Array<{ profile_id: string | null; phone: string | null; updated_at?: string | null; entry_fee_paid?: boolean | null }>>();
        for (const workerRow of workerRows || []) {
            if (!workerRow.profile_id) continue;
            if (!workersByProfileId.has(workerRow.profile_id)) {
                workersByProfileId.set(workerRow.profile_id, []);
            }
            workersByProfileId.get(workerRow.profile_id)?.push(workerRow);
        }

        let processed = 0;

        // Check which users already got a document_expiring email in the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentEmails } = await supabase
            .from('email_queue')
            .select('user_id')
            .eq('email_type', 'document_expiring')
            .eq('status', 'sent')
            .gte('created_at', thirtyDaysAgo);

        const recentlyNotified = new Set(recentEmails?.map(e => e.user_id) || []);

        for (const doc of docs || []) {
            const profile = (doc as any).profiles;

            if (!profile || !profile.email) {
                console.warn(`[Cron] Missing profile/email for document ${doc.id}`);
                continue;
            }

            // Skip if user was already notified in the last 30 days
            if (recentlyNotified.has(profile.id)) {
                continue;
            }

            // Lookup phone for WhatsApp dual-send
            const workerRecord = pickCanonicalWorkerRecord(workersByProfileId.get(profile.id) || []);
            const phone = normalizeWorkerPhone(workerRecord?.phone) || undefined;

            // Send email via queue helper (which tries SMTP immediately)
            await queueEmail(
                supabase,
                profile.id,
                "document_expiring",
                profile.email,
                profile.full_name || "User",
                {
                    documentType: (doc.document_type || "Document").toUpperCase(),
                    expirationDate: new Date(doc.expires_at).toLocaleDateString("en-GB"),
                    offerLink: "https://workersunited.eu/profile/worker/documents"
                },
                undefined,
                phone
            );
            // Mark as notified so we don't send for another doc of the same user in this batch
            recentlyNotified.add(profile.id);
            processed++;
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${processed} expiring documents`,
            processed_count: processed
        });

    } catch (err) {
        console.error("[Cron] Execution failed:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
