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

        // 1. Total Registered Workers
        // Use auth.admin.listUsers() — same approach as admin/page.tsx
        // This is the reliable source of truth since profiles.user_type may not be populated
        const { data: authData } = await supabase.auth.admin.listUsers();
        const allAuthUsers = authData?.users || [];
        const totalWorkers = allAuthUsers.filter((u: any) =>
            u.user_metadata?.user_type !== 'employer'
        ).length;

        // 2. Completed Profiles
        // Count candidates with nationality filled (proxy for profile completion)
        const { count: completedProfiles, error: profilesError } = await supabase
            .from('candidates')
            .select('*', { count: 'exact', head: true })
            .not('nationality', 'is', null);

        if (profilesError) {
            console.error("[Funnel] Profiles error:", profilesError);
        }

        // 3. Uploaded Documents
        // Distinct candidates who have uploaded at least one document
        const { data: uploadedDocs, error: uploadError } = await supabase
            .from('documents')
            .select('candidate_id');

        if (uploadError) {
            console.error("[Funnel] Upload error:", uploadError);
        }
        const distinctUploaded = uploadedDocs
            ? new Set(uploadedDocs.map(d => d.candidate_id)).size
            : 0;

        // 4. Verified Documents
        // Distinct candidates with at least one verified document
        const { data: verifiedDocs, error: verifyError } = await supabase
            .from('documents')
            .select('candidate_id')
            .eq('verification_status', 'verified');

        if (verifyError) {
            console.error("[Funnel] Verify error:", verifyError);
        }
        const distinctVerified = verifiedDocs
            ? new Set(verifiedDocs.map(d => d.candidate_id)).size
            : 0;

        // 5. Job Matched (or Emailed)
        // Count distinct recipients of 'job_match' emails
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
