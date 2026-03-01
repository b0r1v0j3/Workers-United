// Email templates for Workers United
import { escapeHtml } from "@/lib/sanitize";

export type EmailType =
    | "welcome"
    | "profile_complete"
    | "payment_success"
    | "job_offer"
    | "offer_reminder"
    | "refund_approved"
    | "document_expiring"
    | "job_match"
    | "admin_update"
    | "announcement"
    | "profile_incomplete"
    | "profile_reminder"
    | "profile_warning"
    | "profile_deletion"
    | "announcement_document_fix";

interface EmailTemplate {
    subject: string;
    html: string;
}

// ─── Strict template data ──────────────────────────────────────────────
export interface TemplateData {
    name?: string;
    email?: string;
    // Job & payment
    jobTitle?: string;
    companyName?: string;
    country?: string;
    amount?: string;
    offerLink?: string;
    jobId?: string;
    // Document expiring
    documentType?: string;
    expirationDate?: string;
    // Job match
    location?: string;
    salary?: string;
    industry?: string;
    // Admin & announcements
    subject?: string;
    title?: string;
    message?: string;
    actionLink?: string;
    actionText?: string;
    // Profile incomplete
    missingFields?: string;
    completion?: string;
    // Profile reminders (used by cron)
    todoList?: string;
    daysLeft?: number;
    isEmployer?: boolean;
}

const baseStyles = `
    font-family: 'Montserrat', sans-serif;
    color: #334155;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
`;

const buttonStyle = `
    display: inline-block;
    background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
    color: #ffffff !important;
    padding: 14px 32px;
    border-radius: 9999px;
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.3);
    transition: all 0.3s ease;
    text-align: center;
`;

// Helper to wrap content in the Contained Navy Header design
const wrapModernTemplate = (content: string, title: string = "Workers United", subtitle: string = ""): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
    </style>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFC; ${baseStyles}">
    <!-- Preheader text for inbox preview -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${subtitle}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    
    <!-- Main Email Container -->
    <div style="max-width:600px; margin: 40px auto; padding: 0 15px;">
        
        <!-- The "Window" (Card) -->
        <div style="background:white; border-radius:24px; box-shadow:0 10px 40px -10px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid rgba(226, 232, 240, 0.6);">
            
            <!-- Navy Header "Integrated" into the window -->
            <div style="background: linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%); padding: 40px 40px 30px; text-align: center;">
                 <img src="https://www.workersunited.eu/logo-white.png" alt="Workers United" width="80" height="auto" style="vertical-align: middle; display: block; margin: 0 auto 15px auto;">
                 <div style="color: white; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Workers United</div>
            </div>

            <!-- Content Area -->
            <div style="padding: 40px;">
                ${content}
            </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align:center; margin-top:40px; margin-bottom: 40px; color:#94a3b8; font-size:13px;">
            <p style="margin-bottom:20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 11px;">Stay connected</p>
            <div style="margin-bottom:30px;">
                <a href="https://www.facebook.com/profile.php?id=61585104076725" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/facebook-new.png" width="28" height="28" alt="Facebook"></a>
                <a href="https://www.instagram.com/workersunited.eu/" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/instagram-new.png" width="28" height="28" alt="Instagram"></a>
                <a href="https://www.threads.net/@workersunited.eu" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/ios-filled/50/threads.png" width="28" height="28" alt="Threads"></a>
                 <a href="https://wa.me/15557839521" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/whatsapp.png" width="28" height="28" alt="WhatsApp"></a>
                <a href="https://x.com/WorkersUnitedEU" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/ios-filled/50/twitterx.png" width="28" height="28" alt="X"></a>
                <a href="https://www.tiktok.com/@workersunited.eu" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/tiktok.png" width="28" height="28" alt="TikTok"></a>
                <a href="https://www.linkedin.com/company/workersunited-eu/" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/linkedin.png" width="28" height="28" alt="LinkedIn"></a>
            </div>
            
            <p style="margin:0 0 8px;">&copy; ${new Date().getFullYear()} Workers United LLC</p>
            <p style="margin:0 0 20px;">75 E 3rd St., Sheridan, Wyoming 82801</p>
            <div style="margin-bottom: 20px;">
                <a href="https://workersunited.eu/privacy-policy" style="color:#94a3b8; text-decoration:none; margin: 0 10px; font-weight: 500;">Privacy</a>
                <a href="https://workersunited.eu/terms" style="color:#94a3b8; text-decoration:none; margin: 0 10px; font-weight: 500;">Terms</a>
                <a href="https://workersunited.eu/profile/settings" style="color:#94a3b8; text-decoration:none; margin: 0 10px; font-weight: 500;">Preferences</a>
            </div>
        </div>
    </div>
</body>
</html>
`;

export function getEmailTemplate(type: EmailType, data: TemplateData): EmailTemplate {
    const name = escapeHtml(data.name || "friend");
    const firstName = escapeHtml((data.name || "friend").split(" ")[0]);

    switch (type) {
        case "welcome":
            return {
                subject: "Welcome to the team!",
                html: wrapModernTemplate(`
                    <div style="text-align: center; margin-bottom: 30px;">
                         <img src="https://img.icons8.com/ios/100/2563eb/conference-call.png" width="80" height="80" alt="Welcome" style="margin-bottom: 20px;">
                        <h1 style="margin:0; color:#1e293b; font-size: 26px; font-weight: 700;">Welcome, ${firstName}!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 10px;">We're thrilled to have you onboard.</p>
                    </div>

                    <p style="font-size: 16px; color: #334155; margin-bottom: 25px; text-align: center;">
                        Workers United is your bridge to great job opportunities in Europe. We handle the paperwork, so you can focus on building your future.
                    </p>
                    
                    <div style="background:#F8FAFC; border-radius:20px; padding:25px; margin:30px 0; border: 1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        <h3 style="margin:0 0 20px; font-size:12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; text-align: center;">Your Journey</h3>
                        
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td width="50" style="vertical-align: top; padding-bottom: 15px;"><img src="https://img.icons8.com/ios/50/2563eb/edit-user-male.png" width="32"></td>
                                <td style="padding-bottom: 15px;">
                                    <strong style="color: #1e293b;">1. Complete Profile</strong>
                                    <div style="color: #64748b; font-size: 14px;">Review all fields</div>
                                </td>
                            </tr>
                            <tr>
                                <td width="50" style="vertical-align: top; padding-bottom: 15px;"><img src="https://img.icons8.com/ios/50/2563eb/upload-to-cloud.png" width="32"></td>
                                <td style="padding-bottom: 15px;">
                                    <strong style="color: #1e293b;">2. Upload Docs</strong>
                                    <div style="color: #64748b; font-size: 14px;">Passport, Photo, Diploma</div>
                                </td>
                            </tr>
                            <tr>
                                <td width="50" style="vertical-align: top; padding-bottom: 15px;"><img src="https://img.icons8.com/ios/50/2563eb/brain.png" width="32"></td>
                                <td style="padding-bottom: 15px;">
                                    <strong style="color: #1e293b;">3. AI Verification</strong>
                                    <div style="color: #64748b; font-size: 14px;">Instant checks</div>
                                </td>
                            </tr>
                            <tr>
                                <td width="50" style="vertical-align: top;"><img src="https://img.icons8.com/ios/50/2563eb/rocket.png" width="32"></td>
                                <td>
                                    <strong style="color: #1e293b;">4. Get Hired</strong>
                                    <div style="color: #64748b; font-size: 14px;">Matched with employers</div>
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="text-align:center; margin-top:40px;">
                        <a href="https://workersunited.eu/profile/worker/edit" style="${buttonStyle}">
                            Start Your Profile
                        </a>
                    </div>
                `, "Welcome to Workers United", "Let's get you hired!")
            };

        case "profile_complete":
            return {
                subject: "You're Verified!",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/verified-account.png" width="80" height="80" alt="Verified" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Verification Complete!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">Your documents are approved.</p>
                    </div>

                    <p style="margin-top: 30px; color: #334155; text-align: center;">
                        Great news, ${firstName}! Your profile is now 100% verified. You are officially ready to enter our job matching queue.
                    </p>
                    
                    <div style="background:linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); border-radius:20px; padding:35px; margin:35px 0; color:white; text-align:center; box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);">
                        <h3 style="margin:0 0 10px; font-size:22px; color: white;">Activate Job Search</h3>
                        <p style="margin:0 0 25px; opacity:0.9; font-size: 16px; color: #dbeafe;">One-time entry fee</p>
                        <div style="font-size:56px; font-weight:800; margin-bottom: 15px; letter-spacing: -2px; color: white;">$9</div>
                        <div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 600; color: white;">
                            90-day money-back guarantee
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:20px;">
                        <a href="https://workersunited.eu/profile/worker" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 15px;">
                             Go to Dashboard &rarr;
                        </a>
                    </div>
                `, "Profile Verified", "Ready to start?")
            };

        case "payment_success":
            return {
                subject: "You're in the Queue!",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/rocket.png" width="80" height="80" alt="Rocket" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Payment Confirmed</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">Your job search is active.</p>
                    </div>

                    <div style="background:#f0fdf4; border-radius:12px; padding:15px; margin:30px 0; text-align: center; border: 1px solid #bbf7d0;">
                        <p style="margin:0; color: #166534; font-weight: 600; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <img src="https://img.icons8.com/ios/50/166534/checked.png" width="20">
                            ${data.amount || "$9"} Payment Received
                        </p>
                    </div>
                    
                    <div style="margin: 30px 0; text-align: center;">
                        <h3 style="color:#1e293b; font-size: 18px; font-weight: 600;">What happens now?</h3>
                        <p style="color:#64748b;">
                            Sit back and relax. Our system is now actively matching your profile with employers across Europe. You will receive an email instantly when we find a match!
                        </p>
                    </div>

                    <div style="text-align:center; margin-top:40px;">
                        <a href="https://workersunited.eu/profile" style="${buttonStyle}">
                            View My Status
                        </a>
                    </div>
                `, "Payment Confirmed", "Good luck!")
            };

        case "job_offer":
            return {
                subject: `✨ Job Offer: ${data.jobTitle}`,
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/briefcase.png" width="80" height="80" alt="Job" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">You've been picked!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">A company wants to hire you.</p>
                    </div>

                    <div style="background:#fff; border: 1px solid rgba(226, 232, 240, 0.8); border-radius:20px; margin:30px 0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
                        <div style="background: #F8FAFC; padding: 15px; border-bottom: 1px solid rgba(226, 232, 240, 0.8); text-align: center;">
                             <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Official Offer</div>
                        </div>
                        <div style="padding: 30px; text-align: center;">
                            <h2 style="margin:0 0 10px; font-size: 22px; color: #1e293b; font-weight: 700;">${data.jobTitle}</h2>
                            <p style="margin:0 0 20px; color: #64748b; font-size: 16px; font-weight: 500;">${data.companyName}</p>
                            
                            <div style="display: inline-block; background: #eff6ff; color: #2563eb; padding: 6px 16px; border-radius: 99px; font-weight: 600; font-size: 13px;">
                                ${data.country || "Europe"}
                            </div>
                        </div>
                    </div>
                    
                    <div style="background:#fff7ed; border-radius:12px; padding:15px; text-align: center; color: #ea580c; font-weight: 600; font-size: 15px; border: 1px solid #ffedd5;">
                        ⏰ Please respond within 24 hours
                    </div>
                    
                    <div style="text-align:center; margin-top:40px;">
                        <a href="${data.offerLink || "https://workersunited.eu/profile"}" style="${buttonStyle}">
                            View & Accept Offer
                        </a>
                    </div>
                `, "Job Offer", "Congrats!")
            };

        case "offer_reminder":
            return {
                subject: "Offer Expiring Soon!",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/dc2626/alarm-clock.png" width="80" height="80" alt="Clock" style="margin-bottom: 20px;">
                        <h1 style="color:#dc2626; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Hurry up!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">Your job offer is waiting.</p>
                    </div>

                    <p style="text-align: center; color: #334155; margin: 30px 0; font-size: 16px;">
                        Hey ${firstName}, you have a pending job offer that expires soon. Don't let this opportunity slip away!
                    </p>
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${data.offerLink || "https://workersunited.eu/profile"}" style="${buttonStyle} background-color: #dc2626; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.2);">
                            Respond Now
                        </a>
                    </div>
                `, "Action Required", "Tick tock...")
            };

        case "refund_approved":
            return {
                subject: "Refund Processed",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/refund.png" width="80" height="80" alt="Refund" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Refund Sent</h1>
                    </div>

                    <p style="color: #334155; margin-bottom: 25px; text-align: center; font-size: 16px;">
                        Hi ${firstName}, as per our 90-day guarantee, we have processed your refund of <strong>${data.amount || "$9"}</strong>.
                    </p>
                    
                    <div style="background:#F8FAFC; border-radius:20px; padding:20px; text-align: center; color: #64748b; font-size: 14px; border: 1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        The funds should appear in your account within 5-10 business days.
                    </div>
                    
                    <p style="margin-top: 25px; color: #94a3b8; font-size: 15px; text-align: center;">
                        We're sorry we couldn't find the perfect match this time. You are always welcome back!
                    </p>
                `, "Refund Processed", "Funds returned")
            };

        case "document_expiring":
            return {
                subject: "Document Alert",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                         <img src="https://img.icons8.com/ios/100/ea580c/expired.png" width="80" height="80" alt="Expired" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Check your docs</h1>
                    </div>

                    <p style="color: #334155; text-align: center; margin-bottom: 30px; font-size: 16px;">
                        Your <strong>${data.documentType}</strong> is expiring on <strong style="color:#ea580c">${data.expirationDate}</strong>.
                    </p>
                    
                    <div style="background:#fff7ed; border-radius:12px; padding:20px; text-align: center; color: #ea580c; border: 1px solid #ffedd5; font-weight: 500;">
                        Please update it to keep your profile active.
                    </div>
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="https://workersunited.eu/profile/worker/documents" style="${buttonStyle}">
                            Update Document
                        </a>
                    </div>
                `, "Document Alert", "Action needed")
            };

        case "job_match":
            return {
                subject: `New Match: ${data.jobTitle}`,
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/bullish.png" width="80" height="80" alt="Match" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">New Match!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">We found a job for you.</p>
                    </div>

                    <div style="background:white; border: 1px solid rgba(226, 232, 240, 0.8); border-radius:20px; overflow:hidden; margin: 30px 0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
                        <div style="padding: 25px; text-align: center;">
                            <h3 style="margin:0 0 5px; color:#1e293b; font-size: 20px; font-weight: 700;">${data.jobTitle}</h3>
                            <div style="color: #64748b; font-size: 16px; margin-bottom: 20px;">${data.industry}</div>
                            
                            <div style="display: flex; gap: 10px; justify-content: center;">
                                <span style="background: #eff6ff; color: #2563eb; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                                    ${data.location}
                                </span>
                                <span style="background: #f0fdf4; color: #166534; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                                    ${data.salary}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${data.offerLink}" style="${buttonStyle}">
                            View Details
                        </a>
                    </div>
                `, "New Match", "Check it out")
            };

        case "admin_update":
            return {
                subject: data.subject || "Update from Workers United",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/commercial.png" width="80" height="80" alt="News" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Profile Update</h1>
                    </div>

                    <div style="background:#F8FAFC; border: 1px solid rgba(226, 232, 240, 0.8); border-radius:20px; padding:25px; margin:30px 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        <h3 style="margin-top:0; color: #1e293b; font-size: 18px;">${data.title}</h3>
                        <p style="margin-bottom:0; color: #64748b; font-size: 16px;">${data.message}</p>
                    </div>
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="https://workersunited.eu/profile" style="${buttonStyle}">
                            Check Profile
                        </a>
                    </div>
                `, "Account Update", "Notification")
            };

        case "announcement":
            return {
                subject: data.subject || "Announcement",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/megaphone.png" width="80" height="80" alt="Announcement" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">${data.title}</h1>
                    </div>

                    <div style="color: #334155; font-size: 16px; line-height: 1.7; margin: 30px 0; white-space: pre-line; text-align: center;">
                        ${data.message}
                    </div>

                    ${data.actionLink ? `
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${data.actionLink}" style="${buttonStyle}">
                            ${data.actionText || "Learn More"}
                        </a>
                    </div>
                    ` : ''}
                `, "Announcement", "News for you")
            };

        case "profile_incomplete":
            return {
                subject: "Finish your profile!",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/edit-property.png" width="80" height="80" alt="Edit" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Almost there!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">You're missing a few things.</p>
                    </div>

                    <div style="margin: 30px 0;">
                         <p style="color: #334155; text-align: center; margin-bottom: 20px; font-size: 16px;">
                            We want to match you with a job, but we need these details first:
                         </p>
                         
                         <div style="background:#fff7ed; border: 1px dashed #fdba74; border-radius:12px; padding:20px; color: #c2410c; font-weight: 500; text-align: center;">
                            ${data.missingFields}
                         </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="https://workersunited.eu/profile/worker/edit" style="${buttonStyle}">
                            Finish Profile
                        </a>
                    </div>
                `, "Complete Profile", "Action required")
            };

        case "profile_reminder": {
            const isEmp = data.isEmployer || false;
            const title = isEmp ? "Start Hiring!" : "Start working!";
            const text = isEmp
                ? "Complete your company profile to find great workers."
                : "Complete your profile to get matched with jobs.";
            const btnLink = isEmp ? "https://workersunited.eu/profile/employer" : "https://workersunited.eu/profile/worker/edit";

            return {
                subject: "Don't forget your profile!",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/2563eb/todo-list.png" width="80" height="80" alt="Todo" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">${title}</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">${text}</p>
                    </div>

                   <div style="background:#F8FAFC; border-radius:20px; padding:25px; margin:30px 0; border: 1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        <strong style="display:block; margin-bottom:15px; color:#1e293b; font-size: 16px;">What's missing:</strong>
                        <ul style="padding-left: 20px; margin: 0; color: #64748b; font-size: 15px;">
                            ${data.todoList}
                        </ul>
                    </div>

                    <div style="text-align:center; margin-top:35px;">
                        <a href="${btnLink}" style="${buttonStyle}">
                            Complete Now
                        </a>
                    </div>
                `, "Profile Reminder", "Don't wait")
            };
        }

        case "profile_warning": {
            const daysLeft = data.daysLeft || 0;
            const color = daysLeft <= 1 ? "#dc2626" : "#d97706";

            return {
                subject: `Last chance: ${daysLeft} days left`,
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/dc2626/high-priority.png" width="80" height="80" alt="Warning" style="margin-bottom: 20px;">
                        <h1 style="color:${color}; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Account Warning</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">
                            Your account will be deleted in <strong>${daysLeft} days</strong>.
                        </p>
                    </div>

                    <p style="text-align: center; color: #334155; margin: 30px 0; font-size: 16px;">
                        We delete incomplete profiles to keep our platform valid. Please finish your signup to stay with us!
                    </p>

                    <div style="text-align:center; margin-top:35px;">
                        <a href="https://workersunited.eu/profile/worker/edit" style="${buttonStyle} background-color: ${color}; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.2);">
                            Save My Account
                        </a>
                    </div>
                `, "Final Warning", "Please act now")
            };
        }

        case "profile_deletion":
            return {
                subject: "Account Removed",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/64748b/trash.png" width="80" height="80" alt="Deleted" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Goodbye for now</h1>
                    </div>

                    <p style="text-align: center; color: #334155; margin: 30px 0; font-size: 16px;">
                         Your account has been removed due to inactivity. You are always welcome to sign up again when you are ready!
                    </p>
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="https://workersunited.eu/signup" style="${buttonStyle}">
                            Create New Account
                        </a>
                    </div>
                `, "Account Deleted", "See you later")
            };

        case "announcement_document_fix":
            return {
                subject: "Important: Document Upload System Fixed",
                html: wrapModernTemplate(`
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="https://img.icons8.com/ios-filled/100/2563eb/settings.png" width="80" height="80" alt="System Update" style="margin-bottom: 20px;">
                        <h1 style="margin:0; color:#1e293b; font-size: 26px; font-weight: 700;">Hi ${firstName},</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 10px;">We've fixed the document upload issue!</p>
                    </div>

                    <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">
                        If you recently tried to upload your passport or diploma and experienced errors, we sincerely apologize. We have completely resolved this technical issue.
                    </p>
                    
                    <p style="font-size: 16px; color: #334155; margin-bottom: 30px;">
                        Your profile is waiting for you. You can now securely upload your documents and complete your AI verification to join the hiring queue.
                    </p>
                    
                    <div style="text-align:center; margin-top:40px;">
                        <a href="https://workersunited.eu/profile/worker/documents" style="${buttonStyle}">
                            Upload Documents Now
                        </a>
                    </div>
                `, "Document Upload System Update", "We've fixed the technical issues. You can now complete your profile.")
            };

        default:
            return {
                subject: "Message from Workers United",
                html: wrapModernTemplate(`
                    <div style="padding: 40px; text-align: center;">
                        <p style="font-size: 16px; color: #334155;">Hello ${name},</p>
                        <p style="font-size: 16px; color: #64748b;">This is a message from Workers United.</p>
                    </div>
                `)
            };
    }
}

// Helper function to queue an email and send it immediately via SMTP
// Optionally also sends a WhatsApp template message if recipientPhone is provided
export async function queueEmail(
    supabase: any,
    userId: string,
    emailType: EmailType,
    recipientEmail: string,
    recipientName: string,
    templateData: TemplateData = {},
    scheduledFor?: Date,
    recipientPhone?: string
): Promise<void> {
    const template = getEmailTemplate(emailType, { name: recipientName, ...templateData });

    const { data } = await supabase.from("email_queue").insert({
        user_id: userId,
        email_type: emailType,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject: template.subject,
        template_data: { ...templateData, html: template.html },
        scheduled_for: scheduledFor?.toISOString() || new Date().toISOString()
    }).select().single();

    // Send immediately via SMTP
    if (!scheduledFor) {
        try {
            const { sendEmail } = await import("@/lib/mailer");
            const result = await sendEmail(recipientEmail, template.subject, template.html);
            if (data?.id) {
                await supabase.from("email_queue").update({
                    status: result.success ? "sent" : "failed",
                    sent_at: result.success ? new Date().toISOString() : null,
                    ...(result.error ? { error_message: result.error } : {})
                }).eq("id", data.id);
            }
        } catch (err) {
            console.error("Direct SMTP send failed, n8n will retry:", err);
        }
    }

    // Also send WhatsApp template if phone provided
    if (recipientPhone && !scheduledFor) {
        try {
            const wa = await import("@/lib/whatsapp");
            const firstName = recipientName?.split(" ")[0] || "there";

            // Map EmailType → WhatsApp template
            switch (emailType) {
                case "welcome":
                    await wa.sendWelcome(recipientPhone, firstName, userId);
                    break;
                case "profile_complete":
                    await wa.sendProfileVerified(recipientPhone, firstName, userId);
                    break;
                case "payment_success":
                    await wa.sendPaymentConfirmed(recipientPhone, firstName, templateData.amount || "$9", userId);
                    break;
                case "document_expiring":
                    await wa.sendDocumentReminder(recipientPhone, firstName, templateData.documentType || "document", templateData.expirationDate || "", userId);
                    break;
                case "profile_incomplete":
                    await wa.sendProfileIncomplete(recipientPhone, firstName, templateData.completion || "0", templateData.missingFields || "", userId);
                    break;
                case "refund_approved":
                    await wa.sendRefundProcessed(recipientPhone, firstName, templateData.amount || "$9", userId);
                    break;
                case "admin_update":
                    await wa.sendStatusUpdate(recipientPhone, firstName, templateData.message || "Profile updated", userId);
                    break;
                case "announcement":
                    await wa.sendAnnouncement(recipientPhone, templateData.title || "Announcement", templateData.message || "", templateData.actionLink, userId);
                    break;
                // job_offer and offer_reminder are handled separately in notifications.ts
                default:
                    break;
            }
        } catch (err) {
            // WhatsApp failure should never block email
            console.error(`WhatsApp send failed for ${emailType}:`, err);
        }
    }
}
