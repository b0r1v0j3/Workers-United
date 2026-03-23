// ─── WhatsApp Media Processing ──────────────────────────────────────────────
// Downloads media from WhatsApp Cloud API and processes it:
// - Audio/voice messages → OpenAI Whisper transcription
// - Image messages → Claude Vision document detection + OCR extraction

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
 * Map MIME type to a file extension Whisper accepts.
 * Whisper supports: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
 */
function getAudioExtension(mimeType: string): string {
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("mpeg") || mimeType.includes("mpga")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("flac")) return "flac";
    if (mimeType.includes("m4a")) return "m4a";
    return "ogg"; // WhatsApp voice notes are ogg/opus
}

/**
 * Transcribe a WhatsApp voice/audio message using OpenAI Whisper API.
 * Whisper natively handles 50+ languages including Serbian, Arabic, Hindi, etc.
 */
export async function transcribeWhatsAppAudio(
    openaiApiKey: string,
    mediaId: string
): Promise<{ text: string; language: string }> {
    const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId);

    const extension = getAudioExtension(mimeType);

    // Whisper API uses multipart/form-data
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("file", blob, `voice.${extension}`);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${openaiApiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Whisper transcription failed: ${response.status} - ${errText.substring(0, 300)}`);
    }

    const data = await response.json();

    return {
        text: typeof data.text === "string" ? data.text.trim() : "",
        language: typeof data.language === "string" ? data.language : "en",
    };
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

// ─── Media type helpers ─────────────────────────────────────────────────────

export function isAudioWhatsAppMessage(messageType: string): boolean {
    return messageType === "audio" || messageType === "voice";
}

export function isImageWhatsAppMessage(messageType: string): boolean {
    return messageType === "image";
}
