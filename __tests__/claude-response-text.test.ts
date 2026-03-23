import { describe, expect, it } from "vitest";
import { extractClaudeResponseText } from "@/lib/claude-response-text";

describe("extractClaudeResponseText", () => {
    it("extracts text from a standard Claude Messages API response", () => {
        const data = {
            content: [
                { type: "text", text: "Hello, how can I help?" },
            ],
        };

        expect(extractClaudeResponseText(data)).toBe("Hello, how can I help?");
    });

    it("trims whitespace from extracted text", () => {
        const data = {
            content: [
                { type: "text", text: "  Some reply  \n" },
            ],
        };

        expect(extractClaudeResponseText(data)).toBe("Some reply");
    });

    it("skips empty text blocks and returns the first non-empty one", () => {
        const data = {
            content: [
                { type: "text", text: "" },
                { type: "text", text: "Second block" },
            ],
        };

        expect(extractClaudeResponseText(data)).toBe("Second block");
    });

    it("returns empty string when content array is empty", () => {
        expect(extractClaudeResponseText({ content: [] })).toBe("");
    });

    it("returns empty string when content is null", () => {
        expect(extractClaudeResponseText({ content: null })).toBe("");
    });

    it("returns empty string when response has no content field", () => {
        expect(extractClaudeResponseText({})).toBe("");
    });

    it("ignores non-text content blocks", () => {
        const data = {
            content: [
                { type: "tool_use", text: "should ignore this" },
                { type: "text", text: "Actual reply" },
            ],
        };

        expect(extractClaudeResponseText(data)).toBe("Actual reply");
    });
});
