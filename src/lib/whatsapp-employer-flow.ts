import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
    buildCanonicalWhatsAppFacts,
    buildEmployerWhatsAppRules,
    looksLikeEmployerWhatsAppLead,
    looksLikeWorkerWhatsAppLead,
} from "@/lib/whatsapp-brain";
import { formatWhatsAppHistory, type WhatsAppBrainMemoryEntry, type WhatsAppHistoryMessage } from "@/lib/whatsapp-conversation-helpers";

type AdminClient = SupabaseClient<Database>;

export interface WhatsAppEmployerRecord {
    id: string;
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
        .select("id, company_name, contact_name, status")
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
    return language === "sr"
        ? "Zdravo! Ja sam WhatsApp asistent Workers United. Pomažemo kompanijama da pronađu strane radnike — besplatno za poslodavce. Kako mogu da Vam pomognem?"
        : "Hi! I'm the Workers United WhatsApp assistant. We help companies hire foreign workers — completely free for employers. How can I help you?";
}

export function getEmployerWhatsAppErrorReply(language: string): string {
    return language === "sr"
        ? "Zdravo! Ja sam WhatsApp asistent Workers United. Pomažemo kompanijama da pronađu strane radnike besplatno. Pišite nam na contact@workersunited.eu ili posetite workersunited.eu."
        : "Hi! I'm the Workers United assistant. We help companies hire foreign workers for free. Contact us at contact@workersunited.eu or visit workersunited.eu.";
}

export function getEmployerWhatsAppStaticReply(language: string): string {
    return language === "sr"
        ? "Zdravo! Workers United pomaže kompanijama da pronađu strane radnike — besplatno za poslodavce. Registrujte se na workersunited.eu/signup."
        : "Hi! Workers United helps companies hire foreign workers — free for employers. Register at workersunited.eu/signup.";
}
