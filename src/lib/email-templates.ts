// Email templates for Workers United

export type EmailType =
    | "welcome"
    | "profile_complete"
    | "payment_success"
    | "job_offer"
    | "offer_reminder"
    | "refund_approved";

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

const wrapTemplate = (content: string): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f6fb;">
    <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
        <!-- Header -->
        <div style="text-align:center; margin-bottom:30px;">
            <img src="https://workersunited.eu/logo.png" alt="Workers United" width="48" height="48" style="border-radius:8px;">
            <h1 style="margin:10px 0 0; font-size:24px; color:#183b56;">Workers United</h1>
        </div>
        
        <!-- Content -->
        <div style="background:white; border-radius:16px; padding:40px; box-shadow:0 2px 8px rgba(0,0,0,0.05); ${baseStyles}">
            ${content}
        </div>
        
        <!-- Footer -->
        <div style="text-align:center; margin-top:30px; color:#6c7a89; font-size:12px;">
            <p style="margin:0 0 10px;">Workers United LLC</p>
            <p style="margin:0 0 10px;">75 E 3rd St., Sheridan, Wyoming 82801</p>
            <p style="margin:0;">
                <a href="https://workersunited.eu/privacy-policy" style="color:#2f6fed;">Privacy Policy</a> · 
                <a href="https://workersunited.eu/terms" style="color:#2f6fed;">Terms of Service</a>
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
                html: wrapTemplate(`
                    <h2 style="margin:0 0 20px; color:#183b56;">Welcome, ${name}!</h2>
                    <p>Thank you for joining Workers United. We're excited to help you find your dream job in Europe.</p>
                    
                    <div style="background:#f4f6fb; border-radius:12px; padding:20px; margin:25px 0;">
                        <h3 style="margin:0 0 15px; font-size:16px;">Next Steps:</h3>
                        <ol style="margin:0; padding-left:20px;">
                            <li style="margin-bottom:8px;">Complete your profile</li>
                            <li style="margin-bottom:8px;">Upload your documents</li>
                            <li style="margin-bottom:8px;">Pay the $9 activation fee</li>
                            <li>We'll start searching for jobs!</li>
                        </ol>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://workersunited.eu/onboarding" style="${buttonStyle}">
                            Complete Your Profile
                        </a>
                    </div>
                    
                    <p style="margin-top:30px; color:#6c7a89; font-size:14px;">
                        Questions? Reply to this email or contact us at contact@workersunited.eu
                    </p>
                `)
            };

        case "profile_complete":
            return {
                subject: "Your profile is complete! One more step... 📋",
                html: wrapTemplate(`
                    <h2 style="margin:0 0 20px; color:#183b56;">Great job, ${name}!</h2>
                    <p>Your profile and documents are now verified. You're just one step away from starting your job search.</p>
                    
                    <div style="background:linear-gradient(135deg, #183b56 0%, #2f6fed 100%); border-radius:12px; padding:25px; margin:25px 0; color:white; text-align:center;">
                        <h3 style="margin:0 0 10px; font-size:20px;">Activate Your Profile</h3>
                        <p style="margin:0 0 20px; opacity:0.9;">Pay just $9 to enter our job matching queue</p>
                        <div style="font-size:32px; font-weight:bold;">$9</div>
                        <p style="margin:10px 0 0; font-size:13px; opacity:0.8;">90-day money-back guarantee if no job found</p>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://workersunited.eu/dashboard" style="${buttonStyle}">
                            Activate Now
                        </a>
                    </div>
                `)
            };

        case "payment_success":
            return {
                subject: "Payment confirmed! Your job search has started 🚀",
                html: wrapTemplate(`
                    <h2 style="margin:0 0 20px; color:#183b56;">You're all set, ${name}!</h2>
                    <p>Your payment of <strong>${data.amount || "$9"}</strong> has been confirmed. Your profile is now active in our job matching queue.</p>
                    
                    <div style="background:#10b981; border-radius:12px; padding:20px; margin:25px 0; color:white; text-align:center;">
                        <div style="font-size:48px; margin-bottom:10px;">✓</div>
                        <h3 style="margin:0; font-size:18px;">Your job search has started!</h3>
                    </div>
                    
                    <div style="background:#f4f6fb; border-radius:12px; padding:20px; margin:25px 0;">
                        <h3 style="margin:0 0 15px; font-size:16px;">What happens next:</h3>
                        <ul style="margin:0; padding-left:20px;">
                            <li style="margin-bottom:8px;">We match your profile with employer requests</li>
                            <li style="margin-bottom:8px;">You'll receive job offers via email</li>
                            <li style="margin-bottom:8px;">Accept offers within 24 hours</li>
                            <li>We handle visa and documentation</li>
                        </ul>
                    </div>
                    
                    <div style="background:#fff3cd; border-radius:12px; padding:15px; margin:25px 0; border-left:4px solid #ffc107;">
                        <strong>90-Day Guarantee:</strong> If we don't find you a job within 90 days, you'll get a full refund.
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://workersunited.eu/dashboard" style="${buttonStyle}">
                            View Your Dashboard
                        </a>
                    </div>
                `)
            };

        case "job_offer":
            return {
                subject: `🎉 Job offer from ${data.companyName || "an employer"}!`,
                html: wrapTemplate(`
                    <h2 style="margin:0 0 20px; color:#183b56;">Great news, ${name}!</h2>
                    <p>You have received a job offer. Please review and respond within <strong>24 hours</strong>.</p>
                    
                    <div style="background:#f4f6fb; border-radius:12px; padding:25px; margin:25px 0;">
                        <h3 style="margin:0 0 15px; color:#183b56;">${data.jobTitle || "Job Opportunity"}</h3>
                        <p style="margin:0 0 10px;"><strong>Company:</strong> ${data.companyName || "Employer"}</p>
                        <p style="margin:0 0 10px;"><strong>Location:</strong> ${data.country || "Europe"}</p>
                    </div>
                    
                    <div style="background:#fff3cd; border-radius:12px; padding:15px; margin:25px 0; border-left:4px solid #ffc107;">
                        ⚠️ <strong>Important:</strong> You have 24 hours to respond. Declining may affect your refund eligibility.
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="${data.offerLink || "https://workersunited.eu/dashboard"}" style="${buttonStyle}">
                            View & Accept Offer
                        </a>
                    </div>
                `)
            };

        case "offer_reminder":
            return {
                subject: "⏰ Your job offer expires soon!",
                html: wrapTemplate(`
                    <h2 style="margin:0 0 20px; color:#dc3545;">Reminder: Offer expiring soon!</h2>
                    <p>Hi ${name}, you have a pending job offer that will expire in a few hours.</p>
                    
                    <div style="background:#fff3cd; border-radius:12px; padding:20px; margin:25px 0; text-align:center;">
                        <div style="font-size:32px; margin-bottom:10px;">⏰</div>
                        <p style="margin:0; font-weight:bold;">Don't miss this opportunity!</p>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="${data.offerLink || "https://workersunited.eu/dashboard"}" style="${buttonStyle}">
                            Respond Now
                        </a>
                    </div>
                `)
            };

        case "refund_approved":
            return {
                subject: "Your refund has been processed",
                html: wrapTemplate(`
                    <h2 style="margin:0 0 20px; color:#183b56;">Refund Processed</h2>
                    <p>Hi ${name}, as promised under our 90-day guarantee, your refund of <strong>${data.amount || "$9"}</strong> has been processed.</p>
                    
                    <div style="background:#f4f6fb; border-radius:12px; padding:20px; margin:25px 0;">
                        <p style="margin:0;">The refund will appear in your account within 5-10 business days, depending on your bank.</p>
                    </div>
                    
                    <p>We're sorry we couldn't find you a job this time. You're always welcome to try again in the future.</p>
                    
                    <p style="margin-top:30px; color:#6c7a89; font-size:14px;">
                        Thank you for giving Workers United a try.
                    </p>
                `)
            };

        default:
            return {
                subject: "Message from Workers United",
                html: wrapTemplate(`<p>Hello ${name},</p><p>This is a message from Workers United.</p>`)
            };
    }
}

// Helper function to queue an email
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

    await supabase.from("email_queue").insert({
        user_id: userId,
        email_type: emailType,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject: template.subject,
        template_data: { ...templateData, html: template.html },
        scheduled_for: scheduledFor?.toISOString() || new Date().toISOString()
    });
}
