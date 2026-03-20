// Email templates for Workers United
import { normalizeUserType, type CanonicalUserType } from "@/lib/domain";
import { attachEmailQueueMeta, processQueuedEmailRecord, type EmailQueueDeliveryResult } from "@/lib/email-queue";
import { buildPlatformUrl, buildPlatformWhatsAppUrl, normalizePlatformWebsiteUrl } from "@/lib/platform-contact";
import { escapeHtml } from "@/lib/sanitize";

export type EmailType =
    | "welcome"
    | "profile_complete"
    | "payment_success"
    | "checkout_recovery"
    | "job_offer"
    | "offer_reminder"
    | "offer_expired"
    | "refund_approved"
    | "document_expiring"
    | "job_match"
    | "admin_update"
    | "announcement"
    | "employer_outreach"
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
    campaignLanguage?: string;
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
    // Offer
    expiresAt?: string;
    queuePosition?: number;
}

export type QueueEmailWhatsAppResult = {
    attempted: boolean;
    sent: boolean;
    error?: string | null;
    retryable?: boolean;
    failureCategory?: string | null;
    messageId?: string | null;
};

export type QueueEmailResult = EmailQueueDeliveryResult & {
    whatsapp?: QueueEmailWhatsAppResult | null;
};

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

const BASE_URL = normalizePlatformWebsiteUrl(process.env.NEXT_PUBLIC_BASE_URL);

function buildEmailUrl(path: string) {
    return buildPlatformUrl(BASE_URL, path);
}

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
            return buildEmailUrl("/profile/employer");
        case "agency":
            return buildEmailUrl("/profile/agency");
        case "worker":
        default:
            switch (purpose) {
                case "setup":
                    return buildEmailUrl("/profile/worker/edit");
                case "documents":
                    return buildEmailUrl("/profile/worker/documents");
                case "queue":
                    return buildEmailUrl("/profile/worker/queue");
                case "dashboard":
                default:
                    return buildEmailUrl("/profile/worker");
            }
    }
}

function renderJourneyRows(rows: Array<{ title: string; description: string }>) {
    return rows.map((row, index) => `
        <tr>
            <td width="50" style="vertical-align: top; padding-bottom: ${index === rows.length - 1 ? "0" : "15px"};">
                <div style="width:32px; height:32px; border-radius:9999px; background:#111111; color:#FFFFFF; font-size:13px; font-weight:700; line-height:32px; text-align:center;">
                    ${index + 1}
                </div>
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

type HeroVariant =
    | "welcome"
    | "success"
    | "alert"
    | "offer"
    | "money"
    | "info"
    | "company"
    | "goodbye";

function getHeroGlyph(variant: HeroVariant) {
    switch (variant) {
        case "welcome":
            return "WU";
        case "success":
            return "✓";
        case "offer":
            return "★";
        case "money":
            return "$";
        case "info":
            return "i";
        case "company":
            return "▣";
        case "goodbye":
            return "×";
        case "alert":
        default:
            return "!";
    }
}

function renderIconHero(variant: HeroVariant, title: string, subtitle: string) {
    return `
        <div style="text-align: center;">
            <div style="width:80px; height:80px; margin:0 auto 20px; border-radius:9999px; border:3px solid #111111; color:#111111; font-size:${variant === "welcome" ? "24px" : "40px"}; font-weight:700; line-height:74px; text-align:center; letter-spacing:${variant === "welcome" ? "1px" : "0"};">
                ${getHeroGlyph(variant)}
            </div>
            <h1 style="color:#1D1D1F; font-size: 26px; font-weight: 700; margin: 0 0 10px;">${title}</h1>
            <p style="font-size: 16px; color: #515154; margin-top: 5px;">${subtitle}</p>
        </div>
    `;
}

function renderDarkPanel(title: string, bodyHtml: string) {
    return `
        <div style="background:#111111; border-radius:16px; padding:35px; margin:35px 0; color:white; text-align:center;">
            <h3 style="margin:0 0 15px; font-size:12px; color: #86868B; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">${escapeHtml(title)}</h3>
            <div style="margin:0; font-size: 16px; color: #E5E5EA; line-height: 1.6;">
                ${bodyHtml}
            </div>
        </div>
    `;
}

function renderLightPanel(title: string, bodyHtml: string) {
    return `
        <div style="background:#F5F5F7; border-radius:12px; padding:32px; margin:35px 0; border: 1px solid #E5E5EA; text-align:center;">
            <h3 style="margin:0 0 15px; font-size:12px; color: #86868B; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">${escapeHtml(title)}</h3>
            <div style="margin:0; font-size: 15px; color: #1D1D1F; line-height: 1.6;">
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

function renderFooterSocialLinks() {
    const links = [
        { href: "https://www.facebook.com/profile.php?id=61585104076725", label: "Facebook" },
        { href: "https://www.instagram.com/workersunited.eu/", label: "Instagram" },
        { href: "https://www.threads.net/@workersunited.eu", label: "Threads" },
        { href: buildPlatformWhatsAppUrl(), label: "WhatsApp" },
        { href: "https://x.com/WorkersUnitedEU", label: "X" },
        { href: "https://www.tiktok.com/@workersunited.eu", label: "TikTok" },
        { href: "https://www.linkedin.com/company/workersunited-eu/", label: "LinkedIn" },
    ];

    return links.map((link) => `
        <a href="${link.href}" style="display:inline-block; margin:4px 6px; padding:8px 12px; border-radius:9999px; border:1px solid #D2D2D7; color:#1D1D1F; text-decoration:none; font-size:12px; font-weight:600; letter-spacing:0.2px;">
            ${link.label}
        </a>
    `).join("");
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
                <img src="${buildEmailUrl("/logo-wordmark.png")}" alt="Workers United" width="168" height="auto" style="display:block; margin:0 auto; width:168px; height:auto; border:0; outline:none; text-decoration:none; color:#1D1D1F; font-size:16px; font-weight:700;">
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
                ${renderFooterSocialLinks()}
            </div>
            
            <p style="margin:0 0 8px;">&copy; ${new Date().getFullYear()} Workers United LLC</p>
            <p style="margin:0 0 20px;">75 E 3rd St., Sheridan, Wyoming 82801</p>
            <div style="margin-bottom: 20px;">
                <a href="${buildEmailUrl("/privacy-policy")}" style="color:#94a3b8; text-decoration:none; margin: 0 10px; font-weight: 500;">Privacy</a>
                <a href="${buildEmailUrl("/terms")}" style="color:#94a3b8; text-decoration:none; margin: 0 10px; font-weight: 500;">Terms</a>
                <a href="${buildEmailUrl("/profile/settings")}" style="color:#94a3b8; text-decoration:none; margin: 0 10px; font-weight: 500;">Preferences</a>
            </div>
        </div>
    </div>
</body>
</html>
`;

export function getCheckoutRecoveryStatusMessage(step: number | undefined, amount: string) {
    const safeAmount = amount || "$9";

    switch (step) {
        case 2:
            return `Your ${safeAmount} Job Finder payment is still waiting. Your profile, required documents, and admin review already unlocked this final checkout step. Return to your Workers United dashboard to finish payment, enter the active queue, and unlock support.`;
        case 3:
            return `Your previous ${safeAmount} Job Finder checkout expired. Your profile, required documents, and admin review are still in place, so open your Workers United dashboard to start a fresh checkout and continue where you left off.`;
        default:
            return `You opened the ${safeAmount} Job Finder checkout but did not finish it yet. Your profile, required documents, and admin review already unlocked this final payment step. Return to your Workers United dashboard to finish payment, enter the active queue, and unlock support.`;
    }
}

function getOfferExpiredStatusMessage(jobTitle: string | undefined, queuePosition: number | undefined) {
    const safeJobTitle = (jobTitle || "your previous offer").trim() || "your previous offer";
    const safeQueuePosition = typeof queuePosition === "number" && queuePosition > 0
        ? `#${queuePosition}`
        : "your current spot";

    return `Your offer for ${safeJobTitle} has expired. You stay active in the Workers United queue at ${safeQueuePosition}, and we will contact you as soon as the next matching offer is ready.`;
}

function formatDocumentNameForEmail(value: string | undefined | null) {
    const raw = (value || "document").trim();
    return raw
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getEmployerOutreachCopy(companyName: string, language: string | undefined) {
    const rawCompanyName = (companyName || "your company").trim() || "your company";
    const safeCompanyName = escapeHtml(rawCompanyName);
    const isEnglish = language === "en";

    if (isEnglish) {
        return {
            subject: `Free international hiring support for ${rawCompanyName}`,
            heroTitle: "International hiring support without platform fees",
            heroSubtitle: `A faster route for ${safeCompanyName} to request verified workers while we handle the legal and logistics work.`,
            intro: "Workers United is not a job board. We coordinate worker sourcing, visa paperwork, contracts, arrival support, and ongoing case handling for employers.",
            panelTitle: "What your company gets",
            panelBody: "Verified worker cases, document handling, visa workflow coordination, and arrival support. Employers do not pay platform fees.",
            checklistTitle: "Included in the service",
            checklistItems: [
                "Verified international worker cases prepared for review",
                "Visa, work permit, contract, and embassy coordination handled by our team",
                "Arrival support and onboarding coordination after approval",
                "No platform cost for the employer",
            ],
            ctaTitle: "Open your employer workspace and submit your hiring request.",
            ctaText: "Create Employer Account",
            ctaUrl: buildEmailUrl("/signup"),
            footer: "If hiring is a priority right now, register the company profile and we can start from there.",
        };
    }

    return {
        subject: `Besplatna podrška za zapošljavanje internacionalnih radnika za ${rawCompanyName}`,
        heroTitle: "Zapošljavanje internacionalnih radnika bez platformskih troškova",
        heroSubtitle: `Brži način da ${safeCompanyName} zatraži proverene radnike dok mi vodimo dokumentaciju, vizni proces i koordinaciju dolaska.`,
        intro: "Workers United nije job board. Mi vodimo sourcing radnika, papirologiju za vizu, ugovore, dolazak i dalju koordinaciju sa poslodavcem.",
        panelTitle: "Šta dobijate",
        panelBody: "Proverene radničke slučajeve, obradu dokumentacije, koordinaciju oko vize i dozvole za rad, plus podršku pri dolasku. Poslodavac ne plaća platformsku uslugu.",
        checklistTitle: "Usluga uključuje",
        checklistItems: [
            "Proverene internacionalne radnike spremne za pregled",
            "Vize, dozvole za rad, ugovori i ambasadna koordinacija preko našeg tima",
            "Podršku pri dolasku i onboarding koordinaciju nakon odobrenja",
            "Bez troška za poslodavca",
        ],
        ctaTitle: "Otvorite employer workspace i pošaljite svoj hiring zahtev.",
        ctaText: "Registrujte Kompaniju",
        ctaUrl: buildEmailUrl("/signup"),
        footer: "Ako Vam je zapošljavanje prioritet, registrujte kompaniju i odatle preuzimamo dalje korake.",
    };
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
                            title: "1. Complete Profile",
                            description: "Review your worker details",
                        },
                        {
                            title: "2. Upload Docs",
                            description: "Passport, photo, diploma",
                        },
                        {
                            title: "3. Wait for Approval",
                            description: "We review the completed case",
                        },
                        {
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
                            title: "1. Finish Company Profile",
                            description: "Add the essentials about your business",
                        },
                        {
                            title: "2. Submit Hiring Needs",
                            description: "Tell us role, salary, and headcount",
                        },
                        {
                            title: "3. We Match Workers",
                            description: "We search verified worker cases for you",
                        },
                        {
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
                            title: "1. Open Your Workspace",
                            description: "Use one dashboard for all worker cases",
                        },
                        {
                            title: "2. Add Workers",
                            description: "Create and manage worker profiles",
                        },
                        {
                            title: "3. Upload Documents",
                            description: "Prepare each worker case for review",
                        },
                        {
                            title: "4. Unlock Job Finder Per Case",
                            description: "Activate approved worker cases one by one",
                        },
                    ],
                },
            }[recipientRole];

            return {
                subject: welcomeCopy.subject,
                html: wrapModernTemplate(`
                    ${renderIconHero("welcome", welcomeCopy.title, welcomeCopy.subtitle)}

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
                    ${renderIconHero("success", `Congratulations, ${firstName}!`, "Your profile is now 100% complete.")}

                    <p style="margin-top: 30px; color: #1D1D1F; text-align: center;">
                        Your profile and required documents are now ready for admin review. We will check everything and unlock Job Finder as soon as your case is approved.
                    </p>
                    
                    ${renderDarkPanel("What Happens Next", `
                        1. Admin reviews your profile
                        <br>
                        2. Job Finder unlocks after approval
                        <br>
                        3. You can then activate the $9 service
                    `)}

                    ${renderChecklistCard("While You Wait", [
                        "Your profile is now in the admin review queue",
                        "We will notify you as soon as approval is complete",
                        "No payment is needed until Job Finder is officially unlocked",
                    ])}
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="${buildEmailUrl("/profile/worker")}" style="${buttonStyle}">
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
                    ${renderIconHero("success", "Payment Confirmed", "Your job search is now active.")}

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
                1: `You opened the ${amount} Job Finder checkout but did not finish the payment yet. Your profile, required documents, and admin review already unlocked this final step, so return to your dashboard and continue when you're ready.`,
                2: `Your profile, required documents, and admin review already unlocked the ${amount} Job Finder checkout. Once that final payment is confirmed, your worker profile enters the active queue and support unlocks inside the platform.`,
                3: `Your earlier ${amount} checkout is no longer active. Your profile, required documents, and admin review are still in place, so open your dashboard to start a fresh checkout and continue exactly where you left off.`,
            };

            const recoveryNoteMap: Record<1 | 2 | 3, string> = {
                1: "Your profile stays exactly as it is. Nothing needs to be filled again.",
                2: "If we do not find you a job within 90 days, the entry fee is refunded.",
                3: "Only the old checkout expired. Your profile, required documents, and approval stay saved in your account.",
            };

            return {
                subject: recoverySubjectMap[recoveryStep],
                html: wrapModernTemplate(`
                    ${renderIconHero("alert", recoveryTitleMap[recoveryStep], `${firstName}, your profile is ready to continue.`)}

                    <p style="font-size: 16px; color: #1D1D1F; margin-bottom: 20px; text-align: center;">
                        ${recoveryBodyMap[recoveryStep]}
                    </p>

                    <div style="background:#111111; border-radius:16px; padding:35px; margin:35px 0; color:white; text-align:center;">
                        <div style="font-size:12px; color:#86868B; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:15px;">
                            Job Finder activation
                        </div>
                        <div style="font-size:48px; font-weight:800; color:#FFFFFF; letter-spacing:-1.5px; margin-bottom:15px; line-height:1;">
                            ${amount}
                        </div>
                        <div style="font-size:16px; color:#E5E5EA; line-height:1.6;">
                            ${recoveryNoteMap[recoveryStep]}
                        </div>
                    </div>

                    ${renderLightPanel("What You Need To Know", `
                        Only the checkout state changes here.
                        <br>
                        Your profile, required documents, and review progress stay saved in the dashboard.
                        <br>
                        Open your account whenever you are ready to continue.
                    `)}

                    <div style="text-align:center; margin-top:40px;">
                        <a href="${buildEmailUrl("/profile/worker")}" style="${buttonStyle}">
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
                    ${renderIconHero("offer", "You've been picked!", "A company wants to hire you.")}

                    <div style="background:#111111; border-radius:16px; padding:35px; margin:35px 0; color:white; text-align:center; position:relative; overflow:hidden;">
                        <div style="position:absolute; top:0; left:0; right:0; height:4px; background:#D2D2D7;"></div>
                        
                        <div style="font-size: 12px; color: #86868B; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 20px;">Official Offer</div>
                        
                        <h2 style="margin:0 0 15px; font-size: 26px; color: #FFFFFF; font-weight: 700; letter-spacing: -0.5px;">${jobTitle}</h2>
                        <p style="margin:0 0 25px; color: #E5E5EA; font-size: 18px; font-weight: 500;">${companyName}</p>
                        
                        <div style="display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #FFFFFF; padding: 8px 20px; border-radius: 99px; font-weight: 600; font-size: 14px;">
                            ${country}
                        </div>
                    </div>

                    ${renderLightPanel("Response Window", "Please review this offer and respond within 24 hours so we can keep the hiring process moving.")}
                    
                    <div style="text-align:center; margin-top:40px;">
                        <a href="${data.offerLink || buildEmailUrl("/profile/worker/queue")}" style="${buttonStyle}">
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
                    ${renderIconHero("alert", "Hurry up!", "Your job offer is still waiting for a response.")}

                    <p style="text-align: center; color: #1D1D1F; margin: 30px 0; font-size: 16px;">
                        Hey ${firstName}, you have a pending job offer that expires soon. Don't let this opportunity slip away!
                    </p>

                    ${renderLightPanel("Why This Matters", "If the offer expires without a response, we may need to release the slot and move the case forward without you.")}
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${data.offerLink || buildEmailUrl("/profile/worker/queue")}" style="${buttonStyle}">
                            Respond Now
                        </a>
                    </div>
                `, "Action Required", "Tick tock...")
            };

        case "offer_expired": {
            const jobTitle = escapeHtml(data.jobTitle || "Position");
            const queuePosition = data.queuePosition ?? 0;
            return {
                subject: `Your job offer has expired — ${data.jobTitle || "Position"}`,
                html: wrapModernTemplate(`
                    ${renderIconHero("alert", "Offer Expired", "The response window has closed.")}

                    <p style="color: #1D1D1F; margin-bottom: 20px; text-align: center; font-size: 16px;">
                        Hi ${firstName}, the offer for <strong>${jobTitle}</strong> has expired because it was not confirmed within 24 hours.
                    </p>

                    ${renderLightPanel("What Happens Now", `
                        The position has been offered to the next worker in the queue.
                        <br><br>
                        <strong>Don't worry — you stay in the queue</strong> and will hear from us when the next matching opportunity appears.
                        ${queuePosition > 0 ? `<br><br>Your current queue position: <strong>#${queuePosition}</strong>` : ""}
                    `)}

                    <p style="margin-top: 25px; color: #86868B; font-size: 15px; text-align: center;">
                        Keep your profile and documents up to date so you are ready for the next opportunity.
                    </p>
                `, "Offer Expired", "Stay ready")
            };
        }

        case "refund_approved": {
            const amount = escapeHtml(data.amount || "$9");
            return {
                subject: "Refund Processed",
                html: wrapModernTemplate(`
                    ${renderIconHero("money", "Refund Sent", "Your 90-day guarantee refund has been processed.")}

                    <p style="color: #1D1D1F; margin-bottom: 25px; text-align: center; font-size: 16px;">
                        Hi ${firstName}, as per our 90-day guarantee, we have processed your refund of <strong>${amount}</strong>.
                    </p>

                    ${renderLightPanel("Refund Timeline", "The funds should appear back on the original payment method within 5 to 10 business days, depending on your bank.")}
                    
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
                    ${renderIconHero("alert", "Check your documents", "One of your required files is close to expiring.")}

                    <p style="color: #1D1D1F; text-align: center; margin-bottom: 30px; font-size: 16px;">
                        Your <strong>${documentType}</strong> is expiring on <strong>${expirationDate}</strong>.
                    </p>

                    ${renderLightPanel("Why Update Now", "Keeping your required documents current helps us avoid delays when your case reaches a live employer or visa-processing step.")}
                    
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
                    <div style="text-align: center;">
                        <img src="${buildEmailUrl("/logo-icon.png")}" width="80" alt="Workers United" style="margin-bottom: 20px; border-radius: 16px;">
                        <h1 style="color:#1D1D1F; font-size: 26px; font-weight: 700; margin: 0 0 10px;">New Match!</h1>
                        <p style="font-size: 16px; color: #515154; margin-top: 5px;">We found a job that fits your case.</p>
                    </div>

                    <div style="background:#111111; border-radius:16px; padding:35px; margin:35px 0; color:white; text-align:center; position:relative; overflow:hidden;">
                        <div style="position:absolute; top:0; left:0; right:0; height:4px; background:#D2D2D7;"></div>
                        <h3 style="margin:0 0 10px; color:#FFFFFF; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${jobTitle}</h3>
                        <div style="color: #86868B; font-size: 16px; margin-bottom: 25px;">${industry}</div>
                        
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                            <span style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #FFFFFF; padding: 8px 16px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                                ${location}
                            </span>
                            <span style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #FFFFFF; padding: 8px 16px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                                ${salary}
                            </span>
                        </div>
                    </div>

                    ${renderLightPanel("Next Step", "Open the case details to review the opportunity, expected conditions, and what we need from you next.")}
                    
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
            const actionLink = data.actionLink || buildEmailUrl("/profile/worker");
            const actionText = escapeHtml(data.actionText || "Check Profile");
            return {
                subject: data.subject || "Update from Workers United",
                html: wrapModernTemplate(`
                    ${renderIconHero("info", "Profile Update", "There is a new message about your case.")}

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
                    ${renderIconHero("success", `${safeDocName} Approved`, "One more required step is now complete.")}

                    <p style="margin-top: 30px; color: #1D1D1F; text-align: center;">
                        Your <strong>${safeDocName}</strong> has been verified and approved by our team. It is now safely stored in your Workers United dashboard, and you do not need to upload this file again.
                    </p>

                    ${renderLightPanel("What Happens Next", `
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
                        <a href="${buildEmailUrl("/profile/worker/documents")}" style="${buttonStyle}">Open My Documents</a>
                    </div>
                ` : `
                    ${renderIconHero("alert", `${safeDocName} Needs Attention`, "We still need a replacement file before your case can move forward.")}

                    <div style="background:#F5F5F7; border: 1px solid #E5E5EA; border-radius:12px; padding:25px; margin:30px 0;">
                        <p style="margin:0 0 10px; color: #86868B; font-size: 12px; font-weight:700; text-transform: uppercase; letter-spacing: 1px;">Issue Found</p>
                        <p style="margin:0; color: #1D1D1F; font-size: 16px;">${escapeHtml(data.feedback || "Document does not meet requirements.")}</p>
                    </div>

                    ${renderLightPanel("Next Step", `
                        Upload a clearer replacement for your ${safeDocName.toLowerCase()} from the dashboard. We will review the new file as soon as it arrives.
                    `)}

                    ${renderChecklistCard("Before You Upload Again", [
                        "Make sure the full document is visible inside the frame",
                        "Avoid glare, blur, shadows, or overexposed areas",
                        "Upload the replacement from your dashboard documents section",
                    ])}

                    <div style="text-align:center; margin-top:35px;">
                        <a href="${buildEmailUrl("/profile/worker/documents")}" style="${buttonStyle}">Upload New Document</a>
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
                    ${renderIconHero("alert", title, "Important information from Workers United.")}

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

        case "employer_outreach": {
            const companyName = data.companyName || data.name || "your company";
            const copy = getEmployerOutreachCopy(companyName, data.campaignLanguage);

            return {
                subject: data.subject || copy.subject,
                html: wrapModernTemplate(`
                    ${renderIconHero("company", copy.heroTitle, copy.heroSubtitle)}

                    <p style="text-align:center; color:#1D1D1F; margin:30px 0; font-size:16px;">
                        ${copy.intro}
                    </p>

                    ${renderLightPanel(copy.panelTitle, copy.panelBody)}

                    ${renderChecklistCard(copy.checklistTitle, copy.checklistItems)}

                    <p style="text-align:center; color:#515154; margin:30px 0 20px; font-size:15px;">
                        ${copy.ctaTitle}
                    </p>

                    <div style="text-align:center; margin-top:35px;">
                        <a href="${copy.ctaUrl}" style="${buttonStyle}">
                            ${copy.ctaText}
                        </a>
                    </div>

                    <p style="text-align:center; color:#515154; margin:24px 0 0; font-size:14px;">
                        ${copy.footer}
                    </p>
                `, "Employer Outreach", "Free hiring support for employers")
            };
        }

        case "profile_incomplete":
            return {
                subject: "Finish your profile!",
                html: wrapModernTemplate(`
                    ${renderIconHero("alert", "Almost there!", "You're missing a few things before we can move your case forward.")}

                    <div style="margin: 30px 0;">
                         <p style="color: #1D1D1F; text-align: center; margin-bottom: 20px; font-size: 16px;">
                            We want to match you with a job, but we need these details first:
                         </p>
                         
                         <div style="background:#F5F5F7; border: 1px solid #E5E5EA; border-radius:12px; padding:20px; color: #1D1D1F; font-weight: 500; text-align: center;">
                            ${data.missingFields}
                         </div>
                    </div>

                    ${renderLightPanel("Why This Matters", "Your profile and required documents have to be complete before we can send the case to admin review and eventually unlock Job Finder.")}
                    
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
                    ${renderIconHero("alert", reminderCopy.title, reminderCopy.text)}

                   <div style="background:#F5F5F7; border-radius:12px; padding:25px; margin:30px 0; border: 1px solid #E5E5EA;">
                        <strong style="display:block; margin-bottom:15px; color:#1D1D1F; font-size: 16px;">What's missing:</strong>
                        <ul style="padding-left: 20px; margin: 0; color: #515154; font-size: 15px;">
                            ${data.todoList}
                        </ul>
                    </div>

                    ${renderLightPanel("Keep The Case Moving", "Once the missing items are saved, your workspace can move to the next real step without starting over.")}

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
                    ${renderIconHero("alert", "Inactive Account Warning", `If there is still no profile activity, we will clean up this incomplete account in ${daysLeft} days.`)}

                    <p style="text-align: center; color: #1D1D1F; margin: 30px 0; font-size: 16px;">
                        ${warningCopy.warningText} Update your profile or documents to keep the account active.
                    </p>

                    ${renderLightPanel("Cleanup Timeline", `You still have <strong style="color:#1D1D1F;">${daysLeft} days</strong> to save activity on the account before the inactive cleanup runs.`)}

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
                    ${renderIconHero("goodbye", "Goodbye for now", "This incomplete inactive account has been removed.")}

                    <p style="text-align: center; color: #1D1D1F; margin: 30px 0; font-size: 16px;">
                         ${deletionCopy.body}
                    </p>

                    ${renderChecklistCard("What This Means", [
                        "The inactive account has been cleared from our system",
                        "No additional action is required unless you want to return",
                        "You can create a fresh new account whenever you are ready",
                    ])}
                    
                    <div style="text-align:center; margin-top:35px;">
                        <a href="${buildEmailUrl("/signup")}" style="${buttonStyle}">
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
                    ${renderIconHero("success", `Hi ${firstName},`, "We've fixed the document upload issue.")}

                    <p style="font-size: 16px; color: #1D1D1F; margin-bottom: 20px;">
                        If you recently tried to upload your passport or diploma and experienced errors, we sincerely apologize. We have completely resolved this technical issue.
                    </p>
                    
                    <p style="font-size: 16px; color: #1D1D1F; margin-bottom: 30px;">
                        Your profile is waiting for you. You can now securely upload your documents and complete the missing verification steps so we can move your case back into admin review.
                    </p>

                    ${renderLightPanel("Next Step", "Return to your dashboard, upload the missing documents, and we will resume your case from there. Once everything is complete and approved, Job Finder unlocks in your dashboard.")}
                    
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
    userId: string | null,
    emailType: EmailType,
    recipientEmail: string,
    recipientName: string,
    templateData: TemplateData = {},
    scheduledFor?: Date,
    recipientPhone?: string
): Promise<QueueEmailResult> {
    const recipientRole = getRecipientRole(templateData);
    const enrichedTemplateData = { ...templateData, recipientRole };
    const template = getEmailTemplate(emailType, { name: recipientName, ...enrichedTemplateData });
    const queueTemplateData = attachEmailQueueMeta(
        { ...enrichedTemplateData, html: template.html },
        { attempts: 0, maxAttempts: 3 }
    );

    const { data } = await supabase.from("email_queue").insert({
        user_id: userId || null,
        email_type: emailType,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject: template.subject,
        template_data: queueTemplateData,
        scheduled_for: scheduledFor?.toISOString() || new Date().toISOString()
    }).select().single();

    let deliveryResult: QueueEmailResult = {
        id: data?.id || null,
        sent: false,
        queued: Boolean(scheduledFor),
        status: scheduledFor ? "scheduled" : "failed",
        error: null,
        whatsapp: null,
    };

    // Send immediately via SMTP
    if (!scheduledFor && data?.id) {
        deliveryResult = await processQueuedEmailRecord(supabase, {
            id: data.id,
            recipient_email: recipientEmail,
            subject: template.subject,
            template_data: queueTemplateData,
            scheduled_for: data.scheduled_for,
        });
    }

    // Also send WhatsApp template if phone provided
    if (recipientPhone && !scheduledFor && userId) {
        let whatsappSidecarResult: QueueEmailWhatsAppResult | null = null;
        try {
            const wa = await import("@/lib/whatsapp");
            const firstName = recipientName?.split(" ")[0] || "there";
            const recipientPhoneNumber = recipientPhone as string;
            let sendResult: {
                success: boolean;
                messageId?: string;
                error?: string;
                retryable?: boolean;
                failureCategory?: string;
            } | null = null;

            // Map EmailType → WhatsApp template
            switch (emailType) {
                case "welcome":
                    sendResult = await wa.sendRoleWelcome(recipientPhoneNumber, firstName, recipientRole, userId);
                    break;
                case "profile_complete":
                    if (recipientRole === "worker") {
                        sendResult = await wa.sendRoleStatusUpdate(
                            recipientPhoneNumber,
                            firstName,
                            "Your profile is 100% complete and is now waiting for admin review. We will unlock Job Finder as soon as it is approved.",
                            "worker",
                            userId
                        );
                    }
                    break;
                case "payment_success":
                    sendResult = await wa.sendPaymentConfirmed(recipientPhoneNumber, firstName, templateData.amount || "$9", userId);
                    break;
                case "checkout_recovery":
                    sendResult = await wa.sendRoleStatusUpdate(
                        recipientPhoneNumber,
                        firstName,
                        getCheckoutRecoveryStatusMessage(templateData.recoveryStep, templateData.amount || "$9"),
                        recipientRole,
                        userId
                    );
                    break;
                case "document_expiring":
                    sendResult = await wa.sendDocumentReminder(recipientPhoneNumber, firstName, templateData.documentType || "document", templateData.expirationDate || "", userId);
                    break;
                case "profile_incomplete":
                    sendResult = await wa.sendProfileIncomplete(recipientPhoneNumber, firstName, templateData.completion || "0", templateData.missingFields || "", userId);
                    break;
                case "refund_approved":
                    sendResult = await wa.sendRefundProcessed(recipientPhoneNumber, firstName, templateData.amount || "$9", userId);
                    break;
                case "admin_update":
                    sendResult = await wa.sendRoleStatusUpdate(recipientPhoneNumber, firstName, templateData.message || "Profile updated", recipientRole, userId);
                    break;
                case "announcement":
                    sendResult = await wa.sendRoleAnnouncement(recipientPhoneNumber, templateData.title || "Announcement", templateData.message || "", recipientRole, templateData.actionLink, userId);
                    break;
                case "job_offer":
                    if (enrichedTemplateData.jobTitle && enrichedTemplateData.companyName && enrichedTemplateData.country && enrichedTemplateData.offerLink) {
                        const offerId = enrichedTemplateData.offerLink.split("/").pop() || "";
                        sendResult = await wa.sendJobOffer(recipientPhoneNumber, recipientName, enrichedTemplateData.jobTitle, enrichedTemplateData.companyName, enrichedTemplateData.country, offerId, userId);
                    }
                    break;
                case "offer_expired":
                    sendResult = await wa.sendRoleStatusUpdate(
                        recipientPhoneNumber,
                        firstName,
                        getOfferExpiredStatusMessage(enrichedTemplateData.jobTitle, enrichedTemplateData.queuePosition),
                        "worker",
                        userId
                    );
                    break;
                default:
                    break;
            }

            if (sendResult) {
                whatsappSidecarResult = {
                    attempted: true,
                    sent: sendResult.success,
                    error: sendResult.error || null,
                    retryable: sendResult.retryable,
                    failureCategory: sendResult.failureCategory || null,
                    messageId: sendResult.messageId || null,
                };

                if (!sendResult.success) {
                    console.warn(`[QueueEmail] WhatsApp sidecar failed for ${emailType}:`, {
                        userId,
                        recipientPhone: recipientPhoneNumber,
                        error: sendResult.error || null,
                        retryable: sendResult.retryable ?? false,
                        failureCategory: sendResult.failureCategory || null,
                    });
                }
            }
        } catch (err) {
            // WhatsApp failure should never block email
            console.error(`WhatsApp send failed for ${emailType}:`, err);
            whatsappSidecarResult = {
                attempted: true,
                sent: false,
                error: err instanceof Error ? err.message : "Unknown WhatsApp sidecar error",
                retryable: false,
                failureCategory: "unknown",
                messageId: null,
            };
        }

        deliveryResult.whatsapp = whatsappSidecarResult;
    }

    return deliveryResult;
}
