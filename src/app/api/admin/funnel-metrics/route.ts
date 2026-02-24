import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, getAllAuthUsers } from '@/lib/supabase/admin';
import { isGodModeUser } from '@/lib/godmode';
import { getWorkerCompletion } from '@/lib/profile-completion';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Auth check: only admins can access funnel metrics
        const authSupabase = await createClient();
        const { data: { user } } = await authSupabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role — matches admin/layout.tsx pattern
        const { data: profile } = await authSupabase
            .from('profiles')
            .select('user_type')
            .eq('id', user.id)
            .single();

        const isOwner = isGodModeUser(user.email);
        if (profile?.user_type !== 'admin' && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = createAdminClient();

        // Parse date range from query params (optional)
        const url = new URL(request.url);
        const fromDate = url.searchParams.get('from');
        const toDate = url.searchParams.get('to');

        // 1. Total Registered Workers (from auth — paginated to get ALL users)
        const allAuthUsers = await getAllAuthUsers(supabase);
        let workerUsers = allAuthUsers.filter((u: any) =>
            u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin'
        );

        // Filter by date range if provided
        if (fromDate) {
            const from = new Date(fromDate);
            workerUsers = workerUsers.filter((u: any) => new Date(u.created_at) >= from);
        }
        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            workerUsers = workerUsers.filter((u: any) => new Date(u.created_at) <= to);
        }

        const totalWorkers = workerUsers.length;

        // 2. Completed Profiles (100% completion using same fields as worker/page.tsx)
        // Fetch all profiles and candidates to calculate per-user completion
        const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, full_name');

        const { data: allCandidates } = await supabase
            .from('candidates')
            .select('profile_id, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, lives_abroad, previous_visas');

        const { data: allDocs } = await supabase
            .from('candidate_documents')
            .select('user_id, document_type, status');

        const profileMap = new Map(allProfiles?.map(p => [p.id, p]) || []);
        const candidateMap = new Map(allCandidates?.map(c => [c.profile_id, c]) || []);

        // Count using shared 16-field getWorkerCompletion() — single source of truth
        let completedCount = 0;
        for (const wu of workerUsers) {
            const p = profileMap.get(wu.id);
            const c = candidateMap.get(wu.id);
            const docs = (allDocs?.filter(d => d.user_id === wu.id) || []) as { document_type: string }[];

            const result = getWorkerCompletion({
                profile: p || null,
                candidate: c || null,
                documents: docs,
            });
            if (result.completion === 100) completedCount++;
        }

        // 3. Uploaded Documents — distinct WORKER users with at least one doc
        const workerIds = new Set(workerUsers.map((u: any) => u.id));
        const workerDocs = allDocs?.filter(d => workerIds.has(d.user_id)) || [];
        const distinctUploaded = new Set(workerDocs.map(d => d.user_id)).size;

        // 4. Verified — distinct WORKER users with verified docs (status = 'verified')
        const verifiedDocs = workerDocs.filter(d => d.status === 'verified');
        const distinctVerified = new Set(verifiedDocs.map(d => d.user_id)).size;

        // 5. Job Matched — distinct recipients of 'job_match' emails
        const { data: jobMatches, error: matchError } = await supabase
            .from('email_queue')
            .select('recipient_email')
            .eq('email_type', 'job_match');

        if (matchError) {
            console.error("[Funnel] Match error:", matchError);
        }
        const distinctMatched = jobMatches
            ? new Set(jobMatches.map(m => m.recipient_email)).size
            : 0;

        // 6. Supply vs Demand (IN_QUEUE candidates vs open job positions)
        const { data: queueCandidates } = await supabase.from('candidates').select('preferred_job').eq('status', 'IN_QUEUE');
        const { data: openJobs } = await supabase.from('job_requests').select('industry, positions_count, positions_filled').in('status', ['open', 'matching']);

        const sdMap = new Map<string, { industry: string, supply: number, demand: number }>();

        queueCandidates?.forEach(c => {
            const ind = c.preferred_job || 'Unspecified';
            if (!sdMap.has(ind)) sdMap.set(ind, { industry: ind, supply: 0, demand: 0 });
            sdMap.get(ind)!.supply += 1;
        });

        openJobs?.forEach(j => {
            const ind = j.industry || 'Unspecified';
            if (!sdMap.has(ind)) sdMap.set(ind, { industry: ind, supply: 0, demand: 0 });
            sdMap.get(ind)!.demand += Math.max(0, (j.positions_count || 0) - (j.positions_filled || 0));
        });

        const supplyDemand = Array.from(sdMap.values()).sort((a, b) => (b.demand + b.supply) - (a.demand + a.supply));

        return NextResponse.json({
            success: true,
            data: {
                total_users: totalWorkers,
                completed_profiles: completedCount,
                uploaded_documents: distinctUploaded,
                verified: distinctVerified,
                job_matched: distinctMatched,
                supply_demand: supplyDemand
            }
        });

    } catch (error) {
        console.error("[Funnel Analytics] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
