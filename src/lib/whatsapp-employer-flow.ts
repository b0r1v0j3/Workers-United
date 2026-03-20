import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
    buildCanonicalWhatsAppFacts,
    buildEmployerWhatsAppRules,
    looksLikeEmployerWhatsAppLead,
    looksLikeWorkerWhatsAppLead,
    resolveWhatsAppLanguageCode,
} from "@/lib/whatsapp-brain";
import { formatWhatsAppHistory, type WhatsAppBrainMemoryEntry, type WhatsAppHistoryMessage } from "@/lib/whatsapp-conversation-helpers";

type AdminClient = SupabaseClient<Database>;

export interface WhatsAppEmployerRecord {
    id: string;
    profile_id: string | null;
    company_name: string | null;
    contact_name: string | null;
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
    const rawEmployerResult = await ((params.admin
        .from("employers")
        .select("id, profile_id, company_name, contact_name, status")
        .or(`phone.eq.${params.normalizedPhone},contact_phone.eq.${params.normalizedPhone}`)
        .maybeSingle()) as unknown as Promise<{ data: Record<string, unknown> | null }>);
    const rawEmployerRecord = rawEmployerResult.data;

    const explicitlyLooksLikeEmployer = looksLikeEmployerWhatsAppLead(params.content);
    const explicitlyLooksLikeWorker = looksLikeWorkerWhatsAppLead(params.content);
    const isLikelyEmployer = isEuropeanPhone(params.normalizedPhone)
        && !params.hasRegisteredWorker
        && !params.isAdmin
        && explicitlyLooksLikeEmployer
        && !explicitlyLooksLikeWorker;

    const employerRecord = rawEmployerRecord
        ? {
            id: String(rawEmployerRecord.id || ""),
            profile_id: typeof rawEmployerRecord.profile_id === "string" ? rawEmployerRecord.profile_id : null,
            company_name: typeof rawEmployerRecord.company_name === "string" ? rawEmployerRecord.company_name : null,
            contact_name: typeof rawEmployerRecord.contact_name === "string" ? rawEmployerRecord.contact_name : null,
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
}): Promise<string> {
    const isRegistered = !!params.employerRecord;
    const companyName = params.employerRecord?.company_name || "";
    const contactName = params.employerRecord?.contact_name || "";
    const memoryText = params.brainMemory.length > 0
        ? params.brainMemory.map((entry) => `- [${entry.category}] ${entry.content}`).join("\n")
        : "(No stored facts)";
    const canonicalFacts = buildCanonicalWhatsAppFacts();
    const instructions = `You are the official WhatsApp assistant for Workers United.

Personality:
- Warm, professional, direct, and operational.
- Answer first, then move the employer to one concrete next step.
- Do not oversell or invent inventory.

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
    })}`;

    return params.callResponseText({
        model: params.model,
        instructions,
        input: `Phone: ${params.normalizedPhone}\nLatest message:\n${params.message}\n\nRecent conversation:\n${formatWhatsAppHistory(params.historyMessages, 10)}`,
        maxOutputTokens: 2048,
    });
}

export function getEmployerWhatsAppDefaultReply(language: string): string {
    switch (resolveWhatsAppLanguageCode(language, language)) {
        case "sr":
            return "Zdravo! Ja sam WhatsApp asistent Workers United. Pomažemo kompanijama da pronađu strane radnike — besplatno za poslodavce. Kako mogu da Vam pomognem?";
        case "ar":
            return "مرحبًا! أنا مساعد Workers United على WhatsApp. نساعد الشركات في توظيف عمال دوليين — مجانًا تمامًا لأصحاب العمل. كيف يمكنني مساعدتك؟";
        case "fr":
            return "Bonjour ! Je suis l’assistant WhatsApp de Workers United. Nous aidons les entreprises à recruter des travailleurs internationaux — gratuitement pour les employeurs. Comment puis-je vous aider ?";
        case "pt":
            return "Olá! Eu sou o assistente de WhatsApp da Workers United. Ajudamos empresas a contratar trabalhadores internacionais — totalmente grátis para empregadores. Como posso ajudar?";
        case "hi":
            return "नमस्ते! मैं Workers United का WhatsApp assistant हूँ। हम कंपनियों को international workers hire करने में मदद करते हैं — employers के लिए पूरी तरह free। मैं आपकी कैसे मदद कर सकता हूँ?";
        default:
            return "Hi! I'm the Workers United WhatsApp assistant. We help companies hire foreign workers — completely free for employers. How can I help you?";
    }
}

export function getEmployerWhatsAppErrorReply(language: string): string {
    switch (resolveWhatsAppLanguageCode(language, language)) {
        case "sr":
            return "Zdravo! Ja sam WhatsApp asistent Workers United. Pomažemo kompanijama da pronađu strane radnike besplatno. Pišite nam na contact@workersunited.eu ili posetite workersunited.eu.";
        case "ar":
            return "مرحبًا! أنا مساعد Workers United. نساعد الشركات على توظيف عمال دوليين مجانًا. راسلنا على contact@workersunited.eu أو زر workersunited.eu.";
        case "fr":
            return "Bonjour ! Je suis l’assistant de Workers United. Nous aidons les entreprises à recruter des travailleurs internationaux gratuitement. Écrivez-nous à contact@workersunited.eu ou visitez workersunited.eu.";
        case "pt":
            return "Olá! Eu sou o assistente da Workers United. Ajudamos empresas a contratar trabalhadores internacionais gratuitamente. Fale conosco em contact@workersunited.eu ou visite workersunited.eu.";
        case "hi":
            return "नमस्ते! मैं Workers United का assistant हूँ। हम कंपनियों को international workers free में hire करने में मदद करते हैं। हमें contact@workersunited.eu पर लिखिए या workersunited.eu पर जाइए।";
        default:
            return "Hi! I'm the Workers United assistant. We help companies hire foreign workers for free. Contact us at contact@workersunited.eu or visit workersunited.eu.";
    }
}

export function getEmployerWhatsAppStaticReply(language: string): string {
    switch (resolveWhatsAppLanguageCode(language, language)) {
        case "sr":
            return "Zdravo! Workers United pomaže kompanijama da pronađu strane radnike — besplatno za poslodavce. Registrujte se na workersunited.eu/signup.";
        case "ar":
            return "مرحبًا! تساعد Workers United الشركات على توظيف عمال دوليين — مجانًا لأصحاب العمل. سجّل على workersunited.eu/signup.";
        case "fr":
            return "Bonjour ! Workers United aide les entreprises à recruter des travailleurs internationaux — gratuitement pour les employeurs. Inscrivez-vous sur workersunited.eu/signup.";
        case "pt":
            return "Olá! A Workers United ajuda empresas a contratar trabalhadores internacionais — grátis para empregadores. Registre-se em workersunited.eu/signup.";
        case "hi":
            return "नमस्ते! Workers United कंपनियों को international workers hire करने में मदद करता है — employers के लिए free। workersunited.eu/signup पर register कीजिए।";
        default:
            return "Hi! Workers United helps companies hire foreign workers — free for employers. Register at workersunited.eu/signup.";
    }
}
