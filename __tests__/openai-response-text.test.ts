import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenAIResponseText, extractOpenAIResponseText } from "@/lib/openai-response-text";

describe("openai-response-text", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("prefers output_text when available", () => {
        expect(extractOpenAIResponseText({
            output_text: "  Hello from output_text  ",
            output: [
                {
                    type: "message",
                    content: [{ text: "Fallback message" }],
                },
            ],
        })).toBe("Hello from output_text");
    });

    it("falls back to the first message block when output_text is empty", () => {
        expect(extractOpenAIResponseText({
            output: [
                {
                    type: "reasoning",
                    content: [{ text: "internal" }],
                },
                {
                    type: "message",
                    content: [{ text: "Final answer" }],
                },
            ],
        })).toBe("Final answer");
    });

    it("falls back to the first text-bearing content block when needed", () => {
        expect(extractOpenAIResponseText({
            output: [
                {
                    type: "reasoning",
                    content: [{ text: "Reasoning fallback" }],
                },
            ],
        })).toBe("Reasoning fallback");
    });

    it("passes json mode through the responses API payload", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ output_text: '{"intent":"general"}' }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await callOpenAIResponseText("test-key", {
            model: "gpt-5-mini",
            instructions: "Return JSON",
            input: "hello",
            json: true,
            maxOutputTokens: 123,
        });

        expect(result).toBe('{"intent":"general"}');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, requestInit] = fetchMock.mock.calls[0];
        expect(requestInit?.method).toBe("POST");
        const parsedBody = JSON.parse(String(requestInit?.body));
        expect(parsedBody.model).toBe("gpt-5-mini");
        expect(parsedBody.max_output_tokens).toBe(123);
        expect(parsedBody.text).toEqual({
            format: { type: "json_object" },
        });
    });
});
