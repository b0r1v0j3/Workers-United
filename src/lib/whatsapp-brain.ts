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

const WHATSAPP_ONBOARDING_PATTERN = /fill.*profile.*whatsapp|complete.*profile.*whatsapp|register.*whatsapp|whatsapp.*profile|whatsapp.*register|profile.*on whatsapp|popuni.*profil.*whatsapp|profil.*na whatsapp|registr.*preko whatsapp|registro.*whatsapp|perfil.*whatsapp/i;

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

export function shouldStartWhatsAppOnboarding(message: string): boolean {
    return WHATSAPP_ONBOARDING_PATTERN.test(message.toLowerCase().trim());
}

export function buildCanonicalWhatsAppFacts({
    supportEmail = "contact@workersunited.eu",
    website = "workersunited.eu",
}: CanonicalWhatsAppFactsOptions = {}): string {
    return [
        "- Workers United is a full-service hiring and visa-support platform, not a public job board.",
        "- Job Finder is a paid search service: the worker registers a profile first, then Workers United searches for a suitable match during the 90-day service period.",
        "- There is no standing inventory of jobs and no public vacancy catalog waiting on the shelf. Openings appear over time and suitable places can be filled quickly.",
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
3. Never imply that there is a list of jobs ready to browse right now. Explain Job Finder as a search-and-wait service when relevant.
4. If the user is not yet registered and asks how to start, tell them to register at ${website}/signup first. After signup they can continue either in the dashboard or here on WhatsApp.
5. Do NOT push payment before registration, full profile completion, and admin approval. If an unregistered user asks about price, explain the $9 service briefly, but say registration/profile comes first.
6. Do NOT share direct payment links from WhatsApp. If the worker is truly payment-ready, tell them to open the dashboard and start checkout there.
7. If the user asks to see jobs before paying, explain simply that Workers United does not keep a public stock of jobs; the service is searching and waiting for the right match.
8. If the user asks about documents, answer only the required documents and say uploads happen in the dashboard. Never claim WhatsApp attachments update the profile.
9. If the user asks about status, use only the provided snapshot and never invent missing data.
10. Never claim you escalated, forwarded screenshots, opened a ticket, or that a human/technical team will reply unless the system has actually performed that action.
11. If the user wants human help or reports a bug, acknowledge it and direct them to the dashboard or ${website}/signup as appropriate, plus ${supportEmail}, but do not promise a live handoff.
12. If the user already paid and asks for help, you may mention the support inbox in the dashboard as an option in addition to WhatsApp.
13. Ask at most one short follow-up question, and only when it helps move the conversation forward.
14. If someone says they are an agency or employer, do not collect worker personal profile fields from them.
15. Never invent legal rules, salaries, timelines, country promises, worker counts, current vacancies, or hidden internal actions.
16. Never start the reply with a symbol or a list marker.
17. ${isAdmin ? "This is the platform owner. If they give a correction, treat it as authoritative." : "Do not invent facts that are not in the canonical facts, the snapshot, or the stored memory."}`;
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
4. Do not claim exact worker counts, origin countries, vacancy stock, or timelines unless those facts are explicitly supplied as verified system facts.
5. If they ask how to start, tell them to register the employer profile at ${website}/signup first. After signup, they can continue through the dashboard or here on WhatsApp over the same company record.
6. Ask only one next hiring question at a time: worker type, number of workers, work location, start date, salary, or housing.
7. Do not promise immediate availability. Explain that matching depends on fit and timing.
8. Do not mention worker-side pricing.
9. Never invent legal guarantees, salary bands, or current open roles.
10. Stay practical and operational: answer, then move them to the next concrete step.`;
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
