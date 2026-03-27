import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
    buildPlatformUrl,
    normalizePlatformSupportEmail,
    normalizePlatformWebsiteUrl,
} from "@/lib/platform-config";
import {
    buildCanonicalWhatsAppFacts,
    buildEmployerWhatsAppRules,
    looksLikeEmployerWhatsAppLead,
    looksLikeWorkerWhatsAppLead,
    resolveWhatsAppLanguageCode,
} from "@/lib/whatsapp-brain";
import { formatWhatsAppHistory, type WhatsAppBrainMemoryEntry, type WhatsAppHistoryMessage } from "@/lib/whatsapp-conversation-helpers";

type AdminClient = SupabaseClient<Database>;

interface EmployerWhatsAppPlatformContact {
    websiteUrl?: string | null;
    supportEmail?: string | null;
}

function resolveEmployerPlatformContact(platform?: EmployerWhatsAppPlatformContact) {
    const websiteUrl = normalizePlatformWebsiteUrl(platform?.websiteUrl);
    return {
        websiteUrl,
        signupUrl: buildPlatformUrl(websiteUrl, "/signup"),
        supportEmail: normalizePlatformSupportEmail(platform?.supportEmail),
    };
}

export interface WhatsAppEmployerRecord {
    id: string;
    profile_id: string | null;
    company_name: string | null;
    status: string | null;
}

export interface EmployerLeadResolution {
    employerRecord: WhatsAppEmployerRecord | null;
    isEmployer: boolean;
    isLikelyEmployer: boolean;
}

const EUROPEAN_COUNTRY_CODES = [
    "381",
    "43",
    "32",
    "359",
    "385",
    "357",
    "420",
    "45",
    "372",
    "358",
    "33",
    "49",
    "30",
    "36",
    "353",
    "39",
    "371",
    "370",
    "352",
    "356",
    "31",
    "47",
    "48",
    "351",
    "40",
    "421",
    "386",
    "34",
    "46",
    "41",
    "44",
    "387",
    "382",
    "389",
    "355",
];

export function isEuropeanPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, "");
    return EUROPEAN_COUNTRY_CODES.some((code) => digits.startsWith(code));
}

export async function resolveEmployerWhatsAppLead(params: {
    admin: AdminClient;
    normalizedPhone: string;
    content: string;
    isAdmin: boolean;
    hasRegisteredWorker: boolean;
}): Promise<EmployerLeadResolution> {
    const rawEmployerResult = await (params.admin
        .from("employers")
        .select("id, profile_id, company_name, status")
        .eq("contact_phone", params.normalizedPhone)
        .maybeSingle()) as {
            data: Record<string, unknown> | null;
            error?: { message?: string } | null;
        };

    if (rawEmployerResult.error) {
        throw new Error(rawEmployerResult.error.message || "Employer WhatsApp lookup failed");
    }

    const rawEmployerRecord = rawEmployerResult.data;

    const explicitlyLooksLikeEmployer = looksLikeEmployerWhatsAppLead(params.content);
    const explicitlyLooksLikeWorker = looksLikeWorkerWhatsAppLead(params.content);
    // Agencies/partnerships can contact from anywhere — skip the European
    // phone check when the message explicitly mentions agency/partnership.
    const AGENCY_LEAD_PATTERN = /\b(agency|staffing|partnership|partner|recruitment agency|placement|manpower|agencija|partnerstvo|kadrovska)\b/i;
    const looksLikeAgencyLead = AGENCY_LEAD_PATTERN.test(params.content);
    const isLikelyEmployer = !params.hasRegisteredWorker
        && !params.isAdmin
        && explicitlyLooksLikeEmployer
        && !explicitlyLooksLikeWorker
        && (isEuropeanPhone(params.normalizedPhone) || looksLikeAgencyLead);

    const employerRecord = rawEmployerRecord
        ? {
            id: String(rawEmployerRecord.id || ""),
            profile_id: typeof rawEmployerRecord.profile_id === "string" ? rawEmployerRecord.profile_id : null,
            company_name: typeof rawEmployerRecord.company_name === "string" ? rawEmployerRecord.company_name : null,
            status: typeof rawEmployerRecord.status === "string" ? rawEmployerRecord.status : null,
        }
        : null;

    return {
        employerRecord: employerRecord ?? null,
        isEmployer: Boolean(employerRecord) || isLikelyEmployer,
        isLikelyEmployer,
    };
}

export async function generateEmployerWhatsAppReply(params: {
    callResponseText: (options: {
        model: string;
        instructions: string;
        input: string;
        maxOutputTokens?: number;
    }) => Promise<string>;
    model: string;
    message: string;
    normalizedPhone: string;
    employerRecord: WhatsAppEmployerRecord | null;
    historyMessages: WhatsAppHistoryMessage[];
    brainMemory: WhatsAppBrainMemoryEntry[];
    language: string;
    websiteUrl?: string;
    supportEmail?: string;
}): Promise<string> {
    const isRegistered = !!params.employerRecord;
    const companyName = params.employerRecord?.company_name || "";
    const contactName = "";
    const memoryText = params.brainMemory.length > 0
        ? params.brainMemory.map((entry) => `- [${entry.category}] ${entry.content}`).join("\n")
        : "(No stored facts)";
    const canonicalFacts = buildCanonicalWhatsAppFacts({
        website: params.websiteUrl,
        supportEmail: params.supportEmail,
    });
    const instructions = `You are the official WhatsApp assistant for Workers United.

Personality:
- Warm, professional, direct, and operational.
- Answer first, then move the employer to one concrete next step.
- Do not oversell or invent inventory.

Media messages:
- Messages starting with "[Voice message]" were ALREADY transcribed from audio. Treat the text as what the person said. Do NOT say you can't listen to voice messages.
- Messages starting with "[Image:" were ALREADY analyzed by vision AI. Respond based on that content.

Canonical facts (never contradict these):
${canonicalFacts}

Useful stored facts:
${memoryText}

${buildEmployerWhatsAppRules({
        language: params.language,
        isRegistered,
        companyName,
        contactName,
        employerStatus: params.employerRecord?.status || null,
        website: params.websiteUrl,
    })}`;

    return params.callResponseText({
        model: params.model,
        instructions,
        input: `Phone: ${params.normalizedPhone}\nLatest message:\n${params.message}\n\nRecent conversation:\n${formatWhatsAppHistory(params.historyMessages, 12)}`,
        maxOutputTokens: 1024,
    });
}

export function getEmployerWhatsAppDefaultReply(language: string): string {
    switch (resolveWhatsAppLanguageCode(language, language)) {
        case "sr":
            return "Zdravo! Ja sam WhatsApp asistent Workers United. Pomažemo kompanijama da pronađu radnike — besplatno za poslodavce. Kako mogu da Vam pomognem?";
        case "ar":
            return "مرحبًا! أنا مساعد Workers United على WhatsApp. نساعد الشركات في توظيف عمال دوليين — مجانًا تمامًا لأصحاب العمل. كيف يمكنني مساعدتك؟";
        case "fr":
            return "Bonjour ! Je suis l’assistant WhatsApp de Workers United. Nous aidons les entreprises à recruter des travailleurs internationaux — gratuitement pour les employeurs. Comment puis-je vous aider ?";
        case "pt":
            return "Olá! Eu sou o assistente de WhatsApp da Workers United. Ajudamos empresas a contratar trabalhadores internacionais — totalmente grátis para empregadores. Como posso ajudar?";
        case "hi":
            return "नमस्ते! मैं Workers United का WhatsApp assistant हूँ। हम कंपनियों को international workers hire करने में मदद करते हैं — employers के लिए पूरी तरह free। मैं आपकी कैसे मदद कर सकता हूँ?";
        default:
            return "Hi! I'm the Workers United WhatsApp assistant. We help companies hire international workers — completely free for employers. How can I help you?";
    }
}

export function getEmployerWhatsAppErrorReply(language: string, platform?: EmployerWhatsAppPlatformContact): string {
    const { websiteUrl, supportEmail } = resolveEmployerPlatformContact(platform);
    switch (resolveWhatsAppLanguageCode(language, language)) {
        case "sr":
            return `Zdravo! Ja sam WhatsApp asistent Workers United. Pomažemo kompanijama da pronađu radnike besplatno. Pišite nam na ${supportEmail} ili posetite ${websiteUrl}.`;
        case "ar":
            return `مرحبًا! أنا مساعد Workers United. نساعد الشركات على توظيف عمال دوليين مجانًا. راسلنا على ${supportEmail} أو زر ${websiteUrl}.`;
        case "fr":
            return `Bonjour ! Je suis l’assistant de Workers United. Nous aidons les entreprises à recruter des travailleurs internationaux gratuitement. Écrivez-nous à ${supportEmail} ou visitez ${websiteUrl}.`;
        case "pt":
            return `Olá! Eu sou o assistente da Workers United. Ajudamos empresas a contratar trabalhadores internacionais gratuitamente. Fale conosco em ${supportEmail} ou visite ${websiteUrl}.`;
        case "hi":
            return `नमस्ते! मैं Workers United का assistant हूँ। हम कंपनियों को international workers free में hire करने में मदद करते हैं। हमें ${supportEmail} पर लिखिए या ${websiteUrl} पर जाइए।`;
        default:
            return `Hi! I'm the Workers United assistant. We help companies hire international workers for free. Contact us at ${supportEmail} or visit ${websiteUrl}.`;
    }
}

export function getEmployerWhatsAppStaticReply(language: string, platform?: EmployerWhatsAppPlatformContact): string {
    const { signupUrl } = resolveEmployerPlatformContact(platform);
    switch (resolveWhatsAppLanguageCode(language, language)) {
        case "sr":
            return `Zdravo! Workers United pomaže kompanijama da pronađu radnike — besplatno za poslodavce. Registrujte se na ${signupUrl}.`;
        case "ar":
            return `مرحبًا! تساعد Workers United الشركات على توظيف عمال دوليين — مجانًا لأصحاب العمل. سجّل على ${signupUrl}.`;
        case "fr":
            return `Bonjour ! Workers United aide les entreprises à recruter des travailleurs internationaux — gratuitement pour les employeurs. Inscrivez-vous sur ${signupUrl}.`;
        case "pt":
            return `Olá! A Workers United ajuda empresas a contratar trabalhadores internacionais — grátis para empregadores. Registre-se em ${signupUrl}.`;
        case "hi":
            return `नमस्ते! Workers United कंपनियों को international workers hire करने में मदद करता है — employers के लिए free। ${signupUrl} पर register कीजिए।`;
        default:
            return `Hi! Workers United helps companies hire international workers — free for employers. Register at ${signupUrl}.`;
    }
}
