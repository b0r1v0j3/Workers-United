import {
    DEFAULT_PLATFORM_SUPPORT_EMAIL,
    DEFAULT_PLATFORM_WEBSITE_URL,
    normalizePlatformSupportEmail,
    normalizePlatformWebsiteUrl,
} from "@/lib/platform-config";

export interface CanonicalWhatsAppFactsOptions {
    supportEmail?: string;
    website?: string;
}

export interface WorkerWhatsAppRulesOptions extends CanonicalWhatsAppFactsOptions {
    language: string;
    intent: string;
    confidence: string;
    reason: string;
    isAdmin: boolean;
}

export interface EmployerWhatsAppRulesOptions extends CanonicalWhatsAppFactsOptions {
    language: string;
    isRegistered: boolean;
    companyName?: string;
    contactName?: string;
    employerStatus?: string | null;
}

export interface RegisteredWorkerWhatsAppReplyOptions extends CanonicalWhatsAppFactsOptions {
    message: string;
    language: string;
    intent: string;
    historyMessages?: WhatsAppLanguageHistoryEntry[];
    workerStatus?: string | null;
    entryFeePaid?: boolean | null;
    adminApproved?: boolean | null;
    queueJoinedAt?: string | null;
    hasSupportAccess?: boolean;
}

export interface BrainLearningCandidate {
    category: string;
    content: string;
}

export interface WhatsAppBrainMemoryEntry {
    category: string;
    content: string;
    confidence: number;
}

export interface WhatsAppLanguageHistoryEntry {
    direction?: string | null;
    content?: string | null;
}

const CANONICAL_REQUIRED_WORKER_DOCUMENTS = "passport, biometric photo, and a final school, university, or formal vocational diploma";

export type WhatsAppLanguageCode = "en" | "sr" | "ar" | "fr" | "pt" | "hi";

const WHATSAPP_ONBOARDING_PATTERN = /fill.*profile.*whatsapp|complete.*profile.*whatsapp|register.*whatsapp|whatsapp.*profile|whatsapp.*register|profile.*on whatsapp|popuni.*profil.*whatsapp|profil.*na whatsapp|registr.*preko whatsapp|registro.*whatsapp|perfil.*whatsapp|rempl(?:ir|is|issez).*(?:profil).*(?:whatsapp)|cr[eé]er.*profil.*whatsapp|inscri(?:re|ption).*(?:whatsapp)|profil.*sur whatsapp|प्रोफाइल.*व्हाट्सएप|व्हाट्सएप.*प्रोफाइल|रजिस्टर.*व्हाट्सएप|व्हाट्सएप.*रजिस्टर|भर.*प्रोफाइल.*व्हाट्सएप/i;
const SERBIAN_LATIN_PATTERN = /\b(pozdrav|zdravo|cao|ćao|dobar dan|dobro vece|dobro veče|dobro jutro|hvala|molim|ocu|hoću|hocu|zelim|želim|treba mi|trebam|trazim|tražim|kako|kako da|kako radi|kako funkcionise|kako funkcioniše|sta|šta|zasto|zašto|gde|gdje|kad|imam|nemam|mogu li|moze li|može li|pomoc|pomoć|problem|sajt|nalog|broj|cekam|čekam|poruka|prijava|prijavim|registracija|posao|radnik|radnike|radim|koliko|kosta|košta|cena|cijena|dokumenti|dokumenta|dokumenata|pasos|pasoš|red cekanja|čekanja|odobren|odobreno|uplata|uplate|platim|placanje|plaćanje|koji je|sta je|šta je|da li je|mog profila|moj profil|profila|pomoc oko|pomo[cć] oko|voza[cč]|gra[dđ]evin|skladi|magacin|spanij|nemack|nemačk|srpski|engleski|jezik|jezici)\b/i;
const EMPLOYER_LEAD_PATTERN = /\b(employer|company|business|firm|hire|hiring|recruit(ing|er)?|need workers|looking for workers|we need workers|we are hiring|poslodavac|firma|kompanija|zapo[sš]ljavamo|treba(?:ju)? nam radnici|tra[zž]imo radnike)\b/i;
const WORKER_LEAD_PATTERN = /\b(worker|job|work abroad|looking for a job|looking for work|need a job|i want a job|radnik|posao|tra[zž]im posao|ocu posao|ho[ćc]u posao|[zž]elim posao|radim kao|imam iskustva)\b/i;
const PRICE_HINT_PATTERN = /\b(price|cost|fee|payment|pay|prix|paiement|co[uû]t|pre[cç]o|preco|custo|pagamento|valor|koliko|kosta|košta|cena|cijena|platim|platiti|uplata|placanje|plaćanje|शुल्क|भुगतान|سعر|تكلفة|دفع)\b/i;
const DOCUMENT_HINT_PATTERN = /\b(document|documents|docs?|documentos?|passport|passeport|passaporte|diploma|photo|biometric|biom[eé]trique|biom[ée]trica|upload|verification|dokumenti|dokumenta|pasos|pasoš|slika|fotografija|verifikacija|पासपोर्ट|दस्तावेज|جواز|مستند)\b/i;
const STATUS_HINT_PATTERN = /\b(status|statut|profile|profil|perfil|approval|approved|review|queue|support|mon profil|meu perfil|status dos meus|stanje|odobren|odobreno|red|podrska|podrška|स्थिति|حالة|مراجعة)\b/i;
const JOB_HINT_PATTERN = /\b(ima li|postoji li|any job|available job|vacancy|vacancies|job for|posao za|ocu posao|ho[ćc]u posao|tra[zž]im posao|looking for work|looking for a job)\b/i;
const SPECIFIC_AVAILABILITY_HINT_PATTERN = /\b(ima li|postoji li|any job|available job|vacancy|vacancies|job for|posao za|open job|open position|what jobs|which jobs|koji poslovi|lista poslova|available workers list)\b/i;
const PROCESS_HINT_PATTERN = /\b(how does it work|how it works|process|steps|next step|how do i start|kako radi|kako funkcioni[sš]e|kako ide|koji su koraci|sledeci korak|sledeći korak|kako da krenem)\b/i;
const SUPPORT_HINT_PATTERN = /\b(help|support|human|agent|bug|error|problem|issue|not working|operator|tehni[cč]ki|podr[sš]ka|pomo[cć]|aide|ajuda|assist[eê]ncia|suporte|atendimento|مساعدة|دعم|مشكلة)\b/i;
const SERBIAN_WARM_GREETING_PATTERN = /^\s*(?:(?:pozdrav|zdravo|cao|ćao|dobar dan|dobro jutro|dobro vece|dobro veče)(?:\s+(?:kako si(?: danas)?|kako ste(?: danas)?|sta ima|šta ima|kako ide|jel si dobro|jesi dobro|jesi li dobro|dobro si))?|(?:kako si(?: danas)?|kako ste(?: danas)?|sta ima|šta ima|kako ide|jel si dobro|jesi dobro|jesi li dobro|dobro si))\s*[.!?]*\s*$/i;
const FRENCH_LANGUAGE_PATTERN = /\b(bonjour|salut|bonsoir|merci|emploi|travail|profil|passeport|paiement|statut|quel est|quelle est|mon profil|mes documents|besoin d['’]aide|j['’]ai besoin|ça va|ca va|comment ça va|comment ca va|comment vas[\s-]*tu|comment allez[\s-]*vous)\b/i;
const PORTUGUESE_LANGUAGE_PATTERN = /\b(olá|ola|bom dia|boa tarde|boa noite|obrigad[oa]|emprego|trabalho|perfil|documentos?|passaporte|pagamento|status dos meus|meu perfil|meus documentos|preciso de ajuda|qual [ée]|tudo bem|como vai|como voce est[aá]|como você est[aá]|como estás)\b/i;
const HINDI_LATIN_PATTERN = /\b(namaste|namaskar|kaise ho|kaisi ho|aap kaise ho|aap kaise hain|kya haal hai|sab thik|sab theek|naukri|kaam chahiye)\b/i;
const ARABIC_LATIN_PATTERN = /\b(salam|selam|marhaba|ahlan|kifak|keefak|kifik|keefik|kayf halak|kayf halik|shlonak|shlonik)\b/i;
const SHORT_ENGLISH_GREETING_PATTERN = /^\s*(?:(?:hi|hello|hey|good morning|good afternoon|good evening)(?:\s+(?:how are you(?: today| doing)?|how is your day|are you okay|you okay|you good))?|(?:how are you(?: today| doing)?|how is your day|are you okay|you okay|you good))\s*[.!?]*\s*$/i;
const SHORT_FRENCH_GREETING_PATTERN = /^\s*(?:(?:bonjour|salut|bonsoir)(?:\s+(?:ça va|ca va|comment ça va|comment ca va|comment vas[\s-]*tu|comment allez[\s-]*vous))?|(?:ça va|ca va|comment ça va|comment ca va|comment vas[\s-]*tu|comment allez[\s-]*vous))\s*[.!?]*\s*$/i;
const SHORT_PORTUGUESE_GREETING_PATTERN = /^\s*(?:(?:olá|ola|bom dia|boa tarde|boa noite)(?:\s+(?:tudo bem|como vai|como voce est[aá]|como você est[aá]|como estás))?|(?:tudo bem|como vai|como voce est[aá]|como você est[aá]|como estás))\s*[.!?]*\s*$/i;
const SHORT_HINDI_GREETING_PATTERN = /^\s*(?:(?:namaste|namaskar|नमस्ते|नमस्कार|हाय|हेलो)(?:\s+(?:कैसे हो|कैसी हो|आप कैसे हो|क्या हाल है|kaise ho|kaisi ho|aap kaise ho|kya haal hai|sab thik|sab theek))?|(?:कैसे हो|कैसी हो|आप कैसे हो|क्या हाल है|kaise ho|kaisi ho|aap kaise ho|kya haal hai|sab thik|sab theek))\s*[.!?]*\s*$/i;
const SHORT_ARABIC_GREETING_PATTERN = /^\s*(?:(?:مرحبا|أهلا|اهلا|السلام عليكم|سلام|salam|selam|marhaba)(?:\s+(?:كيفك|كيف حالك|كيف الحال|شلونك|kifak|keefak|kifik|keefik|kayf halak|kayf halik|shlonak|shlonik))?|(?:كيفك|كيف حالك|كيف الحال|شلونك|kifak|keefak|kifik|keefik|kayf halak|kayf halik|shlonak|shlonik))\s*[.!?]*\s*$/i;

const GREETING_ONLY_PATTERNS: Record<WhatsAppLanguageCode, readonly RegExp[]> = {
    en: [/^\s*(?:hi|hello|hey|good morning|good afternoon|good evening)\s*[.!?]*\s*$/i],
    sr: [/^\s*(?:pozdrav|zdravo|cao|ćao|dobar dan|dobro jutro|dobro vece|dobro veče)\s*[.!?]*\s*$/i],
    ar: [/^\s*(?:مرحبا|أهلا|اهلا|السلام عليكم|سلام|salam|selam|marhaba)\s*[.!?؟]*\s*$/i],
    fr: [/^\s*(?:bonjour|salut|bonsoir)\s*[.!?]*\s*$/i],
    pt: [/^\s*(?:olá|ola|bom dia|boa tarde|boa noite)\s*[.!?]*\s*$/i],
    hi: [/^\s*(?:नमस्ते|नमस्कार|हाय|हेलो|namaste|namaskar)\s*[.!?]*\s*$/i],
};

const WARM_GREETING_PATTERNS: Record<WhatsAppLanguageCode, readonly RegExp[]> = {
    en: [SHORT_ENGLISH_GREETING_PATTERN],
    sr: [SERBIAN_WARM_GREETING_PATTERN],
    ar: [SHORT_ARABIC_GREETING_PATTERN],
    fr: [SHORT_FRENCH_GREETING_PATTERN],
    pt: [SHORT_PORTUGUESE_GREETING_PATTERN],
    hi: [SHORT_HINDI_GREETING_PATTERN],
};

const NON_ENGLISH_LANGUAGE_PATTERNS: Record<Exclude<WhatsAppLanguageCode, "en">, readonly RegExp[]> = {
    sr: [
        SERBIAN_LATIN_PATTERN,
        SERBIAN_WARM_GREETING_PATTERN,
        /^\s*(?:jel si dobro|jesi dobro|jesi li dobro|dobro si)\s*[.!?]*\s*$/i,
    ],
    ar: [
        /[\u0600-\u06FF]/,
        SHORT_ARABIC_GREETING_PATTERN,
        ARABIC_LATIN_PATTERN,
    ],
    fr: [
        SHORT_FRENCH_GREETING_PATTERN,
        FRENCH_LANGUAGE_PATTERN,
    ],
    pt: [
        SHORT_PORTUGUESE_GREETING_PATTERN,
        PORTUGUESE_LANGUAGE_PATTERN,
    ],
    hi: [
        /[\u0900-\u097F]/,
        SHORT_HINDI_GREETING_PATTERN,
        HINDI_LATIN_PATTERN,
    ],
};

const EXPLICIT_LANGUAGE_PREFERENCE_PATTERNS: Record<WhatsAppLanguageCode, readonly RegExp[]> = {
    sr: [
        /\b(?:pi[sš]i|govori|pri[cč]aj|odgovaraj|nastavi)\b.*\b(?:srpski|srpskom)\b/i,
        /\b(?:na|po)\s+srpskom\b/i,
        /\b(?:write|reply|respond|speak|continue)\b.*\bserbian\b/i,
    ],
    en: [
        /\b(?:write|reply|respond|speak|continue)\b.*\benglish\b/i,
        /\b(?:na|po)\s+engleskom\b/i,
        /\bin english\b/i,
    ],
    fr: [
        /\b(?:write|reply|respond|speak|continue)\b.*\b(?:french|fran[cç]ais|francais)\b/i,
        /\ben\s+fran[cç]ais\b/i,
        /\b(?:na|po)\s+francuskom\b/i,
    ],
    pt: [
        /\b(?:write|reply|respond|speak|continue)\b.*\b(?:portuguese|portugu[eê]s)\b/i,
        /\bem\s+portugu[eê]s\b/i,
        /\b(?:na|po)\s+portugalskom\b/i,
    ],
    ar: [
        /\b(?:write|reply|respond|speak|continue)\b.*\barabic\b/i,
        /(?:اكتب|تكلم|رد)\s+بالعربية/i,
        /\b(?:na|po)\s+arapskom\b/i,
    ],
    hi: [
        /\b(?:write|reply|respond|speak|continue)\b.*\bhindi\b/i,
        /(?:हिंदी में|हिन्दी में)/i,
        /\b(?:na|po)\s+hind(?:i|iju)\b/i,
    ],
};

const SAFE_BRAIN_LEARNING_CATEGORIES = new Set([
    "common_question",
    "error_fix",
    "copy_rule",
]);

const RISKY_BRAIN_LEARNING_PATTERNS = [
    /\b\d+\b/,
    /\$|€|usd|eur/i,
    /\brefund|service charge|fee|placement|price|cost\b/i,
    /\bpassport|diploma|biometric|document|visa|embassy|permit|contract\b/i,
    /\bserbia|bosnia|india|bangladesh|nepal|morocco|philippines|germany|france|italy|spain|croatia|austria|belgrade\b/i,
    /\bavailable workers|verified workers|workers available|jobs in stock\b/i,
    /https?:\/\//i,
];

function normalizeBrainLearningContent(content: string): string {
    return content.trim().replace(/\s+/g, " ");
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(value));
}

function normalizeWhatsAppPublicContact(options: CanonicalWhatsAppFactsOptions = {}) {
    return {
        website: normalizePlatformWebsiteUrl(options.website),
        supportEmail: normalizePlatformSupportEmail(options.supportEmail),
    };
}

export function detectExplicitWhatsAppLanguagePreference(message: string): WhatsAppLanguageCode | null {
    const normalized = message.trim();
    if (!normalized) {
        return null;
    }

    for (const [code, patterns] of Object.entries(EXPLICIT_LANGUAGE_PREFERENCE_PATTERNS) as [WhatsAppLanguageCode, readonly RegExp[]][]) {
        if (matchesAnyPattern(normalized, patterns)) {
            return code;
        }
    }

    return null;
}

function getMostRecentInboundHistoryLanguageCode(
    historyMessages: WhatsAppLanguageHistoryEntry[] = []
): WhatsAppLanguageCode | null {
    for (let index = historyMessages.length - 1; index >= 0; index -= 1) {
        const entry = historyMessages[index];
        if (entry?.direction !== "inbound" || !entry.content?.trim()) {
            continue;
        }

        return detectWhatsAppLanguageCode(entry.content);
    }

    return null;
}

function shouldPreferWhatsAppHistoryLanguage(message: string): boolean {
    const trimmed = message.trim();
    if (!trimmed) {
        return false;
    }

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const looksLikeStructuredShortQuestion =
        PRICE_HINT_PATTERN.test(trimmed)
        || DOCUMENT_HINT_PATTERN.test(trimmed)
        || STATUS_HINT_PATTERN.test(trimmed)
        || JOB_HINT_PATTERN.test(trimmed)
        || PROCESS_HINT_PATTERN.test(trimmed)
        || SUPPORT_HINT_PATTERN.test(trimmed);

    return (wordCount <= 4 && !looksLikeStructuredShortQuestion)
        || looksLikeGreetingOnlyWhatsAppMessage(trimmed)
        || looksLikeWarmGreetingWhatsAppMessage(trimmed);
}

function getLanguageName(code: WhatsAppLanguageCode): string {
    switch (code) {
        case "sr":
            return "Serbian";
        case "ar":
            return "Arabic";
        case "fr":
            return "French";
        case "pt":
            return "Portuguese";
        case "hi":
            return "Hindi";
        default:
            return "English";
    }
}

const RESPONSE_LANGUAGE_SIGNAL_PATTERNS: Record<WhatsAppLanguageCode, readonly RegExp[]> = {
    en: [
        /\b(?:your|please|dashboard|next step|create your account|complete your profile|how can i help|support inbox)\b/i,
    ],
    sr: [
        /[\u0400-\u04FF]/,
        /[čćžšđ]/i,
        /\b(?:naravno|prvi korak|sledeći|sljedeći|nalog|uplata|odobren|pošaljite|otvorite|radnik|radnika|dokumenta)\b/i,
    ],
    ar: [
        /[\u0600-\u06FF]/,
    ],
    fr: [
        /[àâçéèêëîïôùûüœ]/i,
        /\b(?:votre|vos|statut|documents?|pai(?:e|è)ment|tableau de bord|prochaine (?:étape|etape)|ouvrez|envoyez|compl[eé]tez|travailleur(?:s)?|employeur(?:s)?)\b/i,
    ],
    pt: [
        /[ãõáàâéêíóôúç]/i,
        /\b(?:seu|sua|seus|suas|documentos?|pagamento|painel|pr[oó]xim[oa] (?:passo|etapa)|envie|acompanhe|complete|trabalhador(?:es)?|empregador(?:es)?)\b/i,
    ],
    hi: [
        /[\u0900-\u097F]/,
    ],
};

const SHORT_RESPONSE_LANGUAGE_SIGNALS: Record<WhatsAppLanguageCode, readonly string[]> = {
    en: ["yes", "no", "sure", "absolutely"],
    sr: ["da", "ne", "naravno", "moze", "može"],
    ar: ["نعم", "لا"],
    fr: ["oui", "non", "bien sur", "bien sûr", "daccord", "d'accord"],
    pt: ["sim", "nao", "não", "claro"],
    hi: ["हाँ", "हां", "नहीं"],
};

function normalizeShortLanguageReply(text: string) {
    return text
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.!?,;:()[\]{}"'`´’‘]/g, "")
        .replace(/\s+/g, " ");
}

function getLanguageCodeFromLabel(label?: string | null): WhatsAppLanguageCode | null {
    const normalized = (label || "").trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.startsWith("sr") || normalized.includes("serb") || normalized.includes("croat") || normalized.includes("bosnian") || normalized.includes("montenegrin")) return "sr";
    if (normalized.startsWith("ar") || normalized.includes("arab")) return "ar";
    if (normalized.startsWith("fr") || normalized.includes("french")) return "fr";
    if (normalized.startsWith("pt") || normalized.includes("portug") || normalized.includes("brazil")) return "pt";
    if (normalized.startsWith("hi") || normalized.includes("hindi")) return "hi";
    if (normalized.startsWith("en") || normalized.includes("english")) return "en";
    return null;
}

export function shouldStartWhatsAppOnboarding(message: string): boolean {
    return WHATSAPP_ONBOARDING_PATTERN.test(message.toLowerCase().trim());
}

export function detectWhatsAppLanguageCode(message: string): WhatsAppLanguageCode {
    const normalized = message.trim().toLowerCase();

    if (/[\u0600-\u06FF]/.test(message)) return "ar";
    if (/[\u0900-\u097F]/.test(message)) return "hi";
    if (/[\u0400-\u04FF]/.test(message) || /[čćžšđ]/i.test(message)) return "sr";

    if (matchesAnyPattern(normalized, NON_ENGLISH_LANGUAGE_PATTERNS.sr)) return "sr";
    if (matchesAnyPattern(normalized, NON_ENGLISH_LANGUAGE_PATTERNS.fr)) return "fr";
    if (matchesAnyPattern(normalized, NON_ENGLISH_LANGUAGE_PATTERNS.pt)) return "pt";
    if (matchesAnyPattern(normalized, NON_ENGLISH_LANGUAGE_PATTERNS.hi)) return "hi";
    if (matchesAnyPattern(normalized, NON_ENGLISH_LANGUAGE_PATTERNS.ar)) return "ar";

    return "en";
}

export function resolveWhatsAppLanguageCode(
    message: string,
    detectedLanguage?: string | null,
    historyMessages: WhatsAppLanguageHistoryEntry[] = []
): WhatsAppLanguageCode {
    const explicitPreferenceCode = detectExplicitWhatsAppLanguagePreference(message);
    if (explicitPreferenceCode) {
        return explicitPreferenceCode;
    }

    const normalizedMessage = message.trim();
    const quickCode = detectWhatsAppLanguageCode(message);
    const detectedCode = getLanguageCodeFromLabel(detectedLanguage);
    const recentInboundHistoryCode = getMostRecentInboundHistoryLanguageCode(historyMessages);

    if (!normalizedMessage) {
        return recentInboundHistoryCode || detectedCode || "en";
    }

    if (quickCode !== "en") {
        return quickCode;
    }

    if (detectedCode && detectedCode !== "en") {
        return detectedCode;
    }

    if (shouldPreferWhatsAppHistoryLanguage(message)) {
        if (recentInboundHistoryCode) {
            return recentInboundHistoryCode;
        }
    }

    return detectedCode || "en";
}

export function resolveWhatsAppLanguageName(
    message: string,
    detectedLanguage?: string | null,
    historyMessages: WhatsAppLanguageHistoryEntry[] = []
): string {
    return getLanguageName(resolveWhatsAppLanguageCode(message, detectedLanguage, historyMessages));
}

export function replyMatchesExpectedWhatsAppLanguage(expectedLanguage: string, responseText: string): boolean {
    const expectedCode = getLanguageCodeFromLabel(expectedLanguage);
    if (!expectedCode) {
        return true;
    }

    const normalizedResponse = responseText.trim();
    if (!normalizedResponse) {
        return false;
    }

    if (RESPONSE_LANGUAGE_SIGNAL_PATTERNS[expectedCode].some((pattern) => pattern.test(normalizedResponse))) {
        return true;
    }

    const normalizedShortReply = normalizeShortLanguageReply(normalizedResponse);
    if (SHORT_RESPONSE_LANGUAGE_SIGNALS[expectedCode].includes(normalizedShortReply)) {
        return true;
    }

    return detectWhatsAppLanguageCode(normalizedResponse) === expectedCode;
}

export function looksLikeEmployerWhatsAppLead(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return EMPLOYER_LEAD_PATTERN.test(normalized) && !WORKER_LEAD_PATTERN.test(normalized);
}

export function looksLikeWorkerWhatsAppLead(message: string): boolean {
    return WORKER_LEAD_PATTERN.test(message.trim().toLowerCase());
}

export function looksLikeGreetingOnlyWhatsAppMessage(message: string): boolean {
    const normalized = message.trim();
    return Object.values(GREETING_ONLY_PATTERNS).some((patterns) => matchesAnyPattern(normalized, patterns));
}

export function looksLikeWarmGreetingWhatsAppMessage(message: string): boolean {
    const normalized = message.trim();
    return Object.values(WARM_GREETING_PATTERNS).some((patterns) => matchesAnyPattern(normalized, patterns));
}

export function looksLikeWhatsAppPriceQuestion(message: string): boolean {
    return PRICE_HINT_PATTERN.test(message.trim().toLowerCase());
}

export function looksLikeWhatsAppDocumentQuestion(message: string): boolean {
    return DOCUMENT_HINT_PATTERN.test(message.trim().toLowerCase());
}

export function looksLikeWhatsAppStatusQuestion(message: string): boolean {
    return STATUS_HINT_PATTERN.test(message.trim().toLowerCase());
}

export function buildUnregisteredWorkerWhatsAppReply({
    message,
    language,
    intent,
    historyMessages = [],
    website = DEFAULT_PLATFORM_WEBSITE_URL,
    supportEmail = DEFAULT_PLATFORM_SUPPORT_EMAIL,
    requiredDocuments = CANONICAL_REQUIRED_WORKER_DOCUMENTS,
    isFirstContact = false,
}: {
    message: string;
    language: string;
    intent: string;
    historyMessages?: WhatsAppLanguageHistoryEntry[];
    website?: string;
    supportEmail?: string;
    requiredDocuments?: string;
    isFirstContact?: boolean;
}): string | null {
    ({ website, supportEmail } = normalizeWhatsAppPublicContact({ website, supportEmail }));
    const normalized = message.trim().toLowerCase();
    const lang = resolveWhatsAppLanguageCode(message, language, historyMessages);
    const isGreetingOnly = looksLikeGreetingOnlyWhatsAppMessage(message);
    const isWarmGreeting = looksLikeWarmGreetingWhatsAppMessage(message);
    const explicitLanguagePreference = detectExplicitWhatsAppLanguagePreference(message);
    const wantsPrice = intent === "price" || PRICE_HINT_PATTERN.test(normalized);
    const wantsDocuments = intent === "documents" || DOCUMENT_HINT_PATTERN.test(normalized);
    const wantsStatus = intent === "status" || intent === "support" || STATUS_HINT_PATTERN.test(normalized);
    const asksSpecificAvailability = SPECIFIC_AVAILABILITY_HINT_PATTERN.test(normalized);
    const asksHowItWorks = PROCESS_HINT_PATTERN.test(normalized);
    const wantsJobHelp = intent === "job_intent" || JOB_HINT_PATTERN.test(normalized) || looksLikeWorkerWhatsAppLead(message);

    if (explicitLanguagePreference && !wantsPrice && !wantsDocuments && !wantsStatus && !asksSpecificAvailability && !wantsJobHelp) {
        switch (lang) {
            case "sr":
                return "Naravno — nastaviću na srpskom. Ja sam Workers United AI asistent. Kako mogu da pomognem?";
            case "ar":
                return "بالتأكيد — سأتابع بالعربية. أنا مساعد Workers United بالذكاء الاصطناعي. كيف يمكنني مساعدتك؟";
            case "fr":
                return "Bien sûr — je continue en français. Je suis l’assistant IA de Workers United. Comment puis-je vous aider ?";
            case "pt":
                return "Claro — vou continuar em português. Eu sou o assistente de IA da Workers United. Como posso ajudar?";
            case "hi":
                return "ज़रूर — मैं हिंदी में जारी रखूँगा। मैं Workers United का AI assistant हूँ। मैं कैसे मदद कर सकता हूँ?";
            default:
                return "Of course — I’ll continue in English. I’m the Workers United AI assistant. How can I help?";
        }
    }

    if ((isFirstContact || isWarmGreeting || isGreetingOnly) && isWarmGreeting && !wantsPrice && !wantsDocuments && !wantsStatus && !asksSpecificAvailability) {
        switch (lang) {
            case "sr":
                return `Pozdrav! Ja sam Workers United AI asistent i tu sam da pomognem.\n\nMogu da objasnim kako funkcionišu posao, dokumenta, status profila ili sledeći korak. Samo mi napišite šta vas zanima.`;
            case "ar":
                return `مرحبًا! أنا مساعد الذكاء الاصطناعي من Workers United وأنا هنا للمساعدة.\n\nيمكنني شرح الوظائف أو المستندات أو حالة الملف أو الخطوة التالية. فقط اكتب لي ما الذي تريد معرفته.`;
            case "fr":
                return `Bonjour ! Je suis l’assistant IA de Workers United et je suis là pour aider.\n\nJe peux expliquer les emplois, les documents, le statut du profil ou la prochaine étape. Dites-moi simplement ce que vous voulez vérifier.`;
            case "pt":
                return `Olá! Eu sou o assistente de IA da Workers United e estou aqui para ajudar.\n\nPosso explicar vagas, documentos, status do perfil ou o próximo passo. É só me dizer o que você quer verificar.`;
            case "hi":
                return `नमस्ते! मैं Workers United का AI assistant हूँ और मदद के लिए यहाँ हूँ।\n\nमैं jobs, documents, profile status या अगले step के बारे में समझा सकता हूँ। बस बताइए कि आप क्या check करना चाहते हैं।`;
            default:
                return `Hello! I’m the Workers United AI assistant, and I’m here to help.\n\nI can explain jobs, documents, profile status, or the next step. Just tell me what you want to check.`;
        }
    }

    if (wantsPrice) {
        switch (lang) {
            case "sr":
                return `Job Finder košta $9, ali se to ne plaća odmah. Prvo napravite nalog na ${website}/signup i završite profil i obavezna dokumenta; checkout se otključava tek kada sve to bude kompletno i admin ga odobri, a uplata se pokreće iz dashboard-a, ne preko WhatsApp-a.`;
            case "ar":
                return `تكلفة Job Finder هي $9، لكن ذلك لا يُدفع فورًا. أنشئ حسابك أولاً على ${website}/signup وأكمل ملفك والمستندات المطلوبة؛ يتم فتح الدفع فقط بعد اكتمال ذلك كله وموافقة الإدارة، ويبدأ الدفع من لوحة التحكم وليس عبر WhatsApp.`;
            case "fr":
                return `Job Finder coûte $9, mais ce n’est pas à payer immédiatement. Créez d’abord votre compte sur ${website}/signup et complétez votre profil ainsi que les documents requis ; le paiement ne s’ouvre qu’après cela et la validation admin, et il démarre depuis le tableau de bord, pas via WhatsApp.`;
            case "pt":
                return `O Job Finder custa $9, mas isso não é pago imediatamente. Primeiro crie sua conta em ${website}/signup e complete seu perfil e os documentos obrigatórios; o checkout só é liberado depois disso e da aprovação admin, e o pagamento começa no painel, não pelo WhatsApp.`;
            case "hi":
                return `Job Finder की कीमत $9 है, लेकिन यह तुरंत pay नहीं किया जाता। पहले ${website}/signup पर account बनाइए, profile और required documents पूरे कीजिए; checkout तभी unlock होता है जब यह सब complete हो और admin approve करे, और payment dashboard से शुरू होता है, WhatsApp से नहीं।`;
            default:
                return `Job Finder costs $9, but that is not paid immediately. First create your account at ${website}/signup and complete your profile and required documents; checkout unlocks only after that is complete and admin approves it, and payment starts from the dashboard, not through WhatsApp.`;
        }
    }

    if (wantsDocuments) {
        switch (lang) {
            case "sr":
                return `Potrebna dokumenta su ${requiredDocuments}. Dokumenta se uploaduju kroz dashboard na ${website}/signup nakon registracije; WhatsApp prilozi se trenutno ne vezuju automatski za profil.`;
            case "ar":
                return `المستندات المطلوبة هي ${requiredDocuments}. يتم رفع المستندات من خلال لوحة التحكم بعد التسجيل على ${website}/signup؛ مرفقات WhatsApp لا ترتبط بالملف تلقائيًا حاليًا.`;
            case "fr":
                return `Les documents requis sont : ${requiredDocuments}. Les documents se téléversent dans le tableau de bord après inscription sur ${website}/signup ; les pièces jointes WhatsApp ne sont pas reliées automatiquement au profil pour le moment.`;
            case "pt":
                return `Os documentos necessários são ${requiredDocuments}. Os documentos são enviados pelo painel após o cadastro em ${website}/signup; anexos do WhatsApp ainda não são vinculados automaticamente ao perfil.`;
            case "hi":
                return `ज़रूरी documents हैं: ${requiredDocuments}. Documents registration के बाद ${website}/signup से dashboard में upload किए जाते हैं; WhatsApp attachments अभी profile से automatically link नहीं होते।`;
            default:
                return `The required documents are ${requiredDocuments}. Documents are uploaded in the dashboard after registration at ${website}/signup; WhatsApp attachments are not linked to the profile automatically yet.`;
        }
    }

    if (wantsStatus) {
        switch (lang) {
            case "sr":
                return `Za ovaj broj još ne vidim registrovan worker nalog. Prvi korak je da napravite nalog na ${website}/signup; kada nalog postoji, status, dokumenta i sledeći koraci se prate kroz dashboard. Ako imate tehnički problem, pošaljite kratak opis na ${supportEmail}.`;
            case "ar":
                return `لا أرى حتى الآن حساب عامل مسجل لهذا الرقم. الخطوة الأولى هي إنشاء حساب على ${website}/signup؛ وبعد وجود الحساب تتم متابعة الحالة والمستندات والخطوات التالية من خلال لوحة التحكم. إذا كانت لديك مشكلة تقنية فأرسل وصفًا قصيرًا إلى ${supportEmail}.`;
            case "fr":
                return `Je ne vois pas encore de compte worker enregistré pour ce numéro. La première étape est de créer un compte sur ${website}/signup ; ensuite le statut, les documents et les prochaines étapes se suivent dans le tableau de bord. En cas de problème technique, envoyez une courte description à ${supportEmail}.`;
            case "pt":
                return `Ainda não vejo uma conta de worker registrada para este número. O primeiro passo é criar uma conta em ${website}/signup; depois disso, status, documentos e próximos passos são acompanhados no painel. Se houver problema técnico, envie uma breve descrição para ${supportEmail}.`;
            case "hi":
                return `इस नंबर के लिए अभी मुझे registered worker account नहीं दिख रहा। पहला step है ${website}/signup पर account बनाना; उसके बाद status, documents और next steps dashboard में दिखते हैं। अगर technical problem है तो short description ${supportEmail} पर भेजिए।`;
            default:
                return `I do not see a registered worker account for this number yet. The first step is to create an account at ${website}/signup; after that, status, documents, and next steps are tracked in the dashboard. If you have a technical issue, send a short description to ${supportEmail}.`;
        }
    }

    if (asksSpecificAvailability) {
        switch (lang) {
            case "sr":
                return `Mogu da pomognem, ali ne mogu da potvrdim konkretan otvoren posao preko WhatsApp-a. Workers United radi kroz vođeni matching proces, pa je prvi korak da napravite nalog na ${website}/signup i popunite profil; posle toga pratimo sledeće korake kroz dashboard, a ovde mogu da objasnim proces.`;
            case "ar":
                return `يمكنني المساعدة، لكن لا أستطيع تأكيد وظيفة محددة مفتوحة عبر WhatsApp. يعمل Workers United من خلال مطابقة موجهة، لذلك الخطوة الأولى هي إنشاء حساب على ${website}/signup وإكمال الملف، وبعدها نتابع الخطوات التالية من خلال لوحة التحكم ويمكنني هنا شرح العملية.`;
            case "fr":
                return `Je peux aider, mais je ne peux pas confirmer une offre précise ouverte via WhatsApp. Workers United fonctionne avec un processus d’appariement guidé ; la première étape est donc de créer un compte sur ${website}/signup et de compléter le profil, puis nous suivons les prochaines étapes via le tableau de bord et je peux expliquer le processus ici.`;
            case "pt":
                return `Posso ajudar, mas não posso confirmar uma vaga específica aberta pelo WhatsApp. A Workers United trabalha com um processo guiado de matching, então o primeiro passo é criar uma conta em ${website}/signup e completar o perfil; depois acompanhamos os próximos passos no painel, e eu posso explicar o processo por aqui.`;
            case "hi":
                return `मैं मदद कर सकता हूँ, लेकिन WhatsApp पर किसी specific open job की पुष्टि नहीं कर सकता। Workers United guided matching process के ज़रिए काम करता है, इसलिए पहला step ${website}/signup पर account बनाना और profile पूरा करना है; उसके बाद next steps dashboard में follow होते हैं, और मैं यहाँ process समझा सकता हूँ।`;
            default:
                return `I can help, but I cannot confirm a specific open job over WhatsApp. Workers United works through a guided matching process, so the first step is to create an account at ${website}/signup and complete the profile; after that, the next steps are tracked in the dashboard, and I can explain the process here.`;
        }
    }

    if (wantsJobHelp) {
        switch (lang) {
            case "sr":
                return asksHowItWorks
                    ? `Naravno. Workers United radi kroz vođeni matching proces: prvo napravite nalog na ${website}/signup i popunite profil, zatim kroz dashboard pratite dokumenta i sledeće korake, a kada profil bude spreman mi nastavljamo sa traženjem odgovarajućeg match-a.`
                    : `Naravno. Prvi korak je da napravite nalog na ${website}/signup i popunite profil. Posle toga kroz dashboard pratite dokumenta i sledeće korake, a ovde mogu da pomognem ako imate pitanje oko registracije, dokumenata ili procesa.`;
            case "ar":
                return asksHowItWorks
                    ? `بالتأكيد. يعمل Workers United من خلال مطابقة موجهة: تنشئ حسابًا أولاً على ${website}/signup وتكمل ملفك، ثم تتابع المستندات والخطوات التالية من خلال لوحة التحكم، وبعد أن يصبح الملف جاهزًا نواصل البحث عن المطابقة المناسبة.`
                    : `بالتأكيد. الخطوة الأولى هي إنشاء حساب على ${website}/signup وإكمال ملفك. بعد ذلك تتابع المستندات والخطوات التالية من خلال لوحة التحكم، ويمكنني هنا المساعدة إذا كانت لديك أسئلة عن التسجيل أو المستندات أو العملية.`;
            case "fr":
                return asksHowItWorks
                    ? `Bien sûr. Workers United fonctionne avec un processus d’appariement guidé : vous créez d’abord un compte sur ${website}/signup et complétez votre profil, puis vous suivez les documents et les prochaines étapes dans le tableau de bord, et une fois le profil prêt nous poursuivons la recherche du bon match.`
                    : `Bien sûr. La première étape est de créer un compte sur ${website}/signup et de compléter votre profil. Ensuite vous suivez les documents et les prochaines étapes dans le tableau de bord, et je peux vous aider ici si vous avez des questions sur l’inscription, les documents ou le processus.`;
            case "pt":
                return asksHowItWorks
                    ? `Claro. A Workers United trabalha com um processo guiado de matching: primeiro você cria sua conta em ${website}/signup e completa o perfil, depois acompanha documentos e próximos passos no painel, e quando o perfil estiver pronto nós seguimos com a busca pelo match adequado.`
                    : `Claro. O primeiro passo é criar sua conta em ${website}/signup e completar o perfil. Depois disso você acompanha documentos e próximos passos no painel, e eu posso ajudar por aqui se tiver dúvidas sobre cadastro, documentos ou processo.`;
            case "hi":
                return asksHowItWorks
                    ? `ज़रूर। Workers United guided matching process के ज़रिए काम करता है: पहले ${website}/signup पर account बनाइए और profile पूरा कीजिए, फिर dashboard में documents और next steps follow कीजिए, और जब profile तैयार हो जाए तो हम सही match ढूँढने की प्रक्रिया आगे बढ़ाते हैं।`
                    : `ज़रूर। पहला step ${website}/signup पर account बनाना और profile पूरा करना है। उसके बाद dashboard में documents और next steps follow होते हैं, और अगर registration, documents या process को लेकर सवाल हो तो मैं यहाँ मदद कर सकता हूँ।`;
            default:
                return asksHowItWorks
                    ? `Of course. Workers United works through a guided matching process: first you create an account at ${website}/signup and complete your profile, then you follow documents and next steps in the dashboard, and once the profile is ready we continue with the search for the right match.`
                    : `Of course. The first step is to create your account at ${website}/signup and complete the profile. After that, you follow documents and next steps in the dashboard, and I can help here if you have questions about registration, documents, or the process.`;
        }
    }

    return null;
}

function isRegisteredWorkerPaymentReady({
    workerStatus,
    entryFeePaid,
    adminApproved,
}: {
    workerStatus?: string | null;
    entryFeePaid?: boolean | null;
    adminApproved?: boolean | null;
}) {
    return !entryFeePaid && !!adminApproved && workerStatus === "APPROVED";
}

function isRegisteredWorkerPendingApproval({
    workerStatus,
    entryFeePaid,
    adminApproved,
}: {
    workerStatus?: string | null;
    entryFeePaid?: boolean | null;
    adminApproved?: boolean | null;
}) {
    return !entryFeePaid && !adminApproved && workerStatus === "PENDING_APPROVAL";
}

function getRegisteredWorkerAdvancedStatusReply(
    language: WhatsAppLanguageCode,
    workerStatus: string | null | undefined,
    website: string
): string | null {
    const normalizedStatus = (workerStatus || "").trim().toUpperCase();

    switch (normalizedStatus) {
        case "IN_QUEUE":
            switch (language) {
                case "sr":
                    return `Vaša Job Finder uplata je evidentirana i vaš profil je aktivan u redu čekanja. Status i naredne korake pratite kroz dashboard na ${website}/profile/worker.`;
                case "ar":
                    return `تم تسجيل دفعة Job Finder الخاصة بك وملفك نشط الآن في قائمة الانتظار. تابع الحالة والخطوات القادمة من لوحة التحكم على ${website}/profile/worker.`;
                case "fr":
                    return `Votre paiement Job Finder est enregistré et votre profil est maintenant actif dans la file d’attente. Suivez le statut et les prochaines étapes depuis le tableau de bord sur ${website}/profile/worker.`;
                case "pt":
                    return `Seu pagamento do Job Finder está registrado e seu perfil agora está ativo na fila. Acompanhe o status e os próximos passos no painel em ${website}/profile/worker.`;
                case "hi":
                    return `आपका Job Finder payment दर्ज हो चुका है और आपका profile अब queue में active है। Status और next steps ${website}/profile/worker dashboard में देखें।`;
                default:
                    return `Your Job Finder payment is recorded and your profile is now active in the queue. Please follow your status and next steps in the dashboard at ${website}/profile/worker.`;
            }
        case "OFFER_PENDING":
        case "OFFER_ACCEPTED":
            switch (language) {
                case "sr":
                    return `Vaš slučaj je trenutno u fazi ponude. Najnoviji status i sledeće korake pratite kroz dashboard na ${website}/profile/worker.`;
                case "ar":
                    return `حالتك الآن في مرحلة العرض. تابع أحدث حالة والخطوات التالية من لوحة التحكم على ${website}/profile/worker.`;
                case "fr":
                    return `Votre dossier est actuellement à l’étape de l’offre. Suivez le dernier statut et les prochaines étapes depuis le tableau de bord sur ${website}/profile/worker.`;
                case "pt":
                    return `Seu caso está atualmente na etapa da oferta. Acompanhe o status mais recente e os próximos passos no painel em ${website}/profile/worker.`;
                case "hi":
                    return `आपका case अभी offer stage में है। Latest status और next steps ${website}/profile/worker dashboard में देखें।`;
                default:
                    return `Your case is currently in the offer stage. Please follow the latest status and next steps in the dashboard at ${website}/profile/worker.`;
            }
        case "VISA_PROCESS_STARTED":
            switch (language) {
                case "sr":
                    return `Vaš vizni proces je u toku. Najnovije korake i ažuriranja pratite kroz dashboard na ${website}/profile/worker.`;
                case "ar":
                    return `عملية التأشيرة الخاصة بك قيد التنفيذ الآن. تابع أحدث الخطوات والتحديثات من لوحة التحكم على ${website}/profile/worker.`;
                case "fr":
                    return `Votre procédure de visa est en cours. Suivez les dernières étapes et mises à jour depuis le tableau de bord sur ${website}/profile/worker.`;
                case "pt":
                    return `Seu processo de visto está em andamento. Acompanhe as etapas e atualizações mais recentes no painel em ${website}/profile/worker.`;
                case "hi":
                    return `आपका visa process चल रहा है। Latest steps और updates ${website}/profile/worker dashboard में देखें।`;
                default:
                    return `Your visa process is currently in progress. Please follow the latest steps and updates in the dashboard at ${website}/profile/worker.`;
            }
        case "VISA_APPROVED":
            switch (language) {
                case "sr":
                    return `Vaša viza je odobrena. Najnovija dalja uputstva i ažuriranja pratite kroz dashboard na ${website}/profile/worker.`;
                case "ar":
                    return `تمت الموافقة على تأشيرتك. تابع أحدث التعليمات والتحديثات من لوحة التحكم على ${website}/profile/worker.`;
                case "fr":
                    return `Votre visa est approuvé. Suivez les dernières instructions et mises à jour depuis le tableau de bord sur ${website}/profile/worker.`;
                case "pt":
                    return `Seu visto foi aprovado. Acompanhe as instruções e atualizações mais recentes no painel em ${website}/profile/worker.`;
                case "hi":
                    return `आपका visa approve हो चुका है। Latest instructions और updates ${website}/profile/worker dashboard में देखें।`;
                default:
                    return `Your visa has been approved. Please follow the latest instructions and updates in the dashboard at ${website}/profile/worker.`;
            }
        case "PLACED":
            switch (language) {
                case "sr":
                    return `Vaš slučaj je prešao u završenu placement fazu. Najnovija ažuriranja pratite kroz dashboard na ${website}/profile/worker.`;
                case "ar":
                    return `انتقلت حالتك إلى مرحلة الإحالة المكتملة. تابع أحدث التحديثات من لوحة التحكم على ${website}/profile/worker.`;
                case "fr":
                    return `Votre dossier est passé à l’étape de placement finalisé. Suivez les dernières mises à jour depuis le tableau de bord sur ${website}/profile/worker.`;
                case "pt":
                    return `Seu caso entrou na etapa de colocação concluída. Acompanhe as atualizações mais recentes no painel em ${website}/profile/worker.`;
                case "hi":
                    return `आपका case completed placement stage में पहुँच चुका है। Latest updates ${website}/profile/worker dashboard में देखें।`;
                default:
                    return `Your case has reached the completed placement stage. Please follow the latest updates in the dashboard at ${website}/profile/worker.`;
            }
        case "REFUND_FLAGGED":
            switch (language) {
                case "sr":
                    return `Vaš slučaj je trenutno u refund proveri. Najnoviji status i naredne korake pratite kroz dashboard na ${website}/profile/worker.`;
                case "ar":
                    return `حالتك الآن قيد مراجعة الاسترداد. تابع أحدث حالة والخطوات التالية من لوحة التحكم على ${website}/profile/worker.`;
                case "fr":
                    return `Votre dossier est actuellement en revue de remboursement. Suivez le dernier statut et les prochaines étapes depuis le tableau de bord sur ${website}/profile/worker.`;
                case "pt":
                    return `Seu caso está atualmente em revisão de reembolso. Acompanhe o status mais recente e os próximos passos no painel em ${website}/profile/worker.`;
                case "hi":
                    return `आपका case इस समय refund review में है। Latest status और next steps ${website}/profile/worker dashboard में देखें।`;
                default:
                    return `Your case is currently in refund review. Please follow the latest status and next steps in the dashboard at ${website}/profile/worker.`;
            }
        default:
            return null;
    }
}

export function buildRegisteredWorkerWhatsAppReply({
    message,
    language,
    intent,
    historyMessages = [],
    workerStatus,
    entryFeePaid,
    adminApproved,
    queueJoinedAt,
    hasSupportAccess = false,
    website = DEFAULT_PLATFORM_WEBSITE_URL,
    supportEmail = DEFAULT_PLATFORM_SUPPORT_EMAIL,
}: RegisteredWorkerWhatsAppReplyOptions): string | null {
    ({ website, supportEmail } = normalizeWhatsAppPublicContact({ website, supportEmail }));
    const normalized = message.trim().toLowerCase();
    const lang = resolveWhatsAppLanguageCode(message, language, historyMessages);
    const isGreetingOnly = looksLikeGreetingOnlyWhatsAppMessage(message);
    const isWarmGreeting = looksLikeWarmGreetingWhatsAppMessage(message);
    const explicitLanguagePreference = detectExplicitWhatsAppLanguagePreference(message);
    const wantsPrice = intent === "price" || PRICE_HINT_PATTERN.test(normalized);
    const wantsDocuments = intent === "documents" || DOCUMENT_HINT_PATTERN.test(normalized);
    const wantsStatus = intent === "status" || STATUS_HINT_PATTERN.test(normalized);
    const wantsSupport = !wantsStatus && (
        intent === "support"
        || /\b(help|support|human|agent|bug|error|problem|issue|not working|operator|tehni[cč]ki|podr[sš]ka|pomo[cć])\b/i.test(normalized)
    );
    const asksSpecificAvailability = SPECIFIC_AVAILABILITY_HINT_PATTERN.test(normalized);
    const asksHowItWorks = PROCESS_HINT_PATTERN.test(normalized);
    const wantsJobHelp = intent === "job_intent" || JOB_HINT_PATTERN.test(normalized) || looksLikeWorkerWhatsAppLead(message);

    const paymentReady = isRegisteredWorkerPaymentReady({ workerStatus, entryFeePaid, adminApproved });
    const pendingApproval = isRegisteredWorkerPendingApproval({ workerStatus, entryFeePaid, adminApproved });
    const advancedStatusReply = getRegisteredWorkerAdvancedStatusReply(lang, workerStatus, website);

    if (explicitLanguagePreference && !wantsPrice && !wantsDocuments && !wantsStatus && !wantsSupport && !asksSpecificAvailability && !wantsJobHelp) {
        switch (lang) {
            case "sr":
                return "Naravno — nastaviću na srpskom. Ja sam Workers United AI asistent. Mogu da pomognem oko statusa, dokumenata, uplate ili sledećeg koraka.";
            case "ar":
                return "بالتأكيد — سأتابع بالعربية. أنا مساعد Workers United بالذكاء الاصطناعي. يمكنني المساعدة بخصوص الحالة أو المستندات أو الدفع أو الخطوة التالية.";
            case "fr":
                return "Bien sûr — je continue en français. Je suis l’assistant IA de Workers United. Je peux aider pour le statut, les documents, le paiement ou la prochaine étape.";
            case "pt":
                return "Claro — vou continuar em português. Eu sou o assistente de IA da Workers United. Posso ajudar com status, documentos, pagamento ou próximo passo.";
            case "hi":
                return "ज़रूर — मैं हिंदी में जारी रखूँगा। मैं Workers United का AI assistant हूँ। मैं status, documents, payment या अगले step में मदद कर सकता हूँ।";
            default:
                return "Of course — I’ll continue in English. I’m the Workers United AI assistant. I can help with your status, documents, payment, or next step.";
        }
    }

    if ((isGreetingOnly || isWarmGreeting) && !wantsPrice && !wantsDocuments && !wantsStatus && !wantsSupport) {
        switch (lang) {
            case "sr":
                return `Pozdrav! Ja sam Workers United AI asistent. Mogu da pomognem oko vašeg statusa, dokumenata, uplate ili sledećeg koraka. Samo mi napišite šta želite da proverimo.`;
            case "ar":
                return `مرحبًا! أنا مساعد الذكاء الاصطناعي من Workers United. يمكنني مساعدتك بخصوص حالتك أو المستندات أو الدفع أو الخطوة التالية. فقط اكتب لي ما الذي تريد التحقق منه.`;
            case "fr":
                return `Bonjour ! Je suis l’assistant IA de Workers United. Je peux vous aider concernant votre statut, vos documents, votre paiement ou la prochaine étape. Dites-moi simplement ce que vous voulez vérifier.`;
            case "pt":
                return `Olá! Eu sou o assistente de IA da Workers United. Posso ajudar com seu status, documentos, pagamento ou próximo passo. Basta me dizer o que você quer verificar.`;
            case "hi":
                return `नमस्ते! मैं Workers United का AI assistant हूँ। मैं आपके status, documents, payment या अगले step में मदद कर सकता हूँ। बस लिखिए कि आप क्या check करना चाहते हैं।`;
            default:
                return `Hello! I’m the Workers United AI assistant. I can help with your status, documents, payment, or next step. Just tell me what you want to check.`;
        }
    }

    if (wantsPrice) {
        if (entryFeePaid) {
            switch (lang) {
                case "sr":
                    return `Vaša Job Finder uplata je vec evidentirana, tako da ovde nema novog payment linka za slanje. Sledeci korak i status pratite kroz dashboard na ${website}/profile/worker.`;
                case "ar":
                    return `تم تسجيل دفعة Job Finder بالفعل، لذلك لا يوجد رابط دفع جديد لإرساله هنا. تابع الحالة والخطوة التالية من لوحة التحكم على ${website}/profile/worker.`;
                case "fr":
                    return `Votre paiement Job Finder est déjà enregistré, donc il n’y a pas de nouveau lien à envoyer ici. Suivez le statut et la prochaine étape depuis le tableau de bord sur ${website}/profile/worker.`;
                case "pt":
                    return `Seu pagamento do Job Finder já está registrado, então não há novo link para enviar aqui. Acompanhe o status e a próxima etapa no painel em ${website}/profile/worker.`;
                case "hi":
                    return `आपका Job Finder payment पहले से दर्ज है, इसलिए यहाँ कोई नया payment link भेजने की ज़रूरत नहीं है। अगला step और status ${website}/profile/worker dashboard में देखें।`;
                default:
                    return `Your Job Finder payment is already recorded, so there is no new payment link to send here. Please follow your status and next step in the dashboard at ${website}/profile/worker.`;
            }
        }

        if (paymentReady) {
            switch (lang) {
                case "sr":
                    return `Vaš profil je odobren i Job Finder checkout bi sada trebalo da bude dostupan u dashboard-u. Otvorite ${website}/profile/worker i pokrenite uplatu tamo, ne preko WhatsApp linka.`;
                case "ar":
                    return `تمت الموافقة على ملفك ويجب أن يكون Checkout الخاص بـ Job Finder متاحًا الآن في لوحة التحكم. افتح ${website}/profile/worker وابدأ الدفع من هناك، وليس عبر رابط WhatsApp.`;
                case "fr":
                    return `Votre profil est approuvé et le checkout Job Finder devrait maintenant être disponible dans le tableau de bord. Ouvrez ${website}/profile/worker et lancez le paiement là-bas, pas via un lien WhatsApp.`;
                case "pt":
                    return `Seu perfil foi aprovado e o checkout do Job Finder agora deve estar disponível no painel. Abra ${website}/profile/worker e inicie o pagamento por lá, não por um link no WhatsApp.`;
                case "hi":
                    return `आपका profile approve हो चुका है और Job Finder checkout अब dashboard में available होना चाहिए। ${website}/profile/worker खोलिए और payment वहीं से शुरू कीजिए, WhatsApp link से नहीं।`;
                default:
                    return `Your profile is approved and Job Finder checkout should now be available in the dashboard. Open ${website}/profile/worker and start payment there, not through a WhatsApp link.`;
            }
        }

        switch (lang) {
            case "sr":
                return pendingApproval
                    ? `Job Finder uplata jos nije otključana jer je vaš profil trenutno u admin review fazi. Kada admin potvrdi profil, checkout ce se pojaviti u dashboard-u na ${website}/profile/worker.`
                    : `Job Finder uplata se otključava tek kada profil bude kompletan, obavezna dokumenta završena i admin ga odobri. Sledeci korak pratite kroz dashboard na ${website}/profile/worker, a placanje se pokrece tamo, ne preko WhatsApp-a.`;
            case "ar":
                return pendingApproval
                    ? `دفع Job Finder لم يُفتح بعد لأن ملفك حاليًا في مراجعة الإدارة. عندما تؤكد الإدارة الملف سيظهر checkout في لوحة التحكم على ${website}/profile/worker.`
                    : `يتم فتح دفع Job Finder فقط بعد اكتمال الملف والمستندات المطلوبة وموافقة الإدارة. تابع الخطوة التالية عبر لوحة التحكم على ${website}/profile/worker، ويبدأ الدفع من هناك وليس عبر WhatsApp.`;
            case "fr":
                return pendingApproval
                    ? `Le paiement Job Finder n’est pas encore débloqué car votre profil est actuellement en revue admin. Une fois le profil confirmé par l’admin, le checkout apparaîtra dans le tableau de bord sur ${website}/profile/worker.`
                    : `Le paiement Job Finder ne s’ouvre qu’après profil complet, documents requis et validation admin. Suivez la prochaine étape dans le tableau de bord sur ${website}/profile/worker, et le paiement démarre là-bas, pas sur WhatsApp.`;
            case "pt":
                return pendingApproval
                    ? `O pagamento do Job Finder ainda não foi liberado porque seu perfil está em revisão administrativa. Quando o admin confirmar o perfil, o checkout aparecerá no painel em ${website}/profile/worker.`
                    : `O pagamento do Job Finder só é liberado após perfil completo, documentos obrigatórios e aprovação administrativa. Acompanhe o próximo passo no painel em ${website}/profile/worker; o pagamento começa lá, não pelo WhatsApp.`;
            case "hi":
                return pendingApproval
                    ? `Job Finder payment अभी unlock नहीं हुआ है क्योंकि आपका profile इस समय admin review में है। जब admin profile confirm करेगा, checkout ${website}/profile/worker dashboard में दिखेगा।`
                    : `Job Finder payment तभी unlock होता है जब profile complete हो, required documents पूरे हों और admin approve करे। अगला step ${website}/profile/worker dashboard में follow करें; payment वहीं से शुरू होता है, WhatsApp से नहीं।`;
            default:
                return pendingApproval
                    ? `Job Finder payment is not unlocked yet because your profile is currently in admin review. Once admin confirms the profile, checkout will appear in the dashboard at ${website}/profile/worker.`
                    : `Job Finder payment unlocks only after the profile is complete, the required documents are finished, and admin approves it. Please follow the next step in the dashboard at ${website}/profile/worker; payment starts there, not on WhatsApp.`;
        }
    }

    if (wantsDocuments) {
        switch (lang) {
            case "sr":
                return `Potrebna dokumenta su pasoš, biometrijska fotografija i završna školska, univerzitetska ili formalna stručna diploma. Upload i status dokumenata pratite kroz dashboard na ${website}/profile/worker; WhatsApp prilozi se ne vezuju automatski za profil.`;
            case "ar":
                return `المستندات المطلوبة هي جواز السفر، الصورة البيومترية، والدبلومة النهائية المدرسية أو الجامعية أو المهنية الرسمية. ارفع المستندات وتابع حالتها من لوحة التحكم على ${website}/profile/worker؛ مرفقات WhatsApp لا ترتبط بالملف تلقائيًا.`;
            case "fr":
                return `Les documents requis sont le passeport, la photo biométrique, et le diplôme final scolaire, universitaire ou professionnel formel. Le téléversement et le statut se suivent dans le tableau de bord sur ${website}/profile/worker ; les pièces jointes WhatsApp ne sont pas reliées automatiquement au profil.`;
            case "pt":
                return `Os documentos necessários são passaporte, foto biométrica e diploma final escolar, universitário ou profissional formal. O envio e o status dos documentos são acompanhados no painel em ${website}/profile/worker; anexos do WhatsApp não são vinculados automaticamente ao perfil.`;
            case "hi":
                return `ज़रूरी documents हैं passport, biometric photo, और final school, university, या formal vocational diploma। Documents upload और उनका status ${website}/profile/worker dashboard में देखें; WhatsApp attachments अपने-आप profile से link नहीं होते।`;
            default:
                return `The required documents are passport, biometric photo, and a final school, university, or formal vocational diploma. Uploads and document status are tracked in the dashboard at ${website}/profile/worker; WhatsApp attachments are not linked to the profile automatically.`;
        }
    }

    if (wantsSupport) {
        switch (lang) {
            case "sr":
                return hasSupportAccess
                    ? `Mogu da pomognem ovde, a vaš support inbox je takodje otvoren u dashboard-u na ${website}/profile/worker/inbox. Ako se isti problem ponavlja, nastavite tamo ili pošaljite screenshot i kratak opis na ${supportEmail}.`
                    : `Mogu da pomognem osnovnim informacijama ovde, ali support inbox se otključava tek kada Job Finder bude dostupan u dashboard-u i kada $9 uplata bude uspešno završena. Do toga se stiže tek posle kompletnog profila, obaveznih dokumenata i admin odobrenja. Ako imate tehnički problem pre toga, pošaljite screenshot i kratak opis na ${supportEmail}.`;
            case "ar":
                return hasSupportAccess
                    ? `يمكنني المساعدة هنا، كما أن صندوق الدعم لديك مفتوح أيضًا في لوحة التحكم على ${website}/profile/worker/inbox. إذا كانت نفس المشكلة تتكرر، واصل من هناك أو أرسل لقطة شاشة ووصفًا قصيرًا إلى ${supportEmail}.`
                    : `يمكنني المساعدة بالمعلومات الأساسية هنا، لكن صندوق الدعم يُفتح فقط بعد أن يصبح Job Finder متاحًا في لوحة التحكم وبعد إتمام دفعة $9 بنجاح. ولا يتم ذلك إلا بعد اكتمال الملف والمستندات المطلوبة وموافقة الإدارة. إذا كانت لديك مشكلة تقنية قبل ذلك فأرسل لقطة شاشة ووصفًا قصيرًا إلى ${supportEmail}.`;
            case "fr":
                return hasSupportAccess
                    ? `Je peux aider ici, et votre boîte de support est aussi ouverte dans le tableau de bord sur ${website}/profile/worker/inbox. Si le même problème se répète, continuez là-bas ou envoyez une capture d’écran avec une courte description à ${supportEmail}.`
                    : `Je peux aider ici avec les informations de base, mais la boîte de support ne s’ouvre qu’une fois Job Finder disponible dans le tableau de bord et le paiement de $9 terminé avec succès. Cela n’arrive qu’après profil complet, documents requis et validation admin. Si vous avez un problème technique avant cela, envoyez une capture d’écran et une courte description à ${supportEmail}.`;
            case "pt":
                return hasSupportAccess
                    ? `Posso ajudar por aqui, e sua caixa de suporte também está aberta no painel em ${website}/profile/worker/inbox. Se o mesmo problema continuar, siga por lá ou envie uma captura de tela com uma breve descrição para ${supportEmail}.`
                    : `Posso ajudar por aqui com orientações básicas, mas a caixa de suporte só é liberada quando o Job Finder fica disponível no painel e o pagamento de $9 é concluído com sucesso. Isso só acontece após perfil completo, documentos obrigatórios e aprovação admin. Se houver um problema técnico antes disso, envie uma captura de tela e uma breve descrição para ${supportEmail}.`;
            case "hi":
                return hasSupportAccess
                    ? `मैं यहाँ मदद कर सकता हूँ, और आपका support inbox भी ${website}/profile/worker/inbox dashboard में खुला है। अगर वही problem बार-बार आ रहा है, तो वहाँ जारी रखें या screenshot और short description ${supportEmail} पर भेजें।`
                    : `मैं यहाँ basic guidance दे सकता हूँ, लेकिन support inbox तभी unlock होता है जब Job Finder dashboard में available हो और $9 payment successfully complete हो। यह तभी होता है जब profile complete हो, required documents पूरे हों और admin approval मिल जाए। अगर उससे पहले technical problem है, तो screenshot और short description ${supportEmail} पर भेजें।`;
            default:
                return hasSupportAccess
                    ? `I can help here, and your support inbox is also open in the dashboard at ${website}/profile/worker/inbox. If the same issue keeps repeating, continue there or send a screenshot and a short description to ${supportEmail}.`
                    : `I can help with basic guidance here, but the support inbox unlocks only once Job Finder is available in the dashboard and the $9 payment has been completed successfully. That happens only after the profile is complete, the required documents are finished, and admin approval is done. If you have a technical problem before that, send a screenshot and a short description to ${supportEmail}.`;
        }
    }

    if (wantsStatus) {
        if (advancedStatusReply) {
            return advancedStatusReply;
        }

        switch (lang) {
            case "sr":
                if (entryFeePaid) {
                    return `Vaša Job Finder uplata je evidentirana. Sledeci korak i trenutni status pratite kroz dashboard na ${website}/profile/worker.`;
                }
                if (paymentReady) {
                    return `Vaš profil je odobren i checkout bi sada trebalo da bude dostupan u dashboard-u na ${website}/profile/worker. Sledeci korak je da uplatu pokrenete tamo.`;
                }
                if (pendingApproval) {
                    return `Vaš profil je trenutno u admin review fazi. Kada admin potvrdi profil, uplata ce se otključati u dashboard-u na ${website}/profile/worker.`;
                }
                return `Trenutni sledeci korak je da kroz dashboard na ${website}/profile/worker završite profil i obavezna dokumenta, pa zatim pratite admin review status tamo.`;
            case "ar":
                if (entryFeePaid) {
                    return `تم تسجيل دفعة Job Finder الخاصة بك. تابع الخطوة التالية والحالة الحالية من لوحة التحكم على ${website}/profile/worker.`;
                }
                if (paymentReady) {
                    return `تمت الموافقة على ملفك ويجب أن يكون checkout متاحًا الآن في لوحة التحكم على ${website}/profile/worker. الخطوة التالية هي بدء الدفع من هناك.`;
                }
                if (pendingApproval) {
                    return `ملفك حاليًا في مراجعة الإدارة. عندما تؤكد الإدارة الملف سيتم فتح الدفع في لوحة التحكم على ${website}/profile/worker.`;
                }
                return `الخطوة التالية الحالية هي إكمال الملف والمستندات المطلوبة من خلال لوحة التحكم على ${website}/profile/worker، ثم متابعة حالة مراجعة الإدارة هناك.`;
            case "fr":
                if (entryFeePaid) {
                    return `Votre paiement Job Finder est enregistré. Suivez la prochaine étape et le statut actuel dans le tableau de bord sur ${website}/profile/worker.`;
                }
                if (paymentReady) {
                    return `Votre profil est approuvé et le checkout devrait maintenant être disponible dans le tableau de bord sur ${website}/profile/worker. La prochaine étape est de démarrer le paiement depuis là-bas.`;
                }
                if (pendingApproval) {
                    return `Votre profil est actuellement en revue admin. Quand l’admin confirme le profil, le paiement se débloque dans le tableau de bord sur ${website}/profile/worker.`;
                }
                return `La prochaine étape actuelle est de terminer le profil et les documents requis via le tableau de bord sur ${website}/profile/worker, puis de suivre la revue admin là-bas.`;
            case "pt":
                if (entryFeePaid) {
                    return `Seu pagamento do Job Finder está registrado. Acompanhe o próximo passo e o status atual no painel em ${website}/profile/worker.`;
                }
                if (paymentReady) {
                    return `Seu perfil foi aprovado e o checkout agora deve estar disponível no painel em ${website}/profile/worker. O próximo passo é iniciar o pagamento por lá.`;
                }
                if (pendingApproval) {
                    return `Seu perfil está atualmente em revisão administrativa. Quando o admin confirmar o perfil, o pagamento será liberado no painel em ${website}/profile/worker.`;
                }
                return `O próximo passo agora é concluir o perfil e os documentos obrigatórios pelo painel em ${website}/profile/worker e depois acompanhar a revisão administrativa por lá.`;
            case "hi":
                if (entryFeePaid) {
                    return `आपका Job Finder payment दर्ज हो चुका है। अगला step और current status ${website}/profile/worker dashboard में देखें।`;
                }
                if (paymentReady) {
                    return `आपका profile approve हो चुका है और checkout अब ${website}/profile/worker dashboard में available होना चाहिए। अगला step वहीं से payment शुरू करना है।`;
                }
                if (pendingApproval) {
                    return `आपका profile इस समय admin review में है। जब admin profile confirm करेगा, payment dashboard में unlock हो जाएगा।`;
                }
                return `अभी अगला step ${website}/profile/worker dashboard में profile और required documents पूरा करना है, और फिर admin review status वहीं follow करना है।`;
            default:
                if (entryFeePaid) {
                    return `Your Job Finder payment is recorded. Please follow your current status and next step in the dashboard at ${website}/profile/worker.`;
                }
                if (paymentReady) {
                    return `Your profile is approved and checkout should now be available in the dashboard at ${website}/profile/worker. The next step is to start payment there.`;
                }
                if (pendingApproval) {
                    return `Your profile is currently in admin review. Once admin confirms it, payment will unlock in the dashboard at ${website}/profile/worker.`;
                }
                return `The current next step is to finish your profile and required documents through the dashboard at ${website}/profile/worker, and then follow your admin-review status there.`;
        }
    }

    if (asksSpecificAvailability) {
        switch (lang) {
            case "sr":
                return `Ne mogu da potvrdim konkretan otvoren posao preko WhatsApp-a. Workers United radi kroz vođeni matching proces, pa je najbolje da svoj status i sledece korake pratite kroz dashboard, a ovde mogu da objasnim proces ili pomognem oko statusa, dokumenata i uplate.`;
            case "ar":
                return `لا أستطيع تأكيد وظيفة محددة مفتوحة عبر WhatsApp. يعمل Workers United من خلال مطابقة موجهة، لذلك من الأفضل متابعة حالتك والخطوات التالية من خلال لوحة التحكم، ويمكنني هنا شرح العملية أو المساعدة بشأن الحالة أو المستندات أو الدفع.`;
            case "fr":
                return `Je ne peux pas confirmer une offre précise ouverte via WhatsApp. Workers United fonctionne avec un processus d’appariement guidé ; il vaut mieux suivre votre statut et les prochaines étapes dans le tableau de bord, et je peux ici expliquer le processus ou aider sur le statut, les documents ou le paiement.`;
            case "pt":
                return `Eu não posso confirmar uma vaga específica aberta pelo WhatsApp. A Workers United trabalha com um processo guiado de matching, então o melhor é acompanhar seu status e os próximos passos no painel, e por aqui eu posso explicar o processo ou ajudar com status, documentos e pagamento.`;
            case "hi":
                return `मैं WhatsApp पर किसी specific open job की पुष्टि नहीं कर सकता। Workers United guided matching process के ज़रिए काम करता है, इसलिए बेहतर है कि status और next steps dashboard में follow करें; यहाँ मैं process, status, documents या payment में मदद कर सकता हूँ।`;
            default:
                return `I cannot confirm a specific open job over WhatsApp. Workers United works through a guided matching process, so it is best to follow your status and next steps in the dashboard, and I can help here with the process, status, documents, or payment.`;
        }
    }

    if (wantsJobHelp) {
        switch (lang) {
            case "sr":
                return asksHowItWorks
                    ? `Workers United radi kroz vođeni matching proces: profil, dokumenta, admin approval, pa tek onda Job Finder checkout u dashboard-u i dalje pracenje statusa tamo. Ako želite, mogu odmah da pomognem oko statusa, dokumenata ili uplate.`
                    : `Mogu da pomognem oko sledeceg koraka. Ako želite, napišite da li vas zanima status, dokumenta, uplata ili kako proces dalje funkcioniše.`;
            case "ar":
                return asksHowItWorks
                    ? `يعمل Workers United من خلال مطابقة موجهة: الملف، ثم المستندات، ثم موافقة الإدارة، وبعدها فقط يفتح Checkout الخاص بـ Job Finder داخل لوحة التحكم مع متابعة الخطوات هناك. إذا أردت يمكنني الآن المساعدة بخصوص الحالة أو المستندات أو الدفع.`
                    : `يمكنني مساعدتك بخصوص الخطوة التالية. إذا أردت، أخبرني هل تريد معرفة الحالة أو المستندات أو الدفع أو كيف تستمر العملية.`;
            case "fr":
                return asksHowItWorks
                    ? `Workers United fonctionne avec un processus d’appariement guidé : profil, documents, validation admin, puis déblocage du checkout Job Finder dans le tableau de bord avec suivi des étapes là-bas. Si vous voulez, je peux aider tout de suite sur le statut, les documents ou le paiement.`
                    : `Je peux vous aider pour la prochaine étape. Si vous voulez, dites-moi si vous avez besoin du statut, des documents, du paiement, ou du fonctionnement du processus.`;
            case "pt":
                return asksHowItWorks
                    ? `A Workers United trabalha com um processo guiado de matching: perfil, documentos, aprovação administrativa, e só depois liberação do checkout do Job Finder no painel com acompanhamento dos próximos passos por lá. Se quiser, posso ajudar agora com status, documentos ou pagamento.`
                    : `Posso ajudar com o próximo passo. Se quiser, me diga se você precisa de ajuda com status, documentos, pagamento ou como o processo funciona.`;
            case "hi":
                return asksHowItWorks
                    ? `Workers United guided matching process के साथ काम करता है: profile, documents, admin approval, और उसके बाद dashboard में Job Finder checkout unlock होता है और next steps वहीं follow होते हैं। अगर चाहें तो मैं अभी status, documents या payment में मदद कर सकता हूँ।`
                    : `मैं अगले step में मदद कर सकता हूँ। अगर चाहें तो बताइए कि आपको status, documents, payment या process समझने में मदद चाहिए।`;
            default:
                return asksHowItWorks
                    ? `Workers United works through a guided matching process: profile, documents, admin approval, and only then Job Finder checkout unlocks in the dashboard with the next steps tracked there. If you want, I can help right away with status, documents, or payment.`
                    : `I can help with the next step. If you want, tell me whether you need help with status, documents, payment, or how the process works.`;
        }
    }

    return null;
}

export function buildWhatsAppAutoHandoffReply({
    language,
    hasSupportAccess,
    website = DEFAULT_PLATFORM_WEBSITE_URL,
    supportEmail = DEFAULT_PLATFORM_SUPPORT_EMAIL,
}: {
    language: string;
    hasSupportAccess: boolean;
    website?: string;
    supportEmail?: string;
}): string {
    ({ website, supportEmail } = normalizeWhatsAppPublicContact({ website, supportEmail }));
    const lang = getLanguageCodeFromLabel(language) || detectWhatsAppLanguageCode(language);

    if (!hasSupportAccess) {
        switch (lang) {
            case "sr":
                return `Vidim da se isti problem ponavlja. Nemam ovde otvoren support inbox za vaš nalog, zato pošaljite screenshot i kratak opis na ${supportEmail}, a status profila proverite i kroz ${website}/profile/worker.`;
            case "ar":
                return `أرى أن نفس المشكلة تتكرر. لا يوجد صندوق دعم مفتوح لهذا الحساب هنا، لذلك أرسل لقطة شاشة ووصفًا قصيرًا إلى ${supportEmail}، وتحقق أيضًا من حالة الملف عبر ${website}/profile/worker.`;
            case "fr":
                return `Je vois que le même problème se répète. Il n’y a pas de boîte de support ouverte pour ce compte ici, donc envoyez une capture d’écran et une courte description à ${supportEmail}, et vérifiez aussi le statut du profil via ${website}/profile/worker.`;
            case "pt":
                return `Vejo que o mesmo problema está se repetindo. Não há uma caixa de suporte liberada para esta conta aqui, então envie uma captura de tela com uma breve descrição para ${supportEmail} e também confira o status do perfil em ${website}/profile/worker.`;
            case "hi":
                return `मैं देख रहा हूँ कि वही problem बार-बार हो रहा है। इस account के लिए यहाँ support inbox खुला नहीं है, इसलिए screenshot और short description ${supportEmail} पर भेजें, और profile status ${website}/profile/worker में भी check करें।`;
            default:
                return `I can see the same issue is repeating. There is no support inbox unlocked for this account here, so please send a screenshot and a short description to ${supportEmail}, and also check your profile status at ${website}/profile/worker.`;
        }
    }

    switch (lang) {
        case "sr":
            return `Vidim da se isti problem ponavlja, pa sam ovu poruku prebacio i u vaš support inbox. Nastavite kroz ${website}/profile/worker/inbox ili ovde pošaljite jednu kratku dopunu ako treba.`;
        case "ar":
            return `أرى أن نفس المشكلة تتكرر، لذلك قمت أيضًا بإرسال هذه الرسالة إلى صندوق الدعم الخاص بك. تابع عبر ${website}/profile/worker/inbox أو أرسل هنا إضافة قصيرة إذا لزم الأمر.`;
        case "fr":
            return `Je vois que le même problème se répète, donc j’ai aussi enregistré ce message dans votre boîte de support. Continuez via ${website}/profile/worker/inbox ou envoyez ici un court complément si nécessaire.`;
        case "pt":
            return `Vejo que o mesmo problema está se repetindo, então também registrei esta mensagem na sua caixa de suporte. Continue por ${website}/profile/worker/inbox ou envie aqui uma breve atualização se precisar.`;
        case "hi":
            return `मैं देख रहा हूँ कि वही problem बार-बार हो रहा है, इसलिए मैंने यह message आपके support inbox में भी save कर दिया है। आगे ${website}/profile/worker/inbox से जारी रखें या ज़रूरत हो तो यहाँ एक short update भेजें।`;
        default:
            return `I can see the same issue is repeating, so I also saved this message into your support inbox. Please continue through ${website}/profile/worker/inbox or send one short update here if needed.`;
    }
}

export function buildCanonicalWhatsAppFacts({
    supportEmail = DEFAULT_PLATFORM_SUPPORT_EMAIL,
    website = DEFAULT_PLATFORM_WEBSITE_URL,
}: CanonicalWhatsAppFactsOptions = {}): string {
    ({ website, supportEmail } = normalizeWhatsAppPublicContact({ website, supportEmail }));
    return [
        "- Workers United is a full-service hiring and visa-support platform that works through guided matching.",
        "- Job Finder is a paid search service: the worker registers a profile first, then Workers United searches for a suitable match during the 90-day service period.",
        "- There is no live public vacancy feed to browse on demand. Openings appear over time, and suitable places can be filled quickly.",
        `- Registration starts at ${website}/signup.`,
        "- Job Finder payment unlocks only after the worker profile is fully complete, the required documents are finished, and admin approval is done.",
        "- WhatsApp can answer questions and, when the user explicitly asks, collect some text profile details here. Document uploads and screenshots are not processed as WhatsApp attachments yet; those belong in the dashboard.",
        "- Required worker documents are passport, biometric photo, and a final school, university, or formal vocational diploma.",
        "- Employers do not pay platform fees.",
        `- Support email: ${supportEmail}.`,
    ].join("\n");
}

export function buildWorkerWhatsAppRules({
    language,
    intent,
    confidence,
    reason,
    isAdmin,
    website = DEFAULT_PLATFORM_WEBSITE_URL,
    supportEmail = DEFAULT_PLATFORM_SUPPORT_EMAIL,
}: WorkerWhatsAppRulesOptions): string {
    ({ website, supportEmail } = normalizeWhatsAppPublicContact({ website, supportEmail }));
    return `IMPORTANT: You MUST reply in ${language}. Always match the language of the user's latest message.

Current routed intent: ${intent}
Router confidence: ${confidence}
Router reason: ${reason}

Rules:
1. Keep the reply concise: 1-3 short paragraphs max.
2. Answer the user's actual question first. Do not force a sales pitch.
3. If the user opens with only a greeting or a vague first contact, start warmly, explain in one short sentence that Workers United helps workers, employers, and agencies, and ask one simple clarifying question without assuming their role.
3a. If the user asks you to switch language, acknowledge that in one short sentence and continue fully in the requested language. Do not fall back to English after that.
4. Never imply that there is a list of jobs ready to browse right now. Explain Job Finder as a search-and-wait service when relevant.
5. If the user is not yet registered and asks how to start, tell them to register at ${website}/signup first. After signup they can continue either in the dashboard or here on WhatsApp.
6. Do NOT push payment before registration, full profile completion, required documents, and admin approval. If an unregistered user asks about price, explain the $9 service briefly, but say registration/profile/documents come first.
7. Do NOT share direct payment links from WhatsApp. If the worker is not payment-ready, never ask whether they want to activate/pay now. If the worker is truly payment-ready, tell them to open the dashboard and start checkout there.
8. If the user asks to see jobs before paying, explain simply that Workers United works through guided matching rather than a live public jobs list; the service is searching and waiting for the right match.
9. Do not lead with the guided-matching explanation unless the user asked how the process works or asked to see or confirm current openings.
10. If the user asks about documents, answer only the required documents and say uploads happen in the dashboard. Never claim WhatsApp attachments update the profile.
11. If the user asks about status, use only the provided snapshot and never invent missing data.
12. Never claim you escalated, forwarded screenshots, opened a ticket, prioritized a case, or that a human/technical team will reply unless the system has actually performed that action.
13. If the user wants human help or reports a bug, acknowledge it and direct them to the dashboard or ${website}/signup as appropriate, plus ${supportEmail}, but do not promise a live handoff and do not say you added notes to an internal case.
14. If the user already paid and asks for help, you may mention the support inbox in the dashboard as an option in addition to WhatsApp.
15. Ask at most one short follow-up question, and only when it helps move the conversation forward.
16. If someone says they are an agency or employer, do not collect worker personal profile fields from them.
17. Never invent legal rules, salaries, timelines, country promises, worker counts, current vacancies, or hidden internal actions.
18. Never start the reply with a symbol or a list marker.
19. ${isAdmin ? "This is the platform owner. If they give a correction, treat it as authoritative." : "Do not invent facts that are not in the canonical facts, the snapshot, or the stored memory."}`;
}

export function buildEmployerWhatsAppRules({
    language,
    isRegistered,
    companyName = "",
    contactName = "",
    employerStatus = "",
    website = DEFAULT_PLATFORM_WEBSITE_URL,
}: EmployerWhatsAppRulesOptions): string {
    website = normalizePlatformWebsiteUrl(website);
    const employerContext = isRegistered
        ? `Registered employer: YES\nCompany: ${companyName || "(unknown)"}\nContact: ${contactName || "(unknown)"}\nStatus: ${employerStatus || "unknown"}`
        : "Registered employer: NO (new contact)";

    return `IMPORTANT: You MUST reply in ${language}. Always match the language of the employer's latest message.

Employer context:
${employerContext}

Rules:
1. Speak only as an employer-hiring assistant. Never talk as if this person is looking for a job.
2. Keep the reply concise: 1-3 short paragraphs max.
3. Service is free for employers. Say that clearly if they ask about price.
4. If they open with only a greeting or a vague first contact, start warmly, explain in one short sentence that Workers United helps employers hire international workers, and ask one simple hiring question.
4a. If they ask to switch language, acknowledge it briefly and continue fully in that language.
5. Do not claim exact worker counts, origin countries, vacancy stock, or timelines unless those facts are explicitly supplied as verified system facts.
6. If they ask how to start, tell them to register the employer profile at ${website}/signup first. After signup, they can continue through the dashboard or here on WhatsApp over the same company record.
7. Ask only one next hiring question at a time: worker type, number of workers, work location, start date, salary, or housing.
8. Do not promise immediate availability. Explain that matching depends on fit and timing.
9. Do not mention worker-side pricing.
10. Never invent legal guarantees, salary bands, or current open roles.
11. Stay practical and operational: answer, then move them to the next concrete step.`;
}

export const SAFE_BRAIN_IMPROVEMENT_PROMPT = `You are improving Workers United carefully.

You may learn only low-risk conversational improvements, never new business facts.
Allowed categories:
- common_question
- error_fix
- copy_rule

Safe learning examples:
- users often ask to see jobs before paying
- when an agency identifies itself, do not ask worker personal questions
- keep first reply shorter and answer the first question before asking another
- if a user asks for a human, acknowledge it first and then continue

Unsafe learning examples:
- prices, fees, refunds, timelines, country promises, worker counts
- document requirements, legal rules, visa claims
- current vacancies, available workers, salary ranges
- anything with numbers, money, URLs, or country lists
`;

export function filterSafeBrainLearnings(candidates: BrainLearningCandidate[]): BrainLearningCandidate[] {
    const seen = new Set<string>();
    const filtered: BrainLearningCandidate[] = [];

    for (const candidate of candidates) {
        const category = candidate.category.trim();
        const content = normalizeBrainLearningContent(candidate.content);

        if (!SAFE_BRAIN_LEARNING_CATEGORIES.has(category)) continue;
        if (content.length < 24 || content.length > 220) continue;
        if (RISKY_BRAIN_LEARNING_PATTERNS.some((pattern) => pattern.test(content))) continue;

        const dedupeKey = `${category}::${content.toLowerCase()}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        filtered.push({ category, content });
    }

    return filtered;
}

export function filterSafeWhatsAppBrainMemory(entries: WhatsAppBrainMemoryEntry[]): WhatsAppBrainMemoryEntry[] {
    const safeEntries = filterSafeBrainLearnings(
        entries.map((entry) => ({
            category: entry.category,
            content: entry.content,
        }))
    );

    return safeEntries.map((safeEntry) => {
        const original = entries.find((entry) => entry.category === safeEntry.category && normalizeBrainLearningContent(entry.content) === safeEntry.content);
        return {
            category: safeEntry.category,
            content: safeEntry.content,
            confidence: original?.confidence ?? 0,
        };
    });
}
