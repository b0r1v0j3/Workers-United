export interface OpenAIResponseTextOptions {
    model: string;
    instructions: string;
    input: string;
    json?: boolean;
    maxOutputTokens?: number;
}

type OpenAIResponseOutputItem = {
    type?: string;
    content?: Array<{
        text?: string | null;
    }> | null;
};

type OpenAIResponsesPayload = {
    output_text?: string | null;
    output?: OpenAIResponseOutputItem[] | null;
};

export function extractOpenAIResponseText(data: OpenAIResponsesPayload): string {
    const directOutputText = typeof data.output_text === "string" ? data.output_text.trim() : "";
    if (directOutputText) {
        return directOutputText;
    }

    const outputs = Array.isArray(data.output) ? data.output : [];

    for (const item of outputs) {
        const candidate = item?.type === "message" ? item.content?.[0]?.text?.trim() : "";
        if (candidate) {
            return candidate;
        }
    }

    for (const item of outputs) {
        const candidate = item?.content?.[0]?.text?.trim();
        if (candidate) {
            return candidate;
        }
    }

    return "";
}

export async function callOpenAIResponseText(
    apiKey: string,
    options: OpenAIResponseTextOptions
): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: options.model,
            instructions: options.instructions,
            input: options.input,
            ...(options.maxOutputTokens ? { max_output_tokens: options.maxOutputTokens } : {}),
            ...(options.json
                ? {
                    text: {
                        format: { type: "json_object" },
                    },
                }
                : {}),
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI responses failed: ${response.status} - ${errText.substring(0, 300)}`);
    }

    const data = await response.json();
    return extractOpenAIResponseText(data as OpenAIResponsesPayload);
}
