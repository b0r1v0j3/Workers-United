
import { NextResponse } from 'next/server';
import { hasValidCronBearerToken } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { queueEmail } from '@/lib/email-templates';
import { buildPlatformUrl } from '@/lib/platform-contact';

// Config
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for job matching

export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (!hasValidCronBearerToken(authHeader)) {
        console.warn("[Job Match] Unauthorized access attempt.");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createAdminClient();

        // BUG-002 fix: Distributed lock — skip if last job_match email was sent < 5 min ago
        // This prevents duplicate emails from concurrent Vercel cron retries
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recentRun } = await supabase
            .from("email_queue")
            .select("id")
            .eq("email_type", "job_match")
            .gte("created_at", fiveMinAgo)
            .limit(1);

        if (recentRun && recentRun.length > 0) {
            return NextResponse.json({
                message: "Skipped — match-jobs ran recently (< 5 min ago)",
                matched_count: 0
            });
        }

        // 1. Fetch Open Jobs
        const { data: openJobs, error: jobsError } = await supabase
            .from('job_requests')
            .select('*')
            .eq('status', 'open');

        if (jobsError) {
            console.error("[Job Match] Error fetching jobs:", jobsError);
            return NextResponse.json({ error: jobsError.message }, { status: 500 });
        }

        if (!openJobs || openJobs.length === 0) {
            return NextResponse.json({ message: "No open jobs to process", matched_count: 0 });
        }

        // 2. Fetch verified worker documents (at least one verified passport)
        const { data: verifiedDocs, error: docsError } = await supabase
            .from('worker_documents')
            .select('user_id')
            .eq('status', 'verified')
            .eq('document_type', 'passport');

        if (docsError) {
            console.error("[Job Match] Error fetching verified docs:", docsError);
            return NextResponse.json({ error: docsError.message }, { status: 500 });
        }

        const verifiedUserIds = verifiedDocs?.map(d => d.user_id) || [];

        if (verifiedUserIds.length === 0) {
            return NextResponse.json({ message: "No verified workers to match", matched_count: 0 });
        }

        // Fetch worker onboarding rows for verified profile IDs — only those IN_QUEUE and paid
        const { data: workerRows, error: workerRowsError } = await supabase
            .from('worker_onboarding')
            .select(`
                *,
                profiles!inner(*)
            `)
            .in('profile_id', verifiedUserIds)
            .eq('status', 'IN_QUEUE')
            .eq('entry_fee_paid', true);

        if (workerRowsError) {
            console.error("[Job Match] Error fetching worker rows:", workerRowsError);
            return NextResponse.json({ error: workerRowsError.message }, { status: 500 });
        }

        let totalMatches = 0;
        let emailsSent = 0;
        let emailFailures = 0;

        // Pre-fetch active offers for dedup (workerRecordId|jobId)
        const jobIds = openJobs.map(j => j.id);
        const { data: activeOffers } = await supabase
            .from("offers")
            .select("worker_id, job_request_id, status")
            .in("job_request_id", jobIds)
            .in("status", ["pending", "accepted"]);

        const activeOfferKeys = new Set<string>();
        const matchedWorkerRecordIds = new Set<string>();
        for (const o of activeOffers || []) {
            if (o.worker_id && o.job_request_id) {
                activeOfferKeys.add(`${o.worker_id}|${o.job_request_id}`);
                matchedWorkerRecordIds.add(o.worker_id);
            }
        }

        // 3. Matching Logic
        for (const job of openJobs) {
            for (const workerRow of workerRows || []) {
                // One active offer at a time per worker
                if (matchedWorkerRecordIds.has(workerRow.id)) {
                    continue;
                }

                // Skip if no profile (should rely on inner join but safety check)
                if (!workerRow.profiles) continue;

                // A. Industry Match
                const jobIndustry = (job.industry || "").toLowerCase();
                const workerIndustry = (workerRow.preferred_job || "").toLowerCase();

                const industryMatch =
                    workerIndustry === "any" ||
                    workerIndustry === jobIndustry ||
                    (jobIndustry === "other" && workerIndustry !== "");

                if (!industryMatch) continue;

                // B. Location Match
                const jobLocation = job.destination_country || "Europe";
                const workerPreferredLocations = workerRow.desired_countries || [];

                const locationMatch =
                    workerPreferredLocations.includes("Any") ||
                    workerPreferredLocations.includes(jobLocation);

                if (!locationMatch) continue;

                // C. Match found. Skip if an active offer already exists for this worker/job.
                const offerKey = `${workerRow.id}|${job.id}`;
                if (activeOfferKeys.has(offerKey)) {
                    continue;
                }

                // D. Create offer (24h expiry) and move worker to OFFER_PENDING
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24);

                const { data: offer, error: offerError } = await supabase
                    .from("offers")
                    .insert({
                        job_request_id: job.id,
                        worker_id: workerRow.id,
                        queue_position_at_offer: workerRow.queue_position,
                        expires_at: expiresAt.toISOString(),
                    })
                    .select("id")
                    .single();

                if (offerError || !offer) {
                    console.error("[Job Match] Failed to create offer:", offerError);
                    continue;
                }

                await supabase
                    .from("worker_onboarding")
                    .update({ status: "OFFER_PENDING" })
                    .eq("id", workerRow.id);

                // E. Send notification with real offer link
                const emailResult = await queueEmail(
                    supabase,
                    workerRow.profiles.id,
                    "job_match",
                    workerRow.profiles.email,
                    workerRow.profiles.full_name || "Worker",
                    {
                        jobId: job.id,
                        jobTitle: job.title,
                        location: job.destination_country || "Europe",
                        salary: `${Number(job.salary_rsd || 0).toLocaleString('de-DE')} RSD`,
                        industry: job.industry,
                        offerLink: buildPlatformUrl(process.env.NEXT_PUBLIC_BASE_URL, `/profile/worker/offers/${offer.id}`),
                    }
                );

                if (emailResult.sent) {
                    emailsSent++;
                } else {
                    emailFailures++;
                    console.warn("[Job Match] Offer email queue/send failed:", {
                        workerProfileId: workerRow.profiles.id,
                        workerEmail: workerRow.profiles.email,
                        offerId: offer.id,
                        error: emailResult.error || "Unknown email queue failure",
                    });
                }

                // Mark as active so we don't create duplicate offers in this run
                activeOfferKeys.add(offerKey);
                matchedWorkerRecordIds.add(workerRow.id);
                totalMatches++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed matching. Sent ${emailsSent} notifications.${emailFailures > 0 ? ` ${emailFailures} failed.` : ""}`,
            matches: totalMatches,
            emails_sent: emailsSent,
            email_failures: emailFailures,
        });

    } catch (error) {
        console.error("[Job Match] System error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
