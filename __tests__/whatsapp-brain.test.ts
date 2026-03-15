import { describe, expect, it } from "vitest";
import {
    buildCanonicalWhatsAppFacts,
    filterSafeBrainLearnings,
    shouldStartWhatsAppOnboarding,
} from "@/lib/whatsapp-brain";

describe("whatsapp-brain guards", () => {
    it("does not start onboarding for normal vacancy questions", () => {
        expect(shouldStartWhatsAppOnboarding("Hi, I have a question about Workers United")).toBe(false);
        expect(shouldStartWhatsAppOnboarding("What kind of work do you have for a client in Serbia?")).toBe(false);
        expect(shouldStartWhatsAppOnboarding("yes, I need a full job description")).toBe(false);
    });

    it("starts onboarding only for explicit WhatsApp profile requests", () => {
        expect(shouldStartWhatsAppOnboarding("I want to complete my profile on WhatsApp")).toBe(true);
        expect(shouldStartWhatsAppOnboarding("Can I register on WhatsApp?")).toBe(true);
    });

    it("keeps canonical facts aligned with the real Job Finder model", () => {
        const facts = buildCanonicalWhatsAppFacts();

        expect(facts).toContain("not a public job board");
        expect(facts).toContain("There is no standing inventory of jobs");
        expect(facts).toContain("After signup, the user can continue in the dashboard or here on WhatsApp");
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
});
