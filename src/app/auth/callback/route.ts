import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logServerActivity } from '@/lib/activityLoggerServer';
import { resolvePostAuthRedirect } from '@/lib/auth-redirect';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next');
    const userTypeParam = searchParams.get('user_type'); // From signup flow
    const claimWorkerIdParam = searchParams.get('claim_worker_id');

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            // Log the auth failure so the brain monitor can detect patterns
            console.error("[Auth Callback] Code exchange failed:", error.message);
            try {
                await logServerActivity("anonymous", "auth_code_exchange_failed", "auth", {
                    error: error.message,
                    code_prefix: code.substring(0, 8) + "...",
                }, "error");
            } catch { /* don't block redirect */ }
            return NextResponse.redirect(`${origin}/auth/auth-code-error`);
        }

        // Get user
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const href = await resolvePostAuthRedirect({
                origin,
                user,
                next,
                userTypeParam,
                claimWorkerIdParam,
            });
            return NextResponse.redirect(href);
        }

        return NextResponse.redirect(`${origin}/profile`);
    }

    const authMode = searchParams.get("type") === "recovery" ? "recovery" : "confirm";
    return NextResponse.redirect(`${origin}/login?mode=${authMode}`);
}
