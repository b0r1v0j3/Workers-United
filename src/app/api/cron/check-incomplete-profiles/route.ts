import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { queueEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

// Field labels for human-readable emails
const WORKER_FIELD_LABELS: Record<string, string> = {
    full_name: "Full Name",
    phone: "Phone Number",
    nationality: "Nationality",
    current_country: "Current Country",
    preferred_job: "Preferred Job",
    gender: "Gender",
    date_of_birth: "Date of Birth",
    birth_country: "Birth Country",
    birth_city: "Birth City",
    citizenship: "Citizenship",
    marital_status: "Marital Status",
    passport_number: "Passport Number",
    lives_abroad: "Lives Abroad",
    previous_visas: "Previous Visas",
    passport_doc: "Passport Upload",
    biometric_photo_doc: "Biometric Photo Upload",
};

const EMPLOYER_FIELD_LABELS: Record<string, string> = {
    company_name: "Company Name",
    company_registration_number: "Company Registration Number",
    company_address: "Company Address",
    contact_phone: "Contact Phone",
    country: "Country",
    city: "City",
    industry: "Industry",
    description: "Company Description",
};

export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    try {
        // Fetch all auth users
        const { data: authData } = await supabase.auth.admin.listUsers();
        const allUsers = authData?.users || [];

        // Fetch all profiles, candidates, employers, and docs
        const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, email');
        const { data: allCandidates } = await supabase.from('candidates')
            .select('profile_id, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, lives_abroad, previous_visas');
        const { data: allEmployers } = await supabase.from('employers')
            .select('profile_id, company_name, company_registration_number, company_address, contact_phone, country, city, industry, description');
        const { data: allDocs } = await supabase.from('candidate_documents').select('user_id, document_type');

        // Check which users already got a profile_incomplete email in the last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentEmails } = await supabase
            .from('email_queue')
            .select('user_id')
            .eq('email_type', 'profile_incomplete')
            .gte('created_at', sevenDaysAgo);

        const recentlySent = new Set(recentEmails?.map(e => e.user_id) || []);

        const profileMap = new Map(allProfiles?.map(p => [p.id, p]) || []);
        const candidateMap = new Map(allCandidates?.map(c => [c.profile_id, c]) || []);
        const employerMap = new Map(allEmployers?.map(e => [e.profile_id, e]) || []);

        let sentCount = 0;

        for (const authUser of allUsers) {
            // Skip if already emailed recently
            if (recentlySent.has(authUser.id)) continue;

            const p = profileMap.get(authUser.id);
            const isEmployer = authUser.user_metadata?.user_type === 'employer';
            const email = p?.email || authUser.email;
            if (!email) continue;

            let missingLabels: string[] = [];
            let completion = 0;

            if (isEmployer) {
                // Employer completion check
                const emp = employerMap.get(authUser.id);
                const fields: Record<string, any> = {
                    company_name: emp?.company_name,
                    company_registration_number: emp?.company_registration_number,
                    company_address: emp?.company_address,
                    contact_phone: emp?.contact_phone,
                    country: emp?.country,
                    city: emp?.city,
                    industry: emp?.industry,
                    description: emp?.description,
                };
                const total = Object.keys(fields).length;
                const filled = Object.values(fields).filter(Boolean).length;
                completion = Math.round((filled / total) * 100);

                missingLabels = Object.entries(fields)
                    .filter(([_, v]) => !v)
                    .map(([k]) => EMPLOYER_FIELD_LABELS[k] || k);
            } else {
                // Worker completion check (same 16-field formula as worker/page.tsx)
                const c = candidateMap.get(authUser.id);
                const docs = allDocs?.filter(d => d.user_id === authUser.id) || [];

                const fields: Record<string, any> = {
                    full_name: p?.full_name,
                    phone: c?.phone,
                    nationality: c?.nationality,
                    current_country: c?.current_country,
                    preferred_job: c?.preferred_job,
                    gender: c?.gender,
                    date_of_birth: c?.date_of_birth,
                    birth_country: c?.birth_country,
                    birth_city: c?.birth_city,
                    citizenship: c?.citizenship,
                    marital_status: c?.marital_status,
                    passport_number: c?.passport_number,
                    lives_abroad: c?.lives_abroad,
                    previous_visas: c?.previous_visas,
                    passport_doc: docs.some(d => d.document_type === 'passport'),
                    biometric_photo_doc: docs.some(d => d.document_type === 'biometric_photo'),
                };
                const total = Object.keys(fields).length;
                const filled = Object.values(fields).filter(Boolean).length;
                completion = Math.round((filled / total) * 100);

                missingLabels = Object.entries(fields)
                    .filter(([_, v]) => !v)
                    .map(([k]) => WORKER_FIELD_LABELS[k] || k);
            }

            // Only send if profile is incomplete
            if (completion >= 100 || missingLabels.length === 0) continue;

            const missingHtml = missingLabels.map(f => `• ${f}`).join('<br>');

            await queueEmail(
                supabase,
                authUser.id,
                'profile_incomplete',
                email,
                p?.full_name || authUser.user_metadata?.full_name || 'User',
                {
                    missingFields: missingHtml,
                    completion: String(completion),
                    subject: `Action Required: Your profile is ${completion}% complete`
                }
            );
            sentCount++;
        }

        console.log(`[Cron] Incomplete profiles: sent ${sentCount} reminders`);
        return NextResponse.json({ success: true, sent: sentCount });

    } catch (error) {
        console.error('[Cron] check-incomplete-profiles error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
