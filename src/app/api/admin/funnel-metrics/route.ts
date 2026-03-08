import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, getAllAuthUsers } from '@/lib/supabase/admin';
import { isGodModeUser } from '@/lib/godmode';
import { getWorkerCompletion } from '@/lib/profile-completion';
import { isReportablePaymentProfile } from '@/lib/reporting';
import { pickCanonicalWorkerRecord } from '@/lib/workers';

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
        // Fetch all profiles and worker onboarding rows to calculate per-user completion
        const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email');

        const { data: allWorkerRecords } = await supabase
            .from('worker_onboarding')
            .select('profile_id, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, lives_abroad, previous_visas');

        const { data: allDocs } = await supabase
            .from('worker_documents')
            .select('user_id, document_type, status');

        const profileMap = new Map(allProfiles?.map(p => [p.id, p]) || []);
        const workerGroups = new Map<string, any[]>();
        for (const workerRow of allWorkerRecords || []) {
            if (!workerRow?.profile_id) continue;
            const current = workerGroups.get(workerRow.profile_id) || [];
            current.push(workerRow);
            workerGroups.set(workerRow.profile_id, current);
        }
        const workerMap = new Map(
            Array.from(workerGroups.entries())
                .map(([profileId, rows]) => [profileId, pickCanonicalWorkerRecord(rows)])
                .filter((entry): entry is [string, any] => !!entry[1])
        );

        // Count using shared 16-field getWorkerCompletion() — single source of truth
        let completedCount = 0;
        for (const wu of workerUsers) {
            const p = profileMap.get(wu.id);
            const worker = workerMap.get(wu.id);
            const docs = (allDocs?.filter(d => d.user_id === wu.id) || []) as { document_type: string }[];

            const result = getWorkerCompletion({
                profile: p || null,
                worker: worker || null,
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

        // 6. Supply vs Demand (IN_QUEUE workers vs open job positions)
        const { data: queueWorkerRows } = await supabase.from('worker_onboarding').select('preferred_job').eq('status', 'IN_QUEUE');
        const { data: openJobs } = await supabase.from('job_requests').select('industry, positions_count, positions_filled').in('status', ['open', 'matching']);

        const sdMap = new Map<string, { industry: string, supply: number, demand: number }>();

        queueWorkerRows?.forEach(workerRow => {
            const ind = workerRow.preferred_job || 'Unspecified';
            if (!sdMap.has(ind)) sdMap.set(ind, { industry: ind, supply: 0, demand: 0 });
            sdMap.get(ind)!.supply += 1;
        });

        openJobs?.forEach(j => {
            const ind = j.industry || 'Unspecified';
            if (!sdMap.has(ind)) sdMap.set(ind, { industry: ind, supply: 0, demand: 0 });
            sdMap.get(ind)!.demand += Math.max(0, (j.positions_count || 0) - (j.positions_filled || 0));
        });

        const supplyDemand = Array.from(sdMap.values()).sort((a, b) => (b.demand + b.supply) - (a.demand + a.supply));

        // 7. Time-series data for charts (last 30 days by default, or based on date range)
        const timeSeriesMap = new Map<string, { date: string, workers: number, employers: number, revenue: number }>();

        // Helper to get past N days
        const generateDates = (days: number) => {
            const arr = [];
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                arr.push(d.toISOString().split('T')[0]);
            }
            return arr;
        };

        const dateKeys = generateDates(30);
        dateKeys.forEach(date => {
            timeSeriesMap.set(date, { date, workers: 0, employers: 0, revenue: 0 });
        });

        // Populate worker signups
        allAuthUsers.forEach((u: any) => {
            if (u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin') {
                const dateKey = new Date(u.created_at).toISOString().split('T')[0];
                if (timeSeriesMap.has(dateKey)) {
                    timeSeriesMap.get(dateKey)!.workers += 1;
                }
            }
        });

        // Populate employer signups (need to fetch employers)
        const { data: allEmployers } = await supabase.from('employers').select('created_at');
        allEmployers?.forEach((e: any) => {
            const dateKey = new Date(e.created_at).toISOString().split('T')[0];
            if (timeSeriesMap.has(dateKey)) {
                timeSeriesMap.get(dateKey)!.employers += 1;
            }
        });

        // Populate revenue (need to fetch payments)
        const paymentProfileMap = new Map(allProfiles?.map(p => [p.id, p]) || []);

        const { data: allPayments } = await supabase
            .from('payments')
            .select('amount, amount_cents, paid_at, status, profile_id')
            .in('status', ['paid', 'completed']);
        allPayments?.forEach((p: any) => {
            if (!p.paid_at) {
                return;
            }

            const paymentProfile = p.profile_id ? paymentProfileMap.get(p.profile_id) || null : null;
            if (!isReportablePaymentProfile(paymentProfile)) {
                return;
            }

            const dateKey = new Date(p.paid_at).toISOString().split('T')[0];
            if (timeSeriesMap.has(dateKey)) {
                const value = p.amount != null ? Number(p.amount) : Number(p.amount_cents || 0) / 100;
                timeSeriesMap.get(dateKey)!.revenue += Number.isFinite(value) ? value : 0;
            }
        });

        const timeSeriesData = Array.from(timeSeriesMap.values());

        return NextResponse.json({
            success: true,
            data: {
                total_users: totalWorkers,
                completed_profiles: completedCount,
                uploaded_documents: distinctUploaded,
                verified: distinctVerified,
                job_matched: distinctMatched,
                supply_demand: supplyDemand,
                time_series: timeSeriesData
            }
        });

    } catch (error) {
        console.error("[Funnel Analytics] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
