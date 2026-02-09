
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
        console.log("[Job Match] Starting automated job matching...");

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
            console.log("[Job Match] No open jobs found.");
            return NextResponse.json({ message: "No open jobs to process", matched_count: 0 });
        }

        // 2. Fetch Verified Candidates (those with at least one verified passport document)
        // Note: Joining across tables in Supabase can be tricky without foreign keys set up perfectly.
        // We'll fetch all candidates and their profiles, then filter by verification status if possible.
        // Or fetch verified documents first.

        const { data: verifiedDocs, error: docsError } = await supabase
            .from('documents')
            .select('candidate_id')
            .eq('verification_status', 'verified')
            .eq('document_type', 'passport'); // Focusing on passport verification

        if (docsError) {
            console.error("[Job Match] Error fetching verified docs:", docsError);
            return NextResponse.json({ error: docsError.message }, { status: 500 });
        }

        const verifiedCandidateIds = verifiedDocs?.map(d => d.candidate_id) || [];

        if (verifiedCandidateIds.length === 0) {
            console.log("[Job Match] No verified candidates found.");
            return NextResponse.json({ message: "No verified candidates to match", matched_count: 0 });
        }

        // Fetch candidate details for verified IDs
        const { data: candidates, error: candidatesError } = await supabase
            .from('candidates')
            .select(`
                *,
                profiles!inner(*)
            `)
            .in('id', verifiedCandidateIds);

        if (candidatesError) {
            console.error("[Job Match] Error fetching candidates:", candidatesError);
            return NextResponse.json({ error: candidatesError.message }, { status: 500 });
        }

        let totalMatches = 0;
        let emailsSent = 0;

        // 3. Matching Logic
        for (const job of openJobs) {
            for (const candidate of candidates || []) {
                // Skip if no profile (should rely on inner join but safety check)
                if (!candidate.profiles) continue;

                // A. Indutry Match
                // Job industry: string (e.g. "construction")
                // Candidate preferred_job: string (e.g. "Construction") or "Any"
                const jobIndustry = (job.industry || "").toLowerCase();
                const candidateIndustry = (candidate.preferred_job || "").toLowerCase();

                const industryMatch =
                    candidateIndustry === "any" ||
                    candidateIndustry === jobIndustry ||
                    (jobIndustry === "other" && candidateIndustry !== ""); // Weak match for 'other'

                if (!industryMatch) continue;

                // B. Location Match
                // Job destination_country: string (e.g. "Germany")
                // Candidate desired_countries: string[] (e.g. ["Germany", "Austria"]) or ["Any"]
                const jobLocation = job.destination_country || "Serbia"; // Default fallback
                const candidateLocations = candidate.desired_countries || [];

                const locationMatch =
                    candidateLocations.includes("Any") ||
                    candidateLocations.includes(jobLocation);

                if (!locationMatch) continue;

                // C. Match Found! Check if already notified.
                // We use email_queue to check for previous notifications for this specific job+candidate combo.
                // We'll query JSONB metadata to be efficient? No, metadata filtering can be slow.
                // But for Cron it's okay.
                // Better: Check if we sent 'job_match' to this email with this job ID in metadata.

                /* 
                   Note on Supabase querying JSONB for specific key-value:
                   .contains('template_data', { jobId: job.id }) 
                */
                const { data: existingEmails } = await supabase
                    .from('email_queue')
                    .select('id')
                    .eq('email_type', 'job_match')
                    .eq('recipient_email', candidate.profiles.email)
                    .contains('template_data', { jobId: job.id })
                    .limit(1);

                if (existingEmails && existingEmails.length > 0) {
                    // Already notified about this job
                    continue;
                }

                // D. Send Notification
                console.log(`[Job Match] Matched Job ${job.id} (${job.title}) with Candidate ${candidate.id} (${candidate.profiles.email})`);

                await queueEmail(
                    supabase,
                    candidate.profiles.id,
                    "job_match",
                    candidate.profiles.email,
                    candidate.profiles.full_name || "Candidate",
                    {
                        jobId: job.id, // Critical for deduping
                        jobTitle: job.title,
                        location: job.destination_country || "Serbia",
                        salary: `${Number(job.salary_rsd || 0).toLocaleString('de-DE')} RSD`,
                        industry: job.industry,
                        offerLink: `https://workersunited.eu/jobs/${job.id}` // Assuming this route exists or will exist
                    }
                );

                totalMatches++;
                emailsSent++;
            }
        }

        console.log(`[Job Match] Completed. Found ${totalMatches} matches, sent ${emailsSent} emails.`);

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
