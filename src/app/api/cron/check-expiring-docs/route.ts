import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { queueEmail } from '@/lib/email-templates';

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
            .from('documents')
            .select(`
                *,
                candidates!inner(
                    profiles!inner(
                        id,
                        email,
                        full_name
                    )
                )
            `)
            .eq('verification_status', 'verified')
            .gt('expires_at', today.toISOString())
            .lte('expires_at', sixMonthsFromNow.toISOString())
            .limit(50); // Limit batch size to prevent timeouts

        if (error) {
            console.error("[Cron] Database error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let processed = 0;

        // Check which users already got a document_expiring email in the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentEmails } = await supabase
            .from('email_queue')
            .select('user_id')
            .eq('email_type', 'document_expiring')
            .gte('created_at', thirtyDaysAgo);

        const recentlyNotified = new Set(recentEmails?.map(e => e.user_id) || []);

        for (const doc of docs || []) {
            const profile = (doc.candidates as any)?.profiles;

            if (!profile || !profile.email) {
                console.warn(`[Cron] Missing profile/email for document ${doc.id}`);
                continue;
            }

            // Skip if user was already notified in the last 30 days
            if (recentlyNotified.has(profile.id)) {
                continue;
            }

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
                }
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
