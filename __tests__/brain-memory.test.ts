import { describe, expect, it } from "vitest";
import {
    dedupeBrainFacts,
    isInvalidPricingBrainFact,
    normalizeBrainCategory,
    normalizeBrainContent,
    prepareBrainFactsForStorage,
} from "@/lib/brain-memory";

describe("brain-memory helpers", () => {
    it("normalizes category and falls back to faq for unknown values", () => {
        expect(normalizeBrainCategory("common question")).toBe("common_question");
        expect(normalizeBrainCategory("totally_unknown")).toBe("faq");
    });

    it("normalizes content whitespace", () => {
        expect(normalizeBrainContent("  Entry   fee   is   $9  ")).toBe("Entry fee is $9");
    });

    it("deduplicates facts by normalized category/content and keeps highest confidence", () => {
        const deduped = dedupeBrainFacts([
            { category: "FAQ", content: "Entry fee is $9", confidence: 0.6 },
            { category: "faq", content: "  Entry fee is $9  ", confidence: 0.9 },
            { category: "common question", content: "How long?", confidence: 0.7 },
        ]);

        expect(deduped).toHaveLength(2);
        const feeFact = deduped.find((fact) => fact.content === "Entry fee is $9");
        expect(feeFact?.confidence).toBe(0.9);
    });

    it("flags invalid pricing facts that say the employer pays the placement fee", () => {
        expect(
            isInvalidPricingBrainFact("Employer fee is free. Placement fee (example shown for Serbia) is $190 and is payable separately by the employer when applicable.")
        ).toBe(true);
    });

    it("drops invalid pricing facts and injects the canonical pricing payer rule", () => {
        const prepared = prepareBrainFactsForStorage([
            {
                category: "pricing",
                content: "Placement fee in Serbia is $190 (current market); employer fee is always free.",
            },
            {
                category: "eligibility",
                content: "Workers must upload documents before paying the $9 entry fee.",
            },
        ]);

        expect(prepared.some((fact) => fact.content.toLowerCase().includes("employers never pay platform fees"))).toBe(true);
        expect(prepared.some((fact) => fact.content.includes("Placement fee in Serbia is $190 (current market); employer fee is always free."))).toBe(false);
        expect(prepared.some((fact) => fact.content.includes("Workers must upload documents before paying the $9 entry fee."))).toBe(true);
    });
});
