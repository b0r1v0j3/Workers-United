
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

        console.log("[Funnel Analytics] Fetching metrics...");

        // 1. Total Registered (Workers)
        // We'll count from profiles table as it's cleaner than auth list
        const { count: totalUsers, error: usersError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('user_type', 'worker'); // Assuming user_type column exists and is populated

        if (usersError) throw usersError;

        // 2. Completed Profiles
        // Proxy: Workers who have filled out nationality in candidates table
        const { count: completedProfiles, error: profilesError } = await supabase
            .from('candidates')
            .select('*', { count: 'exact', head: true })
            .not('nationality', 'is', null);

        if (profilesError) throw profilesError;

        // 3. Uploaded Documents
        // Distinct candidates who have uploaded at least one document
        // This requires a slightly more complex query or multiple steps.
        // Supabase select with distinct count is tricky via client.
        // We'll fetch candidate_ids and count unique in JS for now (assuming scale < 10k)
        const { data: uploadedDocs, error: uploadError } = await supabase
            .from('documents')
            .select('candidate_id');

        if (uploadError) throw uploadError;
        const distinctUploaded = new Set(uploadedDocs.map(d => d.candidate_id)).size;

        // 4. Verified Documents
        // Distinct candidates with at least one verified document
        const { data: verifiedDocs, error: verifyError } = await supabase
            .from('documents')
            .select('candidate_id')
            .eq('verification_status', 'verified');

        if (verifyError) throw verifyError;
        const distinctVerified = new Set(verifiedDocs.map(d => d.candidate_id)).size;

        // 5. Job Matched (or Emailed)
        // Count distinct recipients of 'job_match' emails
        // Ideally we'd join with profiles to get IDs, but email is unique.
        const { data: jobMatches, error: matchError } = await supabase
            .from('email_queue')
            .select('recipient_email')
            .eq('email_type', 'job_match');

        if (matchError) throw matchError;
        const distinctMatched = new Set(jobMatches.map(m => m.recipient_email)).size;


        return NextResponse.json({
            success: true,
            data: {
                total_users: totalUsers || 0,
                completed_profiles: completedProfiles || 0,
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
