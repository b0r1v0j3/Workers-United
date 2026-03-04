
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { queueEmail } from '@/lib/email-templates';

// Config
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for job matching

export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

        // 2. Fetch Verified Candidates (those with at least one verified passport document)
        const { data: verifiedDocs, error: docsError } = await supabase
            .from('candidate_documents')
            .select('user_id')
            .eq('status', 'verified')
            .eq('document_type', 'passport');

        if (docsError) {
            console.error("[Job Match] Error fetching verified docs:", docsError);
            return NextResponse.json({ error: docsError.message }, { status: 500 });
        }

        const verifiedUserIds = verifiedDocs?.map(d => d.user_id) || [];

        if (verifiedUserIds.length === 0) {
            return NextResponse.json({ message: "No verified candidates to match", matched_count: 0 });
        }

        // Fetch candidate details for verified user IDs — only those IN_QUEUE and paid
        const { data: candidates, error: candidatesError } = await supabase
            .from('candidates')
            .select(`
                *,
                profiles!inner(*)
            `)
            .in('profile_id', verifiedUserIds)
            .eq('status', 'IN_QUEUE')
            .eq('entry_fee_paid', true);

        if (candidatesError) {
            console.error("[Job Match] Error fetching candidates:", candidatesError);
            return NextResponse.json({ error: candidatesError.message }, { status: 500 });
        }

        let totalMatches = 0;
        let emailsSent = 0;

        // Pre-fetch active offers for dedup (candidateId|jobId)
        const jobIds = openJobs.map(j => j.id);
        const { data: activeOffers } = await supabase
            .from("offers")
            .select("candidate_id, job_request_id, status")
            .in("job_request_id", jobIds)
            .in("status", ["pending", "accepted"]);

        const activeOfferKeys = new Set<string>();
        const matchedCandidateIds = new Set<string>();
        for (const o of activeOffers || []) {
            if (o.candidate_id && o.job_request_id) {
                activeOfferKeys.add(`${o.candidate_id}|${o.job_request_id}`);
                matchedCandidateIds.add(o.candidate_id);
            }
        }

        // 3. Matching Logic
        for (const job of openJobs) {
            for (const candidate of candidates || []) {
                // One active offer at a time per candidate
                if (matchedCandidateIds.has(candidate.id)) {
                    continue;
                }

                // Skip if no profile (should rely on inner join but safety check)
                if (!candidate.profiles) continue;

                // A. Industry Match
                const jobIndustry = (job.industry || "").toLowerCase();
                const candidateIndustry = (candidate.preferred_job || "").toLowerCase();

                const industryMatch =
                    candidateIndustry === "any" ||
                    candidateIndustry === jobIndustry ||
                    (jobIndustry === "other" && candidateIndustry !== "");

                if (!industryMatch) continue;

                // B. Location Match
                const jobLocation = job.destination_country || "Europe";
                const candidateLocations = candidate.desired_countries || [];

                const locationMatch =
                    candidateLocations.includes("Any") ||
                    candidateLocations.includes(jobLocation);

                if (!locationMatch) continue;

                // C. Match Found! Skip if active offer already exists for this candidate/job
                const offerKey = `${candidate.id}|${job.id}`;
                if (activeOfferKeys.has(offerKey)) {
                    continue;
                }

                // D. Create offer (24h expiry) and move candidate to OFFER_PENDING
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24);

                const { data: offer, error: offerError } = await supabase
                    .from("offers")
                    .insert({
                        job_request_id: job.id,
                        candidate_id: candidate.id,
                        queue_position_at_offer: candidate.queue_position,
                        expires_at: expiresAt.toISOString(),
                    })
                    .select("id")
                    .single();

                if (offerError || !offer) {
                    console.error("[Job Match] Failed to create offer:", offerError);
                    continue;
                }

                await supabase
                    .from("candidates")
                    .update({ status: "OFFER_PENDING" })
                    .eq("id", candidate.id);

                // E. Send notification with real offer link
                await queueEmail(
                    supabase,
                    candidate.profiles.id,
                    "job_match",
                    candidate.profiles.email,
                    candidate.profiles.full_name || "Candidate",
                    {
                        jobId: job.id,
                        jobTitle: job.title,
                        location: job.destination_country || "Europe",
                        salary: `${Number(job.salary_rsd || 0).toLocaleString('de-DE')} RSD`,
                        industry: job.industry,
                        offerLink: `https://workersunited.eu/profile/worker/offers/${offer.id}`
                    }
                );

                // Mark as active so we don't create duplicate offers in this run
                activeOfferKeys.add(offerKey);
                matchedCandidateIds.add(candidate.id);
                totalMatches++;
                emailsSent++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed matching. Sent ${emailsSent} notifications.`,
            matches: totalMatches
        });

    } catch (error) {
        console.error("[Job Match] System error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
