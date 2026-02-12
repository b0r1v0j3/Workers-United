import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isGodModeUser } from '@/lib/godmode';

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
            .select('role')
            .eq('id', user.id)
            .single();

        const isOwner = isGodModeUser(user.email);
        if (profile?.role !== 'admin' && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = createAdminClient();

        // Parse date range from query params (optional)
        const url = new URL(request.url);
        const fromDate = url.searchParams.get('from');
        const toDate = url.searchParams.get('to');

        // 1. Total Registered Workers (from auth — same as admin/page.tsx)
        const { data: authData } = await supabase.auth.admin.listUsers();
        const allAuthUsers = authData?.users || [];
        let workerUsers = allAuthUsers.filter((u: any) =>
            u.user_metadata?.user_type !== 'employer'
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

        // Count using same 16-field formula as worker/page.tsx
        let completedCount = 0;
        for (const wu of workerUsers) {
            const p = profileMap.get(wu.id);
            const c = candidateMap.get(wu.id);
            const docs = allDocs?.filter(d => d.user_id === wu.id) || [];

            const fields = [
                p?.full_name,
                c?.phone,
                c?.nationality,
                c?.current_country,
                c?.preferred_job,
                c?.gender,
                c?.date_of_birth,
                c?.birth_country,
                c?.birth_city,
                c?.citizenship,
                c?.marital_status,
                c?.passport_number,
                c?.lives_abroad,      // index 12 — boolean answer, false = valid
                c?.previous_visas,    // index 13 — boolean answer, false = valid
                docs.some(d => d.document_type === 'passport'),
                docs.some(d => d.document_type === 'biometric_photo'),
            ];
            // lives_abroad (12) and previous_visas (13): false is a valid answer
            // Everything else: use truthiness
            const BOOLEAN_ANSWER_INDICES = new Set([12, 13]);
            const filledCount = fields.filter((v, i) =>
                BOOLEAN_ANSWER_INDICES.has(i)
                    ? v !== null && v !== undefined
                    : !!v
            ).length;
            const completion = Math.round((filledCount / fields.length) * 100);
            if (completion === 100) completedCount++;
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

        return NextResponse.json({
            success: true,
            data: {
                total_users: totalWorkers,
                completed_profiles: completedCount,
                uploaded_documents: distinctUploaded,
                verified: distinctVerified,
                job_matched: distinctMatched
            }
        });

    } catch (error) {
        console.error("[Funnel Analytics] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
