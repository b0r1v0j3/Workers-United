import { describe, expect, it } from "vitest";
import {
    buildCanonicalWhatsAppFacts,
    buildWorkerWhatsAppRules,
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
        expect(facts).toContain("payment unlocks only after the worker profile is fully complete and approved by admin");
        expect(facts).toContain("Document uploads and screenshots are not processed as WhatsApp attachments yet");
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
});
