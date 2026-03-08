import { NextResponse } from 'next/server';
import { claimAgencyWorkerDraft, ensureAgencyRecord, getAgencySchemaState } from '@/lib/agencies';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeUserType } from '@/lib/domain';
import { queueEmail } from '@/lib/email-templates';
import { logServerActivity } from '@/lib/activityLoggerServer';
import { ensureWorkerProfileRecord, ensureWorkerRecord, loadCanonicalWorkerRecord } from '@/lib/workers';

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
            if (!userType && userTypeParam && ['worker', 'employer', 'agency'].includes(userTypeParam)) {
                const adminClient = createAdminClient();
                await adminClient.auth.admin.updateUserById(user.id, {
                    user_metadata: {
                        ...user.user_metadata,
                        user_type: userTypeParam,
                        claimed_worker_id: claimWorkerIdParam || user.user_metadata?.claimed_worker_id || null,
                        gdpr_consent: true,
                        gdpr_consent_at: new Date().toISOString(),
                    },
                });
                userType = userTypeParam;
            }

            // If STILL no user_type (direct Google sign-in without going through signup),
            // redirect to role selection
            const normalizedUserType = normalizeUserType(userType);

            if (!normalizedUserType) {
                await logServerActivity(user.id, "auth_no_role", "auth", { redirect: "/auth/select-role" });
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

            if (normalizedUserType === 'admin') {
                await logServerActivity(user.id, "auth_login", "auth", { role: "admin" });
                return NextResponse.redirect(`${origin}/admin`);
            } else if (normalizedUserType === 'employer') {
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

                await logServerActivity(user.id, "auth_login", "auth", { role: "employer", is_new: !employer });
                return NextResponse.redirect(`${origin}/profile/employer`);
            } else if (normalizedUserType === 'agency') {
                const agencyAdmin = createAdminClient();
                const agencySchemaState = await getAgencySchemaState(agencyAdmin);
                if (!agencySchemaState.ready) {
                    await logServerActivity(user.id, "auth_login", "auth", { role: "agency", setup_required: true });
                    return NextResponse.redirect(`${origin}/profile/agency?setup=required`);
                }

                const agencyResult = await ensureAgencyRecord(agencyAdmin, {
                    userId: user.id,
                    email: user.email,
                    fullName: user.user_metadata?.full_name,
                    agencyName: user.user_metadata?.company_name,
                });

                await logServerActivity(user.id, "auth_login", "auth", { role: "agency", is_new: agencyResult.agencyCreated });
                return NextResponse.redirect(`${origin}/profile/agency`);
            } else {
                const workerAdmin = createAdminClient();
                const claimWorkerId = claimWorkerIdParam || user.user_metadata?.claimed_worker_id || null;
                const attemptedClaim = typeof claimWorkerId === "string" && claimWorkerId.trim().length > 0;
                const profileResult = await ensureWorkerProfileRecord(workerAdmin, {
                    userId: user.id,
                    email: user.email,
                    fullName: user.user_metadata?.full_name,
                });
                if (profileResult.profileCreated) {
                    console.log(`[Auth Callback] Created missing profile for ${user.id}`);
                }

                let claimResult: Awaited<ReturnType<typeof claimAgencyWorkerDraft>> | null = null;
                if (attemptedClaim) {
                    const agencySchemaState = await getAgencySchemaState(workerAdmin);
                    if (agencySchemaState.ready) {
                        claimResult = await claimAgencyWorkerDraft(workerAdmin, {
                            workerId: claimWorkerId,
                            profileId: user.id,
                            email: user.email,
                            fullName: user.user_metadata?.full_name,
                        });
                    }

                    await workerAdmin.auth.admin.updateUserById(user.id, {
                        user_metadata: {
                            ...user.user_metadata,
                            claimed_worker_id: null,
                        },
                    });
                }

                if (!attemptedClaim) {
                    const workerRecordResult = await ensureWorkerRecord(workerAdmin, {
                        userId: user.id,
                        email: user.email,
                        fullName: user.user_metadata?.full_name,
                    });
                    if (workerRecordResult.workerCreated) {
                        console.log(`[Auth Callback] Created missing worker record for ${user.id}`);
                    }
                }

                // Check if the worker onboarding record is incomplete (new signup → go to edit)
                const { data: workerRecordCheck } = await loadCanonicalWorkerRecord(supabase, user.id, "id, phone, nationality, updated_at, entry_fee_paid, queue_joined_at, job_search_active, current_country, preferred_job, status");

                // If no worker record or basic onboarding data is missing, send to edit
                if (!workerRecordCheck || !workerRecordCheck.phone || !workerRecordCheck.nationality) {
                    // Proactive WhatsApp onboarding for new workers with a phone
                    if (workerRecordCheck?.phone) {
                        try {
                            const { sendWelcome } = await import('@/lib/whatsapp');
                            const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'there';
                            await sendWelcome(workerRecordCheck.phone, firstName, user.id);
                        } catch { /* WA is best-effort */ }
                    }

                    await logServerActivity(user.id, "auth_login", "auth", {
                        role: "worker",
                        is_new: true,
                        redirect: "/profile/worker",
                        claim_result: claimResult?.reason || null,
                    });
                    const claimQuery = claimResult ? `?claim=${claimResult.reason}` : "";
                    return NextResponse.redirect(`${origin}/profile/worker${claimQuery}`);
                }

                await logServerActivity(user.id, "auth_login", "auth", {
                    role: "worker",
                    is_new: false,
                    claim_result: claimResult?.reason || null,
                });
                const claimQuery = claimResult ? `?claim=${claimResult.reason}` : "";
                return NextResponse.redirect(`${origin}/profile/worker${claimQuery}`);
            }
        }

        return NextResponse.redirect(`${origin}/profile`);
    }

    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
