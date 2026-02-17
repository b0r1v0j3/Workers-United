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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
    color: #1f2937;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
`;

const buttonStyle = `
    display: inline-block;
    background-color: #2563eb;
    color: #ffffff !important;
    padding: 14px 28px;
    border-radius: 99px;
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
    transition: background-color 0.2s;
`;

// Helper to wrap content in the modern design with dynamic header
const wrapModernTemplate = (content: string, title: string = "Workers United", subtitle: string = ""): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; ${baseStyles}">
    <!-- Preheader text for inbox preview -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${subtitle}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    
    <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
        
        <!-- Header: Clean & inviting -->
        <div style="text-align: center; margin-bottom: 30px;">
             <!-- Using Logo-Full for email headers usually looks better if background is not white, 
                  but here we want a clean look. Let's use the icon + text or just icon. 
                  Let's stick to the blue icon for brand recognition. -->
            <img src="https://workersunited.eu/logo.png" alt="Workers United" width="50" height="50" style="vertical-align: middle; border-radius: 12px;">
            <div style="font-weight: 800; font-size: 24px; margin-top: 15px; color: #111827; letter-spacing: -0.5px;">Workers United</div>
        </div>

        <!-- Main Card -->
        <div style="background:white; border-radius:24px; box-shadow:0 10px 40px rgba(0,0,0,0.08); overflow: hidden; padding: 40px;">
            ${content}
        </div>
        
        <!-- Footer: Friendly & Helpful -->
        <div style="text-align:center; margin-top:40px; color:#6b7280; font-size:13px;">
            <p style="margin-bottom:20px; font-weight: 500;">Stay connected</p>
            <div style="margin-bottom:30px;">
                <a href="https://www.facebook.com/profile.php?id=61585104076725" style="text-decoration:none; margin:0 10px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/facebook-new.png" width="28" height="28" alt="Facebook"></a>
                <a href="https://www.instagram.com/workersunited.eu/" style="text-decoration:none; margin:0 10px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/instagram-new.png" width="28" height="28" alt="Instagram"></a>
                <a href="https://www.threads.net/@workersunited.eu" style="text-decoration:none; margin:0 10px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/threads.png" width="28" height="28" alt="Threads"></a>
                <a href="https://www.linkedin.com/company/workersunited-eu/" style="text-decoration:none; margin:0 10px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/linkedin.png" width="28" height="28" alt="LinkedIn"></a>
                <a href="https://x.com/WorkersUnitedEU" style="text-decoration:none; margin:0 10px; opacity: 0.8;"><img src="https://img.icons8.com/ios-filled/50/333333/x.png" width="24" height="24" alt="X"></a>
                <a href="https://www.tiktok.com/@workersunited.eu" style="text-decoration:none; margin:0 10px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/tiktok.png" width="28" height="28" alt="TikTok"></a>
                <a href="https://www.reddit.com/user/workersunited-eu" style="text-decoration:none; margin:0 10px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/reddit.png" width="28" height="28" alt="Reddit"></a>
            </div>
            
            <p style="margin:0 0 8px;">&copy; ${new Date().getFullYear()} Workers United LLC</p>
            <p style="margin:0 0 20px;">75 E 3rd St., Sheridan, Wyoming 82801</p>
            <div style="margin-bottom: 20px;">
                <a href="https://workersunited.eu/privacy-policy" style="color:#6b7280; text-decoration:underline; margin: 0 10px;">Privacy</a>
                <a href="https://workersunited.eu/terms" style="color:#6b7280; text-decoration:underline; margin: 0 10px;">Terms</a>
                <a href="https://workersunited.eu/profile/settings" style="color:#6b7280; text-decoration:underline; margin: 0 10px;">Preferences</a>
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
                        <h1 style="margin:0; color:#111827; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Welcome, ${firstName}!</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 10px;">We're thrilled to have you onboard.</p>
                    </div>

                    <p style="font-size: 16px; color: #374151; margin-bottom: 25px;">
                        Workers United is your bridge to great job opportunities in Europe. We handle the paperwork, so you can focus on building your future.
                    </p>
                    
                    <div style="background:#f9fafb; border-radius:16px; padding:25px; margin:30px 0; border: 1px solid #e5e7eb;">
                        <h3 style="margin:0 0 20px; font-size:16px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Your Journey Starts Here</h3>
                        
                        <div style="display: flex; align-items: start; margin-bottom: 15px;">
                            <span style="font-size: 20px; margin-right: 15px;">📝</span>
                            <div>
                                <strong style="color: #111827;">1. Complete Profile</strong>
                                <div style="color: #6b7280; font-size: 14px;">Review all fields</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: start; margin-bottom: 15px;">
                            <span style="font-size: 20px; margin-right: 15px;">📤</span>
                            <div>
                                <strong style="color: #111827;">2. Upload Docs</strong>
                                <div style="color: #6b7280; font-size: 14px;">Passport, Photo, Diploma</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: start; margin-bottom: 15px;">
                            <span style="font-size: 20px; margin-right: 15px;">🤖</span>
                            <div>
                                <strong style="color: #111827;">3. AI Verification</strong>
                                <div style="color: #6b7280; font-size: 14px;">Instant checks</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: start;">
                            <span style="font-size: 20px; margin-right: 15px;">🚀</span>
                            <div>
                                <strong style="color: #111827;">4. Get Hired</strong>
                                <div style="color: #6b7280; font-size: 14px;">Matched with employers</div>
                            </div>
                        </div>
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
                        <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Verification Complete!</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 5px;">Your documents are approved.</p>
                    </div>

                    <p style="margin-top: 30px; color: #374151;">
                        Great news, ${firstName}! Your profile is now 100% verified. You are officially ready to enter our job matching queue.
                    </p>
                    
                    <div style="background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius:20px; padding:35px; margin:35px 0; color:white; text-align:center; box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3);">
                        <h3 style="margin:0 0 10px; font-size:22px;">Activate Job Search</h3>
                        <p style="margin:0 0 25px; opacity:0.9; font-size: 16px;">One-time entry fee</p>
                        <div style="font-size:56px; font-weight:800; margin-bottom: 15px; letter-spacing: -2px;">$9</div>
                        <div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                            ✨ 90-day money-back guarantee
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top:10px;">
                        <a href="https://workersunited.eu/profile/worker" style="color: #2563eb; text-decoration: none; font-weight: 600;">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">🚀</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Payment Confirmed</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 5px;">Your job search is active.</p>
                    </div>

                    <div style="background:#ecfdf5; border-radius:16px; padding:20px; margin:30px 0; text-align: center; border: 1px solid #d1fae5;">
                        <p style="margin:0; color: #059669; font-weight: 600; font-size: 18px;">
                            ✓ ${data.amount || "$9"} Payment Received
                        </p>
                    </div>
                    
                    <div style="margin: 30px 0;">
                        <h3 style="color:#111827; font-size: 18px;">What happens now?</h3>
                        <p style="color:#374151;">
                            Sit back and relax. Our system is now actively matching your profile with employers across Europe.
                        </p>
                        <p style="color:#374151;">
                            You will receive an email instantly when we find a match!
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
                        <div style="font-size: 60px; margin-bottom: 20px;">✨</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">You've been picked!</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 5px;">A company wants to hire you.</p>
                    </div>

                    <div style="background:#fff; border: 2px solid #f3f4f6; border-radius:20px; margin:30px 0; overflow: hidden;">
                        <div style="background: #f9fafb; padding: 20px; border-bottom: 2px solid #f3f4f6; text-align: center;">
                             <div style="font-size: 14px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Job Offer</div>
                        </div>
                        <div style="padding: 30px; text-align: center;">
                            <h2 style="margin:0 0 10px; font-size: 24px; color: #111827;">${data.jobTitle}</h2>
                            <p style="margin:0 0 20px; color: #6b7280; font-size: 18px;">${data.companyName}</p>
                            
                            <div style="display: inline-block; background: #eff6ff; color: #2563eb; padding: 8px 16px; border-radius: 99px; font-weight: 600; font-size: 14px;">
                                📍 ${data.country || "Europe"}
                            </div>
                        </div>
                    </div>
                    
                    <div style="background:#fff7ed; border-radius:12px; padding:15px; text-align: center; color: #c2410c; font-weight: 500; font-size: 15px;">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">⏰</div>
                        <h1 style="color:#be123c; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Hurry up!</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 5px;">Your job offer is waiting.</p>
                    </div>

                    <p style="text-align: center; color: #374151; margin: 30px 0;">
                        Hey ${firstName}, you have a pending job offer that expires soon. Don't let this opportunity slip away!
                    </p>
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${data.offerLink || "https://workersunited.eu/profile"}" style="${buttonStyle} background-color: #be123c; box-shadow: 0 4px 6px rgba(190, 18, 60, 0.2);">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">💸</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Refund Sent</h1>
                    </div>

                    <p style="color: #374151; margin-bottom: 25px;">
                        Hi ${firstName}, as per our 90-day guarantee, we have processed your refund of <strong>${data.amount || "$9"}</strong>.
                    </p>
                    
                    <div style="background:#f3f4f6; border-radius:12px; padding:20px; text-align: center; color: #4b5563; font-size: 14px;">
                        The funds should appear in your account within 5-10 business days.
                    </div>
                    
                    <p style="margin-top: 25px; color: #6b7280; font-size: 15px;">
                        We're sorry we couldn't find the perfect match this time. You are always welcome back!
                    </p>
                `, "Refund Processed", "Funds returned")
            };

        case "document_expiring":
            return {
                subject: "⚠️ Document Alert",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <div style="font-size: 60px; margin-bottom: 20px;">⚠️</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Check your docs</h1>
                    </div>

                    <p style="color: #374151; text-align: center; margin-bottom: 30px;">
                        Your <strong>${data.documentType}</strong> is expiring on <strong style="color:#c2410c">${data.expirationDate}</strong>.
                    </p>
                    
                    <div style="background:#fff7ed; border-radius:12px; padding:20px; text-align: center; color: #c2410c;">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">🎯</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">New Match!</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 5px;">We found a job for you.</p>
                    </div>

                    <div style="background:white; border: 2px solid #e5e7eb; border-radius:16px; overflow:hidden; margin: 30px 0;">
                        <div style="padding: 25px;">
                            <h3 style="margin:0 0 5px; color:#111827; font-size: 20px;">${data.jobTitle}</h3>
                            <div style="color: #6b7280; font-size: 16px; margin-bottom: 20px;">${data.industry}</div>
                            
                            <div style="display: flex; gap: 10px;">
                                <span style="background: #eff6ff; color: #2563eb; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                                    ${data.location}
                                </span>
                                <span style="background: #ecfdf5; color: #059669; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">📢</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Profile Update</h1>
                    </div>

                    <div style="background:#f3f4f6; border-radius:16px; padding:25px; margin:30px 0;">
                        <h3 style="margin-top:0; color: #111827;">${data.title}</h3>
                        <p style="margin-bottom:0; color: #4b5563;">${data.message}</p>
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
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">${data.title}</h1>
                    </div>

                    <div style="color: #374151; font-size: 16px; line-height: 1.7; margin: 30px 0; white-space: pre-line;">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">📝</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Almost there!</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 5px;">You're missing a few things.</p>
                    </div>

                    <div style="margin: 30px 0;">
                         <p style="color: #374151; text-align: center; margin-bottom: 20px;">
                            We want to match you with a job, but we need these details first:
                         </p>
                         
                         <div style="background:#fff7ed; border: 1px dashed #fdba74; border-radius:12px; padding:20px; color: #c2410c; font-weight: 500;">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">⏳</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">${title}</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 5px;">${text}</p>
                    </div>

                   <div style="background:#f9fafb; border-radius:16px; padding:25px; margin:30px 0;">
                        <strong style="display:block; margin-bottom:15px; color:#111827;">What's missing:</strong>
                        <ul style="padding-left: 20px; margin: 0; color: #4b5563;">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">🫣</div>
                        <h1 style="color:${color}; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Account Warning</h1>
                        <p style="font-size: 18px; color: #6b7280; margin-top: 5px;">
                            Your account will be deleted in <strong>${daysLeft} days</strong>.
                        </p>
                    </div>

                    <p style="text-align: center; color: #374151; margin: 30px 0;">
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
                        <div style="font-size: 60px; margin-bottom: 20px;">👋</div>
                        <h1 style="color:#111827; font-size: 28px; font-weight: 800; margin-bottom: 10px;">Goodbye for now</h1>
                    </div>

                    <p style="text-align: center; color: #374151; margin: 30px 0;">
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
                    <div style="padding: 40px;">
                        <p>Hello ${name},</p>
                        <p>This is a message from Workers United.</p>
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
