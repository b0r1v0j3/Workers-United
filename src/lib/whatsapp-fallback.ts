import { detectWhatsAppLanguageCode, looksLikeWarmGreetingWhatsAppMessage } from "@/lib/whatsapp-brain";
import { isWorkerPaymentUnlocked } from "@/lib/whatsapp-reply-guardrails";
import { getPlatformConfig } from "@/lib/platform-config";

type WhatsAppFallbackLanguage = "sr" | "ne" | "ar" | "fr" | "pt" | "en";

interface WhatsAppFallbackWorkerLike {
    status?: string | null;
    queue_position?: number | null;
    entry_fee_paid?: boolean | null;
    admin_approved?: boolean | null;
    queue_joined_at?: string | null;
}

interface WhatsAppFallbackProfileLike {
    full_name?: string | null;
}

function resolveFallbackLanguage(message: string): WhatsAppFallbackLanguage {
    const detectedLanguage = detectWhatsAppLanguageCode(message);
    return (detectedLanguage === "hi" ? "ne" : detectedLanguage) as WhatsAppFallbackLanguage;
}

export async function getWhatsAppFallbackResponse(
    message: string,
    workerRecord: WhatsAppFallbackWorkerLike | null,
    profile: WhatsAppFallbackProfileLike | null
): Promise<string> {
    const msg = message.toLowerCase().trim();
    const name = profile?.full_name?.split(" ")[0] || "there";
    const config = await getPlatformConfig();

    const entryFee = config.entry_fee || "$9";
    const website = config.website_url || "workersunited.eu";
    const greetingEn = config.bot_greeting_en || "Welcome to Workers United! 🌍 We help workers through the full job-search and visa process in Europe.";
    const greetingSr = config.bot_greeting_sr || "Dobrodošli u Workers United! 🌍 Pomažemo radnicima kroz ceo proces traženja posla i vize u Evropi.";
    const fallbackLang = resolveFallbackLanguage(message);

    const greetings: Record<WhatsAppFallbackLanguage, string> = {
        sr: greetingSr,
        ne: "Workers United मा स्वागत छ! 🌍 हामी युरोपमा काम खोज्न र भिसा प्रक्रियामा मद्दत गर्छौं।",
        ar: "مرحباً بك في Workers United! 🌍 نساعد العمال في إيجاد وظائف في أوروبا وإجراءات التأشيرة.",
        fr: "Bienvenue chez Workers United! 🌍 Nous aidons les travailleurs à trouver des emplois en Europe.",
        pt: "Bem-vindo à Workers United! 🌍 Ajudamos trabalhadores a encontrar empregos na Europa.",
        en: greetingEn,
    };

    const startMessages: Record<WhatsAppFallbackLanguage, string> = {
        sr: `Registrujte se na ${website}/signup i popunite profil. Posle registracije možete nastaviti pitanja ovde na WhatsApp-u, ali profil i dokumenta završavate kroz dashboard. Job Finder se otključava tek kada je profil kompletan i admin ga odobri.`,
        ne: `${website}/signup मा खाता बनाउनुहोस् र प्रोफाइल पूरा गर्नुहोस्। दर्ता भएपछि प्रश्नहरू यहाँ WhatsApp मा गर्न सक्नुहुन्छ, तर प्रोफाइल र कागजातहरू ड्यासबोर्डमार्फत पूरा हुन्छन्। Job Finder प्रोफाइल पूरा भएर admin approval भएपछि मात्र खुल्छ।`,
        ar: `أنشئ حسابك على ${website}/signup وأكمل ملفك الشخصي. بعد التسجيل يمكنك متابعة الأسئلة هنا على WhatsApp، لكن الملف والمستندات تُستكمل من لوحة التحكم. يتم فتح Job Finder فقط بعد اكتمال الملف وموافقة الإدارة.`,
        fr: `Créez votre compte sur ${website}/signup et complétez votre profil. Après inscription, vous pouvez poser vos questions ici sur WhatsApp, mais le profil et les documents se terminent dans le tableau de bord. Job Finder ne s’ouvre qu’après profil complet et validation admin.`,
        pt: `Crie sua conta em ${website}/signup e complete seu perfil. Depois do registro, você pode continuar com perguntas aqui no WhatsApp, mas o perfil e os documentos são concluídos no painel. O Job Finder só é liberado após perfil completo e aprovação administrativa.`,
        en: `Create your account at ${website}/signup and complete your profile. After signup, you can keep asking questions here on WhatsApp, but profile completion and document uploads happen in the dashboard. Job Finder unlocks only after the profile is complete and admin approves it.`,
    };

    const greeting = greetings[fallbackLang] || greetings.en;
    const startMessage = startMessages[fallbackLang] || startMessages.en;
    const isWarmGreeting = looksLikeWarmGreetingWhatsAppMessage(message);

    if (msg.includes("price") || msg.includes("cost") || msg.includes("fee") || msg.includes("payment") || msg.includes("cena") || msg.includes("cijena") || msg.includes("koliko") || msg.includes("शुल्क") || msg.includes("سعر")) {
        if (!workerRecord) {
            if (fallbackLang === "sr") return `Zdravo ${name}! Job Finder košta ${entryFee}, ali uplata se ne otključava odmah. Prvo napravite profil na ${website}/signup, popunite ga do kraja i sačekajte admin odobrenje; tek tada se otvara checkout. Ako ne pronađemo posao u roku od 90 dana, iznos se vraća u potpunosti.`;
            if (fallbackLang === "ne") return `नमस्ते ${name}! Job Finder को शुल्क ${entryFee} हो, तर भुक्तानी तुरुन्त खुल्दैन। पहिले ${website}/signup मा प्रोफाइल बनाउनुहोस्, पूरा गर्नुहोस्, अनि admin approval पछि मात्र checkout खुल्छ। ९० दिनभित्र काम नपाए पूरा फिर्ता हुन्छ।`;
            if (fallbackLang === "ar") return `مرحباً ${name}! تكلفة Job Finder هي ${entryFee}، لكن الدفع لا يُفتح فورًا. أنشئ ملفك أولاً على ${website}/signup وأكمله بالكامل ثم انتظر موافقة الإدارة، وبعدها فقط يفتح الدفع. إذا لم نجد وظيفة خلال 90 يومًا فسيتم رد المبلغ بالكامل.`;
            return `Hi ${name}! Job Finder costs ${entryFee}, but payment does not unlock immediately. First create your profile at ${website}/signup, complete it fully, and wait for admin approval; only then does checkout unlock. If no job is found within 90 days, the full amount is refunded.`;
        }

        if (workerRecord.entry_fee_paid) {
            if (fallbackLang === "sr") return `Zdravo ${name}! Vaša Job Finder uplata je već evidentirana. Sledeći korak i status možete pratiti na ${website}/profile/worker.`;
            if (fallbackLang === "ne") return `नमस्ते ${name}! तपाईंको Job Finder भुक्तानी पहिले नै evidentirana छ। अर्को चरण र status ${website}/profile/worker मा हेर्नुहोस्।`;
            if (fallbackLang === "ar") return `مرحباً ${name}! تم تسجيل دفعة Job Finder بالفعل. يمكنك متابعة الحالة والخطوة التالية على ${website}/profile/worker.`;
            return `Hi ${name}! Your Job Finder payment is already recorded. You can follow the next step and your status at ${website}/profile/worker.`;
        }

        if (!isWorkerPaymentUnlocked(workerRecord)) {
            if (fallbackLang === "sr") return `Zdravo ${name}! Checkout za Job Finder još nije otključan. Potrebno je da profil bude kompletan i da prođe admin review; zatim pokrećete bezbednu uplatu iz dashboard-a na ${website}/profile/worker.`;
            if (fallbackLang === "ne") return `नमस्ते ${name}! Job Finder checkout अझै खुलेको छैन। प्रोफाइल पूरा भई admin review पास भएपछि मात्र ${website}/profile/worker ड्यासबोर्डबाट सुरक्षित भुक्तानी सुरु हुन्छ।`;
            if (fallbackLang === "ar") return `مرحباً ${name}! لم يتم فتح Checkout الخاص بـ Job Finder بعد. يجب أن يكتمل الملف ويمر بمراجعة الإدارة أولاً، ثم تبدأ الدفع الآمن من لوحة التحكم على ${website}/profile/worker.`;
            return `Hi ${name}! Job Finder checkout is not unlocked yet. Your profile must be complete and pass admin review first; after that, you start the secure payment from the dashboard at ${website}/profile/worker.`;
        }

        if (fallbackLang === "sr") return `Zdravo ${name}! Job Finder je spreman za aktivaciju. Otvorite dashboard na ${website}/profile/worker i odatle pokrenite bezbedan checkout za ${entryFee}. Ako ne pronađemo posao u roku od 90 dana, iznos se vraća u potpunosti.`;
        if (fallbackLang === "ne") return `नमस्ते ${name}! Job Finder अब activate गर्न तयार छ। ${website}/profile/worker ड्यासबोर्ड खोल्नुहोस् र त्यहाँबाट ${entryFee} को सुरक्षित checkout सुरु गर्नुहोस्। ९० दिनभित्र काम नपाए पूरा फिर्ता हुन्छ।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! أصبح Job Finder جاهزًا للتفعيل. افتح لوحة التحكم على ${website}/profile/worker وابدأ الدفع الآمن من هناك مقابل ${entryFee}. إذا لم نجد وظيفة خلال 90 يومًا فسيتم رد المبلغ بالكامل.`;
        return `Hi ${name}! Job Finder is ready to activate. Open your dashboard at ${website}/profile/worker and start the secure checkout there for ${entryFee}. If we do not find you a job within 90 days, the full amount is refunded.`;
    }

    if (!workerRecord && isWarmGreeting) {
        if (fallbackLang === "sr") return `Zdravo ${name}! Ja sam Workers United AI asistent. Mogu da pomognem oko posla, dokumenata, statusa profila ili sledećeg koraka. Samo mi napišite šta vas zanima.`;
        if (fallbackLang === "ne") return `नमस्ते ${name}! म Workers United AI assistant हुँ। म job, documents, profile status, वा next step बारे मद्दत गर्न सक्छु। के चाहिएको हो मलाई लेख्नुहोस्।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! أنا مساعد الذكاء الاصطناعي من Workers United. يمكنني المساعدة بخصوص الوظائف أو المستندات أو حالة الملف أو الخطوة التالية. فقط اكتب لي ما الذي تريد معرفته.`;
        return `Hello ${name}! I’m the Workers United AI assistant. I can help with jobs, documents, profile status, or the next step. Just tell me what you want to check.`;
    }

    if (!workerRecord) {
        return `${greeting} ${startMessage}`;
    }

    if (isWarmGreeting) {
        if (fallbackLang === "sr") return `Zdravo ${name}! Ja sam Workers United AI asistent. Mogu da pomognem oko vašeg statusa, dokumenata, uplate ili sledećeg koraka. Samo napišite šta želite da proverimo.`;
        if (fallbackLang === "ne") return `नमस्ते ${name}! म Workers United AI assistant हुँ। म तपाईंको status, documents, payment, वा next step मा मद्दत गर्न सक्छु। के check गर्न चाहनुहुन्छ लेख्नुहोस्।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! أنا مساعد الذكاء الاصطناعي من Workers United. يمكنني مساعدتك بخصوص حالتك أو المستندات أو الدفع أو الخطوة التالية. فقط اكتب لي ما الذي تريد التحقق منه.`;
        return `Hello ${name}! I’m the Workers United AI assistant. I can help with your status, documents, payment, or next step. Just tell me what you want to check.`;
    }

    if (msg.includes("status") || msg.includes("profile") || msg.includes("stanje") || msg.includes("profil") || msg.includes("स्थिति") || msg.includes("حالة")) {
        const statusInfo = workerRecord.status === "REGISTERED" ? "registered ✅" : workerRecord.status;
        const queueInfo = workerRecord.queue_position ? ` Queue position: #${workerRecord.queue_position}.` : "";
        if (fallbackLang === "sr") return `Zdravo ${name}! Vaš status je: ${statusInfo}.${queueInfo} Detalje možete videti na ${website}/profile/worker.`;
        if (fallbackLang === "ne") return `नमस्ते ${name}! तपाईंको स्थिति: ${statusInfo}.${queueInfo} विवरण ${website}/profile/worker मा हेर्नुहोस्।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! حالتك: ${statusInfo}.${queueInfo} يمكنك رؤية التفاصيل على ${website}/profile/worker.`;
        return `Hi ${name}! Your status is: ${statusInfo}.${queueInfo} You can see full details at ${website}/profile/worker.`;
    }

    if (msg.includes("document") || msg.includes("passport") || msg.includes("dokument") || msg.includes("pasos") || msg.includes("पासपोर्ट") || msg.includes("جواز")) {
        if (fallbackLang === "sr") return `Zdravo ${name}! Dokumenta uploadujete na ${website}/profile/worker. Potrebni su: pasoš, biometrijska fotografija i završna školska, univerzitetska ili formalna stručna diploma. WhatsApp prilozi se trenutno ne vezuju automatski za profil.`;
        if (fallbackLang === "ne") return `नमस्ते ${name}! कागजातहरू ${website}/profile/worker मा अपलोड गर्नुहोस्। आवश्यक: पासपोर्ट, बायोमेट्रिक फोटो, र final school, university, वा formal vocational diploma। WhatsApp attachment हरू अहिले प्रोफाइलसँग स्वतः जोडिँदैनन्।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! يمكنك رفع المستندات على ${website}/profile/worker. المطلوب: جواز السفر، الصورة البيومترية، والدبلومة النهائية المدرسية أو الجامعية أو المهنية الرسمية. مرفقات WhatsApp لا ترتبط بالملف تلقائيًا حاليًا.`;
        return `Hi ${name}! Upload documents at ${website}/profile/worker. We need: passport, biometric photo, and a final school, university, or formal vocational diploma. WhatsApp attachments are not linked to the profile automatically yet.`;
    }

    if (fallbackLang === "sr") return `Zdravo ${name}! 👋 ${startMessage}`;
    if (fallbackLang === "ne") return `नमस्ते ${name}! 👋 ${startMessage}`;
    if (fallbackLang === "ar") return `مرحباً ${name}! 👋 ${startMessage}`;
    return `Hi ${name}! 👋 ${startMessage}`;
}
