import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, getAllAuthUsers } from '@/lib/supabase/admin';
import { isGodModeUser } from '@/lib/godmode';
import { classifyEntryFeePaymentQuality, readPaymentQualityMarketSignals } from '@/lib/payment-quality';
import { getWorkerCompletion } from '@/lib/profile-completion';
import { isReportablePaymentProfile } from '@/lib/reporting';
import { pickCanonicalWorkerRecord } from '@/lib/workers';

export const dynamic = 'force-dynamic';

interface PaymentRow {
    id: string;
    profile_id: string | null;
    status: string | null;
    payment_type: string | null;
    stripe_checkout_session_id: string | null;
    paid_at: string | null;
    deadline_at: string | null;
    metadata: unknown;
    amount?: number | null;
    amount_cents?: number | null;
}

interface PaymentActivityRow {
    user_id: string | null;
    action: string;
    created_at: string | null;
    details: unknown;
}

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function extractStringField(value: unknown, key: string): string | null {
    const objectValue = asObject(value);
    if (!objectValue) {
        return null;
    }

    const field = objectValue[key];
    return typeof field === 'string' && field.trim() ? field.trim() : null;
}

function parseIsoDate(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCheckoutCreatedAt(payment: PaymentRow, activities: PaymentActivityRow[]) {
    const metadataStartedAt = parseIsoDate(extractStringField(payment.metadata, 'checkout_started_at'));
    if (metadataStartedAt) {
        return metadataStartedAt;
    }

    const activityByPayment = activities.find((activity) =>
        activity.action === 'checkout_session_created'
        && extractStringField(activity.details, 'payment_id') === payment.id
    );
    if (activityByPayment?.created_at) {
        return parseIsoDate(activityByPayment.created_at);
    }

    if (payment.stripe_checkout_session_id) {
        const activityBySession = activities.find((activity) =>
            activity.action === 'checkout_session_created'
            && extractStringField(activity.details, 'stripe_session_id') === payment.stripe_checkout_session_id
        );
        if (activityBySession?.created_at) {
            return parseIsoDate(activityBySession.created_at);
        }
    }

    const deadlineAt = parseIsoDate(payment.deadline_at);
    if (deadlineAt) {
        return new Date(deadlineAt.getTime() - 72 * 60 * 60 * 1000);
    }

    return null;
}

function getPaymentFailureOrExpiryAt(payment: PaymentRow, activities: PaymentActivityRow[]) {
    const metadataFailureAt = parseIsoDate(extractStringField(payment.metadata, 'stripe_failure_at'));
    if (metadataFailureAt) {
        return metadataFailureAt;
    }

    const metadataExpiredAt = parseIsoDate(extractStringField(payment.metadata, 'stripe_session_expired_at'));
    if (metadataExpiredAt) {
        return metadataExpiredAt;
    }

    const activityByPayment = activities.find((activity) =>
        (activity.action === 'payment_failed' || activity.action === 'checkout_session_expired')
        && extractStringField(activity.details, 'payment_id') === payment.id
    );
    if (activityByPayment?.created_at) {
        return parseIsoDate(activityByPayment.created_at);
    }

    if (payment.stripe_checkout_session_id) {
        const activityBySession = activities.find((activity) =>
            activity.action === 'checkout_session_expired'
            && extractStringField(activity.details, 'stripe_session_id') === payment.stripe_checkout_session_id
        );
        if (activityBySession?.created_at) {
            return parseIsoDate(activityBySession.created_at);
        }
    }

    return null;
}

function getPaymentLastEventAt(payment: PaymentRow, activities: PaymentActivityRow[]) {
    return parseIsoDate(payment.paid_at)
        || getPaymentFailureOrExpiryAt(payment, activities)
        || getCheckoutCreatedAt(payment, activities);
}

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
            .select('user_type')
            .eq('id', user.id)
            .single();

        const isOwner = isGodModeUser(user.email);
        if (profile?.user_type !== 'admin' && !isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = createAdminClient();

        // Parse date range from query params (optional)
        const url = new URL(request.url);
        const fromDate = url.searchParams.get('from');
        const toDate = url.searchParams.get('to');
        const fromBoundary = fromDate ? new Date(fromDate) : null;
        const toBoundary = toDate ? new Date(toDate) : null;
        if (toBoundary) {
            toBoundary.setHours(23, 59, 59, 999);
        }

        // 1. Total Registered Workers (from auth — paginated to get ALL users)
        const allAuthUsers = await getAllAuthUsers(supabase);
        let workerUsers = allAuthUsers.filter((u: any) =>
            u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin'
        );

        // Filter by date range if provided
        if (fromDate) {
            workerUsers = workerUsers.filter((u: any) => new Date(u.created_at) >= fromBoundary!);
        }
        if (toDate) {
            workerUsers = workerUsers.filter((u: any) => new Date(u.created_at) <= toBoundary!);
        }

        const totalWorkers = workerUsers.length;

        // 2. Completed Profiles (100% completion using same fields as worker/page.tsx)
        // Fetch all profiles and worker onboarding rows to calculate per-user completion
        const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email');

        const { data: allWorkerRecords } = await supabase
            .from('worker_onboarding')
            .select('profile_id, status, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, lives_abroad, previous_visas');

        const { data: allDocs } = await supabase
            .from('worker_documents')
            .select('user_id, document_type, status');

        const profileMap = new Map(allProfiles?.map(p => [p.id, p]) || []);
        const workerGroups = new Map<string, any[]>();
        for (const workerRow of allWorkerRecords || []) {
            if (!workerRow?.profile_id) continue;
            const current = workerGroups.get(workerRow.profile_id) || [];
            current.push(workerRow);
            workerGroups.set(workerRow.profile_id, current);
        }
        const workerMap = new Map(
            Array.from(workerGroups.entries())
                .map(([profileId, rows]) => [profileId, pickCanonicalWorkerRecord(rows)])
                .filter((entry): entry is [string, any] => !!entry[1])
        );

        // Count using shared 16-field getWorkerCompletion() — single source of truth
        let completedCount = 0;
        for (const wu of workerUsers) {
            const p = profileMap.get(wu.id);
            const worker = workerMap.get(wu.id);
            const docs = (allDocs?.filter(d => d.user_id === wu.id) || []) as { document_type: string }[];

            const result = getWorkerCompletion({
                profile: p || null,
                worker: worker || null,
                documents: docs,
            });
            if (result.completion === 100) completedCount++;
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

        // 6. Supply vs Demand (IN_QUEUE workers vs open job positions)
        const { data: queueWorkerRows } = await supabase.from('worker_onboarding').select('preferred_job').eq('status', 'IN_QUEUE');
        const { data: openJobs } = await supabase.from('job_requests').select('industry, positions_count, positions_filled').in('status', ['open', 'matching']);

        const sdMap = new Map<string, { industry: string, supply: number, demand: number }>();

        queueWorkerRows?.forEach(workerRow => {
            const ind = workerRow.preferred_job || 'Unspecified';
            if (!sdMap.has(ind)) sdMap.set(ind, { industry: ind, supply: 0, demand: 0 });
            sdMap.get(ind)!.supply += 1;
        });

        openJobs?.forEach(j => {
            const ind = j.industry || 'Unspecified';
            if (!sdMap.has(ind)) sdMap.set(ind, { industry: ind, supply: 0, demand: 0 });
            sdMap.get(ind)!.demand += Math.max(0, (j.positions_count || 0) - (j.positions_filled || 0));
        });

        const supplyDemand = Array.from(sdMap.values()).sort((a, b) => (b.demand + b.supply) - (a.demand + a.supply));

        // 7. Time-series data for charts (last 30 days by default, or based on date range)
        const timeSeriesMap = new Map<string, { date: string, workers: number, employers: number, revenue: number }>();

        // Helper to get past N days
        const generateDates = (days: number) => {
            const arr = [];
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                arr.push(d.toISOString().split('T')[0]);
            }
            return arr;
        };

        const dateKeys = generateDates(30);
        dateKeys.forEach(date => {
            timeSeriesMap.set(date, { date, workers: 0, employers: 0, revenue: 0 });
        });

        // Populate worker signups
        allAuthUsers.forEach((u: any) => {
            if (u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin') {
                const dateKey = new Date(u.created_at).toISOString().split('T')[0];
                if (timeSeriesMap.has(dateKey)) {
                    timeSeriesMap.get(dateKey)!.workers += 1;
                }
            }
        });

        // Populate employer signups (need to fetch employers)
        const { data: allEmployers } = await supabase.from('employers').select('created_at');
        allEmployers?.forEach((e: any) => {
            const dateKey = new Date(e.created_at).toISOString().split('T')[0];
            if (timeSeriesMap.has(dateKey)) {
                timeSeriesMap.get(dateKey)!.employers += 1;
            }
        });

        // Populate revenue (need to fetch payments)
        const { data: allPayments } = await supabase
            .from('payments')
            .select('id, profile_id, status, payment_type, stripe_checkout_session_id, paid_at, deadline_at, metadata, amount, amount_cents');
        const typedPayments = (allPayments || []) as PaymentRow[];
        typedPayments
            .filter((payment) => ['paid', 'completed'].includes(payment.status || ''))
            .forEach((p) => {
            if (!p.paid_at) {
                return;
            }

            const paymentProfile = p.profile_id ? profileMap.get(p.profile_id) || null : null;
            if (!isReportablePaymentProfile(paymentProfile)) {
                return;
            }

            const dateKey = new Date(p.paid_at).toISOString().split('T')[0];
            if (timeSeriesMap.has(dateKey)) {
                const value = p.amount != null ? Number(p.amount) : Number(p.amount_cents || 0) / 100;
                timeSeriesMap.get(dateKey)!.revenue += Number.isFinite(value) ? value : 0;
            }
            });

        const entryFeePayments = typedPayments.filter((payment) => payment.payment_type === 'entry_fee' && !!payment.profile_id);
        const paymentProfileIds = [...new Set(entryFeePayments.map((payment) => payment.profile_id).filter(Boolean))] as string[];
        const { data: paymentActivities, error: paymentActivitiesError } = paymentProfileIds.length === 0
            ? { data: [] as PaymentActivityRow[], error: null }
            : await supabase
                .from('user_activity')
                .select('user_id, action, created_at, details')
                .in('user_id', paymentProfileIds)
                .in('action', ['checkout_session_created', 'payment_completed', 'payment_failed', 'checkout_session_expired'])
                .order('created_at', { ascending: false })
                .range(0, 3999);

        if (paymentActivitiesError) {
            console.error('[Funnel] Payment activity error:', paymentActivitiesError);
        }

        const activitiesByProfile = new Map<string, PaymentActivityRow[]>();
        for (const activity of (paymentActivities || []) as PaymentActivityRow[]) {
            if (!activity.user_id) {
                continue;
            }

            const current = activitiesByProfile.get(activity.user_id) || [];
            current.push(activity);
            activitiesByProfile.set(activity.user_id, current);
        }

        const latestEntryFeeAttemptByProfile = new Map<string, {
            payment: PaymentRow;
            checkoutCreatedAt: Date | null;
            lastEventAt: Date | null;
        }>();

        for (const payment of entryFeePayments) {
            const profileId = payment.profile_id as string;
            const activities = activitiesByProfile.get(profileId) || [];
            const checkoutCreatedAt = getCheckoutCreatedAt(payment, activities);
            const lastEventAt = getPaymentLastEventAt(payment, activities);
            const sortTime = lastEventAt?.getTime() || checkoutCreatedAt?.getTime() || 0;

            if (!sortTime) {
                continue;
            }

            const current = latestEntryFeeAttemptByProfile.get(profileId);
            const currentSortTime = current?.lastEventAt?.getTime() || current?.checkoutCreatedAt?.getTime() || 0;

            if (!current || sortTime >= currentSortTime) {
                latestEntryFeeAttemptByProfile.set(profileId, {
                    payment,
                    checkoutCreatedAt,
                    lastEventAt,
                });
            }
        }

        const paymentQuality = {
            paid: 0,
            active: 0,
            expired: 0,
            abandoned: 0,
            bank_declined: 0,
            stripe_blocked: 0,
            worker_countries: [] as Array<{ country: string; count: number }>,
            billing_countries: [] as Array<{ country: string; count: number }>,
            recent_issues: [] as Array<{
                profile_id: string;
                full_name: string;
                email: string;
                worker_status: string;
                outcome: string;
                outcome_label: string;
                outcome_detail: string;
                worker_country: string | null;
                billing_country: string | null;
                card_country: string | null;
                hours_since_checkout: number | null;
                last_event_at: string | null;
                workspace_href: string;
                case_href: string;
            }>,
        };
        const workerCountryCounts = new Map<string, number>();
        const billingCountryCounts = new Map<string, number>();

        for (const [profileId, latestAttempt] of latestEntryFeeAttemptByProfile.entries()) {
            const profile = profileMap.get(profileId);
            if (!profile || !isReportablePaymentProfile(profile)) {
                continue;
            }

            const lastEventAt = latestAttempt.lastEventAt;
            if (fromBoundary && (!lastEventAt || lastEventAt < fromBoundary)) {
                continue;
            }
            if (toBoundary && (!lastEventAt || lastEventAt > toBoundary)) {
                continue;
            }

            const workerRecord = workerMap.get(profileId);
            const hoursSinceCheckout = latestAttempt.checkoutCreatedAt
                ? Math.max(1, Math.floor((Date.now() - latestAttempt.checkoutCreatedAt.getTime()) / (1000 * 60 * 60)))
                : null;
            const marketSignals = readPaymentQualityMarketSignals(latestAttempt.payment.metadata);
            const classification = classifyEntryFeePaymentQuality({
                status: latestAttempt.payment.status,
                metadata: latestAttempt.payment.metadata,
                hoursSinceCheckout,
            });

            if (classification.outcome === 'completed') paymentQuality.paid += 1;
            if (classification.outcome === 'active') paymentQuality.active += 1;
            if (classification.outcome === 'expired') paymentQuality.expired += 1;
            if (classification.outcome === 'abandoned') paymentQuality.abandoned += 1;
            if (classification.outcome === 'issuer_declined') paymentQuality.bank_declined += 1;
            if (classification.outcome === 'stripe_blocked') paymentQuality.stripe_blocked += 1;

            if (classification.outcome === 'completed' || classification.outcome === 'active') {
                continue;
            }

            if (marketSignals.workerCountry) {
                workerCountryCounts.set(
                    marketSignals.workerCountry,
                    (workerCountryCounts.get(marketSignals.workerCountry) || 0) + 1
                );
            }
            if (marketSignals.billingCountry) {
                billingCountryCounts.set(
                    marketSignals.billingCountry,
                    (billingCountryCounts.get(marketSignals.billingCountry) || 0) + 1
                );
            }

            paymentQuality.recent_issues.push({
                profile_id: profileId,
                full_name: profile.full_name || profile.email?.split('@')[0] || 'Worker',
                email: profile.email || 'Unknown email',
                worker_status: workerRecord?.status || 'NEW',
                outcome: classification.outcome,
                outcome_label: classification.label,
                outcome_detail: classification.detail,
                worker_country: marketSignals.workerCountry,
                billing_country: marketSignals.billingCountry,
                card_country: marketSignals.cardCountry,
                hours_since_checkout: hoursSinceCheckout,
                last_event_at: lastEventAt?.toISOString() || latestAttempt.checkoutCreatedAt?.toISOString() || null,
                workspace_href: `/profile/worker?inspect=${profileId}`,
                case_href: `/admin/workers/${profileId}`,
            });
        }

        paymentQuality.recent_issues.sort((left, right) =>
            new Date(right.last_event_at || 0).getTime() - new Date(left.last_event_at || 0).getTime()
        );
        paymentQuality.worker_countries = Array.from(workerCountryCounts.entries())
            .map(([country, count]) => ({ country, count }))
            .sort((left, right) => right.count - left.count);
        paymentQuality.billing_countries = Array.from(billingCountryCounts.entries())
            .map(([country, count]) => ({ country, count }))
            .sort((left, right) => right.count - left.count);

        const timeSeriesData = Array.from(timeSeriesMap.values());

        return NextResponse.json({
            success: true,
            data: {
                total_users: totalWorkers,
                completed_profiles: completedCount,
                uploaded_documents: distinctUploaded,
                verified: distinctVerified,
                job_matched: distinctMatched,
                payment_quality: paymentQuality,
                supply_demand: supplyDemand,
                time_series: timeSeriesData
            }
        });

    } catch (error) {
        console.error("[Funnel Analytics] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
