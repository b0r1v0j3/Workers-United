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

            // Get user and check their type
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const userType = user.user_metadata?.user_type;

                // EMPLOYER FLOW
                if (userType === 'employer') {
                    // Check if employer profile exists
                    const { data: employer } = await supabase
                        .from('employers')
                        .select('id, pib')
                        .eq('profile_id', user.id)
                        .single();

                    // No employer record -> create one and go to profile setup
                    if (!employer) {
                        // Create employer record with profile_id (matching existing schema)
                        await supabase.from('employers').insert({
                            profile_id: user.id,
                            company_name: user.user_metadata?.company_name || null,
                            contact_person: user.user_metadata?.full_name || null,
                            status: 'pending'
                        });
                        return NextResponse.redirect(`${origin}/employer/profile`);
                    }

                    // Incomplete profile -> go to profile setup
                    if (!employer.pib) {
                        return NextResponse.redirect(`${origin}/employer/profile`);
                    }

                    // Complete -> go to employer dashboard
                    return NextResponse.redirect(`${origin}/employer/dashboard`);
                }

                // CANDIDATE FLOW (default)
                const { data: candidate } = await supabase
                    .from('candidates')
                    .select('onboarding_completed')
                    .eq('profile_id', user.id)
                    .single();

                // New user or incomplete onboarding -> go to onboarding
                if (!candidate || !candidate.onboarding_completed) {
                    return NextResponse.redirect(`${origin}/onboarding`);
                }

                // Completed onboarding -> go to dashboard
                return NextResponse.redirect(`${origin}/dashboard`);
            }

            // Fallback
            return NextResponse.redirect(`${origin}/dashboard`);
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
