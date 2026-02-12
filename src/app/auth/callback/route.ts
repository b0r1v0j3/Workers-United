import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { queueEmail } from '@/lib/email-templates';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next');

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
                const userType = user.user_metadata?.user_type;

                // Queue welcome email if not already sent (avoids duplicate with signup-form auto-confirm path)
                const { data: existing } = await supabase
                    .from('email_queue')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('email_type', 'welcome')
                    .limit(1);

                if (!existing || existing.length === 0) {
                    queueEmail(
                        supabase,
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
                            status: 'pending'
                        });
                    }

                    return NextResponse.redirect(`${origin}/profile/employer`);
                } else {
                    // Workers go to /profile/worker
                    return NextResponse.redirect(`${origin}/profile/worker`);
                }
            }

            return NextResponse.redirect(`${origin}/profile`);
        }
    }

    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
