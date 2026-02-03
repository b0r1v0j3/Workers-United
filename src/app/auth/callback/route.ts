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

            // Check if user has completed onboarding
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: candidate } = await supabase
                    .from('candidates')
                    .select('onboarding_completed')
                    .eq('profile_id', user.id)
                    .single();

                // New user or incomplete onboarding -> go to onboarding
                if (!candidate || !candidate.onboarding_completed) {
                    return NextResponse.redirect(`${origin}/onboarding`);
                }
            }

            // Completed onboarding -> go to dashboard
            return NextResponse.redirect(`${origin}/dashboard`);
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

