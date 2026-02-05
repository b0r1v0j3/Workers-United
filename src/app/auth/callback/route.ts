import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

                if (userType === 'employer') {
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

                    // Employers go to /profile
                    return NextResponse.redirect(`${origin}/profile`);
                } else {
                    // Workers go to /dashboard (old working page)
                    return NextResponse.redirect(`${origin}/dashboard`);
                }
            }

            return NextResponse.redirect(`${origin}/dashboard`);
        }
    }

    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
