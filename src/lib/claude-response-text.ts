export interface ClaudeResponseTextOptions {
    model: string;
    instructions: string;
    input: string;
    json?: boolean;
    maxOutputTokens?: number;
}

interface ClaudeMessageContent {
    type?: string;
    text?: string;
}

interface ClaudeMessagesResponse {
    content?: ClaudeMessageContent[] | null;
    stop_reason?: string | null;
}

export function extractClaudeResponseText(data: ClaudeMessagesResponse): string {
    const content = Array.isArray(data.content) ? data.content : [];

    for (const block of content) {
        if (block.type === "text" && typeof block.text === "string") {
            const trimmed = block.text.trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }

    return "";
}

export async function callClaudeResponseText(
    apiKey: string,
    options: ClaudeResponseTextOptions
): Promise<string> {
    const messages = [
        {
            role: "user" as const,
            content: options.input,
        },
    ];

    const body: Record<string, unknown> = {
        model: options.model,
        max_tokens: options.maxOutputTokens || 1024,
        system: options.instructions,
        messages,
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude API failed: ${response.status} - ${errText.substring(0, 300)}`);
    }

    const data = await response.json();
    return extractClaudeResponseText(data as ClaudeMessagesResponse);
}
