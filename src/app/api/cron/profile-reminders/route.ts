import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";
import { getWorkerCompletion, getEmployerCompletion } from "@/lib/profile-completion";

// ─── Shared email footer with social links ──────────────────────
const SOCIAL_FOOTER = `
    <div style="padding: 16px 24px; background: #f8fafc; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
        <div style="margin-bottom: 12px;">
            <a href="https://www.facebook.com/profile.php?id=61585104076725" style="text-decoration:none; margin:0 4px;"><img src="https://img.icons8.com/color/48/facebook-new.png" width="24" height="24" alt="Facebook" style="vertical-align:middle;"></a>
            <a href="https://www.instagram.com/workersunited.eu/" style="text-decoration:none; margin:0 4px;"><img src="https://img.icons8.com/color/48/instagram-new.png" width="24" height="24" alt="Instagram" style="vertical-align:middle;"></a>
            <a href="https://www.linkedin.com/company/workersunited-eu/" style="text-decoration:none; margin:0 4px;"><img src="https://img.icons8.com/color/48/linkedin.png" width="24" height="24" alt="LinkedIn" style="vertical-align:middle;"></a>
            <a href="https://x.com/WorkersUnitedEU" style="text-decoration:none; margin:0 4px;"><img src="https://img.icons8.com/ios-filled/50/000000/x.png" width="22" height="22" alt="X" style="vertical-align:middle; opacity:0.8;"></a>
            <a href="https://www.tiktok.com/@www.workersunited.eu" style="text-decoration:none; margin:0 4px;"><img src="https://img.icons8.com/color/48/tiktok.png" width="24" height="24" alt="TikTok" style="vertical-align:middle;"></a>
            <a href="https://www.threads.com/@workersunited.eu" style="text-decoration:none; margin:0 4px;"><img src="https://img.icons8.com/ios-filled/50/000000/threads.png" width="22" height="22" alt="Threads" style="vertical-align:middle; opacity:0.8;"></a>
            <a href="https://www.reddit.com/r/WorkersUnitedEU/" style="text-decoration:none; margin:0 4px;"><img src="https://img.icons8.com/color/48/reddit.png" width="24" height="24" alt="Reddit" style="vertical-align:middle;"></a>
        </div>
        <p style="margin: 0; font-size: 12px; color: #6c7a89;">
            Workers United LLC &middot; 75 E 3rd St., Sheridan, Wyoming 82801, USA<br>
            <a href="https://workersunited.eu" style="color: #2f6fed;">workersunited.eu</a>
        </p>
    </div>
    <div style="height: 12px; background: linear-gradient(135deg, #2f6fed, #1c4dd6); border-radius: 0 0 12px 12px;"></div>
`;

// ─── Email builders ─────────────────────────────────────────────

function wrapHtmlDocument(content: string, preheader: string = ""): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f6fb;">
    ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ""}
    <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
        ${content}
    </div>
</body>
</html>`;
}

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

    return wrapHtmlDocument(`
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1b2430;">
            <div style="background: linear-gradient(135deg, #2f6fed, #1c4dd6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <img src="https://workersunited.eu/logo-white.png" alt="Workers United" width="48" height="48" style="vertical-align: middle;">
                <h1 style="color: white; margin: 10px 0 0; font-size: 20px;">Workers United</h1>
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
    `, subtitle);
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

    return wrapHtmlDocument(`
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1b2430;">
            <div style="background: linear-gradient(135deg, ${urgencyColor}, #991b1b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <img src="https://workersunited.eu/logo-white.png" alt="Workers United" width="48" height="48" style="vertical-align: middle;">
                <h1 style="color: white; margin: 10px 0 0; font-size: 20px;">⚠️ Workers United</h1>
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
    `, urgencyText);
}

function buildDeletionEmail(firstName: string, isEmployer: boolean): string {
    const explanation = isEmployer
        ? "Your Workers United company account has been removed because your company profile was not completed within 30 days of registration."
        : "Your Workers United account has been removed because your profile was not completed within 30 days of registration.";
    const ctaText = isEmployer
        ? "If you'd like to try again, you're always welcome to create a new employer account and complete your company profile:"
        : "If you'd like to try again, you're always welcome to create a new account and complete your profile:";

    return wrapHtmlDocument(`
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1b2430;">
            <div style="background: linear-gradient(135deg, #6b7280, #374151); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <img src="https://workersunited.eu/logo-white.png" alt="Workers United" width="48" height="48" style="vertical-align: middle;">
                <h1 style="color: white; margin: 10px 0 0; font-size: 20px;">Workers United</h1>
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
    `, "Your account has been removed due to an incomplete profile.");
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
                    .select("*")
                    .eq("profile_id", userId)
                    .single();

                const result = getEmployerCompletion({ employer });
                missingItems = result.missingFields;
            } else {
                // ── Worker: check candidate profile + documents ──
                const { data: candidate } = await supabase
                    .from("candidates")
                    .select("*")
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

                const result = getWorkerCompletion({
                    profile: profileData,
                    candidate,
                    documents: docs || []
                });
                missingItems = result.missingFields;
            }

            // Profile is complete — skip
            if (missingItems.length === 0) continue;

            const firstName = fullName?.split(" ")[0] || "there";
            const todoList = missingItems.map(item => `<li style="padding: 6px 0;">${item}</li>`).join("");

            // ========== DAY 30+: DELETE ACCOUNT ==========
            if (accountAgeDays >= DELETE_AFTER_DAYS) {

                // Send deletion notification email BEFORE deleting
                const html = buildDeletionEmail(firstName, isEmployer);
                await sendEmail(email, "Your Workers United account has been removed", html);

                // Delete the auth user (cascades to profiles, candidates/employers, documents)
                const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
                if (deleteError) {
                    console.error(`[Reminders] Failed to delete user ${email}:`, deleteError);
                } else {
                    deleted++;
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

        return NextResponse.json({ sent, warned, deleted, skipped, total_checked: eligibleUsers.length });
    } catch (err: any) {
        console.error("[Reminders] Error:", err);
        return NextResponse.json({ error: "Internal error", details: err.message }, { status: 500 });
    }
}
