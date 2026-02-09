import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";

// ─── Shared email footer with social links ──────────────────────
const SOCIAL_FOOTER = `
    <div style="padding: 16px 24px; background: #f8fafc; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
        <div style="margin-bottom: 12px;">
            <a href="https://www.facebook.com/profile.php?id=61585104076725" style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #e4ebff; border-radius: 50%; text-decoration: none; margin: 0 4px; font-size: 14px;" title="Facebook">f</a>
            <a href="https://www.instagram.com/workersunited.eu/" style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #e4ebff; border-radius: 50%; text-decoration: none; margin: 0 4px; font-size: 14px;" title="Instagram">📷</a>
            <a href="https://www.threads.com/@workersunited.eu" style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #e4ebff; border-radius: 50%; text-decoration: none; margin: 0 4px;" title="Threads"><img src="https://workersunited.eu/threads-logo.svg" alt="Threads" style="width: 16px; height: 16px; vertical-align: middle;" /></a>
            <a href="https://www.linkedin.com/company/workersunited-eu/" style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #e4ebff; border-radius: 50%; text-decoration: none; margin: 0 4px; font-size: 14px;" title="LinkedIn">in</a>
            <a href="https://x.com/WorkersUnitedEU" style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #e4ebff; border-radius: 50%; text-decoration: none; margin: 0 4px; font-size: 14px;" title="X">𝕏</a>
            <a href="https://www.tiktok.com/@www.workersunited.eu" style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #e4ebff; border-radius: 50%; text-decoration: none; margin: 0 4px; font-size: 14px;" title="TikTok">♪</a>
            <a href="https://www.reddit.com/r/WorkersUnitedEU/" style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #e4ebff; border-radius: 50%; text-decoration: none; margin: 0 4px; font-size: 14px;" title="Reddit">◉</a>
        </div>
        <p style="margin: 0; font-size: 12px; color: #6c7a89;">
            Workers United LLC &middot; 75 E 3rd St., Sheridan, Wyoming 82801, USA<br>
            <a href="https://workersunited.eu" style="color: #2f6fed;">workersunited.eu</a>
        </p>
    </div>
    <div style="height: 12px; background: linear-gradient(135deg, #2f6fed, #1c4dd6); border-radius: 0 0 12px 12px;"></div>
`;

// ─── Email builders ─────────────────────────────────────────────

function buildReminderEmail(firstName: string, todoList: string, isEmployer: boolean): string {
    const subtitle = isEmployer
        ? "Complete your company profile to start hiring"
        : "Complete your profile to get matched";
    const cta = isEmployer
        ? "Thanks for registering your company with Workers United! To start posting jobs and finding qualified workers, please complete your company profile:"
        : "Thanks for signing up with Workers United! We noticed your profile isn't complete yet. To start receiving job opportunities, please finish these steps:";
    const buttonText = isEmployer ? "Complete Company Profile" : "Complete My Profile";
    const buttonLink = isEmployer
        ? "https://workersunited.eu/profile/employer"
        : "https://workersunited.eu/profile/worker/edit";
    const outro = isEmployer
        ? "A complete company profile helps workers trust your job postings and speeds up the hiring process."
        : "The sooner you complete your profile, the sooner we can match you with suitable job opportunities.";

    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1b2430;">
            <div style="background: linear-gradient(135deg, #2f6fed, #1c4dd6); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Workers United</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">${subtitle}</p>
            </div>
            <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                <p style="margin-top: 0;">Hi ${firstName},</p>
                <p style="line-height: 1.6;">${cta}</p>
                <ul style="background: #f8fafc; padding: 16px 16px 16px 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
                    ${todoList}
                </ul>
                <p style="line-height: 1.6;">${outro}</p>
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${buttonLink}" 
                       style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #2f6fed, #1c4dd6); color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        ${buttonText}
                    </a>
                </div>
            </div>
            ${SOCIAL_FOOTER}
        </div>
    `;
}

function buildWarningEmail(firstName: string, daysLeft: number, todoList: string, isEmployer: boolean): string {
    const urgencyColor = daysLeft <= 1 ? "#dc2626" : daysLeft <= 3 ? "#ea580c" : "#d97706";
    const urgencyBg = daysLeft <= 1 ? "#fef2f2" : daysLeft <= 3 ? "#fff7ed" : "#fffbeb";
    const urgencyText = daysLeft <= 1
        ? "Your account will be deleted tomorrow"
        : `Your account will be deleted in ${daysLeft} days`;
    const explanation = isEmployer
        ? "We haven't received your complete company profile information yet. To keep your account active and continue using Workers United for hiring, please complete your profile before the deadline."
        : "We haven't received your complete profile information yet. To keep your account active, please complete your profile before the deadline.";
    const buttonText = isEmployer ? "Complete Company Profile Now" : "Complete My Profile Now";
    const buttonLink = isEmployer
        ? "https://workersunited.eu/profile/employer"
        : "https://workersunited.eu/profile/worker/edit";

    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1b2430;">
            <div style="background: linear-gradient(135deg, ${urgencyColor}, #991b1b); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ Workers United</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">${urgencyText}</p>
            </div>
            <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                <p style="margin-top: 0;">Hi ${firstName},</p>
                <div style="background: ${urgencyBg}; border: 1px solid ${urgencyColor}33; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <p style="margin: 0; color: ${urgencyColor}; font-weight: bold; font-size: 16px;">
                        ⚠️ ${urgencyText}
                    </p>
                    <p style="margin: 8px 0 0; color: #1b2430;">
                        ${explanation}
                    </p>
                </div>
                <p style="line-height: 1.6;">Here's what's still missing:</p>
                <ul style="background: #f8fafc; padding: 16px 16px 16px 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
                    ${todoList}
                </ul>
                <div style="text-align: center; margin: 24px 0;">
                    <a href="${buttonLink}" 
                       style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, ${urgencyColor}, #991b1b); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        ${buttonText}
                    </a>
                </div>
            </div>
            ${SOCIAL_FOOTER}
        </div>
    `;
}

function buildDeletionEmail(firstName: string, isEmployer: boolean): string {
    const explanation = isEmployer
        ? "Your Workers United company account has been removed because your company profile was not completed within 30 days of registration."
        : "Your Workers United account has been removed because your profile was not completed within 30 days of registration.";
    const ctaText = isEmployer
        ? "If you'd like to try again, you're always welcome to create a new employer account and complete your company profile:"
        : "If you'd like to try again, you're always welcome to create a new account and complete your profile:";

    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1b2430;">
            <div style="background: linear-gradient(135deg, #6b7280, #374151); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Workers United</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">Account removed</p>
            </div>
            <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                <p style="margin-top: 0;">Hi ${firstName},</p>
                <p style="line-height: 1.6;">${explanation}</p>
                <p style="line-height: 1.6;">${ctaText}</p>
                <div style="text-align: center; margin: 24px 0;">
                    <a href="https://workersunited.eu/signup" 
                       style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #2f6fed, #1c4dd6); color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Create New Account
                    </a>
                </div>
                <p style="line-height: 1.6; color: #6c7a89; font-size: 14px;">If you believe this was a mistake, please contact us at <a href="mailto:contact@workersunited.eu" style="color: #2f6fed;">contact@workersunited.eu</a>.</p>
            </div>
            ${SOCIAL_FOOTER}
        </div>
    `;
}

// ─── Type Definitions ──────────────────────────────────────────

interface ProfileData {
    full_name: string | null;
}

interface Candidate {
    id: string;
    status: string;
    entry_fee_paid: boolean;
    phone: string | null;
    nationality: string | null;
    current_country: string | null;
    preferred_job: string | null;
    gender: string | null;
    date_of_birth: string | null;
    birth_country: string | null;
    birth_city: string | null;
    citizenship: string | null;
    marital_status: string | null;
    passport_number: string | null;
    lives_abroad: boolean | null;
    previous_visas: boolean | null;
}

interface Employer {
    company_name: string | null;
    company_registration_number: string | null;
    country: string | null;
    contact_phone: string | null;
    industry: string | null;
    company_address: string | null;
}

interface CandidateDocument {
    document_type: string;
    status: string;
}


// ─── Profile completeness checks ────────────────────────────────

function getWorkerMissingItems(
    profileData: ProfileData | null,
    candidate: Candidate | null,
    docs: CandidateDocument[]
): string[] {
    const missing: string[] = [];

    if (!candidate) {
        missing.push("Complete your worker profile");
        return missing;
    }

    if (!profileData?.full_name) missing.push("Add your full name");
    if (!candidate.phone) missing.push("Add your phone number");
    if (!candidate.nationality) missing.push("Add your nationality");
    if (!candidate.current_country) missing.push("Add your current country");
    if (!candidate.preferred_job) missing.push("Select your preferred job type");
    if (!candidate.gender) missing.push("Select your gender");
    if (!candidate.date_of_birth) missing.push("Add your date of birth");
    if (!candidate.birth_country) missing.push("Add your birth country");
    if (!candidate.birth_city) missing.push("Add your birth city");
    if (!candidate.citizenship) missing.push("Add your citizenship");
    if (!candidate.marital_status) missing.push("Select your marital status");
    if (!candidate.passport_number) missing.push("Add your passport number");
    if (candidate.lives_abroad === null || candidate.lives_abroad === undefined) missing.push("Indicate if you live abroad");
    if (candidate.previous_visas === null || candidate.previous_visas === undefined) missing.push("Indicate previous visa history");

    const docTypes = (docs || []).map((d) => d.document_type);
    if (!docTypes.includes("passport")) missing.push("Upload your passport");
    if (!docTypes.includes("biometric_photo")) missing.push("Upload a biometric photo");

    return missing;
}

function getEmployerMissingItems(employer: Employer | null): string[] {
    const missing: string[] = [];

    if (!employer) {
        missing.push("Set up your company profile");
        return missing;
    }

    if (!employer.company_name) missing.push("Add your company name");
    if (!employer.company_registration_number) missing.push("Add your company registration number");
    if (!employer.country) missing.push("Select your country");
    if (!employer.contact_phone) missing.push("Add your contact phone number");
    if (!employer.industry) missing.push("Select your industry");
    if (!employer.company_address) missing.push("Add your company address");

    return missing;
}

// ─── Main cron handler ──────────────────────────────────────────
// Runs daily via Vercel cron — sends profile completion reminders + auto-deletes after 30 days
// Applies to BOTH workers and employers

export async function GET(request: Request) {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const supabase = createAdminClient();

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Get ALL auth users (except admins)
        const { data: authData } = await supabase.auth.admin.listUsers();
        const allUsers = authData?.users || [];

        const eligibleUsers = allUsers.filter((u: any) => {
            const ut = u.user_metadata?.user_type;
            // Skip admins — never delete admin accounts
            if (ut === "admin") return false;
            // Only check users who signed up more than 24h ago
            return new Date(u.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000);
        });

        if (eligibleUsers.length === 0) {
            return NextResponse.json({ sent: 0, message: "No users to check" });
        }

        let sent = 0;
        let skipped = 0;
        let warned = 0;
        let deleted = 0;

        const WARNING_DAYS = [23, 27, 29];
        const DELETE_AFTER_DAYS = 30;

        for (const user of eligibleUsers) {
            const userId = user.id;
            const email = user.email;
            const fullName = user.user_metadata?.full_name || "";
            const userType = user.user_metadata?.user_type;
            const isEmployer = userType === "employer";

            if (!email) continue;

            // Calculate account age in days
            const accountAgeDays = Math.floor(
                (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );

            // Get profile data
            const { data: profileData } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", userId)
                .single();

            let missingItems: string[];

            if (isEmployer) {
                // ── Employer: check company profile ──
                const { data: employer } = await supabase
                    .from("employers")
                    .select("company_name, company_registration_number, country, contact_phone, industry, company_address")
                    .eq("profile_id", userId)
                    .single();

                missingItems = getEmployerMissingItems(employer);
            } else {
                // ── Worker: check candidate profile + documents ──
                const { data: candidate } = await supabase
                    .from("candidates")
                    .select("id, status, entry_fee_paid, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, lives_abroad, previous_visas")
                    .eq("profile_id", userId)
                    .single();

                const { data: docs } = await supabase
                    .from("candidate_documents")
                    .select("document_type, status")
                    .eq("user_id", userId);

                // NEVER delete paid workers or workers with accepted offers
                if (candidate?.status === "IN_QUEUE" || candidate?.status === "OFFER_ACCEPTED") {
                    continue;
                }

                missingItems = getWorkerMissingItems(profileData, candidate, docs || []);
            }

            // Profile is complete — skip
            if (missingItems.length === 0) continue;

            const firstName = fullName?.split(" ")[0] || "there";
            const todoList = missingItems.map(item => `<li style="padding: 6px 0;">${item}</li>`).join("");

            // ========== DAY 30+: DELETE ACCOUNT ==========
            if (accountAgeDays >= DELETE_AFTER_DAYS) {
                console.log(`[Reminders] Deleting ${isEmployer ? "employer" : "worker"} ${email} (account age: ${accountAgeDays} days)`);

                // Send deletion notification email BEFORE deleting
                const html = buildDeletionEmail(firstName, isEmployer);
                await sendEmail(email, "Your Workers United account has been removed", html);

                // Delete the auth user (cascades to profiles, candidates/employers, documents)
                const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
                if (deleteError) {
                    console.error(`[Reminders] Failed to delete user ${email}:`, deleteError);
                } else {
                    deleted++;
                    console.log(`[Reminders] Deleted ${isEmployer ? "employer" : "worker"} ${email}`);
                }
                continue;
            }

            // ========== WARNING DAYS: SEND ESCALATING WARNINGS ==========
            const daysLeft = DELETE_AFTER_DAYS - accountAgeDays;
            const isWarningDay = WARNING_DAYS.includes(accountAgeDays);

            if (isWarningDay) {
                // Check if we already sent this specific warning
                const warningSubject = `Action required: ${daysLeft} ${daysLeft === 1 ? "day" : "days"} until account removal`;
                const { data: existingWarning } = await supabase
                    .from("email_queue")
                    .select("id")
                    .eq("recipient_email", email)
                    .eq("subject", warningSubject)
                    .limit(1);

                if (existingWarning && existingWarning.length > 0) {
                    skipped++;
                    continue;
                }

                const html = buildWarningEmail(firstName, daysLeft, todoList, isEmployer);
                const result = await sendEmail(email, warningSubject, html);

                if (result.success) {
                    await supabase.from("email_queue").insert({
                        user_id: userId,
                        email_type: "document_reminder",
                        recipient_email: email,
                        recipient_name: fullName || (isEmployer ? "Employer" : "Worker"),
                        subject: warningSubject,
                        template_data: { html },
                        status: "sent",
                        sent_at: new Date().toISOString(),
                        scheduled_for: new Date().toISOString(),
                    });
                    warned++;
                    console.log(`[Reminders] Sent ${daysLeft}-day warning to ${isEmployer ? "employer" : "worker"} ${email}`);
                }
                continue;
            }

            // ========== NORMAL DAYS: REGULAR REMINDER ==========
            const { data: recentEmail } = await supabase
                .from("email_queue")
                .select("id")
                .eq("recipient_email", email)
                .eq("email_type", "document_reminder")
                .gt("created_at", oneDayAgo)
                .limit(1);

            if (recentEmail && recentEmail.length > 0) {
                skipped++;
                continue;
            }

            const subject = isEmployer
                ? "Complete your Workers United company profile"
                : "Your Workers United profile is almost ready!";
            const html = buildReminderEmail(firstName, todoList, isEmployer);
            const result = await sendEmail(email, subject, html);

            if (result.success) {
                await supabase.from("email_queue").insert({
                    user_id: userId,
                    email_type: "document_reminder",
                    recipient_email: email,
                    recipient_name: fullName || (isEmployer ? "Employer" : "Worker"),
                    subject,
                    template_data: { html },
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    scheduled_for: new Date().toISOString(),
                });
                sent++;
            } else {
                console.error(`[Reminders] Failed to send to ${email}:`, result.error);
            }
        }

        console.log(`[Reminders] Sent ${sent} reminders, ${warned} warnings, ${deleted} deleted, skipped ${skipped}`);
        return NextResponse.json({ sent, warned, deleted, skipped, total_checked: eligibleUsers.length });
    } catch (err: any) {
        console.error("[Reminders] Error:", err);
        return NextResponse.json({ error: "Internal error", details: err.message }, { status: 500 });
    }
}
