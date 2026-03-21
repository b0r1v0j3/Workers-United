import { describe, expect, it } from "vitest";
import {
    buildRegisteredWorkerWhatsAppReply,
    buildWhatsAppAutoHandoffReply,
    buildUnregisteredWorkerWhatsAppReply,
    buildCanonicalWhatsAppFacts,
    buildWorkerWhatsAppRules,
    detectWhatsAppLanguageCode,
    filterSafeWhatsAppBrainMemory,
    filterSafeBrainLearnings,
    looksLikeGreetingOnlyWhatsAppMessage,
    looksLikeWarmGreetingWhatsAppMessage,
    looksLikeEmployerWhatsAppLead,
    looksLikeWorkerWhatsAppLead,
    replyMatchesExpectedWhatsAppLanguage,
    resolveWhatsAppLanguageName,
    shouldStartWhatsAppOnboarding,
} from "@/lib/whatsapp-brain";
import { analyzeWhatsAppConfusion } from "@/lib/whatsapp-quality";

describe("whatsapp-brain guards", () => {
    it("does not start onboarding for normal vacancy questions", () => {
        expect(shouldStartWhatsAppOnboarding("Hi, I have a question about Workers United")).toBe(false);
        expect(shouldStartWhatsAppOnboarding("What kind of work do you have for a client in Serbia?")).toBe(false);
        expect(shouldStartWhatsAppOnboarding("yes, I need a full job description")).toBe(false);
    });

    it("starts onboarding only for explicit WhatsApp profile requests", () => {
        expect(shouldStartWhatsAppOnboarding("I want to complete my profile on WhatsApp")).toBe(true);
        expect(shouldStartWhatsAppOnboarding("Can I register on WhatsApp?")).toBe(true);
        expect(shouldStartWhatsAppOnboarding("Je veux remplir mon profil sur WhatsApp")).toBe(true);
        expect(shouldStartWhatsAppOnboarding("मैं व्हाट्सएप पर प्रोफाइल भरना चाहता हूँ")).toBe(true);
    });

    it("keeps canonical facts aligned with the real Job Finder model", () => {
        const facts = buildCanonicalWhatsAppFacts();

        expect(facts).toContain("works through guided matching");
        expect(facts).toContain("There is no live public vacancy feed");
        expect(facts).toContain("payment unlocks only after the worker profile is fully complete, the required documents are finished, and admin approval is done");
        expect(facts).toContain("Document uploads and screenshots are not processed as WhatsApp attachments yet");
    });

    it("normalizes bare website values before composing WhatsApp facts and rules", () => {
        const facts = buildCanonicalWhatsAppFacts({
            website: "portal.example",
            supportEmail: "ops@example.com",
        });
        const rules = buildWorkerWhatsAppRules({
            language: "English",
            intent: "general",
            confidence: "high",
            reason: "Greeting-only first contact",
            isAdmin: false,
            website: "portal.example",
            supportEmail: "ops@example.com",
        });

        expect(facts).toContain("https://portal.example/signup");
        expect(facts).toContain("ops@example.com");
        expect(rules).toContain("https://portal.example/signup");
        expect(rules).toContain("ops@example.com");
    });

    it("forbids premature payment links and fake escalation promises", () => {
        const rules = buildWorkerWhatsAppRules({
            language: "English",
            intent: "support",
            confidence: "high",
            reason: "User reported a website problem",
            isAdmin: false,
        });

        expect(rules).toContain("Do NOT share direct payment links from WhatsApp");
        expect(rules).toContain("Never claim you escalated, forwarded screenshots, opened a ticket");
        expect(rules).toContain("uploads happen in the dashboard");
    });

    it("keeps only low-risk self-improvement learnings", () => {
        const filtered = filterSafeBrainLearnings([
            {
                category: "common_question",
                content: "Users often ask to see jobs before paying, so explain that Job Finder is a search service rather than a vacancy list.",
            },
            {
                category: "error_fix",
                content: "When an agency says they register clients, do not ask worker personal profile questions.",
            },
            {
                category: "faq",
                content: "Job Finder costs $9 and refunds after 90 days.",
            },
            {
                category: "common_question",
                content: "We currently have 194 verified workers available.",
            },
            {
                category: "copy_rule",
                content: "Keep the first WhatsApp reply shorter and answer the first question before asking another.",
            },
        ]);

        expect(filtered).toEqual([
            {
                category: "common_question",
                content: "Users often ask to see jobs before paying, so explain that Job Finder is a search service rather than a vacancy list.",
            },
            {
                category: "error_fix",
                content: "When an agency says they register clients, do not ask worker personal profile questions.",
            },
            {
                category: "copy_rule",
                content: "Keep the first WhatsApp reply shorter and answer the first question before asking another.",
            },
        ]);
    });

    it("detects Serbian written in plain Latin and keeps the reply language Serbian", () => {
        expect(detectWhatsAppLanguageCode("Pozdrav")).toBe("sr");
        expect(detectWhatsAppLanguageCode("Ocu posao")).toBe("sr");
        expect(detectWhatsAppLanguageCode("Treba mi posao")).toBe("sr");
        expect(detectWhatsAppLanguageCode("Kako da se prijavim")).toBe("sr");
        expect(detectWhatsAppLanguageCode("Jel si dobro")).toBe("sr");
        expect(resolveWhatsAppLanguageName("Pozdrav", "English")).toBe("Serbian");
        expect(resolveWhatsAppLanguageName("Treba mi posao", "English")).toBe("Serbian");
    });

    it("detects short warm greetings across supported languages", () => {
        expect(detectWhatsAppLanguageCode("Comment ça va")).toBe("fr");
        expect(detectWhatsAppLanguageCode("Tudo bem")).toBe("pt");
        expect(detectWhatsAppLanguageCode("kaise ho")).toBe("hi");
        expect(detectWhatsAppLanguageCode("كيفك")).toBe("ar");
    });

    it("does not misclassify French, Portuguese, or English status questions as Serbian", () => {
        expect(detectWhatsAppLanguageCode("Qual é o status dos meus documentos?")).toBe("pt");
        expect(detectWhatsAppLanguageCode("Quel est le statut de mon profil?")).toBe("fr");
        expect(detectWhatsAppLanguageCode("J’ai besoin d’aide pour mes documents")).toBe("fr");
        expect(detectWhatsAppLanguageCode("What is my status?")).toBe("en");
        expect(detectWhatsAppLanguageCode("passport and document")).toBe("en");
        expect(detectWhatsAppLanguageCode("Koji je status mog profila?")).toBe("sr");
    });

    it("detects explicit language-switch requests and keeps the requested language", () => {
        expect(resolveWhatsAppLanguageName("Pisi na srpskom", "English")).toBe("Serbian");
        expect(resolveWhatsAppLanguageName("Reply in French", "English")).toBe("French");
        expect(resolveWhatsAppLanguageName("Continue in Hindi", "English")).toBe("Hindi");
    });

    it("keeps the recent conversation language for short ambiguous follow-ups", () => {
        expect(
            resolveWhatsAppLanguageName(
                "ok",
                "English",
                [
                    { direction: "inbound", content: "Bonjour, ça va ?" },
                    { direction: "outbound", content: "Bonjour ! Je suis l’assistant IA de Workers United." },
                ]
            )
        ).toBe("French");
    });

    it("prefers the most recent inbound language even when an older non-English turn exists", () => {
        expect(
            resolveWhatsAppLanguageName(
                "ok",
                "English",
                [
                    { direction: "inbound", content: "Bonjour, ça va ?" },
                    { direction: "outbound", content: "Bonjour ! Je suis l’assistant IA de Workers United." },
                    { direction: "inbound", content: "okay thanks" },
                ]
            )
        ).toBe("English");
    });

    it("does not let short English status/payment/docs/support questions inherit the previous conversation language", () => {
        const frenchHistory = [
            { direction: "inbound", content: "Bonjour, ça va ?" },
            { direction: "outbound", content: "Bonjour ! Je suis l’assistant IA de Workers United." },
        ];

        expect(resolveWhatsAppLanguageName("What is my status?", "English", frenchHistory)).toBe("English");
        expect(resolveWhatsAppLanguageName("How do I pay?", "English", frenchHistory)).toBe("English");
        expect(resolveWhatsAppLanguageName("Need documents", "English", frenchHistory)).toBe("English");
        expect(resolveWhatsAppLanguageName("Need help", "English", frenchHistory)).toBe("English");
    });

    it("uses the most recent inbound history language when the latest message has no text", () => {
        expect(
            resolveWhatsAppLanguageName(
                "",
                null,
                [
                    { direction: "inbound", content: "Tudo bem" },
                    { direction: "outbound", content: "Olá!" },
                ]
            )
        ).toBe("Portuguese");
    });

    it("rejects English replies when the latest user message is Serbian", () => {
        expect(replyMatchesExpectedWhatsAppLanguage("Serbian", "Hi! Create your account at workersunited.eu/signup.")).toBe(false);
        expect(replyMatchesExpectedWhatsAppLanguage("Serbian", "Naravno. Prvi korak je da napravite nalog na workersunited.eu/signup.")).toBe(true);
    });

    it("accepts valid French, Portuguese, and English status replies without false fallback", () => {
        expect(replyMatchesExpectedWhatsAppLanguage("French", "Votre statut est en cours de revue admin.")).toBe(true);
        expect(replyMatchesExpectedWhatsAppLanguage("Portuguese", "Posso ajudar com seu status, documentos, pagamento ou próximo passo.")).toBe(true);
        expect(replyMatchesExpectedWhatsAppLanguage("English", "Your status is under admin review. Please check your dashboard.")).toBe(true);
        expect(replyMatchesExpectedWhatsAppLanguage("French", "Your status is under admin review.")).toBe(false);
    });

    it("accepts short valid non-English yes-no replies without false language fallback", () => {
        expect(replyMatchesExpectedWhatsAppLanguage("French", "Oui.")).toBe(true);
        expect(replyMatchesExpectedWhatsAppLanguage("Portuguese", "Sim.")).toBe(true);
        expect(replyMatchesExpectedWhatsAppLanguage("Serbian", "Da.")).toBe(true);
        expect(replyMatchesExpectedWhatsAppLanguage("French", "Yes.")).toBe(false);
    });

    it("does not treat an ordinary Serbian worker lead as an employer lead", () => {
        expect(looksLikeWorkerWhatsAppLead("Ocu posao")).toBe(true);
        expect(looksLikeEmployerWhatsAppLead("Pozdrav")).toBe(false);
        expect(looksLikeEmployerWhatsAppLead("Trebaju nam radnici za firmu")).toBe(true);
    });

    it("recognizes greeting-only first contact messages", () => {
        expect(looksLikeGreetingOnlyWhatsAppMessage("Pozdrav")).toBe(true);
        expect(looksLikeGreetingOnlyWhatsAppMessage("Hello!")).toBe(true);
        expect(looksLikeGreetingOnlyWhatsAppMessage("Trebaju mi radnici")).toBe(false);
    });

    it("recognizes warmer greeting small-talk openers", () => {
        expect(looksLikeWarmGreetingWhatsAppMessage("Zdravo kako si danas")).toBe(true);
        expect(looksLikeWarmGreetingWhatsAppMessage("Hello how are you today?")).toBe(true);
        expect(looksLikeWarmGreetingWhatsAppMessage("Jel si dobro")).toBe(true);
        expect(looksLikeWarmGreetingWhatsAppMessage("Comment ça va")).toBe(true);
        expect(looksLikeWarmGreetingWhatsAppMessage("Tudo bem")).toBe(true);
        expect(looksLikeWarmGreetingWhatsAppMessage("kaise ho")).toBe(true);
        expect(looksLikeWarmGreetingWhatsAppMessage("كيفك")).toBe(true);
        expect(looksLikeWarmGreetingWhatsAppMessage("Kako radi uplata?")).toBe(false);
    });

    it("greets vague first-contact users without assuming their role", () => {
        const reply = buildUnregisteredWorkerWhatsAppReply({
            message: "Pozdrav",
            language: "Serbian",
            intent: "general",
            isFirstContact: true,
        });

        expect(reply).toContain("Ja sam Workers United AI asistent");
        expect(reply).toContain("šta vas zanima");
        expect(reply).not.toContain("$9");
    });

    it("answers warm first-contact greetings like a human before giving process help", () => {
        const reply = buildUnregisteredWorkerWhatsAppReply({
            message: "Zdravo kako si danas",
            language: "Serbian",
            intent: "general",
            isFirstContact: true,
        });

        expect(reply).toContain("Ja sam Workers United AI asistent");
        expect(reply).toContain("šta vas zanima");
        expect(reply).not.toContain("Prvi korak je da napravite nalog");
    });

    it("confirms the requested language for unregistered users before continuing", () => {
        const reply = buildUnregisteredWorkerWhatsAppReply({
            message: "Pisi na srpskom",
            language: "English",
            intent: "general",
        });

        expect(reply).toContain("nastaviću na srpskom");
        expect(reply).toContain("Kako mogu da pomognem");
    });

    it("greets generic pre-registration job intent without sounding defensive", () => {
        const reply = buildUnregisteredWorkerWhatsAppReply({
            message: "Ocu posao",
            language: "Serbian",
            intent: "job_intent",
        });

        expect(reply).toContain("Prvi korak je da napravite nalog");
        expect(reply).toContain("workersunited.eu/signup");
        expect(reply).not.toContain("$9");
        expect(reply).not.toContain("ne mogu da potvrdim konkretan otvoren posao");
    });

    it("explains guided matching only when the user asks how the process works", () => {
        const reply = buildUnregisteredWorkerWhatsAppReply({
            message: "Kako radi Workers United proces?",
            language: "Serbian",
            intent: "job_intent",
        });

        expect(reply).toContain("vođeni matching proces");
        expect(reply).toContain("workersunited.eu/signup");
    });

    it("uses the availability guard only for concrete open-job questions", () => {
        const reply = buildUnregisteredWorkerWhatsAppReply({
            message: "Ima li trenutno neki posao za vozaca?",
            language: "Serbian",
            intent: "job_intent",
        });

        expect(reply).toContain("ne mogu da potvrdim konkretan otvoren posao");
        expect(reply).toContain("vođeni matching proces");
    });

    it("allows price explanations for unregistered workers without implying direct WhatsApp payment", () => {
        const reply = buildUnregisteredWorkerWhatsAppReply({
            message: "Koliko kosta",
            language: "Serbian",
            intent: "price",
        });

        expect(reply).toContain("$9");
        expect(reply).toContain("obavezna dokumenta");
        expect(reply).toContain("ne preko WhatsApp-a");
    });

    it("answers registered worker payment status deterministically once approval is done", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "Kako da platim?",
            language: "Serbian",
            intent: "price",
            workerStatus: "APPROVED",
            adminApproved: true,
            entryFeePaid: false,
        });

        expect(reply).toContain("profil je odobren");
        expect(reply).toContain("dashboard");
        expect(reply).not.toContain("payment link");
    });

    it("keeps advanced paid worker status replies specific instead of flattening them to generic payment copy", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "What is my status?",
            language: "English",
            intent: "status",
            workerStatus: "OFFER_PENDING",
            adminApproved: true,
            entryFeePaid: true,
            queueJoinedAt: "2026-03-20T10:00:00.000Z",
        });

        expect(reply).toContain("offer stage");
        expect(reply).not.toContain("payment is recorded");
        expect(reply).not.toContain("next active flow");
    });

    it("prefers status replies over generic support keywords in follow-up status questions", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "What is my status again?",
            language: "English",
            intent: "general",
            workerStatus: "PENDING_APPROVAL",
            adminApproved: false,
            entryFeePaid: false,
        });

        expect(reply).toContain("admin review");
        expect(reply).not.toContain("support inbox");
        expect(reply).not.toContain("screenshot");
    });

    it("does not misroute short review follow-ups into the support branch", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "still in review?",
            language: "English",
            intent: "general",
            workerStatus: "PENDING_APPROVAL",
            adminApproved: false,
            entryFeePaid: false,
        });

        expect(reply).toContain("admin review");
        expect(reply).not.toContain("support inbox");
    });

    it("answers registered worker support requests without inventing a handoff", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "Imam problem sa uplatom",
            language: "Serbian",
            intent: "support",
            workerStatus: "APPROVED",
            adminApproved: true,
            entryFeePaid: true,
            queueJoinedAt: "2026-03-18T10:00:00.000Z",
            hasSupportAccess: true,
        });

        expect(reply).toContain("support inbox");
        expect(reply).toContain("contact@workersunited.eu");
        expect(reply).not.toContain("otvorio");
        expect(reply).not.toContain("ticket");
    });

    it("does not describe support inbox as a simple $9-only unlock", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "Treba mi pomoć",
            language: "Serbian",
            intent: "support",
            workerStatus: "NEW",
            adminApproved: false,
            entryFeePaid: false,
            hasSupportAccess: false,
        });

        expect(reply).toContain("obaveznih dokumenata");
        expect(reply).toContain("admin odobrenja");
        expect(reply).not.toContain("tek posle $9 aktivacije");
    });

    it("keeps registered worker payment gate aligned with required documents", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "How do I pay?",
            language: "English",
            intent: "price",
            workerStatus: "NEW",
            adminApproved: false,
            entryFeePaid: false,
        });

        expect(reply).toContain("required documents");
        expect(reply).toContain("admin approves it");
    });

    it("describes the registered worker process with dashboard checkout wording", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "How does the process work?",
            language: "English",
            intent: "job_intent",
            workerStatus: "PENDING_APPROVAL",
            adminApproved: false,
            entryFeePaid: false,
        });

        expect(reply).toContain("Job Finder checkout unlocks in the dashboard");
        expect(reply).not.toContain("Job Finder activation");
    });

    it("keeps registered-worker greetings warm instead of jumping straight into process instructions", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "Zdravo kako si danas",
            language: "Serbian",
            intent: "general",
            workerStatus: "APPROVED",
            adminApproved: true,
            entryFeePaid: false,
        });

        expect(reply).toContain("Ja sam Workers United AI asistent");
        expect(reply).toContain("šta želite da proverimo");
        expect(reply).not.toContain("Prvi korak");
    });

    it("describes the worker journey as checkout unlock instead of Job Finder activation", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "How does it work?",
            language: "English",
            intent: "job_intent",
            workerStatus: "NEW",
            adminApproved: false,
            entryFeePaid: false,
        });

        expect(reply).toContain("checkout unlocks");
        expect(reply).not.toContain("Job Finder activation");
    });

    it("confirms the requested language for registered workers before continuing", () => {
        const reply = buildRegisteredWorkerWhatsAppReply({
            message: "Pisi na srpskom",
            language: "English",
            intent: "general",
            workerStatus: "PENDING_APPROVAL",
            adminApproved: false,
            entryFeePaid: false,
        });

        expect(reply).toContain("nastaviću na srpskom");
        expect(reply).toContain("statusa, dokumenata, uplate");
    });

    it("builds an honest auto-handoff reply only when support access exists", () => {
        const reply = buildWhatsAppAutoHandoffReply({
            language: "Serbian",
            hasSupportAccess: true,
        });

        expect(reply).toContain("support inbox");
        expect(reply).toContain("prebacio");
    });

    it("detects repeated unresolved payment confusion before another AI answer is sent", () => {
        const analysis = analyzeWhatsAppConfusion([
            { direction: "inbound", content: "Website is not allowing me to pay the required $9" },
            { direction: "outbound", content: "Please try again from your dashboard." },
            { direction: "inbound", content: "I already tried all the solutions you suggested, but the problem persists" },
            { direction: "inbound", content: "still not working, payment problem again" },
        ]);

        expect(analysis.triggered).toBe(true);
        expect(analysis.reason).toBe("payment_loop");
        expect(analysis.inboundBurst).toBeGreaterThanOrEqual(2);
    });

    it("does not let outbound templates pretend the assistant already replied", () => {
        const analysis = analyzeWhatsAppConfusion([
            { direction: "inbound", content: "payment not working" },
            {
                direction: "outbound",
                content: "Template reminder",
                status: "sent",
                message_type: "template",
                template_name: "profile_incomplete",
            },
            { direction: "inbound", content: "still not working" },
            { direction: "inbound", content: "please help me" },
        ]);

        expect(analysis.triggered).toBe(true);
        expect(analysis.inboundBurst).toBe(3);
    });

    it("filters legacy risky WhatsApp brain memory before it reaches prompts", () => {
        const filtered = filterSafeWhatsAppBrainMemory([
            {
                category: "admin_rule",
                content: "Always redirect users to the $9 sign-up and say we offer jobs across Europe.",
                confidence: 1,
            },
            {
                category: "error_fix",
                content: "Avoid claiming specific role availability when available positions are unknown.",
                confidence: 0.7,
            },
            {
                category: "copy_rule",
                content: "Keep the first WhatsApp reply shorter and answer the first question before asking another.",
                confidence: 0.9,
            },
        ]);

        expect(filtered).toEqual([
            {
                category: "error_fix",
                content: "Avoid claiming specific role availability when available positions are unknown.",
                confidence: 0.7,
            },
            {
                category: "copy_rule",
                content: "Keep the first WhatsApp reply shorter and answer the first question before asking another.",
                confidence: 0.9,
            },
        ]);
    });

    it("tells the model to start warmly on vague greetings", () => {
        const rules = buildWorkerWhatsAppRules({
            language: "Serbian",
            intent: "general",
            confidence: "high",
            reason: "Greeting-only first contact",
            isAdmin: false,
        });

        expect(rules).toContain("start warmly");
        expect(rules).toContain("helps workers, employers, and agencies");
        expect(rules).toContain("without assuming their role");
    });
});
