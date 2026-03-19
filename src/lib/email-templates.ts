// Email templates for Workers United
import { normalizeUserType, type CanonicalUserType } from "@/lib/domain";
import { escapeHtml } from "@/lib/sanitize";

export type EmailType =
    | "welcome"
    | "profile_complete"
    | "payment_success"
    | "checkout_recovery"
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
    | "announcement_document_fix"
    | "document_review_result";

interface EmailTemplate {
    subject: string;
    html: string;
}

// ─── Strict template data ──────────────────────────────────────────────
export interface TemplateData {
    name?: string;
    email?: string;
    recipientRole?: Exclude<CanonicalUserType, "admin"> | null;
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
    recoveryStep?: number;
    paymentId?: string;
    // Document review
    approved?: boolean;
    docType?: string;
    feedback?: string | null;
}

const baseStyles = `
    font-family: 'Montserrat', sans-serif;
    color: #334155;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
`;

const buttonStyle = `
    display: inline-block;
    background: #111111;
    color: #ffffff !important;
    padding: 14px 32px;
    border-radius: 9999px;
    text-decoration: none;
    font-weight: 600;
    font-size: 16px;
    transition: all 0.3s ease;
    text-align: center;
`;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu";

type RecipientRole = Exclude<CanonicalUserType, "admin">;

function getRecipientRole(data: TemplateData): RecipientRole {
    const normalized = normalizeUserType(data.recipientRole);
    if (normalized === "employer" || normalized === "agency") {
        return normalized;
    }
    if (normalized === "worker") {
        return "worker";
    }
    if (data.isEmployer) {
        return "employer";
    }
    return "worker";
}

function getRecipientWorkspaceUrl(role: RecipientRole, purpose: "setup" | "dashboard" | "documents" | "queue" = "dashboard") {
    switch (role) {
        case "employer":
            return `${BASE_URL}/profile/employer`;
        case "agency":
            return `${BASE_URL}/profile/agency`;
        case "worker":
        default:
            switch (purpose) {
                case "setup":
                    return `${BASE_URL}/profile/worker/edit`;
                case "documents":
                    return `${BASE_URL}/profile/worker/documents`;
                case "queue":
                    return `${BASE_URL}/profile/worker/queue`;
                case "dashboard":
                default:
                    return `${BASE_URL}/profile/worker`;
            }
    }
}

function renderJourneyRows(rows: Array<{ icon: string; title: string; description: string }>) {
    return rows.map((row, index) => `
        <tr>
            <td width="50" style="vertical-align: top; padding-bottom: ${index === rows.length - 1 ? "0" : "15px"};">
                <img src="${row.icon}" width="32" alt="">
            </td>
            <td style="padding-bottom: ${index === rows.length - 1 ? "0" : "15px"};">
                <strong style="color: #1D1D1F;">${row.title}</strong>
                <div style="color: #515154; font-size: 14px;">${row.description}</div>
            </td>
        </tr>
    `).join("");
}

function getRoleReminderCopy(role: RecipientRole) {
    switch (role) {
        case "employer":
            return {
                subject: "Don't forget your company profile!",
                title: "Finish your company profile",
                text: "Complete your company details so your hiring request can move forward.",
                buttonText: "Open Employer Workspace",
                buttonUrl: getRecipientWorkspaceUrl("employer", "dashboard"),
            };
        case "agency":
            return {
                subject: "Don't forget your agency workspace!",
                title: "Finish your agency workspace",
                text: "Complete your agency details so you can manage worker cases from one place.",
                buttonText: "Open Agency Workspace",
                buttonUrl: getRecipientWorkspaceUrl("agency", "dashboard"),
            };
        case "worker":
        default:
            return {
                subject: "Don't forget your profile!",
                title: "Finish your worker profile",
                text: "Complete your profile and required documents so we can move your case to review.",
                buttonText: "Complete Profile",
                buttonUrl: getRecipientWorkspaceUrl("worker", "setup"),
            };
    }
}

function getRoleWarningCopy(role: RecipientRole) {
    switch (role) {
        case "employer":
            return {
                warningText: "Your company profile is still incomplete. If nothing changes, we will clean up this inactive account.",
                buttonText: "Save Company Profile",
                buttonUrl: getRecipientWorkspaceUrl("employer", "dashboard"),
            };
        case "agency":
            return {
                warningText: "Your agency workspace is still incomplete. If nothing changes, we will clean up this inactive workspace.",
                buttonText: "Save Agency Workspace",
                buttonUrl: getRecipientWorkspaceUrl("agency", "dashboard"),
            };
        case "worker":
        default:
            return {
                warningText: "Your worker profile is still incomplete. If nothing changes, we will clean up this inactive account.",
                buttonText: "Save My Profile",
                buttonUrl: getRecipientWorkspaceUrl("worker", "setup"),
            };
    }
}

function getRoleDeletionCopy(role: RecipientRole) {
    switch (role) {
        case "employer":
            return {
                body: "Your employer account was removed after a long period of inactivity while the profile stayed incomplete. You are always welcome to sign up again when you are ready to hire.",
                buttonText: "Create New Employer Account",
            };
        case "agency":
            return {
                body: "Your agency workspace was removed after a long period of inactivity while setup stayed incomplete. You are always welcome to sign up again when you are ready to manage worker cases.",
                buttonText: "Create New Agency Account",
            };
        case "worker":
        default:
            return {
                body: "Your worker account was removed after a long period of inactivity while the profile stayed incomplete. You are always welcome to sign up again when you are ready.",
                buttonText: "Create New Account",
            };
    }
}

function renderMonochromeHero(symbol: string, title: string, subtitle: string) {
    const safeSymbol = escapeHtml(symbol);
    const symbolFontSize = symbol.length > 1 ? 28 : 38;

    return `
        <div style="text-align: center;">
            <div style="width:80px;height:80px;border:2px solid #111111;border-radius:24px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
                <span style="font-size:${symbolFontSize}px;line-height:1;color:#111111;font-weight:700;">${safeSymbol}</span>
            </div>
            <h1 style="color:#1D1D1F; font-size: 26px; font-weight: 700; margin: 0 0 10px;">${title}</h1>
            <p style="font-size: 16px; color: #515154; margin-top: 5px;">${subtitle}</p>
        </div>
    `;
}

function renderDarkPanel(title: string, bodyHtml: string) {
    return `
        <div style="background:#111111; border-radius:16px; padding:32px; margin:35px 0; color:white; text-align:center;">
            <h3 style="margin:0 0 10px; font-size:22px; color: white;">${escapeHtml(title)}</h3>
            <div style="margin:0; opacity:0.9; font-size: 16px; color: #E5E5EA; line-height: 1.7;">
                ${bodyHtml}
            </div>
        </div>
    `;
}

function renderChecklistCard(title: string, items: string[]) {
    const rows = items.map((item, index) => `
        <tr>
            <td width="24" style="vertical-align: top; padding-bottom: ${index === items.length - 1 ? "0" : "10px"}; color:#111111; font-size:15px; font-weight:700; line-height:20px;">✓</td>
            <td style="padding-bottom: ${index === items.length - 1 ? "0" : "10px"}; color: #1D1D1F; font-size: 14px; text-align: left;">${item}</td>
        </tr>
    `).join("");

    return `
        <div style="background:#F5F5F7; border-radius:12px; padding:20px; margin:20px 0; border: 1px solid #E5E5EA;">
            <h3 style="margin:0 0 15px; font-size:12px; color: #86868B; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; text-align: center;">${escapeHtml(title)}</h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
            </table>
        </div>
    `;
}

// Helper to wrap content in the Monochrome Apple Header design
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
<body style="margin:0; padding:0; background-color:#F5F5F7; ${baseStyles}">
    <!-- Preheader text for inbox preview -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${subtitle}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    
    <!-- Main Email Container -->
    <div style="max-width:600px; margin: 0 auto; padding: 0 15px;">
        <div style="height:28px; line-height:28px; font-size:1px;">&nbsp;</div>
        
        <!-- The "Window" (Card) -->
        <div style="background:white; border-radius:24px; overflow: hidden; border: 1px solid #E5E5EA;">
            
            <!-- Compact official wordmark header -->
            <div style="background: #FFFFFF; padding: 20px 24px; text-align: center; border-bottom: 1px solid #E5E5EA;">
                <img src="https://workersunited.eu/logo-wordmark-email.png" alt="Workers United" width="168" height="12" style="display:block; margin:0 auto; width:168px; height:12px; border:0; outline:none; text-decoration:none;">
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

function getCheckoutRecoveryStatusMessage(step: number | undefined, amount: string) {
    const safeAmount = amount || "$9";

    switch (step) {
        case 2:
            return `Your ${safeAmount} Job Finder payment is still waiting. Return to your Workers United dashboard to activate job search and unlock support.`;
        case 3:
            return `Your previous ${safeAmount} Job Finder checkout expired. Open your Workers United dashboard to start a fresh checkout and continue where you left off.`;
        default:
            return `You opened the ${safeAmount} Job Finder checkout but did not finish it yet. Return to your Workers United dashboard to activate job search.`;
    }
}

function formatDocumentNameForEmail(value: string | undefined | null) {
    const raw = (value || "document").trim();
    return raw
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getEmailTemplate(type: EmailType, data: TemplateData): EmailTemplate {
    const name = escapeHtml(data.name || "friend");
    const firstName = escapeHtml((data.name || "friend").split(" ")[0]);
    const recipientRole = getRecipientRole(data);

    switch (type) {
        case "welcome": {
            const welcomeCopy = {
                worker: {
                    subject: "Welcome to Workers United",
                    title: `Welcome, ${firstName}!`,
                    subtitle: "We're thrilled to have you onboard.",
                    intro: "Workers United is your bridge to legal work in Europe. Complete your worker case first, and we will handle the rest when the right opportunity appears.",
                    buttonText: "Start Your Profile",
                    buttonUrl: getRecipientWorkspaceUrl("worker", "setup"),
                    rows: [
                        {
                            icon: "https://img.icons8.com/ios/50/000000/edit-user-male.png",
                            title: "1. Complete Profile",
                            description: "Review your worker details",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/upload-to-cloud.png",
                            title: "2. Upload Docs",
                            description: "Passport, photo, diploma",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/approval.png",
                            title: "3. Wait for Approval",
                            description: "We review the completed case",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/rocket.png",
                            title: "4. Activate Job Finder",
                            description: "Unlock the $9 search after approval",
                        },
                    ],
                },
                employer: {
                    subject: "Welcome to Workers United",
                    title: `Welcome, ${firstName}!`,
                    subtitle: "Your hiring workspace is ready.",
                    intro: "Workers United helps you request international workers without platform fees. Complete your employer profile so we can start matching real hiring needs.",
                    buttonText: "Open Employer Workspace",
                    buttonUrl: getRecipientWorkspaceUrl("employer", "dashboard"),
                    rows: [
                        {
                            icon: "https://img.icons8.com/ios/50/000000/company.png",
                            title: "1. Finish Company Profile",
                            description: "Add the essentials about your business",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/document.png",
                            title: "2. Submit Hiring Needs",
                            description: "Tell us role, salary, and headcount",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/search--v1.png",
                            title: "3. We Match Workers",
                            description: "We search verified worker cases for you",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/passport-control.png",
                            title: "4. We Handle Legal Steps",
                            description: "Contracts, visa workflow, and arrival coordination",
                        },
                    ],
                },
                agency: {
                    subject: "Welcome to Workers United",
                    title: `Welcome, ${firstName}!`,
                    subtitle: "Your agency workspace is ready.",
                    intro: "Workers United gives your agency one place to add workers, upload documents, and track each approved worker case through Job Finder and the visa process.",
                    buttonText: "Open Agency Workspace",
                    buttonUrl: getRecipientWorkspaceUrl("agency", "dashboard"),
                    rows: [
                        {
                            icon: "https://img.icons8.com/ios/50/000000/briefcase.png",
                            title: "1. Open Your Workspace",
                            description: "Use one dashboard for all worker cases",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/add-user-group-man-man.png",
                            title: "2. Add Workers",
                            description: "Create and manage worker profiles",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/upload-to-cloud.png",
                            title: "3. Upload Documents",
                            description: "Prepare each worker case for review",
                        },
                        {
                            icon: "https://img.icons8.com/ios/50/000000/checked-user-male.png",
                            title: "4. Unlock Job Finder Per Case",
                            description: "Activate approved worker cases one by one",
                        },
                    ],
                },
            }[recipientRole];

            return {
                subject: welcomeCopy.subject,
                html: wrapModernTemplate(`
                    <div style="text-align: center; margin-bottom: 30px;">
                         <img src="https://img.icons8.com/ios/100/000000/conference-call.png" width="80" height="80" alt="Welcome" style="margin-bottom: 20px;">
                        <h1 style="margin:0; color:#1D1D1F; font-size: 26px; font-weight: 700;">${welcomeCopy.title}</h1>
                        <p style="font-size: 16px; color: #515154; margin-top: 10px;">${welcomeCopy.subtitle}</p>
                    </div>

                    <p style="font-size: 16px; color: #1D1D1F; margin-bottom: 25px; text-align: center;">
                        ${welcomeCopy.intro}
                    </p>
                    
                    <div style="background:#F5F5F7; border-radius:12px; padding:25px; margin:30px 0; border: 1px solid #E5E5EA;">
                        <h3 style="margin:0 0 20px; font-size:12px; color: #86868B; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; text-align: center;">Your Journey</h3>
                        
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            ${renderJourneyRows(welcomeCopy.rows)}
                        </table>
                    </div>
                    
                    <div style="text-align:center; margin-top:40px;">
                        <a href="${welcomeCopy.buttonUrl}" style="${buttonStyle}">
                            ${welcomeCopy.buttonText}
                        </a>
                    </div>
                `, "Welcome to Workers United", "Let's get you moving.")
            };
        }

        case "profile_complete":
            return {
                subject: "Profile 100% Complete — Admin Review Started",
                html: wrapModernTemplate(`
                    <div style="text-align: center;">
                        <img src="https://img.icons8.com/ios/100/000000/verified-account.png" width="80" height="80" alt="Verified" style="margin-bottom: 20px;">
                        <h1 style="color:#1D1D1F; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Congratulations, ${firstName}!</h1>
                        <p style="font-size: 16px; color: #515154; margin-top: 5px;">Your profile is now 100% complete.</p>
                    </div>

                    <p style="margin-top: 30px; color: #1D1D1F; text-align: center;">
                        Your profile and required documents are now ready for admin review. We will check everything and unlock Job Finder as soon as your case is approved.
                    </p>
                    
                    <div style="background:#111111; border-radius:16px; padding:35px; margin:35px 0; color:white; text-align:center;">
                        <h3 style="margin:0 0 10px; font-size:22px; color: white;">What Happens Next</h3>
                        <p style="margin:0; opacity:0.9; font-size: 16px; color: #E5E5EA;">
                            1. Admin reviews your profile
                            <br>
                            2. Job Finder unlocks after approval
                            <br>
                            3. You can then activate the $9 service
                        </p>
                    </div>

                    <div style="background:#F5F5F7; border-radius:12px; padding:20px; margin:20px 0; border: 1px solid #E5E5EA;">
                        <h3 style="margin:0 0 15px; font-size:12px; color: #86868B; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; text-align: center;">While You Wait</h3>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td width="30" style="vertical-align: top; padding-bottom: 10px;"><img src="https://img.icons8.com/ios/50/000000/checked.png" width="20"></td>
                                <td style="padding-bottom: 10px; color: #1D1D1F; font-size: 14px;">Your profile is now in the admin review queue</td>
                            </tr>
                            <tr>
                                <td width="30" style="vertical-align: top; padding-bottom: 10px;"><img src="https://img.icons8.com/ios/50/000000/checked.png" width="20"></td>
                                <td style="padding-bottom: 10px; color: #1D1D1F; font-size: 14px;">We will notify you as soon as approval is complete</td>
                            </tr>
                            <tr>
                                <td width="30" style="vertical-align: top;"><img src="https://img.icons8.com/ios/50/000000/checked.png" width="20"></td>
                                <td style="color: #1D1D1F; font-size: 14px;">No payment is needed until Job Finder is officially unlocked</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://workersunited.eu/profile/worker" style="${buttonStyle}">
                            Open My Profile
                        </a>
                    </div>
                `, "Profile Complete!", "Your profile is now waiting for admin review.")
            };

        case "payment_success":
            {
            const amount = escapeHtml(data.amount || "$9");
            return {
                subject: "You're in the Queue!",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("✓", "Payment Confirmed", "Your job search is now active.")}

                    <p style="margin-top: 30px; color: #1D1D1F; text-align: center;">
                        We have received your <strong>${amount}</strong> Job Finder payment. Your worker case is now active in the queue, and our system can start matching you with employers.
                    </p>

                    ${renderDarkPanel("What Happens Next", `
                        1. Your profile stays active in the worker queue
                        <br>
                        2. We monitor new employer demand and match opportunities
                        <br>
                        3. You will hear from us as soon as a real case is ready
                    `)}

                    ${renderChecklistCard("Current Status", [
                        `<strong>${amount}</strong> entry fee received successfully`,
                        "Your Job Finder search is active",
                        "Your in-platform support inbox remains available during the queue stage",
                    ])}

                    <div style="text-align:center; margin-top:40px;">
                        <a href="${getRecipientWorkspaceUrl("worker", "queue")}" style="${buttonStyle}">
                            View My Status
                        </a>
                    </div>
                `, "Payment Confirmed", "Good luck!")
            };
            }

        case "checkout_recovery": {
            const recoveryStep = data.recoveryStep === 2 || data.recoveryStep === 3 ? data.recoveryStep : 1;
            const amount = escapeHtml(data.amount || "$9");

            const recoverySubjectMap: Record<1 | 2 | 3, string> = {
                1: "Finish activating Job Finder",
                2: "Your Job Finder activation is still waiting",
                3: "Your previous Job Finder checkout expired",
            };

            const recoveryTitleMap: Record<1 | 2 | 3, string> = {
                1: "Finish your Job Finder activation",
                2: "You're one step away from entering the queue",
                3: "Open a fresh checkout and continue",
            };

            const recoveryBodyMap: Record<1 | 2 | 3, string> = {
                1: `You opened the ${amount} Job Finder checkout but did not finish the payment yet. Return to your dashboard and continue when you're ready.`,
                2: `Your profile is still waiting for the ${amount} Job Finder payment. Once it is confirmed, your worker profile enters the active queue and support unlocks inside the platform.`,
                3: `Your earlier ${amount} checkout is no longer active. Open your dashboard to start a fresh checkout and continue exactly where you left off.`,
            };

            const recoveryNoteMap: Record<1 | 2 | 3, string> = {
                1: "Your profile stays exactly as it is. Nothing needs to be filled again.",
                2: "If we do not find you a job within 90 days, the entry fee is refunded.",
                3: "Only the old checkout expired. Your profile and documents stay saved in your account.",
            };

            return {
                subject: recoverySubjectMap[recoveryStep],
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("!", recoveryTitleMap[recoveryStep], `${firstName}, your profile is ready to continue.`)}

                    <p style="font-size: 16px; color: #1D1D1F; margin-bottom: 20px; text-align: center;">
                        ${recoveryBodyMap[recoveryStep]}
                    </p>

                    <div style="background:#F5F5F7; border-radius:16px; padding:24px; margin:30px 0; border: 1px solid #E5E5EA; text-align:center;">
                        <div style="font-size:12px; color:#86868B; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:10px;">
                            Job Finder activation
                        </div>
                        <div style="font-size:40px; font-weight:800; color:#111111; letter-spacing:-1px; margin-bottom:8px;">
                            ${amount}
                        </div>
                        <div style="font-size:15px; color:#515154;">
                            ${recoveryNoteMap[recoveryStep]}
                        </div>
                    </div>

                    ${renderDarkPanel("What You Need To Know", `
                        Only the checkout state changes here.
                        <br>
                        Your profile, documents, and review progress stay saved in the dashboard.
                        <br>
                        Open your account whenever you are ready to continue.
                    `)}

                    <div style="text-align:center; margin-top:40px;">
                        <a href="${BASE_URL}/profile/worker" style="${buttonStyle}">
                            Open dashboard
                        </a>
                    </div>
                `, "Finish your activation", recoverySubjectMap[recoveryStep])
            };
        }

        case "job_offer":
            {
            const jobTitle = escapeHtml(data.jobTitle || "Job Opportunity");
            const companyName = escapeHtml(data.companyName || "Workers United Employer");
            const country = escapeHtml(data.country || "Europe");
            return {
                subject: `✨ Job Offer: ${data.jobTitle}`,
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("★", "You've been picked!", "A company wants to hire you.")}

                    <div style="background:#FFFFFF; border: 1px solid #E5E5EA; border-radius:16px; margin:30px 0; overflow: hidden;">
                        <div style="background: #111111; padding: 15px; border-bottom: 1px solid #111111; text-align: center;">
                             <div style="font-size: 12px; color: #E5E5EA; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Official Offer</div>
                        </div>
                        <div style="padding: 30px; text-align: center;">
                            <h2 style="margin:0 0 10px; font-size: 22px; color: #1D1D1F; font-weight: 700;">${jobTitle}</h2>
                            <p style="margin:0 0 20px; color: #515154; font-size: 16px; font-weight: 500;">${companyName}</p>
                            
                            <div style="display: inline-block; background: #E5E5EA; color: #1D1D1F; padding: 6px 16px; border-radius: 99px; font-weight: 600; font-size: 13px;">
                                ${country}
                            </div>
                        </div>
                    </div>

                    ${renderDarkPanel("Response Window", "Please review this offer and respond within 24 hours so we can keep the hiring process moving.")}
                    
                    <div style="text-align:center; margin-top:40px;">
                        <a href="${data.offerLink || "https://workersunited.eu/profile/worker/queue"}" style="${buttonStyle}">
                            View & Accept Offer
                        </a>
                    </div>
                `, "Job Offer", "Congrats!")
            };
            }

        case "offer_reminder":
            return {
                subject: "Offer Expiring Soon!",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("!", "Hurry up!", "Your job offer is still waiting for a response.")}

                    <p style="text-align: center; color: #1D1D1F; margin: 30px 0; font-size: 16px;">
                        Hey ${firstName}, you have a pending job offer that expires soon. Don't let this opportunity slip away!
                    </p>

                    ${renderDarkPanel("Why This Matters", "If the offer expires without a response, we may need to release the slot and move the case forward without you.")}
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${data.offerLink || "https://workersunited.eu/profile/worker/queue"}" style="${buttonStyle}">
                            Respond Now
                        </a>
                    </div>
                `, "Action Required", "Tick tock...")
            };

        case "refund_approved": {
            const amount = escapeHtml(data.amount || "$9");
            return {
                subject: "Refund Processed",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("$", "Refund Sent", "Your 90-day guarantee refund has been processed.")}

                    <p style="color: #1D1D1F; margin-bottom: 25px; text-align: center; font-size: 16px;">
                        Hi ${firstName}, as per our 90-day guarantee, we have processed your refund of <strong>${amount}</strong>.
                    </p>

                    ${renderDarkPanel("Refund Timeline", "The funds should appear back on the original payment method within 5 to 10 business days, depending on your bank.")}
                    
                    <p style="margin-top: 25px; color: #86868B; font-size: 15px; text-align: center;">
                        We're sorry we couldn't find the perfect match this time. You are always welcome back!
                    </p>
                `, "Refund Processed", "Funds returned")
            };
        }

        case "document_expiring": {
            const documentType = escapeHtml(data.documentType || "document");
            const expirationDate = escapeHtml(data.expirationDate || "soon");
            return {
                subject: "Document Alert",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("!", "Check your documents", "One of your required files is close to expiring.")}

                    <p style="color: #1D1D1F; text-align: center; margin-bottom: 30px; font-size: 16px;">
                        Your <strong>${documentType}</strong> is expiring on <strong>${expirationDate}</strong>.
                    </p>

                    ${renderDarkPanel("Why Update Now", "Keeping your required documents current helps us avoid delays when your case reaches a live employer or visa-processing step.")}
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${getRecipientWorkspaceUrl("worker", "documents")}" style="${buttonStyle}">
                            Update Document
                        </a>
                    </div>
                `, "Document Alert", "Action needed")
            };
        }

        case "job_match":
            {
            const jobTitle = escapeHtml(data.jobTitle || "Job Match");
            const industry = escapeHtml(data.industry || "Industry");
            const location = escapeHtml(data.location || "Europe");
            const salary = escapeHtml(data.salary || "Salary to be confirmed");
            return {
                subject: `New Match: ${data.jobTitle}`,
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("+", "New Match!", "We found a job that fits your case.")}

                    <div style="background:white; border: 1px solid #E5E5EA; border-radius:16px; overflow:hidden; margin: 30px 0;">
                        <div style="padding: 25px; text-align: center;">
                            <h3 style="margin:0 0 5px; color:#1D1D1F; font-size: 20px; font-weight: 700;">${jobTitle}</h3>
                            <div style="color: #515154; font-size: 16px; margin-bottom: 20px;">${industry}</div>
                            
                            <div style="display: flex; gap: 10px; justify-content: center;">
                                <span style="background: #E5E5EA; color: #1D1D1F; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                                    ${location}
                                </span>
                                <span style="background: #E5E5EA; color: #1D1D1F; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                                    ${salary}
                                </span>
                            </div>
                        </div>
                    </div>

                    ${renderDarkPanel("Next Step", "Open the case details to review the opportunity, expected conditions, and what we need from you next.")}
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${data.offerLink}" style="${buttonStyle}">
                            View Details
                        </a>
                    </div>
                `, "New Match", "Check it out")
            };
            }

        case "admin_update":
            {
            const title = escapeHtml(data.title || "Case Update");
            const message = escapeHtml(data.message || "There is a new update in your Workers United case.");
            const actionLink = data.actionLink || "https://workersunited.eu/profile/worker";
            const actionText = escapeHtml(data.actionText || "Check Profile");
            return {
                subject: data.subject || "Update from Workers United",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("i", "Profile Update", "There is a new message about your case.")}

                    <div style="background:#F5F5F7; border: 1px solid #E5E5EA; border-radius:12px; padding:25px; margin:30px 0;">
                        <h3 style="margin-top:0; color: #1D1D1F; font-size: 18px;">${title}</h3>
                        <p style="margin-bottom:0; color: #515154; font-size: 16px;">${message}</p>
                    </div>
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${actionLink}" style="${buttonStyle}">
                            ${actionText}
                        </a>
                    </div>
                `, "Account Update", "Notification")
            };
            }

        case "document_review_result": {
            const isApproved = data.approved;
            const docName = formatDocumentNameForEmail(data.docType);
            const safeDocName = escapeHtml(docName);
            return {
                subject: isApproved
                    ? `Your ${docName} Has Been Approved`
                    : `Your ${docName} Needs Attention`,
                html: wrapModernTemplate(isApproved ? `
                    ${renderMonochromeHero("✓", `${safeDocName} Approved`, "One more required step is now complete.")}

                    <p style="margin-top: 30px; color: #1D1D1F; text-align: center;">
                        Your <strong>${safeDocName}</strong> has been verified and approved by our team. It is now safely stored in your Workers United dashboard, and you do not need to upload this file again.
                    </p>

                    ${renderDarkPanel("What Happens Next", `
                        1. Keep any remaining required documents moving forward
                        <br>
                        2. Your approved document stays locked in your case
                        <br>
                        3. We will notify you when the full profile reaches the next step
                    `)}

                    ${renderChecklistCard("Current Status", [
                        `${safeDocName} is verified and saved`,
                        "You can continue from your dashboard at any time",
                        "No action is needed for this document right now",
                    ])}

                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://workersunited.eu/profile/worker/documents" style="${buttonStyle}">Open My Documents</a>
                    </div>
                ` : `
                    ${renderMonochromeHero("!", `${safeDocName} Needs Attention`, "We still need a replacement file before your case can move forward.")}

                    <div style="background:#F5F5F7; border: 1px solid #E5E5EA; border-radius:12px; padding:25px; margin:30px 0;">
                        <p style="margin:0 0 10px; color: #86868B; font-size: 12px; font-weight:700; text-transform: uppercase; letter-spacing: 1px;">Issue Found</p>
                        <p style="margin:0; color: #1D1D1F; font-size: 16px;">${escapeHtml(data.feedback || "Document does not meet requirements.")}</p>
                    </div>

                    ${renderDarkPanel("Next Step", `
                        Upload a clearer replacement for your ${safeDocName.toLowerCase()} from the dashboard. We will review the new file as soon as it arrives.
                    `)}

                    ${renderChecklistCard("Before You Upload Again", [
                        "Make sure the full document is visible inside the frame",
                        "Avoid glare, blur, shadows, or overexposed areas",
                        "Upload the replacement from your dashboard documents section",
                    ])}

                    <div style="text-align:center; margin-top:35px;">
                        <a href="https://workersunited.eu/profile/worker/documents" style="${buttonStyle}">Upload New Document</a>
                    </div>
                `, isApproved ? "Good News" : "Action Needed", isApproved ? "Document Approved" : "Document Review")
            };
        }

        case "announcement":
            {
            const title = escapeHtml(data.title || "Announcement");
            const message = escapeHtml(data.message || "");
            return {
                subject: data.subject || "Announcement",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("!", title, "Important information from Workers United.")}

                    <div style="background:#F5F5F7; border: 1px solid #E5E5EA; border-radius:12px; padding:24px; color: #1D1D1F; font-size: 16px; line-height: 1.7; margin: 30px 0; white-space: pre-line; text-align: center;">
                        ${message}
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
            }

        case "profile_incomplete":
            return {
                subject: "Finish your profile!",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("!", "Almost there!", "You're missing a few things before we can move your case forward.")}

                    <div style="margin: 30px 0;">
                         <p style="color: #1D1D1F; text-align: center; margin-bottom: 20px; font-size: 16px;">
                            We want to match you with a job, but we need these details first:
                         </p>
                         
                         <div style="background:#F5F5F7; border: 1px solid #E5E5EA; border-radius:12px; padding:20px; color: #1D1D1F; font-weight: 500; text-align: center;">
                            ${data.missingFields}
                         </div>
                    </div>

                    ${renderDarkPanel("Why This Matters", "Your profile has to be complete before we can send the case to admin review and eventually unlock Job Finder.")}
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${getRecipientWorkspaceUrl("worker", "setup")}" style="${buttonStyle}">
                            Finish Profile
                        </a>
                    </div>
                `, "Complete Profile", "Action required")
            };

        case "profile_reminder": {
            const reminderCopy = getRoleReminderCopy(recipientRole);

            return {
                subject: reminderCopy.subject,
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("!", reminderCopy.title, reminderCopy.text)}

                   <div style="background:#F5F5F7; border-radius:12px; padding:25px; margin:30px 0; border: 1px solid #E5E5EA;">
                        <strong style="display:block; margin-bottom:15px; color:#1D1D1F; font-size: 16px;">What's missing:</strong>
                        <ul style="padding-left: 20px; margin: 0; color: #515154; font-size: 15px;">
                            ${data.todoList}
                        </ul>
                    </div>

                    ${renderDarkPanel("Keep The Case Moving", "Once the missing items are saved, your workspace can move to the next real step without starting over.")}

                    <div style="text-align:center; margin-top:35px;">
                        <a href="${reminderCopy.buttonUrl}" style="${buttonStyle}">
                            ${reminderCopy.buttonText}
                        </a>
                    </div>
                `, "Profile Reminder", "Don't wait")
            };
        }

        case "profile_warning": {
            const daysLeft = data.daysLeft || 0;
            const warningCopy = getRoleWarningCopy(recipientRole);

            return {
                subject: `Inactive account cleanup in ${daysLeft} days`,
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("!", "Inactive Account Warning", `If there is still no profile activity, we will clean up this incomplete account in ${daysLeft} days.`)}

                    <p style="text-align: center; color: #1D1D1F; margin: 30px 0; font-size: 16px;">
                        ${warningCopy.warningText} Update your profile or documents to keep the account active.
                    </p>

                    ${renderDarkPanel("Cleanup Timeline", `You still have <strong style="color:#ffffff;">${daysLeft} days</strong> to save activity on the account before the inactive cleanup runs.`)}

                    <div style="text-align:center; margin-top:35px;">
                        <a href="${warningCopy.buttonUrl}" style="${buttonStyle}">
                            ${warningCopy.buttonText}
                        </a>
                    </div>
                `, "Final Warning", "Please act now")
            };
        }

        case "profile_deletion": {
            const deletionCopy = getRoleDeletionCopy(recipientRole);
            return {
                subject: "Inactive Account Removed",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("×", "Goodbye for now", "This incomplete inactive account has been removed.")}

                    <p style="text-align: center; color: #1D1D1F; margin: 30px 0; font-size: 16px;">
                         ${deletionCopy.body}
                    </p>

                    ${renderChecklistCard("What This Means", [
                        "The inactive account has been cleared from our system",
                        "No additional action is required unless you want to return",
                        "You can create a fresh new account whenever you are ready",
                    ])}
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${BASE_URL}/signup" style="${buttonStyle}">
                            ${deletionCopy.buttonText}
                        </a>
                    </div>
                `, "Account Deleted", "See you later")
            };
        }

        case "announcement_document_fix":
            return {
                subject: "Important: Document Upload System Fixed",
                html: wrapModernTemplate(`
                    ${renderMonochromeHero("✓", `Hi ${firstName},`, "We've fixed the document upload issue.")}

                    <p style="font-size: 16px; color: #1D1D1F; margin-bottom: 20px;">
                        If you recently tried to upload your passport or diploma and experienced errors, we sincerely apologize. We have completely resolved this technical issue.
                    </p>
                    
                    <p style="font-size: 16px; color: #1D1D1F; margin-bottom: 30px;">
                        Your profile is waiting for you. You can now securely upload your documents and complete your AI verification to join the hiring queue.
                    </p>

                    ${renderDarkPanel("Next Step", "Return to your dashboard, upload the missing documents, and we will resume your case from there.")}
                    
                    <div style="text-align:center; margin-top:40px;">
                        <a href="${getRecipientWorkspaceUrl("worker", "documents")}" style="${buttonStyle}">
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
                        <p style="font-size: 16px; color: #1D1D1F;">Hello ${name},</p>
                        <p style="font-size: 16px; color: #515154;">This is a message from Workers United.</p>
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
    const recipientRole = getRecipientRole(templateData);
    const enrichedTemplateData = { ...templateData, recipientRole };
    const template = getEmailTemplate(emailType, { name: recipientName, ...enrichedTemplateData });

    const { data } = await supabase.from("email_queue").insert({
        user_id: userId,
        email_type: emailType,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject: template.subject,
        template_data: { ...enrichedTemplateData, html: template.html },
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
            console.error("Direct SMTP send failed:", err);
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
                    await wa.sendRoleWelcome(recipientPhone, firstName, recipientRole, userId);
                    break;
                case "profile_complete":
                    if (recipientRole === "worker") {
                        await wa.sendRoleStatusUpdate(
                            recipientPhone,
                            firstName,
                            "Your profile is 100% complete and is now waiting for admin review. We will unlock Job Finder as soon as it is approved.",
                            "worker",
                            userId
                        );
                    }
                    break;
                case "payment_success":
                    await wa.sendPaymentConfirmed(recipientPhone, firstName, templateData.amount || "$9", userId);
                    break;
                case "checkout_recovery":
                    await wa.sendRoleStatusUpdate(
                        recipientPhone,
                        firstName,
                        getCheckoutRecoveryStatusMessage(templateData.recoveryStep, templateData.amount || "$9"),
                        recipientRole,
                        userId
                    );
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
                    await wa.sendRoleStatusUpdate(recipientPhone, firstName, templateData.message || "Profile updated", recipientRole, userId);
                    break;
                case "announcement":
                    await wa.sendRoleAnnouncement(recipientPhone, templateData.title || "Announcement", templateData.message || "", recipientRole, templateData.actionLink, userId);
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
