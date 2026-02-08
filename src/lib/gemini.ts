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

// Helper: call Gemini with image and prompt, parse JSON response
async function callGeminiVision(imageUrl: string, prompt: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const image = await fetchImageAsBase64(imageUrl);

    const result = await model.generateContent([
        { text: prompt },
        {
            inlineData: {
                data: image.data,
                mimeType: image.mimeType,
            },
        },
    ]);

    const text = result.response.text();
    // Strip markdown code fences if present
    return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

// Helper: call Gemini text-only
export async function callGeminiText(prompt: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

export async function extractPassportData(imageUrl: string): Promise<VerificationResult> {
    try {
        const prompt = `You are a passport document analyzer. Extract information from this passport image accurately.
Return a JSON object with EXACTLY these fields (use null if not readable):
{
  "full_name": "SURNAME GIVEN_NAMES",
  "passport_number": "ABC123456",
  "nationality": "COUNTRY",
  "date_of_birth": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "gender": "M or F",
  "place_of_birth": "CITY",
  "readable": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list of problems if any"]
}

If the image is blurry, too dark, or not a passport, set readable to false and list issues.
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
            },
            confidence: parsed.confidence || 0.8,
            issues: parsed.issues || [],
            rawResponse: content,
        };
    } catch (error) {
        console.error("Passport extraction error:", error);
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
        const prompt = `You are a document analyzer. Check if this looks like any kind of educational document, certificate, or diploma.
Be very lenient - this is an OPTIONAL document.

Return JSON:
{
  "is_diploma": true/false,
  "readable": true/false,
  "quality_issues": [],
  "confidence": 0.0-1.0,
  "institution_name": "name if readable",
  "degree_type": "type if readable",
  "graduation_year": "year if readable"
}

Accept any document that looks like a certificate, diploma, training completion, or educational record.
Return ONLY the JSON object, no other text.`;

        const content = await callGeminiVision(imageUrl, prompt);
        const parsed = JSON.parse(content);

        return {
            success: parsed.is_diploma === true || parsed.readable === true,
            isCorrectType: parsed.is_diploma || false,
            qualityIssues: parsed.quality_issues || [],
            confidence: parsed.confidence || 0.8,
            extractedData: {
                institution_name: parsed.institution_name,
                degree_type: parsed.degree_type,
                graduation_year: parsed.graduation_year,
            },
        };
    } catch (error) {
        console.error("Diploma verification error:", error);
        return {
            success: true,
            isCorrectType: true,
            qualityIssues: [],
            confidence: 0.5,
        };
    }
}

export async function verifyBiometricPhoto(imageUrl: string): Promise<DocumentQualityResult> {
    try {
        const prompt = `You are a biometric photo quality analyzer for visa applications.
Check if the photo shows a person's face clearly. Be lenient - accept photos that are reasonably good.
Only reject if:
- No face visible at all
- Photo is extremely blurry or dark
- Multiple people in photo

Return JSON:
{
  "is_valid_photo": true/false,
  "quality_issues": ["list any minor issues"],
  "confidence": 0.0-1.0
}

Be generous - if a face is visible and photo is usable, set is_valid_photo to true.
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
 * Detect document boundaries within an image.
 * Returns crop coordinates as percentages (0-100) so the caller can crop.
 * Used when a user photographs a document on a table — we crop to just the document.
 */
export async function detectDocumentBounds(imageUrl: string, docType: string): Promise<{
    found: boolean;
    crop?: { x: number; y: number; width: number; height: number };
}> {
    try {
        const docLabel = docType === 'passport' ? 'passport data page' :
            docType === 'diploma' ? 'diploma, certificate, or educational document' :
                'document';

        const prompt = `You are a document detector. Find the ${docLabel} in this image.
The document may be photographed on a table, desk, or other surface with background visible.

Return JSON:
{
  "document_found": true/false,
  "crop_x_percent": 0-100,
  "crop_y_percent": 0-100,
  "crop_width_percent": 0-100,
  "crop_height_percent": 0-100,
  "needs_cropping": true/false
}

Rules:
- If the document fills most of the image (>80% area), set needs_cropping to false
- crop_x_percent and crop_y_percent are the top-left corner of the document
- Add 2% padding around the document edges for safety
- Return ONLY the JSON object, no other text.`;

        const content = await callGeminiVision(imageUrl, prompt);
        const parsed = JSON.parse(content);

        if (!parsed.document_found || !parsed.needs_cropping) {
            return { found: parsed.document_found ?? false };
        }

        return {
            found: true,
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
