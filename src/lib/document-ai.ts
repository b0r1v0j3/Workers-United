import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.warn("Missing OPENAI_API_KEY and GEMINI_API_KEY - document AI features will not work");
}

const openAI = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
const geminiAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

export interface PassportData {
    full_name: string;
    passport_number: string;
    nationality: string;
    date_of_birth: string;
    expiry_date: string;
    gender?: string;
    place_of_birth?: string;
    date_of_issue?: string;
    issuing_authority?: string;
}

export interface VerificationResult {
    success: boolean;
    data?: PassportData;
    confidence: number;
    issues: string[];
    rawResponse?: string;
    documentKind?: string;
    summary?: string;
    workerGuidance?: string;
}

export interface DocumentQualityResult {
    success: boolean;
    isCorrectType: boolean;
    qualityIssues: string[];
    confidence: number;
    extractedData?: Record<string, string>;
    documentKind?: string;
    summary?: string;
    workerGuidance?: string;
    rawResponse?: string;
}

export interface DocumentVisionImagePayload {
    data: string;
    mimeType: string;
}

export interface DocumentOrientationResult {
    rotationDegrees: 0 | 90 | 180 | 270;
    confidence: number;
    summary?: string;
}

export interface DocumentOrientationOcrPatchOptions {
    detectedRotationDegrees: 0 | 90 | 180 | 270;
    appliedRotationDegrees: 0 | 90 | 180 | 270;
    confidence?: number | null;
    summary?: string | null;
    cropApplied?: boolean;
}

// Helper: fetch image as base64 for document AI providers
export async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return { data: base64, mimeType: contentType };
}

async function resolveDocumentVisionInput(input: string | DocumentVisionImagePayload): Promise<DocumentVisionImagePayload> {
    if (typeof input === "string") {
        return fetchImageAsBase64(input);
    }

    return input;
}

type AIProviderModel = {
    provider: "openai" | "gemini";
    model: string;
};

// ─── Provider Fallback Chain ────────────────────────────────────────────────
// OpenAI is primary for document verification; Gemini remains as infra fallback.
const VISION_CHAIN: AIProviderModel[] = [
    { provider: "openai", model: "gpt-4o-mini" },
    { provider: "gemini", model: "gemini-3.0-flash" },
    { provider: "gemini", model: "gemini-2.5-pro" },
    { provider: "gemini", model: "gemini-2.5-flash" },
];

const TEXT_CHAIN: AIProviderModel[] = [
    { provider: "openai", model: "gpt-4o-mini" },
    { provider: "gemini", model: "gemini-3.0-flash" },
    { provider: "gemini", model: "gemini-2.5-pro" },
    { provider: "gemini", model: "gemini-2.5-flash" },
];

// Custom error to distinguish AI infra failures from real document issues
export class AIInfraError extends Error {
    constructor(message: string, public modelsTried: string[]) {
        super(message);
        this.name = "AIInfraError";
    }
}

function cleanModelJson(text: string): string {
    return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function readModelString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : null;
}

function readModelStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];
}

const DIPLOMA_EXPLICIT_ACCEPT_KINDS = new Set([
    "formal_diploma",
    "formal_vocational_certificate",
    "school_leaving_certificate",
]);

const DIPLOMA_EXPLICIT_REJECT_KINDS = new Set([
    "short_course_certificate",
    "attendance_or_participation_certificate",
    "transcript_or_marksheet",
    "non_educational",
    "unclear",
]);

const DIPLOMA_NEGATIVE_PATTERNS = [
    /\bcertificate of completion\b/i,
    /\bcompletion certificate\b/i,
    /\bcourse completion\b/i,
    /\battendance certificate\b/i,
    /\bcertificate of attendance\b/i,
    /\bcertificate of participation\b/i,
    /\bparticipation certificate\b/i,
    /\bworkshop\b/i,
    /\bseminar\b/i,
    /\bwebinar\b/i,
    /\bbootcamp\b/i,
    /\bshort course\b/i,
    /\bonline course\b/i,
    /\btraining certificate\b/i,
    /\btraining completion\b/i,
    /\bvirtual productivity assistant\b/i,
];

const DIPLOMA_TRANSCRIPT_PATTERNS = [
    /\btranscript\b/i,
    /\bmark\s?sheet\b/i,
    /\bmarksheet\b/i,
    /\breport card\b/i,
];

const DIPLOMA_POSITIVE_PATTERNS = [
    /\bdiploma\b/i,
    /\bdegree\b/i,
    /\bbachelor'?s?\b/i,
    /\bmaster'?s?\b/i,
    /\bph\.?d\b/i,
    /\bdoctorate\b/i,
    /\bhigh school\b/i,
    /\bsecondary school\b/i,
    /\bschool leaving\b/i,
    /\bcollege\b/i,
    /\buniversity\b/i,
    /\bpolytechnic\b/i,
    /\btechnical institute\b/i,
    /\btrade school\b/i,
    /\bvocational\b/i,
    /\bgraduation certificate\b/i,
];

export function evaluateDiplomaGuardrails(parsed: Record<string, unknown>) {
    const documentKind = readModelString(parsed.document_kind)?.toLowerCase() || "";
    const documentTitle = readModelString(parsed.document_title);
    const documentDescription = readModelString(parsed.document_description);
    const degreeType = readModelString(parsed.degree_type);
    const institutionName = readModelString(parsed.institution_name);
    const summary = readModelString(parsed.summary) || documentDescription;

    const searchableText = [
        documentKind,
        documentTitle,
        documentDescription,
        degreeType,
        institutionName,
    ].filter(Boolean).join(" ").toLowerCase();

    const hasShortCourseSignals =
        documentKind === "short_course_certificate"
        || documentKind === "attendance_or_participation_certificate"
        || DIPLOMA_NEGATIVE_PATTERNS.some((pattern) => pattern.test(searchableText));

    const transcriptOnly =
        documentKind === "transcript_or_marksheet"
        || DIPLOMA_TRANSCRIPT_PATTERNS.some((pattern) => pattern.test(searchableText));

    const hasFormalSignals =
        DIPLOMA_EXPLICIT_ACCEPT_KINDS.has(documentKind)
        || DIPLOMA_POSITIVE_PATTERNS.some((pattern) => pattern.test(searchableText));

    if (transcriptOnly) {
        return {
            isAccepted: false,
            documentKind: documentKind || "transcript_or_marksheet",
            summary: summary || "Transcript or marksheet detected without a final diploma.",
            workerGuidance: "Please upload your final school, university, or formal vocational diploma or degree certificate. A transcript or marksheet alone is not enough.",
            issues: ["transcript_only"],
        };
    }

    if (hasShortCourseSignals) {
        return {
            isAccepted: false,
            documentKind: documentKind || "short_course_certificate",
            summary: summary || "Short course or completion certificate detected instead of a formal diploma.",
            workerGuidance: "Please upload your final school, university, or formal vocational diploma. We cannot accept short course, workshop, attendance, or certificate of completion files.",
            issues: ["short_course_not_accepted"],
        };
    }

    if (DIPLOMA_EXPLICIT_REJECT_KINDS.has(documentKind) || !hasFormalSignals) {
        return {
            isAccepted: false,
            documentKind: documentKind || "non_educational",
            summary: summary || "This upload does not look like a final formal education credential.",
            workerGuidance: "Please upload your final school, university, or formal vocational diploma. The document title, institution name, your name, and the main text must be clearly visible.",
            issues: ["not_formal_education"],
        };
    }

    return {
        isAccepted: true,
        documentKind: documentKind || "formal_diploma",
        summary: summary || (institutionName
            ? `Formal education document detected from ${institutionName}.`
            : "Formal education document detected."),
        workerGuidance: null,
        issues: [] as string[],
    };
}

export function normalizeQuarterTurnRotation(value: unknown): 0 | 90 | 180 | 270 {
    return value === 90 || value === 180 || value === 270 ? value : 0;
}

export function buildDocumentOrientationOcrPatch({
    detectedRotationDegrees,
    appliedRotationDegrees,
    confidence,
    summary,
    cropApplied,
}: DocumentOrientationOcrPatchOptions): Record<string, unknown> {
    return {
        orientation_processed_at: new Date().toISOString(),
        detected_rotation_to_upright_degrees: detectedRotationDegrees,
        auto_rotation_applied_degrees: appliedRotationDegrees,
        orientation_detection_confidence: typeof confidence === "number" ? confidence : null,
        ...(summary ? { orientation_summary: summary } : {}),
        ...(cropApplied ? { auto_crop_applied: true } : {}),
    };
}

async function callOpenAIVision(
    image: { data: string; mimeType: string },
    prompt: string,
    modelName: string
): Promise<string> {
    if (!openAI) {
        throw new Error("OPENAI_API_KEY not configured");
    }

    const result = await openAI.chat.completions.create({
        model: modelName,
        temperature: 0,
        max_tokens: 900,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${image.mimeType};base64,${image.data}`,
                        },
                    },
                ],
            },
        ],
    });

    const text = result.choices[0]?.message?.content;
    if (!text) {
        throw new Error(`OpenAI ${modelName} returned empty content`);
    }

    return cleanModelJson(text);
}

async function callOpenAIText(prompt: string, modelName: string): Promise<string> {
    if (!openAI) {
        throw new Error("OPENAI_API_KEY not configured");
    }

    const result = await openAI.chat.completions.create({
        model: modelName,
        temperature: 0,
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0]?.message?.content;
    if (!text) {
        throw new Error(`OpenAI ${modelName} returned empty content`);
    }

    return cleanModelJson(text);
}

async function callGeminiVision(
    image: { data: string; mimeType: string },
    prompt: string,
    modelName: string
): Promise<string> {
    if (!geminiAI) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const model = geminiAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([
        { text: prompt },
        { inlineData: { data: image.data, mimeType: image.mimeType } },
    ]);

    return cleanModelJson(result.response.text());
}

async function callGeminiText(prompt: string, modelName: string): Promise<string> {
    if (!geminiAI) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const model = geminiAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Helper: call document vision model with provider fallback chain
async function callDocumentVision(input: string | DocumentVisionImagePayload, prompt: string): Promise<string> {
    const image = await resolveDocumentVisionInput(input);
    const errors: string[] = [];

    for (const providerModel of VISION_CHAIN) {
        try {
            if (providerModel.provider === "openai") {
                return await callOpenAIVision(image, prompt, providerModel.model);
            }
            return await callGeminiVision(image, prompt, providerModel.model);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            const label = `${providerModel.provider}:${providerModel.model}`;
            console.warn(`[Document AI] ${label} failed: ${msg.substring(0, 200)}`);
            errors.push(`${label}: ${msg.substring(0, 100)}`);
            // Only retry on infra errors (404, 5xx, rate limit), not on content errors
            if (msg.includes("SAFETY") || msg.includes("blocked")) throw err;
            continue;
        }
    }
    throw new AIInfraError(
        `All models failed: ${errors.join(" | ")}`,
        VISION_CHAIN.map(({ provider, model }) => `${provider}:${model}`)
    );
}

// Helper: call document text model with provider fallback chain
export async function callDocumentText(prompt: string): Promise<string> {
    const errors: string[] = [];
    for (const providerModel of TEXT_CHAIN) {
        try {
            if (providerModel.provider === "openai") {
                return await callOpenAIText(prompt, providerModel.model);
            }
            return await callGeminiText(prompt, providerModel.model);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            const label = `${providerModel.provider}:${providerModel.model}`;
            console.warn(`[Document AI Text] ${label} failed: ${msg.substring(0, 200)}`);
            errors.push(`${label}: ${msg.substring(0, 100)}`);
            if (msg.includes("SAFETY") || msg.includes("blocked")) throw err;
            continue;
        }
    }
    throw new AIInfraError(
        `All text models failed: ${errors.join(" | ")}`,
        TEXT_CHAIN.map(({ provider, model }) => `${provider}:${model}`)
    );
}

export async function extractPassportData(imageUrl: string): Promise<VerificationResult> {
    try {
        const prompt = `You are a passport identity-page analyzer.
Your job is to decide whether this upload shows the INSIDE passport biodata / identity page.

Be tolerant about quality problems like blur, glare, shadows, or angle.
But be STRICT about document type:
- A closed passport cover is NOT valid
- A random inside visa/stamp page is NOT valid
- Another document type is NOT valid
- The upload is only valid if the passport identity page is visible, with the holder photo and personal details area

Return a JSON object with EXACTLY these fields:
{
  "document_kind": "passport_data_page | passport_cover | passport_other_page | non_passport | unclear",
  "summary": "short admin-facing summary of what is visible",
  "worker_guidance": "short direct instruction telling the worker what to upload next",
  "full_name": "SURNAME GIVEN_NAMES",
  "passport_number": "ABC123456",
  "nationality": "COUNTRY",
  "date_of_birth": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "date_of_issue": "YYYY-MM-DD",
  "issuing_authority": "ISSUING AUTHORITY NAME",
  "gender": "M or F",
  "place_of_birth": "CITY",
  "readable": true,
  "confidence": 0.0,
  "issues": ["passport_cover_only | passport_other_page | non_passport | blurry | glare | cropped | unreadable_fields"]
}

Rules:
- Set document_kind to "passport_cover" when the upload shows the front/back cover or a closed passport booklet
- Set document_kind to "passport_other_page" when it is a passport page but NOT the biodata page
- Set document_kind to "non_passport" when it is clearly some other document or photo
- Set readable=true ONLY when the biodata page is visible and the main identity details can be read
- If the biodata page is present but some fields are hard to read, keep document_kind="passport_data_page", set readable=true, and list the quality issues
- If you cannot confidently tell what the upload is, set document_kind="unclear", readable=false

Return ONLY the JSON object, no other text.`;

        const content = await callDocumentVision(imageUrl, prompt);
        const parsed = JSON.parse(content);
        const issues = Array.isArray(parsed.issues)
            ? parsed.issues.filter((issue: unknown): issue is string => typeof issue === "string" && issue.trim().length > 0)
            : [];
        const documentKind = typeof parsed.document_kind === "string" ? parsed.document_kind.trim() : "";
        const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
        const workerGuidance = typeof parsed.worker_guidance === "string" ? parsed.worker_guidance.trim() : "";
        const looksLikeDataPage = documentKind === "passport_data_page"
            || (!!parsed.readable && typeof parsed.passport_number === "string" && typeof parsed.full_name === "string");

        if (!parsed.readable || !looksLikeDataPage) {
            return {
                success: false,
                confidence: parsed.confidence || 0,
                issues: issues.length > 0 ? issues : ["Document not readable"],
                rawResponse: content,
                documentKind,
                summary,
                workerGuidance,
            };
        }

        return {
            success: true,
            data: {
                full_name: parsed.full_name,
                passport_number: parsed.passport_number,
                nationality: parsed.nationality,
                date_of_birth: parsed.date_of_birth,
                expiry_date: parsed.expiry_date,
                gender: parsed.gender,
                place_of_birth: parsed.place_of_birth,
                date_of_issue: parsed.date_of_issue,
                issuing_authority: parsed.issuing_authority,
            },
            confidence: parsed.confidence || 0.8,
            issues,
            rawResponse: content,
            documentKind,
            summary,
            workerGuidance,
        };
    } catch (error) {
        console.error("Passport extraction error:", error);
        // Brain Fix: Distinguish AI infra failures from real document issues
        if (error instanceof AIInfraError) {
            return {
                success: false,
                confidence: 0,
                issues: ["system_error: AI verification temporarily unavailable — queued for manual review"],
                rawResponse: `INFRA_ERROR: ${error.message}`,
            };
        }
        return {
            success: false,
            confidence: 0,
            issues: [`AI processing error: ${error instanceof Error ? error.message : "Unknown error"}`],
        };
    }
}

export function compareNames(aiName: string, signupName: string): boolean {
    const normalize = (name: string) =>
        name.toLowerCase()
            .replace(/[^a-z\s]/g, "")
            .split(/\s+/)
            .filter(Boolean)
            .sort()
            .join(" ");

    const aiNormalized = normalize(aiName);
    const signupNormalized = normalize(signupName);

    if (aiNormalized === signupNormalized) return true;

    const aiParts = aiNormalized.split(" ");
    const signupParts = signupNormalized.split(" ");

    return signupParts.every(part =>
        aiParts.some(aiPart => aiPart.includes(part) || part.includes(aiPart))
    );
}

export async function verifyDiploma(imageUrl: string): Promise<DocumentQualityResult> {
    try {
        const prompt = `You are a formal education credential verifier.
Decide whether this upload is a FINAL FORMAL EDUCATION DOCUMENT that we can accept as the worker's diploma.

Accept ONLY documents such as:
- high school / secondary school diplomas or school-leaving certificates
- university / college degree diplomas or degree certificates
- final vocational / trade / technical diplomas or certificates from a formal school, polytechnic, technical institute, or government-recognized training institution

Reject documents such as:
- certificate of completion
- course completion certificate
- workshop / seminar / webinar / bootcamp certificate
- attendance / participation certificate
- generic training certificate for a short course
- online course certificate
- transcript / marksheet / report card when the final diploma or degree certificate is not visible
- any non-education file

Return JSON:
{
  "is_formal_education_document": true/false,
  "document_kind": "formal_diploma | formal_vocational_certificate | school_leaving_certificate | transcript_or_marksheet | short_course_certificate | attendance_or_participation_certificate | non_educational | unclear",
  "document_title": "main title if visible",
  "document_description": "brief description of what this document actually is",
  "worker_guidance": "short direct instruction telling the worker what to upload next",
  "readable": true/false,
  "quality_issues": [],
  "confidence": 0.0-1.0,
  "institution_name": "name if readable",
  "degree_type": "type if readable",
  "graduation_year": "year if readable"
}

Rules:
- If the title says "Certificate of Completion" or similar, reject it as short_course_certificate unless it is clearly the final graduation certificate from a real school or university.
- If the upload is only a transcript, marksheet, or report card, reject it as transcript_or_marksheet.
- Set readable=true only when the main title, institution name, holder name, and main body text are visible enough to understand the document.
- worker_guidance must tell the worker exactly what to upload next.

Return ONLY the JSON object, no other text.`;

        const content = await callDocumentVision(imageUrl, prompt);
        const parsed = JSON.parse(content);
        const guardrail = evaluateDiplomaGuardrails(parsed);
        const aiAccepted = parsed.is_formal_education_document === true || parsed.is_school_diploma === true;
        const readable = parsed.readable !== false;
        const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
        const qualityIssues = Array.from(new Set([
            ...guardrail.issues,
            ...readModelStringArray(parsed.quality_issues),
        ]));

        if (!readable && !qualityIssues.includes("unreadable_fields")) {
            qualityIssues.push("unreadable_fields");
        }

        const workerGuidance = readModelString(parsed.worker_guidance)
            || guardrail.workerGuidance
            || (!readable
                ? "Please upload a clearer image or scan of your final school, university, or formal vocational diploma. The document title, institution name, your name, and the main text must be readable."
                : null);
        const summary = readModelString(parsed.document_description)
            || readModelString(parsed.summary)
            || guardrail.summary
            || null;
        const isCorrectType = aiAccepted && guardrail.isAccepted;

        return {
            success: isCorrectType && readable && confidence >= 0.75,
            isCorrectType,
            qualityIssues,
            confidence,
            extractedData: {
                institution_name: parsed.institution_name || "",
                degree_type: parsed.degree_type || "",
                graduation_year: parsed.graduation_year || "",
                document_title: parsed.document_title || "",
                document_description: parsed.document_description || "",
            },
            documentKind: guardrail.documentKind,
            summary: summary || undefined,
            workerGuidance: workerGuidance || undefined,
            rawResponse: content,
        };
    } catch (error) {
        console.error("Diploma verification error:", error);
        // Brain Fix: AI infra failure → accept for manual review, don't reject
        if (error instanceof AIInfraError) {
            return {
                success: true, // Accept it — manual review will verify
                isCorrectType: true,
                qualityIssues: ["system_error: AI verification unavailable — accepted for manual review"],
                confidence: 0.3,
            };
        }
        return {
            success: false,
            isCorrectType: false,
            qualityIssues: ["Verification failed — please try again"],
            confidence: 0,
        };
    }
}

export async function verifyBiometricPhoto(imageUrl: string): Promise<DocumentQualityResult> {
    try {
        const prompt = `You are a biometric photo analyzer.
Be EXTREMELY LENIENT. Accept almost ANY photo that shows a person.
Only set is_valid_photo to false if:
- The image contains NO person at all (e.g., a landscape, a document, a blank image)
- The image is completely black or blank

Accept even if:
- Photo is slightly blurry or dark
- Person is not looking at camera
- Background is not plain
- Photo has poor quality
- Multiple people (just note it as an issue but still accept)

Return JSON:
{
  "is_valid_photo": true/false,
  "quality_issues": ["list any minor issues"],
  "confidence": 0.0-1.0
}

IMPORTANT: If you can see ANY person in the photo, set is_valid_photo to true. We will verify manually later.
Return ONLY the JSON object, no other text.`;

        const content = await callDocumentVision(imageUrl, prompt);
        const parsed = JSON.parse(content);

        return {
            success: parsed.is_valid_photo === true,
            isCorrectType: parsed.is_valid_photo === true,
            qualityIssues: parsed.quality_issues || [],
            confidence: parsed.confidence || 0.7,
        };
    } catch (error) {
        console.error("Photo verification error:", error);
        return {
            success: true,
            isCorrectType: true,
            qualityIssues: ["Auto-accepted for manual review"],
            confidence: 0.5,
        };
    }
}

/**
 * Detect document boundaries and rotation within an image.
 * Returns crop coordinates as percentages (0-100) and rotation angle.
 * Used when a user photographs a document on a table — we crop and rotate to just the document.
 */
export async function detectDocumentOrientation(input: string | DocumentVisionImagePayload, docType: string): Promise<DocumentOrientationResult> {
    try {
        const docLabel = docType === 'passport'
            ? 'passport identity page'
            : docType === 'diploma'
                ? 'diploma or certificate'
                : docType === 'biometric_photo'
                    ? 'portrait photo'
                    : 'document';

        const prompt = `You are an image orientation detector.
Look at the main text and visual layout of this ${docLabel}.

Return JSON:
{
  "rotation_degrees_to_upright": 0,
  "confidence": 0.0,
  "summary": "short note about current orientation"
}

Rules:
- rotation_degrees_to_upright is the CLOCKWISE rotation that should be applied to the image so a human can read it upright
- Allowed values: 0, 90, 180, 270
- If the document is upside down, return 180
- If the top of the text currently points to the left side of the screen, return 90
- If the top of the text currently points to the right side of the screen, return 270
- If it is already upright, return 0
- If uncertain, pick the most likely value and lower confidence

Return ONLY the JSON object.`;

        const content = await callDocumentVision(input, prompt);
        const parsed = JSON.parse(content);
        return {
            rotationDegrees: normalizeQuarterTurnRotation(parsed.rotation_degrees_to_upright ?? parsed.rotation_degrees),
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
            summary: typeof parsed.summary === "string" ? parsed.summary.trim() : undefined,
        };
    } catch (error) {
        console.error("Document orientation detection error:", error);
        return {
            rotationDegrees: 0,
            confidence: 0,
        };
    }
}

export async function detectDocumentBounds(input: string | DocumentVisionImagePayload, docType: string): Promise<{
    found: boolean;
    crop?: { x: number; y: number; width: number; height: number };
    rotationDegrees?: number;
}> {
    try {
        const docLabel = docType === 'passport' ? 'passport data page' :
            docType === 'diploma' ? 'diploma, certificate, or educational document' :
                docType === 'biometric_photo' ? 'person photo' :
                    'document';

        const prompt = `You are a document detector and orientation analyzer. Find the ${docLabel} in this image.
The document may be photographed on a table, desk, or other surface with background visible.
The document may also be ROTATED — text might be sideways or upside down.

Return JSON:
{
  "document_found": true/false,
  "rotation_degrees_to_upright": 0,
  "crop_x_percent": 0-100,
  "crop_y_percent": 0-100,
  "crop_width_percent": 0-100,
  "crop_height_percent": 0-100,
  "needs_cropping": true/false
}

Rules for rotation_degrees_to_upright:
- Return the CLOCKWISE rotation that should be applied so the document becomes upright for reading
- 0 = already upright
- 90 = rotate the image 90° clockwise to make it upright
- 180 = rotate the image 180° to make it upright
- 270 = rotate the image 270° clockwise to make it upright
- ONLY use values: 0, 90, 180, or 270

Rules for cropping:
- If the document fills most of the image (>80% area), set needs_cropping to false
- crop_x_percent and crop_y_percent are the top-left corner of the document
- Add 2% padding around the document edges for safety
- Return ONLY the JSON object, no other text.`;

        const content = await callDocumentVision(input, prompt);
        const parsed = JSON.parse(content);

        // Normalize rotation to 0/90/180/270
        const rotationDegrees = normalizeQuarterTurnRotation(parsed.rotation_degrees_to_upright ?? parsed.rotation_degrees);

        if (!parsed.document_found) {
            return { found: false };
        }

        // Return rotation even if no cropping needed
        if (!parsed.needs_cropping) {
            return {
                found: true,
                rotationDegrees,
            };
        }

        return {
            found: true,
            rotationDegrees,
            crop: {
                x: Math.max(0, parsed.crop_x_percent || 0),
                y: Math.max(0, parsed.crop_y_percent || 0),
                width: Math.min(100, parsed.crop_width_percent || 100),
                height: Math.min(100, parsed.crop_height_percent || 100),
            }
        };
    } catch (error) {
        console.error("Document bounds detection error:", error);
        return { found: false };
    }
}
