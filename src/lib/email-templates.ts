// Email templates for Workers United

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
    | "profile_deletion";

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
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #334155;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
`;

const buttonStyle = `
    display: inline-block;
    background-color: #2563eb;
    color: #ffffff !important;
    padding: 14px 32px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    transition: all 0.2s;
    text-align: center;
`;

// Helper to wrap content in the Contained Blue Header design
const wrapModernTemplate = (content: string, title: string = "Workers United", subtitle: string = ""): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; ${baseStyles}">
    <!-- Preheader text for inbox preview -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${subtitle}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    
    <!-- Main Email Container -->
    <div style="max-width:600px; margin: 40px auto; padding: 0 15px;">
        
        <!-- The "Window" (Card) -->
        <div style="background:white; border-radius:16px; box-shadow:0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); overflow: hidden;">
            
            <!-- Blue Header "Integrated" into the window -->
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 40px; text-align: center;">
                 <img src="https://workersunited.eu/logo-white.png" alt="Workers United" width="48" height="48" style="vertical-align: middle; display: inline-block; margin-right: 12px;">
                 <span style="color: white; font-size: 24px; font-weight: 700; vertical-align: middle; letter-spacing: -0.5px;">Workers United</span>
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
                <a href="https://www.threads.net/@workersunited.eu" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://workersunited.eu/threads-logo.svg" width="24" height="24" alt="Threads"></a>
                 <a href="https://www.reddit.com/user/workersunited-eu" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/reddit.png" width="28" height="28" alt="Reddit"></a>
                <a href="https://x.com/WorkersUnitedEU" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://workersunited.eu/x-logo.svg" width="24" height="24" alt="X"></a>
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
    const name = data.name || "friend";
    const firstName = name.split(" ")[0];

    switch (type) {
        case "welcome":
            return {
                subject: "Welcome to the team! 👋",
                html: wrapModernTemplate(`
                    <div style="text-align: center; margin-bottom: 30px;">
                         <img src="https://img.icons8.com/fluency/96/handshake.png" width="80" height="80" alt="Welcome" style="margin-bottom: 20px;">
                        <h1 style="margin:0; color:#1e293b; font-size: 26px; font-weight: 700;">Welcome, ${firstName}!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 10px;">We're thrilled to have you onboard.</p>
                    </div>

                    <p style="font-size: 16px; color: #334155; margin-bottom: 25px; text-align: center;">
                        Workers United is your bridge to great job opportunities in Europe. We handle the paperwork, so you can focus on building your future.
                    </p>
                    
                    <div style="background:#f8fafc; border-radius:12px; padding:25px; margin:30px 0; border: 1px solid #e2e8f0;">
                        <h3 style="margin:0 0 20px; font-size:12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; text-align: center;">Your Journey</h3>
                        
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td width="50" style="vertical-align: top; padding-bottom: 15px;"><img src="https://img.icons8.com/fluency/48/edit-user-female.png" width="32"></td>
                                <td style="padding-bottom: 15px;">
                                    <strong style="color: #1e293b;">1. Complete Profile</strong>
                                    <div style="color: #64748b; font-size: 14px;">Review all fields</div>
                                </td>
                            </tr>
                            <tr>
                                <td width="50" style="vertical-align: top; padding-bottom: 15px;"><img src="https://img.icons8.com/fluency/48/upload-to-cloud.png" width="32"></td>
                                <td style="padding-bottom: 15px;">
                                    <strong style="color: #1e293b;">2. Upload Docs</strong>
                                    <div style="color: #64748b; font-size: 14px;">Passport, Photo, Diploma</div>
                                </td>
                            </tr>
                            <tr>
                                <td width="50" style="vertical-align: top; padding-bottom: 15px;"><img src="https://img.icons8.com/fluency/48/artificial-intelligence.png" width="32"></td>
                                <td style="padding-bottom: 15px;">
                                    <strong style="color: #1e293b;">3. AI Verification</strong>
                                    <div style="color: #64748b; font-size: 14px;">Instant checks</div>
                                </td>
                            </tr>
                            <tr>
                                <td width="50" style="vertical-align: top;"><img src="https://img.icons8.com/fluency/48/rocket.png" width="32"></td>
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
                subject: "You're Verified! 🎉",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/fluency/96/verified-account.png" width="80" height="80" alt="Verified" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Verification Complete!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">Your documents are approved.</p>
                    </div>

                    <p style="margin-top: 30px; color: #334155; text-align: center;">
                        Great news, ${firstName}! Your profile is now 100% verified. You are officially ready to enter our job matching queue.
                    </p>
                    
                    <div style="background:linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius:16px; padding:35px; margin:35px 0; color:white; text-align:center; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);">
                        <h3 style="margin:0 0 10px; font-size:22px; color: white;">Activate Job Search</h3>
                        <p style="margin:0 0 25px; opacity:0.9; font-size: 16px; color: #dbeafe;">One-time entry fee</p>
                        <div style="font-size:56px; font-weight:800; margin-bottom: 15px; letter-spacing: -2px; color: white;">$9</div>
                        <div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 600; color: white;">
                            ✨ 90-day money-back guarantee
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
                subject: "You're in the Queue! 🚀",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/fluency/96/rocket.png" width="80" height="80" alt="Rocket" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Payment Confirmed</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">Your job search is active.</p>
                    </div>

                    <div style="background:#f0fdf4; border-radius:12px; padding:15px; margin:30px 0; text-align: center; border: 1px solid #bbf7d0;">
                        <p style="margin:0; color: #166534; font-weight: 600; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <img src="https://img.icons8.com/fluency/48/checked.png" width="20">
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
                        <img src="https://img.icons8.com/fluency/96/briefcase.png" width="80" height="80" alt="Job" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">You've been picked!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">A company wants to hire you.</p>
                    </div>

                    <div style="background:#fff; border: 1px solid #e2e8f0; border-radius:16px; margin:30px 0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        <div style="background: #f8fafc; padding: 15px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                             <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Official Offer</div>
                        </div>
                        <div style="padding: 30px; text-align: center;">
                            <h2 style="margin:0 0 10px; font-size: 22px; color: #1e293b; font-weight: 700;">${data.jobTitle}</h2>
                            <p style="margin:0 0 20px; color: #64748b; font-size: 16px; font-weight: 500;">${data.companyName}</p>
                            
                            <div style="display: inline-block; background: #eff6ff; color: #2563eb; padding: 6px 16px; border-radius: 99px; font-weight: 600; font-size: 13px;">
                                📍 ${data.country || "Europe"}
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
                subject: "⏰ Offer Expiring Soon!",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/fluency/96/alarm-clock.png" width="80" height="80" alt="Clock" style="margin-bottom: 20px;">
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
                subject: "Refund Processed 💸",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/fluency/96/refund.png" width="80" height="80" alt="Refund" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Refund Sent</h1>
                    </div>

                    <p style="color: #334155; margin-bottom: 25px; text-align: center; font-size: 16px;">
                        Hi ${firstName}, as per our 90-day guarantee, we have processed your refund of <strong>${data.amount || "$9"}</strong>.
                    </p>
                    
                    <div style="background:#f8fafc; border-radius:12px; padding:20px; text-align: center; color: #64748b; font-size: 14px; border: 1px solid #e2e8f0;">
                        The funds should appear in your account within 5-10 business days.
                    </div>
                    
                    <p style="margin-top: 25px; color: #94a3b8; font-size: 15px; text-align: center;">
                        We're sorry we couldn't find the perfect match this time. You are always welcome back!
                    </p>
                `, "Refund Processed", "Funds returned")
            };

        case "document_expiring":
            return {
                subject: "⚠️ Document Alert",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                         <img src="https://img.icons8.com/fluency/96/expired.png" width="80" height="80" alt="Expired" style="margin-bottom: 20px;">
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
                        <img src="https://img.icons8.com/fluency/96/bullish.png" width="80" height="80" alt="Match" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">New Match!</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">We found a job for you.</p>
                    </div>

                    <div style="background:white; border: 1px solid #e2e8f0; border-radius:16px; overflow:hidden; margin: 30px 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
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
                        <img src="https://img.icons8.com/fluency/96/commercial.png" width="80" height="80" alt="News" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Profile Update</h1>
                    </div>

                    <div style="background:#f8fafc; border: 1px solid #e2e8f0; border-radius:16px; padding:25px; margin:30px 0;">
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
                        <img src="https://img.icons8.com/fluency/96/megaphone.png" width="80" height="80" alt="Announcement" style="margin-bottom: 20px;">
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
                subject: "Finish your profile! 📝",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/fluency/96/edit-property.png" width="80" height="80" alt="Edit" style="margin-bottom: 20px;">
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
                subject: "Don't forget your profile! ⏳",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/fluency/96/todo-list.png" width="80" height="80" alt="Todo" style="margin-bottom: 20px;">
                        <h1 style="color:#1e293b; font-size: 26px; font-weight: 700; margin: 0 0 10px;">${title}</h1>
                        <p style="font-size: 16px; color: #64748b; margin-top: 5px;">${text}</p>
                    </div>

                   <div style="background:#f8fafc; border-radius:16px; padding:25px; margin:30px 0; border: 1px solid #e2e8f0;">
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
                        <img src="https://img.icons8.com/fluency/96/high-priority.png" width="80" height="80" alt="Warning" style="margin-bottom: 20px;">
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
                        <img src="https://img.icons8.com/fluency/96/trash.png" width="80" height="80" alt="Deleted" style="margin-bottom: 20px;">
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
export async function queueEmail(
    supabase: any,
    userId: string,
    emailType: EmailType,
    recipientEmail: string,
    recipientName: string,
    templateData: TemplateData = {},
    scheduledFor?: Date
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
}
