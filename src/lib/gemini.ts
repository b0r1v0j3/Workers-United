import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
    console.warn("Missing GEMINI_API_KEY - AI features will not work");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key_for_build");

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
}

export interface DocumentQualityResult {
    success: boolean;
    isCorrectType: boolean;
    qualityIssues: string[];
    confidence: number;
    extractedData?: Record<string, string>;
}

// Helper: fetch image as base64 for Gemini
export async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return { data: base64, mimeType: contentType };
}

// ─── Model Fallback Chain ───────────────────────────────────────────────────
// If primary model fails (404, 5xx, rate limit), try next model automatically.
// Brain Issue #7/#10/#13/#16: prevents false user rejections from AI infra errors.
const MODEL_CHAIN = ["gemini-3.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"];

// Custom error to distinguish AI infra failures from real document issues
export class AIInfraError extends Error {
    constructor(message: string, public modelsTried: string[]) {
        super(message);
        this.name = "AIInfraError";
    }
}

// Helper: call Gemini with image and prompt, with model fallback chain
async function callGeminiVision(imageUrl: string, prompt: string): Promise<string> {
    const image = await fetchImageAsBase64(imageUrl);
    const errors: string[] = [];

    for (const modelName of MODEL_CHAIN) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([
                { text: prompt },
                { inlineData: { data: image.data, mimeType: image.mimeType } },
            ]);
            const text = result.response.text();
            return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        } catch (err: any) {
            const msg = err?.message || String(err);
            console.warn(`[Gemini] Model ${modelName} failed: ${msg.substring(0, 200)}`);
            errors.push(`${modelName}: ${msg.substring(0, 100)}`);
            // Only retry on infra errors (404, 5xx, rate limit), not on content errors
            if (msg.includes("SAFETY") || msg.includes("blocked")) throw err;
            continue;
        }
    }
    throw new AIInfraError(
        `All models failed: ${errors.join(" | ")}`,
        MODEL_CHAIN
    );
}

// Helper: call Gemini text-only, with model fallback chain
export async function callGeminiText(prompt: string): Promise<string> {
    const errors: string[] = [];
    for (const modelName of MODEL_CHAIN) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (err: any) {
            const msg = err?.message || String(err);
            console.warn(`[Gemini Text] Model ${modelName} failed: ${msg.substring(0, 200)}`);
            errors.push(`${modelName}: ${msg.substring(0, 100)}`);
            if (msg.includes("SAFETY") || msg.includes("blocked")) throw err;
            continue;
        }
    }
    throw new AIInfraError(`All text models failed: ${errors.join(" | ")}`, MODEL_CHAIN);
}

export async function extractPassportData(imageUrl: string): Promise<VerificationResult> {
    try {
        const prompt = `You are a passport document analyzer. Extract information from this passport image.
Be VERY LENIENT — accept photos even if slightly blurry, dark, or taken at an angle.
Only set readable to false if the image is clearly NOT a passport at all (e.g., a selfie, a random document, a blank page).
If the image shows ANY passport-like document, set readable to true and try your best to extract data.

Return a JSON object with EXACTLY these fields (use null if not readable):
{
  "full_name": "SURNAME GIVEN_NAMES",
  "passport_number": "ABC123456",
  "nationality": "COUNTRY",
  "date_of_birth": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "date_of_issue": "YYYY-MM-DD",
  "issuing_authority": "ISSUING AUTHORITY NAME",
  "gender": "M or F",
  "place_of_birth": "CITY",
  "readable": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list of problems if any"]
}

IMPORTANT: Be generous. If it looks like a passport, accept it. We will manually verify later.
Return ONLY the JSON object, no other text.`;

        const content = await callGeminiVision(imageUrl, prompt);
        const parsed = JSON.parse(content);

        if (!parsed.readable) {
            return {
                success: false,
                confidence: parsed.confidence || 0,
                issues: parsed.issues || ["Document not readable"],
                rawResponse: content,
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
            issues: parsed.issues || [],
            rawResponse: content,
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
        const prompt = `You are a document verification helper. Determine if this is an educational document.

Be VERY LENIENT. Accept ANY educational or training document:
- School diplomas, university degrees
- Vocational certificates, trade school certificates
- Professional certificates, training certificates
- Course completion certificates
- Language certificates
- Any document from an educational institution

Only set is_school_diploma to false if:
- The image is clearly NOT any kind of certificate/diploma (e.g., a selfie, passport, receipt, blank page)
- The image is completely unreadable

Return JSON:
{
  "is_school_diploma": true/false,
  "document_description": "brief description of what this document actually is",
  "readable": true/false,
  "quality_issues": [],
  "confidence": 0.0-1.0,
  "institution_name": "name if readable",
  "degree_type": "type if readable",
  "graduation_year": "year if readable"
}

IMPORTANT: If it looks like ANY kind of certificate or educational document, accept it. We verify manually later.
Return ONLY the JSON object, no other text.`;

        const content = await callGeminiVision(imageUrl, prompt);
        const parsed = JSON.parse(content);

        return {
            success: parsed.is_school_diploma === true && (parsed.confidence ?? 0) >= 0.7,
            isCorrectType: parsed.is_school_diploma || false,
            qualityIssues: parsed.quality_issues || [],
            confidence: parsed.confidence || 0,
            extractedData: {
                institution_name: parsed.institution_name,
                degree_type: parsed.degree_type,
                graduation_year: parsed.graduation_year,
                document_description: parsed.document_description,
            },
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

        const content = await callGeminiVision(imageUrl, prompt);
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
export async function detectDocumentBounds(imageUrl: string, docType: string): Promise<{
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
  "rotation_degrees": 0,
  "crop_x_percent": 0-100,
  "crop_y_percent": 0-100,
  "crop_width_percent": 0-100,
  "crop_height_percent": 0-100,
  "needs_cropping": true/false
}

Rules for rotation_degrees:
- Look at the TEXT orientation in the document
- 0 = text is upright (normal reading position)
- 90 = text is rotated 90° clockwise (reader must tilt head left to read)
- 180 = text is upside down
- 270 = text is rotated 90° counter-clockwise (reader must tilt head right to read)
- ONLY use values: 0, 90, 180, or 270

Rules for cropping:
- If the document fills most of the image (>80% area), set needs_cropping to false
- crop_x_percent and crop_y_percent are the top-left corner of the document
- Add 2% padding around the document edges for safety
- Return ONLY the JSON object, no other text.`;

        const content = await callGeminiVision(imageUrl, prompt);
        const parsed = JSON.parse(content);

        // Normalize rotation to 0/90/180/270
        const rawRotation = parsed.rotation_degrees || 0;
        const rotationDegrees = [0, 90, 180, 270].includes(rawRotation) ? rawRotation : 0;

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
