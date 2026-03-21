import {
    detectExplicitWhatsAppLanguagePreference,
    looksLikeWhatsAppDocumentQuestion,
    looksLikeWhatsAppPriceQuestion,
    looksLikeWhatsAppStatusQuestion,
    looksLikeWarmGreetingWhatsAppMessage,
    type WhatsAppLanguageHistoryEntry,
    resolveWhatsAppLanguageCode,
} from "@/lib/whatsapp-brain";
import { isWorkerPaymentUnlocked } from "@/lib/whatsapp-reply-guardrails";
import { getPlatformConfig, getPlatformContactInfoFromConfig } from "@/lib/platform-config";

type WhatsAppFallbackLanguage = "sr" | "hi" | "ar" | "fr" | "pt" | "en";

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

function resolveFallbackLanguage(
    message: string,
    preferredLanguage?: string | null,
    historyMessages: WhatsAppLanguageHistoryEntry[] = []
): WhatsAppFallbackLanguage {
    return resolveWhatsAppLanguageCode(message, preferredLanguage, historyMessages) as WhatsAppFallbackLanguage;
}

function getFallbackStatusLabel(
    status: string | null | undefined,
    language: WhatsAppFallbackLanguage
): string {
    const normalized = (status || "").trim().toUpperCase();
    const humanized = normalized.toLowerCase().replace(/_/g, " ").trim();

    switch (normalized) {
        case "REGISTERED":
        case "NEW":
            return language === "sr"
                ? "profil je započet"
                : language === "fr"
                    ? "profil démarré"
                    : language === "pt"
                        ? "perfil iniciado"
                        : language === "hi"
                            ? "प्रोफाइल शुरू हो चुका है"
                            : language === "ar"
                                ? "تم بدء الملف"
                                : "profile started";
        case "PROFILE_COMPLETE":
            return language === "sr"
                ? "profil je kompletan"
                : language === "fr"
                    ? "profil complet"
                    : language === "pt"
                        ? "perfil completo"
                        : language === "hi"
                            ? "प्रोफाइल पूरा है"
                            : language === "ar"
                                ? "الملف مكتمل"
                                : "profile complete";
        case "VERIFIED":
            return language === "sr"
                ? "profil je verifikovan"
                : language === "fr"
                    ? "profil vérifié"
                    : language === "pt"
                        ? "perfil verificado"
                        : language === "hi"
                            ? "प्रोफाइल verify हो चुका है"
                            : language === "ar"
                                ? "تم التحقق من الملف"
                                : "profile verified";
        case "PENDING_APPROVAL":
            return language === "sr"
                ? "profil je u admin proveri"
                : language === "fr"
                    ? "profil en validation admin"
                    : language === "pt"
                        ? "perfil em revisão administrativa"
                        : language === "hi"
                            ? "प्रोफाइल admin review में है"
                            : language === "ar"
                                ? "الملف قيد مراجعة الإدارة"
                                : "profile in admin review";
        case "APPROVED":
            return language === "sr"
                ? "profil je odobren"
                : language === "fr"
                    ? "profil approuvé"
                    : language === "pt"
                        ? "perfil aprovado"
                        : language === "hi"
                            ? "प्रोफाइल approved है"
                            : language === "ar"
                                ? "تمت الموافقة على الملف"
                                : "profile approved";
        case "IN_QUEUE":
            return language === "sr"
                ? "aktivan u redu čekanja"
                : language === "fr"
                    ? "actif dans la file d’attente"
                    : language === "pt"
                        ? "ativo na fila"
                        : language === "hi"
                            ? "queue में सक्रिय"
                        : language === "ar"
                                ? "نشط في قائمة الانتظار"
                                : "active in queue";
        case "OFFER_PENDING":
            return language === "sr"
                ? "slučaj je u fazi ponude"
                : language === "fr"
                    ? "dossier à l’étape de l’offre"
                    : language === "pt"
                        ? "caso na etapa da oferta"
                        : language === "hi"
                            ? "case offer stage में है"
                            : language === "ar"
                                ? "الحالة في مرحلة العرض"
                                : "case in the offer stage";
        case "OFFER_ACCEPTED":
            return language === "sr"
                ? "ponuda je prihvaćena"
                : language === "fr"
                    ? "offre acceptée"
                    : language === "pt"
                        ? "oferta aceita"
                        : language === "hi"
                            ? "offer accept हो चुकी है"
                            : language === "ar"
                                ? "تم قبول العرض"
                                : "offer accepted";
        case "VISA_PROCESS_STARTED":
            return language === "sr"
                ? "vizni proces je u toku"
                : language === "fr"
                    ? "procédure de visa en cours"
                    : language === "pt"
                        ? "processo de visto em andamento"
                        : language === "hi"
                            ? "visa process चल रहा है"
                            : language === "ar"
                                ? "إجراءات التأشيرة جارية"
                                : "visa process in progress";
        case "VISA_APPROVED":
            return language === "sr"
                ? "viza je odobrena"
                : language === "fr"
                    ? "visa approuvé"
                    : language === "pt"
                        ? "visto aprovado"
                        : language === "hi"
                            ? "visa approve हो चुका है"
                            : language === "ar"
                                ? "تمت الموافقة على التأشيرة"
                                : "visa approved";
        case "PLACED":
            return language === "sr"
                ? "placement je završen"
                : language === "fr"
                    ? "placement finalisé"
                    : language === "pt"
                        ? "colocação concluída"
                        : language === "hi"
                            ? "placement complete है"
                            : language === "ar"
                                ? "تم إنهاء التوظيف"
                                : "placement completed";
        case "REFUND_FLAGGED":
            return language === "sr"
                ? "refund je u proveri"
                : language === "fr"
                    ? "remboursement en revue"
                    : language === "pt"
                        ? "reembolso em revisão"
                        : language === "hi"
                            ? "refund review में है"
                            : language === "ar"
                                ? "الاسترداد قيد المراجعة"
                                : "refund in review";
        case "REJECTED":
            return language === "sr"
                ? "profil zahteva ispravke"
                : language === "fr"
                    ? "profil nécessite des corrections"
                    : language === "pt"
                        ? "perfil precisa de correções"
                        : language === "hi"
                            ? "प्रोफाइल में सुधार चाहिए"
                        : language === "ar"
                                ? "الملف يحتاج إلى تصحيحات"
                                : "profile needs corrections";
        default:
            return humanized
                ? humanized
                : language === "sr"
                    ? "status je ažuriran"
                    : language === "fr"
                        ? "statut mis à jour"
                        : language === "pt"
                            ? "status atualizado"
                            : language === "hi"
                                ? "status update हुआ है"
                                : language === "ar"
                                    ? "تم تحديث الحالة"
                                    : "status updated";
    }
}

function getFallbackQueueInfo(
    queuePosition: number | null | undefined,
    language: WhatsAppFallbackLanguage
): string {
    if (!queuePosition) {
        return "";
    }

    switch (language) {
        case "sr":
            return ` Pozicija u redu: #${queuePosition}.`;
        case "fr":
            return ` Position dans la file: #${queuePosition}.`;
        case "pt":
            return ` Posição na fila: #${queuePosition}.`;
        case "hi":
            return ` Queue position: #${queuePosition}.`;
        case "ar":
            return ` الترتيب في القائمة: #${queuePosition}.`;
        default:
            return ` Queue position: #${queuePosition}.`;
    }
}

export async function getWhatsAppFallbackResponse(
    message: string,
    workerRecord: WhatsAppFallbackWorkerLike | null,
    profile: WhatsAppFallbackProfileLike | null,
    preferredLanguage?: string | null,
    historyMessages: WhatsAppLanguageHistoryEntry[] = []
): Promise<string> {
    const msg = message.toLowerCase().trim();
    const name = profile?.full_name?.split(" ")[0] || "there";
    const config = await getPlatformConfig();
    const contactInfo = getPlatformContactInfoFromConfig(config);

    const entryFee = config.entry_fee || "$9";
    const website = contactInfo.websiteUrl;
    const greetingEn = config.bot_greeting_en || "Welcome to Workers United! 🌍 We help workers through the full job-search and visa process in Europe.";
    const greetingSr = config.bot_greeting_sr || "Dobrodošli u Workers United! 🌍 Pomažemo radnicima kroz ceo proces traženja posla i vize u Evropi.";
    const fallbackLang = resolveFallbackLanguage(message, preferredLanguage, historyMessages);
    const explicitLanguagePreference = detectExplicitWhatsAppLanguagePreference(message);

    const greetings: Record<WhatsAppFallbackLanguage, string> = {
        sr: greetingSr,
        hi: "Workers United में आपका स्वागत है! 🌍 हम यूरोप में नौकरी खोजने और वीज़ा प्रक्रिया में मदद करते हैं।",
        ar: "مرحباً بك في Workers United! 🌍 نساعد العمال في إيجاد وظائف في أوروبا وإجراءات التأشيرة.",
        fr: "Bienvenue chez Workers United! 🌍 Nous aidons les travailleurs à trouver des emplois en Europe.",
        pt: "Bem-vindo à Workers United! 🌍 Ajudamos trabalhadores a encontrar empregos na Europa.",
        en: greetingEn,
    };

    const startMessages: Record<WhatsAppFallbackLanguage, string> = {
        sr: `Registrujte se na ${website}/signup i popunite profil. Posle registracije možete nastaviti pitanja ovde na WhatsApp-u, ali profil i dokumenta završavate kroz dashboard. Job Finder checkout u dashboard-u se otključava tek kada su profil i obavezna dokumenta kompletni i admin ga odobri.`,
        hi: `${website}/signup पर account बनाइए और profile पूरा कीजिए। Registration के बाद आप सवाल यहाँ WhatsApp पर पूछ सकते हैं, लेकिन profile और documents dashboard में पूरे होते हैं। Job Finder checkout तभी unlock होता है जब profile और required documents complete हों और admin approve करे।`,
        ar: `أنشئ حسابك على ${website}/signup وأكمل ملفك الشخصي. بعد التسجيل يمكنك متابعة الأسئلة هنا على WhatsApp، لكن الملف والمستندات تُستكمل من لوحة التحكم. لا يفتح Checkout الخاص بـ Job Finder إلا بعد اكتمال الملف والمستندات المطلوبة وموافقة الإدارة.`,
        fr: `Créez votre compte sur ${website}/signup et complétez votre profil. Après inscription, vous pouvez poser vos questions ici sur WhatsApp, mais le profil et les documents se terminent dans le tableau de bord. Le checkout Job Finder ne s’ouvre qu’après profil complet, documents requis et validation admin.`,
        pt: `Crie sua conta em ${website}/signup e complete seu perfil. Depois do registro, você pode continuar com perguntas aqui no WhatsApp, mas o perfil e os documentos são concluídos no painel. O checkout do Job Finder só é liberado após perfil completo, documentos obrigatórios e aprovação administrativa.`,
        en: `Create your account at ${website}/signup and complete your profile. After signup, you can keep asking questions here on WhatsApp, but profile completion and document uploads happen in the dashboard. Job Finder checkout opens only after the profile, required documents, and admin approval are all complete.`,
    };

    const greeting = greetings[fallbackLang] || greetings.en;
    const startMessage = startMessages[fallbackLang] || startMessages.en;
    const isWarmGreeting = looksLikeWarmGreetingWhatsAppMessage(message);
    const asksAboutPrice = looksLikeWhatsAppPriceQuestion(msg);
    const asksAboutStatus = looksLikeWhatsAppStatusQuestion(msg);
    const asksAboutDocuments = looksLikeWhatsAppDocumentQuestion(msg);

    if (explicitLanguagePreference && !asksAboutPrice && !asksAboutStatus && !asksAboutDocuments) {
        if (!workerRecord) {
            if (fallbackLang === "sr") return `Naravno ${name}! Nastaviću na srpskom. Ja sam Workers United AI asistent. Kako mogu da pomognem?`;
            if (fallbackLang === "fr") return `Bien sûr ${name} ! Je continue en français. Je suis l’assistant IA de Workers United. Comment puis-je aider ?`;
            if (fallbackLang === "pt") return `Claro ${name}! Vou continuar em português. Eu sou o assistente de IA da Workers United. Como posso ajudar?`;
            if (fallbackLang === "hi") return `${name}, ज़रूर — मैं हिंदी में जारी रखूँगा। मैं Workers United का AI assistant हूँ। मैं कैसे मदद कर सकता हूँ?`;
            if (fallbackLang === "ar") return `بالتأكيد ${name}! سأتابع بالعربية. أنا مساعد Workers United بالذكاء الاصطناعي. كيف يمكنني مساعدتك؟`;
            return `Of course ${name}! I’ll continue in English. I’m the Workers United AI assistant. How can I help?`;
        }

        if (fallbackLang === "sr") return `Naravno ${name}! Nastaviću na srpskom. Ja sam Workers United AI asistent i mogu da pomognem oko statusa, dokumenata, uplate ili sledećeg koraka.`;
        if (fallbackLang === "fr") return `Bien sûr ${name} ! Je continue en français. Je suis l’assistant IA de Workers United et je peux aider pour le statut, les documents, le paiement ou la prochaine étape.`;
        if (fallbackLang === "pt") return `Claro ${name}! Vou continuar em português. Eu sou o assistente de IA da Workers United e posso ajudar com status, documentos, pagamento ou próximo passo.`;
        if (fallbackLang === "hi") return `${name}, ज़रूर — मैं हिंदी में जारी रखूँगा। मैं Workers United का AI assistant हूँ और status, documents, payment या next step में मदद कर सकता हूँ।`;
        if (fallbackLang === "ar") return `بالتأكيد ${name}! سأتابع بالعربية. أنا مساعد Workers United بالذكاء الاصطناعي ويمكنني المساعدة بخصوص الحالة أو المستندات أو الدفع أو الخطوة التالية.`;
        return `Of course ${name}! I’ll continue in English. I’m the Workers United AI assistant and I can help with your status, documents, payment, or next step.`;
    }

    if (asksAboutPrice) {
        if (!workerRecord) {
            if (fallbackLang === "sr") return `Zdravo ${name}! Job Finder košta ${entryFee}, ali uplata se ne otključava odmah. Prvo napravite profil na ${website}/signup, završite profil i obavezna dokumenta, pa sačekajte admin odobrenje; tek tada se otvara checkout. Ako ne pronađemo posao u roku od 90 dana, iznos se vraća u potpunosti.`;
            if (fallbackLang === "fr") return `Bonjour ${name} ! Job Finder coûte ${entryFee}, mais le paiement ne s’ouvre pas immédiatement. Créez d’abord votre profil sur ${website}/signup, complétez le profil et les documents requis puis attendez la validation admin ; ce n’est qu’ensuite que le checkout s’ouvre. Si aucun emploi n’est trouvé dans les 90 jours, le montant est remboursé intégralement.`;
            if (fallbackLang === "pt") return `Olá ${name}! O Job Finder custa ${entryFee}, mas o pagamento não é liberado imediatamente. Primeiro crie seu perfil em ${website}/signup, complete o perfil e os documentos obrigatórios e aguarde a aprovação admin; só então o checkout é liberado. Se nenhum trabalho for encontrado em 90 dias, o valor é reembolsado integralmente.`;
            if (fallbackLang === "hi") return `नमस्ते ${name}! Job Finder की कीमत ${entryFee} है, लेकिन payment तुरंत unlock नहीं होती। पहले ${website}/signup पर profile बनाइए, profile और required documents पूरे कीजिए, और admin approval का इंतज़ार कीजिए; उसके बाद ही checkout खुलता है। अगर 90 दिनों में job न मिले तो पूरा amount refund होता है।`;
            if (fallbackLang === "ar") return `مرحباً ${name}! تكلفة Job Finder هي ${entryFee}، لكن الدفع لا يُفتح فورًا. أنشئ ملفك أولاً على ${website}/signup وأكمل الملف والمستندات المطلوبة ثم انتظر موافقة الإدارة، وبعدها فقط يفتح الدفع. إذا لم نجد وظيفة خلال 90 يومًا فسيتم رد المبلغ بالكامل.`;
            return `Hi ${name}! Job Finder costs ${entryFee}, but payment does not unlock immediately. First create your profile at ${website}/signup, finish the profile and required documents, and wait for admin approval; only then does checkout unlock. If no job is found within 90 days, the full amount is refunded.`;
        }

        if (workerRecord.entry_fee_paid) {
            if (fallbackLang === "sr") return `Zdravo ${name}! Vaša Job Finder uplata je već evidentirana. Sledeći korak i status možete pratiti na ${website}/profile/worker.`;
            if (fallbackLang === "fr") return `Bonjour ${name} ! Votre paiement Job Finder est déjà enregistré. Vous pouvez suivre le statut et la prochaine étape sur ${website}/profile/worker.`;
            if (fallbackLang === "pt") return `Olá ${name}! Seu pagamento do Job Finder já foi registrado. Você pode acompanhar o status e o próximo passo em ${website}/profile/worker.`;
            if (fallbackLang === "hi") return `नमस्ते ${name}! आपका Job Finder payment पहले से दर्ज है। अगला step और status ${website}/profile/worker पर देखिए।`;
            if (fallbackLang === "ar") return `مرحباً ${name}! تم تسجيل دفعة Job Finder بالفعل. يمكنك متابعة الحالة والخطوة التالية على ${website}/profile/worker.`;
            return `Hi ${name}! Your Job Finder payment is already recorded. You can follow the next step and your status at ${website}/profile/worker.`;
        }

        if (!isWorkerPaymentUnlocked(workerRecord)) {
            if (fallbackLang === "sr") return `Zdravo ${name}! Checkout za Job Finder još nije otključan. Potrebno je da profil bude kompletan, obavezna dokumenta završena i admin review odobren; zatim pokrećete bezbednu uplatu iz dashboard-a na ${website}/profile/worker.`;
            if (fallbackLang === "fr") return `Bonjour ${name} ! Le checkout Job Finder n’est pas encore débloqué. Il faut d’abord un profil complet, les documents requis, puis la validation admin ; ensuite vous lancez le paiement sécurisé depuis le tableau de bord sur ${website}/profile/worker.`;
            if (fallbackLang === "pt") return `Olá ${name}! O checkout do Job Finder ainda não foi liberado. Primeiro é preciso perfil completo, documentos obrigatórios concluídos e aprovação admin; depois disso você inicia o pagamento seguro no painel em ${website}/profile/worker.`;
            if (fallbackLang === "hi") return `नमस्ते ${name}! Job Finder checkout अभी unlock नहीं हुआ है। Profile complete होना चाहिए, required documents पूरे होने चाहिए और admin review approved होना चाहिए; उसके बाद ही ${website}/profile/worker dashboard से secure payment शुरू होती है।`;
            if (fallbackLang === "ar") return `مرحباً ${name}! لم يتم فتح Checkout الخاص بـ Job Finder بعد. يجب أن يكتمل الملف، وتكتمل المستندات المطلوبة، ويتم اعتماد مراجعة الإدارة أولاً؛ وبعدها فقط تبدأ الدفع الآمن من لوحة التحكم على ${website}/profile/worker.`;
            return `Hi ${name}! Job Finder checkout is not unlocked yet. Your profile must be complete, the required documents finished, and admin review approved first; after that, you start the secure payment from the dashboard at ${website}/profile/worker.`;
        }

        if (fallbackLang === "sr") return `Zdravo ${name}! Job Finder checkout je sada otključan u vašem dashboard-u. Otvorite ${website}/profile/worker i odatle pokrenite bezbedan checkout za ${entryFee}. Ako ne pronađemo posao u roku od 90 dana, iznos se vraća u potpunosti.`;
        if (fallbackLang === "fr") return `Bonjour ${name} ! Le checkout Job Finder est maintenant débloqué dans votre tableau de bord. Ouvrez ${website}/profile/worker et lancez le checkout sécurisé depuis là pour ${entryFee}. Si nous ne trouvons pas d’emploi dans les 90 jours, le montant est remboursé intégralement.`;
        if (fallbackLang === "pt") return `Olá ${name}! O checkout do Job Finder agora está liberado no seu painel. Abra ${website}/profile/worker e inicie o checkout seguro por lá no valor de ${entryFee}. Se não encontrarmos um trabalho em 90 dias, o valor é reembolsado integralmente.`;
        if (fallbackLang === "hi") return `नमस्ते ${name}! Job Finder checkout अब आपके dashboard में unlock हो गया है। ${website}/profile/worker खोलिए और वहाँ से ${entryFee} का secure checkout शुरू कीजिए। अगर 90 दिनों में job न मिले तो पूरा amount refund होता है।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! أصبح Checkout الخاص بـ Job Finder مفتوحًا الآن في لوحة التحكم الخاصة بك. افتح ${website}/profile/worker وابدأ الدفع الآمن من هناك مقابل ${entryFee}. إذا لم نجد وظيفة خلال 90 يومًا فسيتم رد المبلغ بالكامل.`;
        return `Hi ${name}! Job Finder checkout is now unlocked in your dashboard. Open ${website}/profile/worker and start the secure checkout there for ${entryFee}. If we do not find you a job within 90 days, the full amount is refunded.`;
    }

    if (!workerRecord && isWarmGreeting) {
        if (fallbackLang === "sr") return `Zdravo ${name}! Ja sam Workers United AI asistent. Mogu da pomognem oko posla, dokumenata, statusa profila ili sledećeg koraka. Samo mi napišite šta vas zanima.`;
        if (fallbackLang === "fr") return `Bonjour ${name} ! Je suis l’assistant IA de Workers United. Je peux aider pour les emplois, les documents, le statut du profil ou la prochaine étape. Dites-moi simplement ce que vous voulez vérifier.`;
        if (fallbackLang === "pt") return `Olá ${name}! Eu sou o assistente de IA da Workers United. Posso ajudar com vagas, documentos, status do perfil ou o próximo passo. Basta me dizer o que você quer verificar.`;
        if (fallbackLang === "hi") return `नमस्ते ${name}! मैं Workers United का AI assistant हूँ। मैं jobs, documents, profile status या next step में मदद कर सकता हूँ। बस लिखिए कि आपको क्या जानना है।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! أنا مساعد الذكاء الاصطناعي من Workers United. يمكنني المساعدة بخصوص الوظائف أو المستندات أو حالة الملف أو الخطوة التالية. فقط اكتب لي ما الذي تريد معرفته.`;
        return `Hello ${name}! I’m the Workers United AI assistant. I can help with jobs, documents, profile status, or the next step. Just tell me what you want to check.`;
    }

    if (!workerRecord) {
        return `${greeting} ${startMessage}`;
    }

    if (isWarmGreeting) {
        if (fallbackLang === "sr") return `Zdravo ${name}! Ja sam Workers United AI asistent. Mogu da pomognem oko vašeg statusa, dokumenata, uplate ili sledećeg koraka. Samo napišite šta želite da proverimo.`;
        if (fallbackLang === "fr") return `Bonjour ${name} ! Je suis l’assistant IA de Workers United. Je peux aider concernant votre statut, vos documents, votre paiement ou la prochaine étape. Dites-moi simplement ce que vous voulez vérifier.`;
        if (fallbackLang === "pt") return `Olá ${name}! Eu sou o assistente de IA da Workers United. Posso ajudar com seu status, documentos, pagamento ou próximo passo. Basta me dizer o que você quer verificar.`;
        if (fallbackLang === "hi") return `नमस्ते ${name}! मैं Workers United का AI assistant हूँ। मैं आपके status, documents, payment या next step में मदद कर सकता हूँ। बस लिखिए कि आप क्या check करना चाहते हैं।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! أنا مساعد الذكاء الاصطناعي من Workers United. يمكنني مساعدتك بخصوص حالتك أو المستندات أو الدفع أو الخطوة التالية. فقط اكتب لي ما الذي تريد التحقق منه.`;
        return `Hello ${name}! I’m the Workers United AI assistant. I can help with your status, documents, payment, or next step. Just tell me what you want to check.`;
    }

    if (asksAboutStatus) {
        const statusInfo = getFallbackStatusLabel(workerRecord.status, fallbackLang);
        const queueInfo = getFallbackQueueInfo(workerRecord.queue_position, fallbackLang);
        if (fallbackLang === "sr") return `Zdravo ${name}! Vaš status je: ${statusInfo}.${queueInfo} Detalje možete videti na ${website}/profile/worker.`;
        if (fallbackLang === "fr") return `Bonjour ${name} ! Votre statut est : ${statusInfo}.${queueInfo} Vous pouvez voir tous les détails sur ${website}/profile/worker.`;
        if (fallbackLang === "pt") return `Olá ${name}! Seu status é: ${statusInfo}.${queueInfo} Você pode ver todos os detalhes em ${website}/profile/worker.`;
        if (fallbackLang === "hi") return `नमस्ते ${name}! आपका status है: ${statusInfo}.${queueInfo} पूरी details ${website}/profile/worker पर देखिए।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! حالتك: ${statusInfo}.${queueInfo} يمكنك رؤية التفاصيل على ${website}/profile/worker.`;
        return `Hi ${name}! Your status is: ${statusInfo}.${queueInfo} You can see full details at ${website}/profile/worker.`;
    }

    if (asksAboutDocuments) {
        if (fallbackLang === "sr") return `Zdravo ${name}! Dokumenta uploadujete na ${website}/profile/worker. Potrebni su: pasoš, biometrijska fotografija i završna školska, univerzitetska ili formalna stručna diploma. WhatsApp prilozi se trenutno ne vezuju automatski za profil.`;
        if (fallbackLang === "fr") return `Bonjour ${name} ! Téléversez les documents sur ${website}/profile/worker. Nous avons besoin du passeport, d’une photo biométrique et d’un diplôme final scolaire, universitaire ou professionnel officiel. Les pièces jointes WhatsApp ne sont pas encore reliées automatiquement au profil.`;
        if (fallbackLang === "pt") return `Olá ${name}! Envie os documentos em ${website}/profile/worker. Precisamos do passaporte, da foto biométrica e de um diploma final escolar, universitário ou profissional formal. Os anexos do WhatsApp ainda não são vinculados automaticamente ao perfil.`;
        if (fallbackLang === "hi") return `नमस्ते ${name}! Documents ${website}/profile/worker पर upload कीजिए। ज़रूरी documents हैं passport, biometric photo, और final school, university, या formal vocational diploma। WhatsApp attachments अभी profile से automatically link नहीं होते।`;
        if (fallbackLang === "ar") return `مرحباً ${name}! يمكنك رفع المستندات على ${website}/profile/worker. المطلوب: جواز السفر، الصورة البيومترية، والدبلومة النهائية المدرسية أو الجامعية أو المهنية الرسمية. مرفقات WhatsApp لا ترتبط بالملف تلقائيًا حاليًا.`;
        return `Hi ${name}! Upload documents at ${website}/profile/worker. We need: passport, biometric photo, and a final school, university, or formal vocational diploma. WhatsApp attachments are not linked to the profile automatically yet.`;
    }

    if (fallbackLang === "sr") return `Zdravo ${name}! 👋 ${startMessage}`;
    if (fallbackLang === "fr") return `Bonjour ${name} ! 👋 ${startMessage}`;
    if (fallbackLang === "pt") return `Olá ${name}! 👋 ${startMessage}`;
    if (fallbackLang === "hi") return `नमस्ते ${name}! 👋 ${startMessage}`;
    if (fallbackLang === "ar") return `مرحباً ${name}! 👋 ${startMessage}`;
    return `Hi ${name}! 👋 ${startMessage}`;
}
