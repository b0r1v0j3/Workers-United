const GUARDED_ESCALATION_PATTERNS = [
    /\btech(?:nical)? team\b/i,
    /\bticket\b/i,
    /\bprioriti[sz](?:e|ed|ing)\b/i,
    /\bescalat(?:e|ed|ing)\b/i,
    /\bforward(?:ed|ing)?\b/i,
    /\bI['’]ve added\b/i,
    /\breply here or to\b/i,
    /\bthey['’]ll reply\b/i,
    /\bteam will (?:investigate|reply|contact)\b/i,
    /\bsupport request in (?:your )?dashboard\b/i,
];

const GUARDED_PAYMENT_PATTERNS = [
    /\bpayment link\b/i,
    /\bactivation link\b/i,
    /\bcheckout link\b/i,
    /\bsend (?:the )?(?:secure )?(?:payment|activation|checkout) link\b/i,
    /\bactivate it in your dashboard or here\b/i,
    /\bactivate Job Finder now\b/i,
    /\bwould you like me to activate\b/i,
    /\bwould you like me to send\b.*\blink\b/i,
    /\bI can send the payment link\b/i,
];

const GUARDED_AVAILABILITY_PATTERNS = [
    /\bwe offer jobs(?:\s+for|\s+across)?\b/i,
    /\bnudimo poslove(?:\s+za|\s+širom|\s+sirom)?\b/i,
    /\bverified workers\b/i,
    /\bavailable workers\b/i,
    /\bimamo\s+\d+\+?\s+verifikovan/i,
];

export interface WhatsAppReplyGuardrailWorkerRecord {
    entry_fee_paid?: boolean | null;
    admin_approved?: boolean | null;
    status?: string | null;
}

export type GuardrailLanguage = "en" | "sr" | "ar" | "fr" | "pt" | "hi";

export interface GuardrailResult {
    text: string;
    triggered: boolean;
    reason: "escalation" | "payment" | null;
}

export function resolveGuardrailLanguage(language?: string | null): GuardrailLanguage {
    const normalized = (language || "").trim().toLowerCase();
    if (normalized.startsWith("sr") || normalized.includes("serbian")) return "sr";
    if (normalized.startsWith("ar") || normalized.includes("arabic")) return "ar";
    if (normalized.startsWith("fr") || normalized.includes("french")) return "fr";
    if (normalized.startsWith("pt") || normalized.includes("portuguese")) return "pt";
    if (normalized.startsWith("hi") || normalized.includes("hindi")) return "hi";
    return "en";
}

export function isWorkerPaymentUnlocked(
    workerRecord: WhatsAppReplyGuardrailWorkerRecord | null | undefined
): boolean {
    return Boolean(
        workerRecord
        && !workerRecord.entry_fee_paid
        && workerRecord.admin_approved
        && workerRecord.status === "APPROVED"
    );
}

export function buildWorkerPaymentSnapshot(
    workerRecord: WhatsAppReplyGuardrailWorkerRecord | null | undefined
): string {
    if (!workerRecord) {
        return "Job Finder payment unlocked: no (registration and profile completion come first)";
    }

    if (workerRecord.entry_fee_paid) {
        return "Job Finder payment unlocked: already paid";
    }

    if (isWorkerPaymentUnlocked(workerRecord)) {
        return "Job Finder payment unlocked: yes (worker is approved and may start checkout from the dashboard)";
    }

    if (!workerRecord.admin_approved) {
        return "Job Finder payment unlocked: no (worker must finish the profile/doc requirements and pass admin review first)";
    }

    return "Job Finder payment unlocked: no (worker should use the dashboard rather than a direct payment link)";
}

export function getMediaAttachmentResponse(language: string): string {
    const guardrailLanguage = resolveGuardrailLanguage(language);
    if (guardrailLanguage === "sr") {
        return "Hvala — vidim da ste poslali prilog. WhatsApp slike i dokumenti se trenutno ne vezuju automatski za profil, zato dokumenta i screenshot-ove pošaljite kroz dashboard ili na contact@workersunited.eu, uz kratko objašnjenje problema.";
    }
    if (guardrailLanguage === "ar") {
        return "شكرًا — استلمت المرفق. صور ووثائق WhatsApp لا ترتبط بملفك تلقائيًا حاليًا، لذلك ارفع المستندات من لوحة التحكم أو أرسل لقطات الشاشة إلى contact@workersunited.eu مع وصف قصير للمشكلة.";
    }
    if (guardrailLanguage === "fr") {
        return "Merci — j’ai bien reçu la pièce jointe. Les images et documents WhatsApp ne sont pas encore reliés automatiquement à votre profil, donc veuillez téléverser les documents dans le tableau de bord ou envoyer les captures à contact@workersunited.eu avec une courte description du problème.";
    }
    if (guardrailLanguage === "pt") {
        return "Obrigado — recebi o anexo. Imagens e documentos enviados pelo WhatsApp ainda não são vinculados automaticamente ao seu perfil, então envie os documentos pelo painel ou mande as capturas para contact@workersunited.eu com uma breve descrição do problema.";
    }
    if (guardrailLanguage === "hi") {
        return "धन्यवाद — मुझे आपका अटैचमेंट मिला। WhatsApp पर भेजी गई तस्वीरें और दस्तावेज़ अभी अपने-आप आपके प्रोफ़ाइल से नहीं जुड़ते, इसलिए दस्तावेज़ डैशबोर्ड में अपलोड करें या screenshot/contact details के साथ contact@workersunited.eu पर भेजें।";
    }

    return "Thanks — I received the attachment. WhatsApp images and documents are not linked to your Workers United profile automatically yet, so please upload documents in the dashboard or email screenshots to contact@workersunited.eu with a short description of the issue.";
}

function getEscalationGuardReply(
    language: GuardrailLanguage,
    workerRecord: WhatsAppReplyGuardrailWorkerRecord | null | undefined
): string {
    if (language === "sr") {
        return workerRecord?.entry_fee_paid
            ? "Žao mi je zbog problema. Ne mogu da otvorim ili ažuriram interni tehnički ticket direktno sa WhatsApp-a i ne treba da obećavam odgovor tima ovde. Ako ste već platili Job Finder, pošaljite poruku kroz support inbox u dashboard-u ili pošaljite screenshot i kratak opis na contact@workersunited.eu."
            : "Žao mi je zbog problema. Ne mogu da otvorim ili ažuriram interni tehnički ticket direktno sa WhatsApp-a i ne treba da obećavam odgovor tima ovde. Pošaljite screenshot i kratak opis problema na contact@workersunited.eu, zajedno sa svojim brojem telefona, pa će zahtev biti pregledan kroz zvanični kanal.";
    }
    if (language === "ar") {
        return workerRecord?.entry_fee_paid
            ? "آسف بسبب هذه المشكلة. لا يمكنني فتح أو تحديث تذكرة تقنية داخلية مباشرة من WhatsApp، ولا ينبغي لي أن أعدك برد من الفريق هنا. إذا كنت قد دفعت Job Finder بالفعل، فاستخدم صندوق الدعم داخل لوحة التحكم أو أرسل لقطة الشاشة ووصفًا قصيرًا إلى contact@workersunited.eu."
            : "آسف بسبب هذه المشكلة. لا يمكنني فتح أو تحديث تذكرة تقنية داخلية مباشرة من WhatsApp، ولا ينبغي لي أن أعدك برد من الفريق هنا. أرسل لقطة الشاشة ووصفًا قصيرًا للمشكلة إلى contact@workersunited.eu مع رقم هاتفك ليتم التعامل معها عبر القناة الرسمية.";
    }
    if (language === "fr") {
        return workerRecord?.entry_fee_paid
            ? "Désolé pour ce problème. Je ne peux pas ouvrir ni mettre à jour un ticket technique interne directement depuis WhatsApp, et je ne dois pas promettre une réponse d’équipe ici. Si Job Finder est déjà payé, utilisez la boîte de support dans le tableau de bord ou envoyez la capture d’écran et une courte description à contact@workersunited.eu."
            : "Désolé pour ce problème. Je ne peux pas ouvrir ni mettre à jour un ticket technique interne directement depuis WhatsApp, et je ne dois pas promettre une réponse d’équipe ici. Envoyez la capture d’écran et une courte description du problème à contact@workersunited.eu avec votre numéro de téléphone pour le suivi officiel.";
    }
    if (language === "pt") {
        return workerRecord?.entry_fee_paid
            ? "Lamento por esse problema. Eu não posso abrir nem atualizar um ticket técnico interno diretamente pelo WhatsApp, e não devo prometer uma resposta da equipe por aqui. Se o Job Finder já foi pago, use a caixa de suporte no painel ou envie a captura de tela com uma breve descrição para contact@workersunited.eu."
            : "Lamento por esse problema. Eu não posso abrir nem atualizar um ticket técnico interno diretamente pelo WhatsApp, e não devo prometer uma resposta da equipe por aqui. Envie a captura de tela e uma breve descrição do problema para contact@workersunited.eu com seu número de telefone para o atendimento oficial.";
    }
    if (language === "hi") {
        return workerRecord?.entry_fee_paid
            ? "इस समस्या के लिए खेद है। मैं WhatsApp से सीधे कोई internal technical ticket खोल या अपडेट नहीं कर सकता, और मुझे यहाँ टीम के जवाब का वादा भी नहीं करना चाहिए। अगर आपने Job Finder पहले ही pay कर दिया है, तो dashboard support inbox का उपयोग करें या screenshot और short description contact@workersunited.eu पर भेजें।"
            : "इस समस्या के लिए खेद है। मैं WhatsApp से सीधे कोई internal technical ticket खोल या अपडेट नहीं कर सकता, और मुझे यहाँ टीम के जवाब का वादा भी नहीं करना चाहिए। कृपया screenshot, short description और अपना phone number contact@workersunited.eu पर भेजें ताकि इसे official channel से देखा जा सके।";
    }

    return workerRecord?.entry_fee_paid
        ? "Sorry this is still causing trouble. I can’t open or update an internal technical ticket directly from WhatsApp, and I shouldn’t promise a team reply here. If you already paid for Job Finder, please use the support inbox in your dashboard or send the screenshot and a short description to contact@workersunited.eu."
        : "Sorry this is still causing trouble. I can’t open or update an internal technical ticket directly from WhatsApp, and I shouldn’t promise a team reply here. Please send the screenshot, a short description, and your phone number to contact@workersunited.eu so it can be reviewed through the official channel.";
}

function getPaymentGuardReply(
    language: GuardrailLanguage,
    workerRecord: WhatsAppReplyGuardrailWorkerRecord | null | undefined
): string {
    if (!workerRecord) {
        if (language === "sr") {
            return "Da biste stigli do Job Finder uplate, prvo napravite nalog na workersunited.eu/signup i dovršite profil. Checkout se otključava tek kada profil bude kompletan i admin review bude završen, a uplata se pokreće iz dashboard-a, ne preko WhatsApp linka.";
        }
        if (language === "ar") {
            return "للوصول إلى دفع Job Finder، أنشئ حسابك أولاً على workersunited.eu/signup وأكمل ملفك. يتم فتح الدفع فقط بعد اكتمال الملف ومراجعة الإدارة، ويبدأ الدفع من لوحة التحكم وليس عبر رابط WhatsApp.";
        }
        if (language === "fr") {
            return "Pour accéder au paiement Job Finder, créez d’abord votre compte sur workersunited.eu/signup et complétez votre profil. Le paiement ne se débloque qu’après profil complet et revue admin, et il démarre depuis le tableau de bord, pas via un lien WhatsApp.";
        }
        if (language === "pt") {
            return "Para chegar ao pagamento do Job Finder, primeiro crie sua conta em workersunited.eu/signup e complete seu perfil. O checkout só é liberado após perfil completo e revisão administrativa, e o pagamento começa no painel, não por link no WhatsApp.";
        }
        if (language === "hi") {
            return "Job Finder payment तक पहुँचने के लिए पहले workersunited.eu/signup पर account बनाइए और profile पूरा कीजिए। Checkout तभी unlock होता है जब profile complete हो और admin review पूरा हो, और payment dashboard से शुरू होता है, WhatsApp link से नहीं।";
        }
        return "To reach Job Finder payment, first register at workersunited.eu/signup and complete your profile. Checkout unlocks only after the profile is complete and admin review is finished, and payment starts from the dashboard, not from a WhatsApp link.";
    }

    if (workerRecord.entry_fee_paid) {
        if (language === "sr") {
            return "Vaša Job Finder uplata je već evidentirana, tako da nema novog payment linka za slanje ovde. Sledeći korak i status pratite iz dashboard-a na workersunited.eu/profile/worker.";
        }
        if (language === "ar") {
            return "تم تسجيل دفعة Job Finder بالفعل، لذلك لا يوجد رابط دفع جديد لإرساله هنا. تابع الحالة والخطوة التالية من لوحة التحكم على workersunited.eu/profile/worker.";
        }
        if (language === "fr") {
            return "Votre paiement Job Finder est déjà enregistré, donc il n’y a pas de nouveau lien de paiement à envoyer ici. Suivez le statut et la prochaine étape depuis le tableau de bord sur workersunited.eu/profile/worker.";
        }
        if (language === "pt") {
            return "Seu pagamento do Job Finder já está registrado, então não há novo link de pagamento para enviar aqui. Acompanhe o status e a próxima etapa no painel em workersunited.eu/profile/worker.";
        }
        if (language === "hi") {
            return "आपका Job Finder payment पहले से दर्ज है, इसलिए यहाँ कोई नया payment link भेजने की ज़रूरत नहीं है। अगला step और status workersunited.eu/profile/worker dashboard में देखें।";
        }
        return "Your Job Finder payment is already recorded, so there is no new payment link to send here. Please follow your status and next step in the dashboard at workersunited.eu/profile/worker.";
    }

    if (!isWorkerPaymentUnlocked(workerRecord)) {
        if (language === "sr") {
            return "Job Finder checkout još nije otključan za vaš nalog. Potrebno je da profil bude kompletan, obavezna dokumenta završena i admin review odobren; tek tada se plaćanje pokreće iz dashboard-a, ne preko WhatsApp linka.";
        }
        if (language === "ar") {
            return "لم يتم فتح Checkout الخاص بـ Job Finder لحسابك بعد. يجب أن يكتمل الملف، وتكتمل المستندات المطلوبة، ويتم اعتماد مراجعة الإدارة أولاً؛ وبعدها فقط يبدأ الدفع من لوحة التحكم وليس عبر رابط WhatsApp.";
        }
        if (language === "fr") {
            return "Le checkout Job Finder n’est pas encore débloqué pour votre compte. Il faut d’abord un profil complet, les documents requis, puis la validation admin; ensuite seulement le paiement commence depuis le tableau de bord, jamais via un lien WhatsApp.";
        }
        if (language === "pt") {
            return "O checkout do Job Finder ainda não está liberado para sua conta. Primeiro é preciso perfil completo, documentos obrigatórios concluídos e aprovação administrativa; só depois o pagamento começa no painel, nunca por link no WhatsApp.";
        }
        if (language === "hi") {
            return "आपके account के लिए Job Finder checkout अभी unlock नहीं हुआ है। पहले profile complete होना चाहिए, required documents पूरे होने चाहिए और admin review approved होना चाहिए; उसके बाद ही payment dashboard से शुरू होता है, WhatsApp link से नहीं।";
        }
        return "Job Finder checkout is not unlocked for your account yet. Your profile must be complete, the required documents finished, and admin review approved first; after that, payment starts from the dashboard, never from a WhatsApp link.";
    }

    if (language === "sr") {
        return "Vaš Job Finder checkout je otključan, ali uplata se i dalje pokreće samo iz dashboard-a. Otvorite workersunited.eu/profile/worker i tamo započnite bezbedan checkout; payment link ne šaljemo preko WhatsApp-a.";
    }
    if (language === "ar") {
        return "تم فتح Checkout الخاص بـ Job Finder لحسابك، لكن الدفع يبدأ فقط من لوحة التحكم. افتح workersunited.eu/profile/worker وابدأ الدفع الآمن من هناك؛ نحن لا نرسل روابط الدفع عبر WhatsApp.";
    }
    if (language === "fr") {
        return "Le checkout Job Finder est débloqué pour votre compte, mais le paiement démarre uniquement depuis le tableau de bord. Ouvrez workersunited.eu/profile/worker et lancez le checkout sécurisé depuis là; nous n’envoyons pas de lien de paiement via WhatsApp.";
    }
    if (language === "pt") {
        return "O checkout do Job Finder está liberado para sua conta, mas o pagamento começa apenas pelo painel. Abra workersunited.eu/profile/worker e inicie o checkout seguro por lá; não enviamos link de pagamento pelo WhatsApp.";
    }
    if (language === "hi") {
        return "आपके account के लिए Job Finder checkout unlock है, लेकिन payment फिर भी सिर्फ dashboard से शुरू होता है। workersunited.eu/profile/worker खोलिए और वहीं से secure checkout शुरू कीजिए; हम WhatsApp पर payment link नहीं भेजते।";
    }
    return "Job Finder checkout is unlocked for your account, but payment still starts only from the dashboard. Open workersunited.eu/profile/worker and start the secure checkout there; we do not send payment links over WhatsApp.";
}

function getAvailabilityGuardReply(
    language: GuardrailLanguage,
    workerRecord: WhatsAppReplyGuardrailWorkerRecord | null | undefined
): string {
    if (language === "sr") {
        return workerRecord
            ? "Ne mogu da potvrdim konkretan otvoren posao ili listu dostupnih radnika preko WhatsApp-a. Workers United radi kroz vođeni matching proces; pratite svoj profil i sledeće korake kroz dashboard, a ovde mogu da objasnim proces."
            : "Ne mogu da potvrdim konkretan otvoren posao preko WhatsApp-a. Workers United radi kroz vođeni matching proces; prvo napravite nalog na workersunited.eu/signup i popunite profil, a zatim nastavljamo kroz dashboard i pitanja o procesu.";
    }
    if (language === "ar") {
        return workerRecord
            ? "لا أستطيع تأكيد وظيفة محددة مفتوحة أو قائمة عمال متاحين عبر WhatsApp. يعمل Workers United من خلال مطابقة موجهة؛ تابع ملفك والخطوات التالية من خلال لوحة التحكم، ويمكنني هنا شرح العملية."
            : "لا أستطيع تأكيد وظيفة محددة مفتوحة عبر WhatsApp. يعمل Workers United من خلال مطابقة موجهة؛ أنشئ حسابك أولاً على workersunited.eu/signup وأكمل ملفك، ثم نتابع من خلال لوحة التحكم وأسئلة العملية.";
    }
    if (language === "fr") {
        return workerRecord
            ? "Je ne peux pas confirmer une offre précise ouverte ni une liste de travailleurs disponibles via WhatsApp. Workers United fonctionne avec un processus d’appariement guidé ; suivez votre profil et les prochaines étapes dans le tableau de bord, et je peux expliquer le processus ici."
            : "Je ne peux pas confirmer une offre précise ouverte via WhatsApp. Workers United fonctionne avec un processus d’appariement guidé ; créez d’abord votre compte sur workersunited.eu/signup et complétez votre profil, puis nous continuons via le tableau de bord et les questions sur le processus.";
    }
    if (language === "pt") {
        return workerRecord
            ? "Eu não posso confirmar uma vaga específica aberta nem uma lista de trabalhadores disponíveis pelo WhatsApp. A Workers United trabalha com um processo guiado de matching; acompanhe seu perfil e os próximos passos no painel, e por aqui eu posso explicar o processo."
            : "Eu não posso confirmar uma vaga específica aberta pelo WhatsApp. A Workers United trabalha com um processo guiado de matching; primeiro crie sua conta em workersunited.eu/signup e complete seu perfil, e depois seguimos pelo painel e pelas dúvidas sobre o processo.";
    }
    if (language === "hi") {
        return workerRecord
            ? "मैं WhatsApp पर किसी specific open job या available workers list की पुष्टि नहीं कर सकता। Workers United guided matching process के ज़रिए काम करता है; अपना profile और next steps dashboard में follow कीजिए, और मैं यहाँ process समझा सकता हूँ।"
            : "मैं WhatsApp पर किसी specific open job की पुष्टि नहीं कर सकता। Workers United guided matching process के ज़रिए काम करता है; पहले workersunited.eu/signup पर account बनाइए और profile पूरा कीजिए, फिर dashboard और process सवालों के साथ आगे बढ़ते हैं।";
    }

    return workerRecord
        ? "I cannot confirm a specific open job or a list of available workers over WhatsApp. Workers United works through a guided matching process; please follow your profile and next steps in the dashboard, and I can explain the process here."
        : "I cannot confirm a specific open job over WhatsApp. Workers United works through a guided matching process; first create your account at workersunited.eu/signup and complete your profile, then we continue through the dashboard and any process questions here.";
}

export function applyWhatsAppReplyGuardrails({
    responseText,
    language,
    workerRecord,
}: {
    responseText: string | null | undefined;
    language: string;
    workerRecord: WhatsAppReplyGuardrailWorkerRecord | null | undefined;
}): GuardrailResult {
    const trimmed = (responseText || "").trim();
    if (!trimmed) {
        return { text: "", triggered: false, reason: null };
    }

    const guardrailLanguage = resolveGuardrailLanguage(language);

    if (GUARDED_ESCALATION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return {
            text: getEscalationGuardReply(guardrailLanguage, workerRecord),
            triggered: true,
            reason: "escalation",
        };
    }

    if (GUARDED_PAYMENT_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return {
            text: getPaymentGuardReply(guardrailLanguage, workerRecord),
            triggered: true,
            reason: "payment",
        };
    }

    if (GUARDED_AVAILABILITY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return {
            text: getAvailabilityGuardReply(guardrailLanguage, workerRecord),
            triggered: true,
            reason: null,
        };
    }

    return {
        text: trimmed,
        triggered: false,
        reason: null,
    };
}
