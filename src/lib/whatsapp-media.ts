// ─── WhatsApp Media Processing ──────────────────────────────────────────────
// Downloads media from WhatsApp Cloud API and processes it with Claude:
// - Audio/voice messages → transcription
// - Image messages → document detection + OCR extraction

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface MediaUrlResponse {
    url?: string;
    mime_type?: string;
}

/**
 * Download a WhatsApp media file by its media ID.
 * Returns the raw binary as a Buffer + the MIME type.
 */
export async function downloadWhatsAppMedia(
    mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
    const token = process.env.WHATSAPP_TOKEN;
    if (!token) {
        throw new Error("WHATSAPP_TOKEN not configured");
    }

    // Step 1: Get the media URL from Meta
    const metaResponse = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaResponse.ok) {
        throw new Error(`Failed to get media URL: ${metaResponse.status}`);
    }

    const metaData = (await metaResponse.json()) as MediaUrlResponse;
    if (!metaData.url) {
        throw new Error("No media URL returned from Meta");
    }

    // Step 2: Download the actual media file
    const mediaResponse = await fetch(metaData.url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!mediaResponse.ok) {
        throw new Error(`Failed to download media: ${mediaResponse.status}`);
    }

    const arrayBuffer = await mediaResponse.arrayBuffer();
    const mimeType = metaData.mime_type || mediaResponse.headers.get("content-type") || "application/octet-stream";

    return {
        buffer: Buffer.from(arrayBuffer),
        mimeType,
    };
}

/**
 * Transcribe a WhatsApp voice/audio message using Claude's audio understanding.
 * Claude can process audio natively — we send it as base64.
 */
export async function transcribeWhatsAppAudio(
    apiKey: string,
    mediaId: string
): Promise<{ text: string; language: string }> {
    const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId);

    // Claude supports audio via base64 in the content block
    const base64Audio = buffer.toString("base64");

    // Map WhatsApp MIME types to Claude-supported types
    const claudeMimeType = mapAudioMimeType(mimeType);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: "You transcribe audio messages. Return ONLY a JSON object with two fields: \"text\" (the transcription) and \"language\" (ISO 639-1 code like \"sr\", \"en\", \"ar\", \"de\"). If the audio is unclear, do your best. Never refuse — always attempt transcription.",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "document",
                            source: {
                                type: "base64",
                                media_type: claudeMimeType,
                                data: base64Audio,
                            },
                        },
                        {
                            type: "text",
                            text: "Transcribe this audio message. Return JSON: {\"text\": \"...\", \"language\": \"xx\"}",
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude audio transcription failed: ${response.status} - ${errText.substring(0, 300)}`);
    }

    const data = await response.json();
    const content = Array.isArray(data.content) ? data.content : [];
    const textBlock = content.find((b: { type: string }) => b.type === "text");
    const raw = textBlock?.text?.trim() || "";

    try {
        const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
        return {
            text: typeof parsed.text === "string" ? parsed.text.trim() : raw,
            language: typeof parsed.language === "string" ? parsed.language : "en",
        };
    } catch {
        // If JSON parse fails, return raw text
        return { text: raw, language: "en" };
    }
}

/**
 * Analyze a WhatsApp image message with Claude Vision.
 * Detects if it's a document (passport, ID, diploma, etc.) and extracts data.
 */
export async function analyzeWhatsAppImage(
    apiKey: string,
    mediaId: string
): Promise<{
    isDocument: boolean;
    documentType: string | null;
    extractedText: string;
    description: string;
}> {
    const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId);
    const base64Image = buffer.toString("base64");

    const imageMimeType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: `You analyze images sent via WhatsApp for Workers United, a job placement platform.
Your job: determine if the image is a document (passport, ID card, diploma, certificate, CV, work permit, etc.)
or just a regular photo/screenshot.

Return ONLY a JSON object:
{
  "is_document": true/false,
  "document_type": "passport" | "id_card" | "diploma" | "certificate" | "cv" | "work_permit" | "contract" | "other_document" | null,
  "extracted_text": "Key text visible in the document (name, number, dates, etc.)",
  "description": "Brief description of what you see"
}

If it's a document, extract as much useful text as possible (names, numbers, dates, issuing authority).
If it's not a document, set is_document to false and describe the image briefly.
Never refuse — always analyze.`,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: imageMimeType,
                                data: base64Image,
                            },
                        },
                        {
                            type: "text",
                            text: "Analyze this image. Is it a document? Extract text if so.",
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Claude image analysis failed: ${response.status} - ${errText.substring(0, 300)}`);
    }

    const data = await response.json();
    const content = Array.isArray(data.content) ? data.content : [];
    const textBlock = content.find((b: { type: string }) => b.type === "text");
    const raw = textBlock?.text?.trim() || "";

    try {
        const parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
        return {
            isDocument: parsed.is_document === true,
            documentType: typeof parsed.document_type === "string" ? parsed.document_type : null,
            extractedText: typeof parsed.extracted_text === "string" ? parsed.extracted_text : "",
            description: typeof parsed.description === "string" ? parsed.description : "",
        };
    } catch {
        return {
            isDocument: false,
            documentType: null,
            extractedText: "",
            description: raw.substring(0, 200),
        };
    }
}

function mapAudioMimeType(mimeType: string): string {
    // WhatsApp sends audio/ogg; codecs=opus for voice messages
    if (mimeType.includes("ogg")) return "audio/ogg";
    if (mimeType.includes("mp4")) return "audio/mp4";
    if (mimeType.includes("mpeg")) return "audio/mpeg";
    if (mimeType.includes("wav")) return "audio/wav";
    if (mimeType.includes("webm")) return "audio/webm";
    // Default fallback
    return "audio/ogg";
}

// ─── Media type helpers ─────────────────────────────────────────────────────

export function isAudioWhatsAppMessage(messageType: string): boolean {
    return messageType === "audio" || messageType === "voice";
}

export function isImageWhatsAppMessage(messageType: string): boolean {
    return messageType === "image";
}
