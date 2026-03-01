import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { queueEmail } from '@/lib/email-templates';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next');
    const userTypeParam = searchParams.get('user_type'); // From signup flow

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // If explicit redirect, use it
            if (next) {
                return NextResponse.redirect(`${origin}${next}`);
            }

            // Get user
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                let userType = user.user_metadata?.user_type;

                // If user_type came from signup URL param (Google signup from signup page),
                // set it in the user's metadata
                if (!userType && userTypeParam && ['worker', 'employer'].includes(userTypeParam)) {
                    const adminClient = createAdminClient();
                    await adminClient.auth.admin.updateUserById(user.id, {
                        user_metadata: {
                            ...user.user_metadata,
                            user_type: userTypeParam,
                            gdpr_consent: true,
                            gdpr_consent_at: new Date().toISOString(),
                        },
                    });
                    userType = userTypeParam;
                }

                // If STILL no user_type (direct Google sign-in without going through signup),
                // redirect to role selection
                if (!userType) {
                    return NextResponse.redirect(`${origin}/auth/select-role`);
                }

                // Queue welcome email if not already sent
                const { data: existing } = await supabase
                    .from('email_queue')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('email_type', 'welcome')
                    .limit(1);

                if (!existing || existing.length === 0) {
                    const adminClient = createAdminClient();
                    queueEmail(
                        adminClient,
                        user.id,
                        'welcome',
                        user.email || '',
                        user.user_metadata?.full_name || user.email?.split('@')[0] || 'there'
                    ).catch(() => { }); // fire-and-forget
                }

                if (userType === 'admin') {
                    return NextResponse.redirect(`${origin}/admin`);
                } else if (userType === 'employer') {
                    // Create employer record if needed
                    const { data: employer } = await supabase
                        .from('employers')
                        .select('id')
                        .eq('profile_id', user.id)
                        .single();

                    if (!employer) {
                        await supabase.from('employers').insert({
                            profile_id: user.id,
                            company_name: user.user_metadata?.company_name || null,
                            status: 'PENDING'
                        });
                    }

                    return NextResponse.redirect(`${origin}/profile/employer`);
                } else {
                    // Check if worker profile is incomplete (new signup → go to edit)
                    const { data: candidateCheck } = await supabase
                        .from("candidates")
                        .select("phone, nationality")
                        .eq("profile_id", user.id)
                        .maybeSingle();

                    // If no candidate record or missing basic fields, send to edit
                    if (!candidateCheck || !candidateCheck.phone || !candidateCheck.nationality) {
                        return NextResponse.redirect(`${origin}/profile/worker/edit`);
                    }

                    return NextResponse.redirect(`${origin}/profile/worker`);
                }
            }

            return NextResponse.redirect(`${origin}/profile`);
        }
    }

    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
