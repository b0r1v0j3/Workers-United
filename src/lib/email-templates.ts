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
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: #ffffff !important;
    padding: 16px 40px;
    border-radius: 12px;
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.1);
    transition: all 0.2s;
    text-align: center;
    letter-spacing: 0.5px;
`;

// Helper to wrap content in the Modern Gradient design
const wrapModernTemplate = (content: string, title: string = "Workers United", subtitle: string = ""): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; ${baseStyles}">
    <!-- Preheader text for inbox preview -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${subtitle}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    
    <!-- Gradient Background Container -->
    <div style="width: 100%; background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%); padding: 60px 0;">
        <div style="max-width:600px; margin:0 auto; padding: 0 20px;">
            
            <!-- Floating Header -->
            <div style="text-align: center; margin-bottom: 40px;">
                <img src="https://workersunited.eu/logo.png" alt="Workers United" width="64" height="64" style="vertical-align: middle; border-radius: 16px; box-shadow: 0 10px 20px rgba(0,0,0,0.08);">
            </div>

            <!-- Glass-morphic Card -->
            <div style="background:white; border-radius:32px; box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.05), 0 10px 20px -5px rgba(0, 0, 0, 0.02); overflow: hidden; position: relative;">
                <!-- Subtle Top Glow -->
                <div style="height: 6px; background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); width: 100%;"></div>
                
                <div style="padding: 50px 40px;">
                    ${content}
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align:center; margin-top:50px; color:#94a3b8; font-size:13px;">
                <p style="margin-bottom:25px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; font-size: 10px; opacity: 0.8;">Stay connected</p>
                <div style="margin-bottom:35px; opacity: 0.9;">
                    <a href="https://www.facebook.com/profile.php?id=61585104076725" style="text-decoration:none; margin:0 6px;"><img src="https://img.icons8.com/fluency/48/facebook-new.png" width="32" height="32" alt="Facebook" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"></a>
                    <a href="https://www.instagram.com/workersunited.eu/" style="text-decoration:none; margin:0 6px;"><img src="https://img.icons8.com/fluency/48/instagram-new.png" width="32" height="32" alt="Instagram" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"></a>
                    <a href="https://www.threads.net/@workersunited.eu" style="text-decoration:none; margin:0 6px;"><img src="https://workersunited.eu/threads-logo.svg" width="28" height="28" alt="Threads" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"></a>
                    <a href="https://www.reddit.com/user/workersunited-eu" style="text-decoration:none; margin:0 6px;"><img src="https://img.icons8.com/fluency/48/reddit.png" width="32" height="32" alt="Reddit" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"></a>
                    <a href="https://x.com/WorkersUnitedEU" style="text-decoration:none; margin:0 6px;"><img src="https://workersunited.eu/x-logo.svg" width="28" height="28" alt="X" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"></a>
                    <a href="https://www.tiktok.com/@workersunited.eu" style="text-decoration:none; margin:0 6px;"><img src="https://img.icons8.com/fluency/48/tiktok.png" width="32" height="32" alt="TikTok" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"></a>
                    <a href="https://www.linkedin.com/company/workersunited-eu/" style="text-decoration:none; margin:0 6px;"><img src="https://img.icons8.com/fluency/48/linkedin.png" width="32" height="32" alt="LinkedIn" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"></a>
                </div>
                
                <p style="margin:0 0 10px;">&copy; ${new Date().getFullYear()} Workers United LLC</p>
                <p style="margin:0 0 25px;">75 E 3rd St., Sheridan, Wyoming 82801</p>
                <div style="margin-bottom: 20px;">
                    <a href="https://workersunited.eu/privacy-policy" style="color:#94a3b8; text-decoration:none; margin: 0 12px; font-weight: 500; transition: color 0.2s;">Privacy</a>
                    <a href="https://workersunited.eu/terms" style="color:#94a3b8; text-decoration:none; margin: 0 12px; font-weight: 500; transition: color 0.2s;">Terms</a>
                    <a href="https://workersunited.eu/profile/settings" style="color:#94a3b8; text-decoration:none; margin: 0 12px; font-weight: 500; transition: color 0.2s;">Preferences</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
`;

// Helper for hero icon container
const heroIcon = (src: string, alt: string) => `
    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); width: 96px; height: 96px; border-radius: 28px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.7), 0 10px 20px -5px rgba(59, 130, 246, 0.15);">
        <img src="${src}" width="56" height="56" alt="${alt}" style="filter: drop-shadow(0 4px 8px rgba(0,0,0,0.08));">
    </div>
`;


export function getEmailTemplate(type: EmailType, data: TemplateData): EmailTemplate {
    const name = data.name || "friend";
    const firstName = name.split(" ")[0];

    switch (type) {
        case "welcome":
            return {
                subject: "Welcome to the team! 👋",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        ${heroIcon("https://img.icons8.com/fluency/96/handshake.png", "Welcome")}
                        <h1 style="margin:0 0 12px; color:#1e293b; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Welcome, ${firstName}!</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0; line-height: 1.6;">We're thrilled to have you onboard.</p>
                    </div>

                    <p style="font-size: 16px; color: #475569; margin: 30px 0 40px; text-align: center; line-height: 1.7;">
                        Workers United is your bridge to great job opportunities in Europe. We handle the paperwork, so you can focus on building your future.
                    </p>
                    
                    <div style="background:#f8fafc; border-radius:24px; padding:30px; margin:30px 0; border: 1px solid #f1f5f9;">
                        <h3 style="margin:0 0 25px; font-size:12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; text-align: center;">Your Journey</h3>
                        
                        <div style="display: table; width: 100%;">
                            <div style="display: table-row;">
                                <div style="display: table-cell; vertical-align: top; width: 50px; padding-bottom: 20px;">
                                    <div style="background: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                        <img src="https://img.icons8.com/fluency/48/edit-user-female.png" width="20">
                                    </div>
                                </div>
                                <div style="display: table-cell; vertical-align: top; padding-bottom: 20px;">
                                    <strong style="color: #1e293b; font-size: 15px; display: block; margin-bottom: 4px;">1. Complete Profile</strong>
                                    <span style="color: #64748b; font-size: 14px;">Review all fields</span>
                                </div>
                            </div>
                            <div style="display: table-row;">
                                <div style="display: table-cell; vertical-align: top; width: 50px; padding-bottom: 20px;">
                                     <div style="background: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                        <img src="https://img.icons8.com/fluency/48/upload-to-cloud.png" width="20">
                                    </div>
                                </div>
                                <div style="display: table-cell; vertical-align: top; padding-bottom: 20px;">
                                    <strong style="color: #1e293b; font-size: 15px; display: block; margin-bottom: 4px;">2. Upload Docs</strong>
                                    <span style="color: #64748b; font-size: 14px;">Passport, Photo, Diploma</span>
                                </div>
                            </div>
                            <div style="display: table-row;">
                                <div style="display: table-cell; vertical-align: top; width: 50px; padding-bottom: 20px;">
                                     <div style="background: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                        <img src="https://img.icons8.com/fluency/48/artificial-intelligence.png" width="20">
                                    </div>
                                </div>
                                <div style="display: table-cell; vertical-align: top; padding-bottom: 20px;">
                                    <strong style="color: #1e293b; font-size: 15px; display: block; margin-bottom: 4px;">3. AI Verification</strong>
                                    <span style="color: #64748b; font-size: 14px;">Instant checks</span>
                                </div>
                            </div>
                            <div style="display: table-row;">
                                <div style="display: table-cell; vertical-align: top; width: 50px;">
                                     <div style="background: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                        <img src="https://img.icons8.com/fluency/48/rocket.png" width="20">
                                    </div>
                                </div>
                                <div style="display: table-cell; vertical-align: top;">
                                    <strong style="color: #1e293b; font-size: 15px; display: block; margin-bottom: 4px;">4. Get Hired</strong>
                                    <span style="color: #64748b; font-size: 14px;">Matched with employers</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:50px;">
                        <a href="https://workersunited.eu/profile/worker/edit" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/verified-account.png", "Verified")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Verification Complete!</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0;">Your documents are approved.</p>
                    </div>

                    <p style="margin-top: 35px; color: #475569; text-align: center; font-size: 16px; line-height: 1.7;">
                        Great news, ${firstName}! Your profile is now 100% verified. You are officially ready to enter our job matching queue.
                    </p>
                    
                    <div style="background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius:24px; padding:40px; margin:40px 0; color:white; text-align:center; box-shadow: 0 20px 40px -10px rgba(37, 99, 235, 0.4); position: relative; overflow: hidden;">
                        
                        <div style="position: relative; z-index: 10;">
                            <h3 style="margin:0 0 8px; font-size:22px; color: white; font-weight: 700;">Activate Job Search</h3>
                            <p style="margin:0 0 30px; opacity:0.9; font-size: 16px; color: #dbeafe;">One-time entry fee</p>
                            <div style="font-size:60px; font-weight:800; margin-bottom: 25px; letter-spacing: -2px; color: white; line-height: 1;">$9</div>
                            <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); display: inline-block; padding: 8px 18px; border-radius: 99px; font-size: 13px; font-weight: 600; color: white; border: 1px solid rgba(255,255,255,0.2);">
                                ✨ 90-day money-back guarantee
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:20px;">
                        <a href="https://workersunited.eu/profile/worker" style="color: #64748b; text-decoration: none; font-weight: 600; font-size: 14px; transition: color 0.2s;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/rocket.png", "Rocket")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Payment Confirmed</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0;">Your job search is active.</p>
                    </div>

                    <div style="background:#f0fdf4; border-radius:20px; padding:20px; margin:35px 0; text-align: center; border: 1px solid #bbf7d0;">
                        <p style="margin:0; color: #15803d; font-weight: 600; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <img src="https://img.icons8.com/fluency/48/checked.png" width="22">
                            ${data.amount || "$9"} Payment Received
                        </p>
                    </div>
                    
                    <div style="margin: 35px 0; text-align: center;">
                        <h3 style="color:#334155; font-size: 18px; font-weight: 700; margin-bottom: 12px;">What happens now?</h3>
                        <p style="color:#64748b; font-size: 16px; line-height: 1.7;">
                            Sit back and relax. Our system is now actively matching your profile with employers across Europe. You will receive an email instantly when we find a match!
                        </p>
                    </div>

                    <div style="text-align:center; margin-top:50px;">
                        <a href="https://workersunited.eu/profile" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/briefcase.png", "Job")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">You've been picked!</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0;">A company wants to hire you.</p>
                    </div>

                    <div style="background:#fff; border: 1px solid #e2e8f0; border-radius:24px; margin:35px 0; overflow: hidden; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.06);">
                         <div style="padding: 35px; text-align: center;">
                            <div style="font-size: 12px; color: #3b82f6; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 15px;">Official Offer</div>
                            <h2 style="margin:0 0 12px; font-size: 24px; color: #1e293b; font-weight: 700;">${data.jobTitle}</h2>
                            <p style="margin:0 0 25px; color: #64748b; font-size: 16px; font-weight: 500;">${data.companyName}</p>
                            
                            <div style="display: inline-block; background: #eff6ff; color: #2563eb; padding: 10px 20px; border-radius: 99px; font-weight: 600; font-size: 14px; box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.1);">
                                📍 ${data.country || "Europe"}
                            </div>
                        </div>
                    </div>
                    
                    <div style="background:#fff7ed; border-radius:16px; padding:18px; text-align: center; color: #ea580c; font-weight: 600; font-size: 15px; border: 1px solid #ffedd5; box-shadow: 0 4px 6px -2px rgba(234, 88, 12, 0.05);">
                        ⏰ Please respond within 24 hours
                    </div>
                    
                    <div style="text-align:center; margin-top:50px;">
                        <a href="${data.offerLink || "https://workersunited.eu/profile"}" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
                        <div style="background: linear-gradient(135deg, #fef2f2 0%, #ffe4e6 100%); width: 96px; height: 96px; border-radius: 28px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.7), 0 10px 20px -5px rgba(239, 68, 68, 0.15);">
                            <img src="https://img.icons8.com/fluency/96/alarm-clock.png" width="56" height="56" alt="Clock">
                        </div>
                        <h1 style="color:#ef4444; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Hurry up!</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0;">Your job offer is waiting.</p>
                    </div>

                    <p style="text-align: center; color: #475569; margin: 35px 0; font-size: 16px; line-height: 1.7;">
                        Hey ${firstName}, you have a pending job offer that expires soon. Don't let this opportunity slip away!
                    </p>
                    
                    <div style="text-align:center; margin-top:50px;">
                        <a href="${data.offerLink || "https://workersunited.eu/profile"}" style="${buttonStyle} background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.3); width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/refund.png", "Refund")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Refund Sent</h1>
                    </div>

                    <p style="color: #475569; margin-bottom: 30px; text-align: center; font-size: 16px;">
                        Hi ${firstName}, as per our 90-day guarantee, we have processed your refund of <strong>${data.amount || "$9"}</strong>.
                    </p>
                    
                    <div style="background:#f8fafc; border-radius:16px; padding:25px; text-align: center; color: #64748b; font-size: 15px; border: 1px solid #e2e8f0;">
                        The funds should appear in your account within 5-10 business days.
                    </div>
                    
                    <p style="margin-top: 35px; color: #94a3b8; font-size: 15px; text-align: center; line-height: 1.7;">
                        We're sorry we couldn't find the perfect match this time. You are always welcome back!
                    </p>
                `, "Refund Processed", "Funds returned")
            };

        case "document_expiring":
            return {
                subject: "⚠️ Document Alert",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                         <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); width: 96px; height: 96px; border-radius: 28px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.7), 0 10px 20px -5px rgba(249, 115, 22, 0.15);">
                            <img src="https://img.icons8.com/fluency/96/expired.png" width="56" height="56" alt="Expired">
                        </div>
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Check your docs</h1>
                    </div>

                    <p style="color: #475569; text-align: center; margin-bottom: 35px; font-size: 16px;">
                        Your <strong>${data.documentType}</strong> is expiring on <strong style="color:#ea580c">${data.expirationDate}</strong>.
                    </p>
                    
                    <div style="background:#fff7ed; border-radius:16px; padding:20px; text-align: center; color: #c2410c; border: 1px solid #ffedd5; font-weight: 600;">
                        Please update it to keep your profile active.
                    </div>
                    
                    <div style="text-align:center; margin-top:50px;">
                        <a href="https://workersunited.eu/profile/worker/documents" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/bullish.png", "Match")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">New Match!</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0;">We found a job for you.</p>
                    </div>

                    <div style="background:white; border: 1px solid #e2e8f0; border-radius:24px; overflow:hidden; margin: 35px 0; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05);">
                        <div style="padding: 35px; text-align: center;">
                            <h3 style="margin:0 0 8px; color:#1e293b; font-size: 20px; font-weight: 700;">${data.jobTitle}</h3>
                            <div style="color: #64748b; font-size: 16px; margin-bottom: 25px;">${data.industry}</div>
                            
                            <div style="display: flex; gap: 12px; justify-content: center;">
                                <span style="background: #eff6ff; color: #2563eb; padding: 10px 20px; border-radius: 99px; font-size: 14px; font-weight: 600;">
                                    ${data.location}
                                </span>
                                <span style="background: #f0fdf4; color: #166534; padding: 10px 20px; border-radius: 99px; font-size: 14px; font-weight: 600;">
                                    ${data.salary}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:50px;">
                        <a href="${data.offerLink}" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/commercial.png", "News")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Profile Update</h1>
                    </div>

                    <div style="background:#f8fafc; border: 1px solid #e2e8f0; border-radius:20px; padding:30px; margin:35px 0;">
                        <h3 style="margin-top:0; color: #1e293b; font-size: 18px; font-weight: 700; margin-bottom: 10px;">${data.title}</h3>
                        <p style="margin-bottom:0; color: #64748b; font-size: 16px; line-height: 1.7;">${data.message}</p>
                    </div>
                    
                    <div style="text-align:center; margin-top:50px;">
                        <a href="https://workersunited.eu/profile" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/megaphone.png", "Announcement")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">${data.title}</h1>
                    </div>

                    <div style="color: #475569; font-size: 16px; line-height: 1.8; margin: 35px 0; white-space: pre-line; text-align: center;">
                        ${data.message}
                    </div>

                    ${data.actionLink ? `
                    <div style="text-align:center; margin-top:50px;">
                        <a href="${data.actionLink}" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/edit-property.png", "Edit")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Almost there!</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0;">You're missing a few things.</p>
                    </div>

                    <div style="margin: 35px 0;">
                         <p style="color: #475569; text-align: center; margin-bottom: 25px; font-size: 16px;">
                            We want to match you with a job, but we need these details first:
                         </p>
                         
                         <div style="background:#fff7ed; border: 1px dashed #fdba74; border-radius:16px; padding:25px; color: #c2410c; font-weight: 600; text-align: center; font-size: 15px;">
                            ${data.missingFields}
                         </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:50px;">
                        <a href="https://workersunited.eu/profile/worker/edit" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/todo-list.png", "Todo")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">${title}</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0;">${text}</p>
                    </div>

                   <div style="background:#f8fafc; border-radius:20px; padding:30px; margin:35px 0; border: 1px solid #e2e8f0;">
                        <strong style="display:block; margin-bottom:15px; color:#1e293b; font-size: 16px;">What's missing:</strong>
                        <ul style="padding-left: 20px; margin: 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                            ${data.todoList}
                        </ul>
                    </div>

                    <div style="text-align:center; margin-top:50px;">
                        <a href="${btnLink}" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
                            Complete Now
                        </a>
                    </div>
                `, "Profile Reminder", "Don't wait")
            };
        }

        case "profile_warning": {
            const daysLeft = data.daysLeft || 0;
            const color = daysLeft <= 1 ? "#ef4444" : "#f59e0b";
            const bgGradient = daysLeft <= 1
                ? "linear-gradient(135deg, #fef2f2 0%, #ffe4e6 100%)"
                : "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)";

            return {
                subject: `Last chance: ${daysLeft} days left`,
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <div style="background: ${bgGradient}; width: 96px; height: 96px; border-radius: 28px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.7), 0 10px 20px -5px rgba(0,0,0, 0.05);">
                            <img src="https://img.icons8.com/fluency/96/high-priority.png" width="56" height="56" alt="Warning">
                        </div>
                        <h1 style="color:${color}; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Account Warning</h1>
                        <p style="font-size: 17px; color: #64748b; margin: 0;">
                            Your account will be deleted in <strong>${daysLeft} days</strong>.
                        </p>
                    </div>

                    <p style="text-align: center; color: #475569; margin: 35px 0; font-size: 16px; line-height: 1.7;">
                        We delete incomplete profiles to keep our platform valid. Please finish your signup to stay with us!
                    </p>

                    <div style="text-align:center; margin-top:50px;">
                        <a href="https://workersunited.eu/profile/worker/edit" style="${buttonStyle} background: ${color}; box-shadow: 0 10px 15px -3px rgba(0,0,0, 0.1); width: 100%; box-sizing: border-box; display: block;">
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
                        ${heroIcon("https://img.icons8.com/fluency/96/trash.png", "Deleted")}
                        <h1 style="color:#1e293b; font-size: 28px; font-weight: 700; margin: 0 0 10px;">Goodbye for now</h1>
                    </div>

                    <p style="text-align: center; color: #475569; margin: 35px 0; font-size: 16px; line-height: 1.7;">
                         Your account has been removed due to inactivity. You are always welcome to sign up again when you are ready!
                    </p>
                    
                    <div style="text-align:center; margin-top:50px;">
                        <a href="https://workersunited.eu/signup" style="${buttonStyle} width: 100%; box-sizing: border-box; display: block;">
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
