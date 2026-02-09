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
    | "profile_incomplete";

interface EmailTemplate {
    subject: string;
    html: string;
}

interface TemplateData {
    name?: string;
    email?: string;
    jobTitle?: string;
    companyName?: string;
    country?: string;
    daysRemaining?: number;
    amount?: string;
    offerLink?: string;
    [key: string]: any;
}

const baseStyles = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #183b56;
    line-height: 1.6;
`;

const buttonStyle = `
    display: inline-block;
    background: linear-gradient(135deg, #2f6fed 0%, #1e5cd6 100%);
    color: white !important;
    padding: 14px 32px;
    border-radius: 30px;
    text-decoration: none;
    font-weight: bold;
    font-size: 16px;
`;

// Helper to wrap content in the modern design with dynamic header
const wrapModernTemplate = (content: string, title: string = "Workers United", subtitle: string = "Welcome to the team!"): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f6fb;">
    <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
        <!-- Content -->
        <div style="background:white; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.05); overflow: hidden; ${baseStyles}">
            <!-- Header Bar -->
            <div style="background: linear-gradient(135deg, #2f6fed 0%, #1e5cd6 100%); padding: 30px 20px; text-align: center;">
                <img src="https://workersunited.eu/logo.png" alt="Workers United" width="60" height="60" style="vertical-align: middle; filter: brightness(0) invert(1);">
                <div style="color: white; font-size: 24px; font-weight: bold; margin-top: 10px;">${title}</div>
                <div style="color: rgba(255,255,255,0.9); font-size: 16px; margin-top: 5px;">${subtitle}</div>
            </div>

            ${content}

            <!-- Bottom Bar -->
            <div style="background: linear-gradient(135deg, #2f6fed 0%, #1e5cd6 100%); height: 8px;"></div>
        </div>
        
        <!-- Footer -->
        <div style="text-align:center; margin-top:30px; color:#6c7a89; font-size:12px;">
            <div style="margin-bottom:20px;">
                <a href="https://www.facebook.com/profile.php?id=61585104076725" style="text-decoration:none; margin:0 8px;"><img src="https://img.icons8.com/color/48/facebook-new.png" width="24" height="24" alt="Facebook" style="vertical-align:middle;"></a>
                <a href="https://www.instagram.com/workersunited.eu/" style="text-decoration:none; margin:0 8px;"><img src="https://img.icons8.com/color/48/instagram-new.png" width="24" height="24" alt="Instagram" style="vertical-align:middle;"></a>
                <a href="https://www.linkedin.com/company/workersunited-eu/" style="text-decoration:none; margin:0 8px;"><img src="https://img.icons8.com/color/48/linkedin.png" width="24" height="24" alt="LinkedIn" style="vertical-align:middle;"></a>
                <a href="https://x.com/WorkersUnitedEU" style="text-decoration:none; margin:0 8px;"><img src="https://img.icons8.com/ios-filled/50/000000/x.png" width="22" height="22" alt="X" style="vertical-align:middle; opacity:0.8;"></a>
                <a href="https://www.tiktok.com/@www.workersunited.eu" style="text-decoration:none; margin:0 8px;"><img src="https://img.icons8.com/color/48/tiktok.png" width="24" height="24" alt="TikTok" style="vertical-align:middle;"></a>
                <a href="https://www.threads.com/@workersunited.eu" style="text-decoration:none; margin:0 8px;"><img src="https://img.icons8.com/ios-filled/50/000000/threads.png" width="22" height="22" alt="Threads" style="vertical-align:middle; opacity:0.8;"></a>
                <a href="https://www.reddit.com/r/WorkersUnitedEU/" style="text-decoration:none; margin:0 8px;"><img src="https://img.icons8.com/color/48/reddit.png" width="24" height="24" alt="Reddit" style="vertical-align:middle;"></a>
            </div>
            <p style="margin:0 0 10px;">Workers United LLC</p>
            <p style="margin:0 0 10px;">75 E 3rd St., Sheridan, Wyoming 82801</p>
            <p style="margin:0;">
                <a href="https://workersunited.eu/privacy-policy" style="color:#2f6fed; text-decoration:none;">Privacy Policy</a> · 
                <a href="https://workersunited.eu/terms" style="color:#2f6fed; text-decoration:none;">Terms of Service</a>
            </p>
        </div>
    </div>
</body>
</html>
`;

export function getEmailTemplate(type: EmailType, data: TemplateData): EmailTemplate {
    const name = data.name || "there";

    switch (type) {
        case "welcome":
            return {
                subject: "Welcome to Workers United! 🎉",
                html: wrapModernTemplate(`
                    <!-- Body Content -->
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">Welcome, ${name}!</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            Thank you for joining Workers United! We're excited to help you find the right job opportunities in Europe.
                        </p>
                        
                        <div style="background:#f0f7ff; border-radius:12px; padding:30px; margin:25px 0;">
                            <h3 style="margin:0 0 20px; font-size:18px; color: #183b56;">Your Next Steps:</h3>
                            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                                <div style="background: #2f6fed; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 12px; flex-shrink: 0;">✓</div>
                                <div style="font-size: 16px; color: #2d3748; padding-top: 2px;">1. Complete your profile information</div>
                            </div>
                            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                                <div style="background: #2f6fed; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 12px; flex-shrink: 0;">✓</div>
                                <div style="font-size: 16px; color: #2d3748; padding-top: 2px;">2. Upload documents</div>
                            </div>
                            <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
                                <div style="background: #2f6fed; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 12px; flex-shrink: 0;">✓</div>
                                <div style="font-size: 16px; color: #2d3748; padding-top: 2px;">3. Wait for verification</div>
                            </div>
                            <div style="display: flex; align-items: flex-start;">
                                <div style="background: #2f6fed; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 12px; flex-shrink: 0;">✓</div>
                                <div style="font-size: 16px; color: #2d3748; padding-top: 2px;">4. Get matched with employers!</div>
                            </div>
                        </div>
                        
                        <div style="text-align:center; margin-top:35px; margin-bottom: 20px;">
                            <a href="https://workersunited.eu/profile/worker/edit" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center;">
                                Complete Your Profile
                            </a>
                        </div>
                        
                        <p style="text-align: center; color:#6c7a89; font-size:14px; margin-top: 30px;">
                            Questions? Reply to this email or contact us at <a href="mailto:contact@workersunited.eu" style="color: #2f6fed; text-decoration: none;">contact@workersunited.eu</a>
                        </p>
                    </div>
                `, "Workers United", "Welcome to the team!")
            };

        case "profile_complete":
            return {
                subject: "Your profile is complete! One more step... 📋",
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">Great job, ${name}!</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            Your profile and documents are now verified. You're just one step away from starting your job search.
                        </p>
                        
                        <div style="background:linear-gradient(135deg, #183b56 0%, #2f6fed 100%); border-radius:12px; padding:30px; margin:25px 0; color:white; text-align:center;">
                            <h3 style="margin:0 0 10px; font-size:20px;">Activate Your Profile</h3>
                            <p style="margin:0 0 20px; opacity:0.9; font-size: 16px;">Pay just $9 to enter our job matching queue</p>
                            <div style="font-size:42px; font-weight:bold; margin-bottom: 10px;">$9</div>
                            <div style="background: rgba(255,255,255,0.1); display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 13px;">
                                90-day money-back guarantee
                            </div>
                        </div>
                        
                        <div style="text-align:center; margin-top:35px;">
                            <a href="https://workersunited.eu/profile" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center;">
                                Activate Now
                            </a>
                        </div>
                    </div>
                `, "Profile Verified", "You're ready for the next step!")
            };

        case "payment_success":
            return {
                subject: "Payment confirmed! Your job search has started 🚀",
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">You're all set, ${name}!</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            Your payment of <strong>${data.amount || "$9"}</strong> has been confirmed. Your profile is now active in our job matching queue.
                        </p>
                        
                        <div style="background:#f0fff4; border: 1px solid #bbf7d0; border-radius:12px; padding:30px; margin:25px 0; text-align:center;">
                            <div style="background: #10b981; color: white; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px;">✓</div>
                            <h3 style="margin:0; font-size:20px; color: #065f46;">Your job search has started!</h3>
                        </div>
                        
                        <div style="background:#f4f6fb; border-radius:12px; padding:30px; margin:25px 0;">
                            <h3 style="margin:0 0 15px; font-size:18px; color: #183b56;">What happens next:</h3>
                            <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                                <div style="color: #2f6fed; margin-right: 10px; font-weight: bold;">•</div>
                                <div>We match your profile with employer requests</div>
                            </div>
                            <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                                <div style="color: #2f6fed; margin-right: 10px; font-weight: bold;">•</div>
                                <div>You'll receive job offers via email</div>
                            </div>
                            <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                                <div style="color: #2f6fed; margin-right: 10px; font-weight: bold;">•</div>
                                <div>Accept offers within 24 hours</div>
                            </div>
                            <div style="display: flex; align-items: flex-start;">
                                <div style="color: #2f6fed; margin-right: 10px; font-weight: bold;">•</div>
                                <div>We handle visa and documentation</div>
                            </div>
                        </div>
                        
                        <div style="text-align:center; margin-top:35px;">
                            <a href="https://workersunited.eu/profile" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center;">
                                View Your Dashboard
                            </a>
                        </div>
                    </div>
                `, "Payment Confirmed", "Your future starts here!")
            };

        case "job_offer":
            return {
                subject: `🎉 Job offer from ${data.companyName || "an employer"}!`,
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">Great news, ${name}!</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            You have received a job offer. Please review and respond within <strong>24 hours</strong>.
                        </p>
                        
                        <div style="background:white; border: 1px solid #e2e8f0; border-radius:12px; padding:0; margin:25px 0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                            <div style="background: #f8fafc; padding: 15px 25px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #475569;">
                                JOB DETAILS
                            </div>
                            <div style="padding: 25px;">
                                <h3 style="margin:0 0 5px; font-size:22px; color:#183b56;">${data.jobTitle || "Job Opportunity"}</h3>
                                <p style="margin:0 0 20px; color: #64748b; font-size: 16px;">${data.companyName || "Employer"}</p>
                                
                                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                                    <div style="width: 24px; text-align: center; margin-right: 10px;">📍</div>
                                    <div style="font-weight: 500;">${data.country || "Europe"}</div>
                                </div>
                                <div style="display: flex; align-items: center;">
                                    <div style="width: 24px; text-align: center; margin-right: 10px;">💰</div>
                                    <div style="font-weight: 500;">Competitive Salary</div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background:#fff7ed; border: 1px solid #ffedd5; border-radius:12px; padding:15px; margin:25px 0; color: #9a3412;">
                            <strong>⚠️ Important:</strong> You have 24 hours to respond. Declining may affect your refund eligibility.
                        </div>
                        
                        <div style="text-align:center; margin-top:35px;">
                            <a href="${data.offerLink || "https://workersunited.eu/profile"}" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center;">
                                View & Accept Offer
                            </a>
                        </div>
                    </div>
                `, "New Job Offer", "A company wants to hire you!")
            };

        case "offer_reminder":
            return {
                subject: "⏰ Your job offer expires soon!",
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#dc3545; font-size: 28px; text-align: center;">Action Required</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            Hi ${name}, you have a pending job offer that will expire in a few hours.
                        </p>
                        
                        <div style="background:#fee2e2; border-radius:12px; padding:30px; margin:25px 0; text-align:center; color: #991b1b;">
                            <div style="font-size:48px; margin-bottom:15px;">⏰</div>
                            <h3 style="margin:0; font-size:20px; font-weight:bold;">Don't miss this opportunity!</h3>
                            <p style="margin:10px 0 0;">This offer is waiting for your response.</p>
                        </div>
                        
                        <div style="text-align:center; margin-top:35px;">
                            <a href="${data.offerLink || "https://workersunited.eu/profile"}" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center; background: linear-gradient(135deg, #dc3545 0%, #b91c1c 100%);">
                                Respond Now
                            </a>
                        </div>
                    </div>
                `, "Offer Expiring", "Please respond immediately")
            };

        case "refund_approved":
            return {
                subject: "Your refund has been processed",
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">Refund Processed</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            Hi ${name}, as promised under our 90-day guarantee, your refund of <strong>${data.amount || "$9"}</strong> has been processed.
                        </p>
                        
                        <div style="background:#f4f6fb; border-radius:12px; padding:25px; margin:25px 0; text-align: center;">
                             <div style="font-size:48px; margin-bottom:15px;">💸</div>
                            <p style="margin:0; font-size: 16px; color: #183b56; font-weight: 500;">Funds sent to your original payment method</p>
                            <p style="margin:10px 0 0; font-size: 14px; color: #64748b;">Expect it within 5-10 business days.</p>
                        </div>
                        
                        <p style="text-align: center; font-size: 15px; color: #4a5568; margin-top: 30px;">
                            We're sorry we couldn't find you a job this time. You're always welcome to try again in the future.
                            <br><br>
                            Thank you for giving Workers United a try.
                        </p>
                    </div>
                `, "Refund Approved", "Money is on the way")
            };

        case "document_expiring":
            return {
                subject: "Action Required: Document Expiring Soon ⚠️",
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">Document Alert</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            Hello ${name},<br><br>
                            Your <strong>${data.jobTitle || 'document'}</strong> is set to expire on <strong>${data.startDate || 'soon'}</strong>.
                        </p>
                        
                        <div style="background:#fff4e5; border:1px solid #ffe0b2; border-radius:12px; padding:25px; margin:25px 0; text-align:center;">
                            <div style="font-size:32px; margin-bottom:10px;">🕒</div>
                            <h3 style="margin:0 0 10px; color:#d97706; font-size:18px;">Expiration Date</h3>
                            <p style="margin:0; font-weight:bold; color:#b45309; font-size:20px;">
                                ${data.startDate || 'Unknown'}
                            </p>
                            <p style="margin:10px 0 0; font-size:14px; color:#9a3412;">
                                Please renew this document to maintain your verified status.
                            </p>
                        </div>
                        
                        <div style="text-align:center; margin-top:35px;">
                            <a href="https://workersunited.eu/profile/worker/documents" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center;">
                                Update Document
                            </a>
                        </div>
                    </div>
                `, "Expiration Alert", "Please check your documents")
            };

        case "job_match":
            return {
                subject: `New Job Match: ${data.jobTitle} in ${data.location}`,
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="background-color: #e3f2fd; color: #1565c0; display: inline-block; padding: 8px 16px; border-radius: 50px; font-weight: 600; font-size: 14px;">
                                🎯 New Match found for you!
                            </div>
                        </div>
                        
                        <h2 style="margin:0 0 15px; color:#183b56; font-size: 24px; text-align: center;">${data.jobTitle}</h2>
                        
                        <div style="background: #f8fafc; border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #e2e8f0;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                <tr>
                                    <td style="padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #64748b; font-size: 14px;">Location</span><br>
                                        <strong style="color: #183b56; font-size: 16px;">${data.location}</strong>
                                    </td>
                                    <td style="padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">
                                        <span style="color: #64748b; font-size: 14px;">Salary</span><br>
                                        <strong style="color: #10b981; font-size: 16px;">${data.salary}</strong>
                                    </td>
                                </tr>
                                <tr>
                                    <td colspan="2" style="padding-top: 15px;">
                                        <span style="color: #64748b; font-size: 14px;">Industry</span><br>
                                        <strong style="color: #183b56; font-size: 16px;">${data.industry}</strong>
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <p style="text-align: center; font-size: 15px; color: #4a5568; margin-bottom: 30px;">
                            This job matches your profile preferences. Apply now before the position is filled!
                        </p>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${data.offerLink}" style="background-color: #1877f2; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(24, 119, 242, 0.25);">
                                View Job Details
                            </a>
                        </div>
                        
                        <p style="text-align: center; font-size: 13px; color: #94a3b8; margin-top: 20px;">
                            You received this because your profile matches this job opening.
                        </p>
                    </div>
                `, "New Job Match", "Opportunity for you")
            };

        case "admin_update":
            return {
                subject: data.subject || "Update from Workers United",
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">Profile Update</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            Hello ${name},<br><br>
                            An administrator has updated your profile status or documents.
                        </p>
                        
                        <div style="background:#f0f9ff; border-left: 4px solid #0ea5e9; border-radius:4px; padding:20px; margin:25px 0;">
                            <h3 style="margin:0 0 10px; color:#0369a1; font-size:18px;">${data.title || "Update Details"}</h3>
                            <p style="margin:0; color:#334155; font-size:16px; line-height: 1.6;">
                                ${data.message || "Your profile has been updated."}
                            </p>
                        </div>
                        
                        <div style="text-align:center; margin-top:35px;">
                            <a href="https://workersunited.eu/profile" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center;">
                                View Your Profile
                            </a>
                        </div>
                    </div>
                `, "Account Update", "Important Notification")
            };

        case "announcement":
            return {
                subject: data.subject || "Announcement from Workers United",
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">${data.title || "Announcement"}</h2>
                        
                        <div style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 30px; white-space: pre-line;">
                            ${data.message || "No content."}
                        </div>
                        
                        ${data.actionLink ? `
                        <div style="text-align:center; margin-top:35px;">
                            <a href="${data.actionLink}" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center;">
                                ${data.actionText || "View Details"}
                            </a>
                        </div>
                        ` : ''}
                        
                        <p style="text-align: center; font-size: 13px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                            You received this email because you are a registered user of Workers United.
                        </p>
                    </div>
                `, data.title || "Workers United", "Official Announcement")
            };

        case "profile_incomplete":
            return {
                subject: data.subject || "Action Required: Complete Your Profile",
                html: wrapModernTemplate(`
                    <div style="padding: 40px;">
                        <h2 style="margin:0 0 20px; color:#183b56; font-size: 28px; text-align: center;">Profile Update Needed</h2>
                        <p style="text-align: center; font-size: 16px; color: #4a5568; margin-bottom: 30px;">
                            Hello ${name},<br><br>
                            We've recently updated our platform and your profile is missing some information. Please take a moment to fill in the required fields.
                        </p>
                        
                        <div style="background:#fff7ed; border: 1px solid #ffedd5; border-radius:12px; padding:25px; margin:25px 0;">
                            <h3 style="margin:0 0 15px; color:#9a3412; font-size:16px;">Missing Fields:</h3>
                            <div style="color:#92400e; font-size:15px; line-height: 1.8;">
                                ${data.missingFields || "Some fields are incomplete."}
                            </div>
                        </div>
                        
                        <div style="background:#f0f9ff; border-radius:12px; padding:20px; margin:25px 0; text-align:center;">
                            <div style="font-size:42px; font-weight:bold; color:#2f6fed;">${data.completion || "0"}%</div>
                            <p style="margin:5px 0 0; color:#64748b; font-size:14px;">Profile Completion</p>
                        </div>
                        
                        <div style="text-align:center; margin-top:35px;">
                            <a href="https://workersunited.eu/profile" style="${buttonStyle} width: 100%; box-sizing: border-box; text-align: center;">
                                Complete Your Profile
                            </a>
                        </div>
                    </div>
                `, "Profile Update", "Action Required")
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

    // Send immediately via SMTP (no need to wait for n8n)
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
