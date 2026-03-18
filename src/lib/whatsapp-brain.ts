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

export interface BrainLearningCandidate {
    category: string;
    content: string;
}

export interface WhatsAppBrainMemoryEntry {
    category: string;
    content: string;
    confidence: number;
}

export type WhatsAppLanguageCode = "en" | "sr" | "ar" | "fr" | "pt" | "hi";

const WHATSAPP_ONBOARDING_PATTERN = /fill.*profile.*whatsapp|complete.*profile.*whatsapp|register.*whatsapp|whatsapp.*profile|whatsapp.*register|profile.*on whatsapp|popuni.*profil.*whatsapp|profil.*na whatsapp|registr.*preko whatsapp|registro.*whatsapp|perfil.*whatsapp/i;
const SERBIAN_LATIN_PATTERN = /\b(pozdrav|zdravo|cao|ćao|dobar dan|dobro vece|dobro veče|dobro jutro|hvala|molim|ocu|hoću|hocu|zelim|želim|posao|radnik|radim|koliko|kosta|košta|cena|cijena|dokumenti|pasos|pasoš|profil|status|red|odobren|uplata|platim|placanje|plaćanje|voza[cč]|gra[dđ]evin|skladi|magacin|spanij|nemack|nemačk|srpski|engleski|jezik|jezici)\b/i;
const EMPLOYER_LEAD_PATTERN = /\b(employer|company|business|firm|hire|hiring|recruit(ing|er)?|need workers|looking for workers|we need workers|we are hiring|poslodavac|firma|kompanija|zapo[sš]ljavamo|treba(?:ju)? nam radnici|tra[zž]imo radnike)\b/i;
const WORKER_LEAD_PATTERN = /\b(worker|job|work abroad|looking for a job|looking for work|need a job|i want a job|radnik|posao|tra[zž]im posao|ocu posao|ho[ćc]u posao|[zž]elim posao|radim kao|imam iskustva)\b/i;
const GREETING_ONLY_PATTERN = /^\s*(hi|hello|hey|good morning|good afternoon|good evening|pozdrav|zdravo|cao|ćao|dobar dan|dobro jutro|dobro vece|dobro veče|selam|salam|bonjour|salut|ola|olá|namaste)\s*[.!?]*\s*$/i;
const PRICE_HINT_PATTERN = /\b(price|cost|fee|payment|pay|koliko|kosta|košta|cena|cijena|platim|platiti|uplata|placanje|plaćanje)\b/i;
const DOCUMENT_HINT_PATTERN = /\b(document|documents|passport|diploma|photo|upload|verification|dokumenti|dokumenta|pasos|pasoš|diploma|slika|fotografija|upload|verifikacija)\b/i;
const STATUS_HINT_PATTERN = /\b(status|profile|approval|approved|queue|support|profil|odobren|odobreno|red|podrska|podrška)\b/i;
const JOB_HINT_PATTERN = /\b(ima li|postoji li|any job|available job|vacancy|vacancies|job for|posao za|ocu posao|ho[ćc]u posao|tra[zž]im posao|looking for work|looking for a job)\b/i;
const SPECIFIC_AVAILABILITY_HINT_PATTERN = /\b(ima li|postoji li|any job|available job|vacancy|vacancies|job for|posao za|open job|open position|what jobs|which jobs|koji poslovi|lista poslova|available workers list)\b/i;
const PROCESS_HINT_PATTERN = /\b(how does it work|how it works|process|steps|next step|how do i start|kako radi|kako funkcioni[sš]e|kako ide|koji su koraci|sledeci korak|sledeći korak|kako da krenem)\b/i;

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
    if (/\b(bonjour|salut|emploi|travail|merci|oui|non)\b/i.test(normalized)) return "fr";
    if (/\b(olá|ola|emprego|trabalho|obrigado|sim|não|nao)\b/i.test(normalized)) return "pt";
    if (/[\u0400-\u04FF]/.test(message) || /[čćžšđ]/i.test(message) || SERBIAN_LATIN_PATTERN.test(normalized)) return "sr";

    return "en";
}

export function resolveWhatsAppLanguageName(message: string, detectedLanguage?: string | null): string {
    const quickCode = detectWhatsAppLanguageCode(message);
    const detectedCode = getLanguageCodeFromLabel(detectedLanguage);

    if (!detectedCode) {
        return getLanguageName(quickCode);
    }

    if (quickCode !== "en" && detectedCode !== quickCode) {
        return getLanguageName(quickCode);
    }

    return getLanguageName(detectedCode);
}

export function looksLikeEmployerWhatsAppLead(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return EMPLOYER_LEAD_PATTERN.test(normalized) && !WORKER_LEAD_PATTERN.test(normalized);
}

export function looksLikeWorkerWhatsAppLead(message: string): boolean {
    return WORKER_LEAD_PATTERN.test(message.trim().toLowerCase());
}

export function looksLikeGreetingOnlyWhatsAppMessage(message: string): boolean {
    return GREETING_ONLY_PATTERN.test(message.trim());
}

export function buildUnregisteredWorkerWhatsAppReply({
    message,
    language,
    intent,
    website = "workersunited.eu",
    supportEmail = "contact@workersunited.eu",
    requiredDocuments = "passport, diploma or work certificate, and biometric photo",
    isFirstContact = false,
}: {
    message: string;
    language: string;
    intent: string;
    website?: string;
    supportEmail?: string;
    requiredDocuments?: string;
    isFirstContact?: boolean;
}): string | null {
    const normalized = message.trim().toLowerCase();
    const lang = getLanguageCodeFromLabel(language) || detectWhatsAppLanguageCode(message);
    const isGreetingOnly = looksLikeGreetingOnlyWhatsAppMessage(message);
    const wantsPrice = intent === "price" || PRICE_HINT_PATTERN.test(normalized);
    const wantsDocuments = intent === "documents" || DOCUMENT_HINT_PATTERN.test(normalized);
    const wantsStatus = intent === "status" || intent === "support" || STATUS_HINT_PATTERN.test(normalized);
    const asksSpecificAvailability = SPECIFIC_AVAILABILITY_HINT_PATTERN.test(normalized);
    const asksHowItWorks = PROCESS_HINT_PATTERN.test(normalized);
    const wantsJobHelp = intent === "job_intent" || intent === "general" || JOB_HINT_PATTERN.test(normalized) || looksLikeWorkerWhatsAppLead(message);

    if (isFirstContact && isGreetingOnly && !wantsPrice && !wantsDocuments && !wantsStatus) {
        switch (lang) {
            case "sr":
                return `Pozdrav! Ja sam Workers United WhatsApp asistent. Pomažemo radnicima kroz proces posla i vize, poslodavcima u pronalaženju radnika, a agencijama u vođenju kandidata kroz platformu.\n\nRecite mi samo jednu stvar: da li tražite posao, radnike ili vodite agenciju, pa ću vas uputiti na sledeći korak.`;
            case "ar":
                return `مرحبًا! أنا مساعد Workers United على WhatsApp. نحن نساعد العمال خلال مسار العمل والتأشيرة، ونساعد أصحاب العمل في العثور على العمال، كما نساعد الوكالات في إدارة المرشحين عبر المنصة.\n\nأخبرني فقط بشيء واحد: هل تبحث عن عمل، أم عن عمال، أم أنك تدير وكالة؟ وبعدها سأوجهك إلى الخطوة التالية.`;
            case "fr":
                return `Bonjour ! Je suis l’assistant WhatsApp de Workers United. Nous aidons les travailleurs dans le processus d’emploi et de visa, les employeurs à trouver des travailleurs, et les agences à gérer leurs candidats sur la plateforme.\n\nDites-moi simplement une chose : cherchez-vous un emploi, des travailleurs, ou gérez-vous une agence ? Ensuite je vous orienterai vers la prochaine étape.`;
            case "pt":
                return `Olá! Eu sou o assistente de WhatsApp da Workers United. Nós ajudamos trabalhadores no processo de emprego e visto, empregadores a encontrar trabalhadores, e agências a gerenciar candidatos pela plataforma.\n\nMe diga só uma coisa: você está procurando trabalho, trabalhadores, ou administra uma agência? Aí eu te direciono para o próximo passo.`;
            case "hi":
                return `नमस्ते! मैं Workers United का WhatsApp assistant हूँ। हम workers को job और visa process में, employers को workers ढूँढने में, और agencies को candidates manage करने में मदद करते हैं.\n\nमुझे बस एक बात बताइए: क्या आप job ढूँढ रहे हैं, workers ढूँढ रहे हैं, या agency चलाते हैं? उसके बाद मैं आपको अगला step बताऊँगा।`;
            default:
                return `Hello! I’m the Workers United WhatsApp assistant. We help workers through the job and visa process, employers find workers, and agencies manage candidates through the platform.\n\nJust tell me one thing: are you looking for a job, looking for workers, or running an agency? Then I’ll point you to the right next step.`;
        }
    }

    if (wantsPrice) {
        switch (lang) {
            case "sr":
                return `Job Finder košta $9, ali se to ne plaća odmah. Prvo napravite nalog na ${website}/signup i završite profil; checkout se otključava tek kada profil bude kompletan i admin ga odobri, a uplata se pokreće iz dashboard-a, ne preko WhatsApp-a.`;
            case "ar":
                return `تكلفة Job Finder هي $9، لكن ذلك لا يُدفع فورًا. أنشئ حسابك أولاً على ${website}/signup وأكمل ملفك؛ يتم فتح الدفع فقط بعد اكتمال الملف وموافقة الإدارة، ويبدأ الدفع من لوحة التحكم وليس عبر WhatsApp.`;
            case "fr":
                return `Job Finder coûte $9, mais ce n’est pas à payer immédiatement. Créez d’abord votre compte sur ${website}/signup et complétez votre profil ; le paiement ne s’ouvre qu’après profil complet et validation admin, et il démarre depuis le tableau de bord, pas via WhatsApp.`;
            case "pt":
                return `O Job Finder custa $9, mas isso não é pago imediatamente. Primeiro crie sua conta em ${website}/signup e complete seu perfil; o checkout só é liberado após perfil completo e aprovação admin, e o pagamento começa no painel, não pelo WhatsApp.`;
            case "hi":
                return `Job Finder की कीमत $9 है, लेकिन यह तुरंत pay नहीं किया जाता। पहले ${website}/signup पर account बनाइए और profile पूरा कीजिए; checkout तभी unlock होता है जब profile complete हो और admin approve करे, और payment dashboard से शुरू होता है, WhatsApp से नहीं।`;
            default:
                return `Job Finder costs $9, but that is not paid immediately. First create your account at ${website}/signup and complete your profile; checkout unlocks only after the profile is complete and admin approves it, and payment starts from the dashboard, not through WhatsApp.`;
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

export function buildCanonicalWhatsAppFacts({
    supportEmail = "contact@workersunited.eu",
    website = "workersunited.eu",
}: CanonicalWhatsAppFactsOptions = {}): string {
    return [
        "- Workers United is a full-service hiring and visa-support platform that works through guided matching.",
        "- Job Finder is a paid search service: the worker registers a profile first, then Workers United searches for a suitable match during the 90-day service period.",
        "- There is no live public vacancy feed to browse on demand. Openings appear over time, and suitable places can be filled quickly.",
        `- Registration starts at ${website}/signup.`,
        "- Job Finder payment unlocks only after the worker profile is fully complete and approved by admin.",
        "- WhatsApp can answer questions and, when the user explicitly asks, collect some text profile details here. Document uploads and screenshots are not processed as WhatsApp attachments yet; those belong in the dashboard.",
        "- Required worker documents are passport, diploma or work certificate, and biometric photo.",
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
    website = "workersunited.eu",
    supportEmail = "contact@workersunited.eu",
}: WorkerWhatsAppRulesOptions): string {
    return `IMPORTANT: You MUST reply in ${language}. Always match the language of the user's latest message.

Current routed intent: ${intent}
Router confidence: ${confidence}
Router reason: ${reason}

Rules:
1. Keep the reply concise: 1-3 short paragraphs max.
2. Answer the user's actual question first. Do not force a sales pitch.
3. If the user opens with only a greeting or a vague first contact, start warmly, explain in one short sentence that Workers United helps workers, employers, and agencies, and ask one simple clarifying question without assuming their role.
4. Never imply that there is a list of jobs ready to browse right now. Explain Job Finder as a search-and-wait service when relevant.
5. If the user is not yet registered and asks how to start, tell them to register at ${website}/signup first. After signup they can continue either in the dashboard or here on WhatsApp.
6. Do NOT push payment before registration, full profile completion, and admin approval. If an unregistered user asks about price, explain the $9 service briefly, but say registration/profile comes first.
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
    website = "workersunited.eu",
}: EmployerWhatsAppRulesOptions): string {
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
