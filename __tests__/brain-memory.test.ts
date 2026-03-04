import { describe, expect, it } from "vitest";
import {
    dedupeBrainFacts,
    normalizeBrainCategory,
    normalizeBrainContent,
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
});
