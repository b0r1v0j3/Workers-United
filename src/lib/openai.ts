import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
    console.warn("Missing OPENAI_API_KEY - document verification will not work");
}

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy_key_for_build",
});

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

export async function extractPassportData(imageUrl: string): Promise<VerificationResult> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a passport document analyzer. Extract information from passport images accurately.
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

If the image is blurry, too dark, or not a passport, set readable to false and list issues.`,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Please extract all passport information from this image:",
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                                detail: "high",
                            },
                        },
                    ],
                },
            ],
            max_tokens: 500,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return {
                success: false,
                confidence: 0,
                issues: ["No response from AI"],
            };
        }

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
    // Normalize names for comparison
    const normalize = (name: string) =>
        name.toLowerCase()
            .replace(/[^a-z\s]/g, "")
            .split(/\s+/)
            .filter(Boolean)
            .sort()
            .join(" ");

    const aiNormalized = normalize(aiName);
    const signupNormalized = normalize(signupName);

    // Exact match after normalization
    if (aiNormalized === signupNormalized) return true;

    // Check if all parts of signup name are in AI name
    const aiParts = aiNormalized.split(" ");
    const signupParts = signupNormalized.split(" ");

    const allPartsMatch = signupParts.every(part =>
        aiParts.some(aiPart => aiPart.includes(part) || part.includes(aiPart))
    );

    return allPartsMatch;
}

export interface DocumentQualityResult {
    success: boolean;
    isCorrectType: boolean;
    qualityIssues: string[];
    confidence: number;
    extractedData?: Record<string, string>;
}

// Verify diploma/certificate - OPTIONAL document, always accept
export async function verifyDiploma(imageUrl: string): Promise<DocumentQualityResult> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a document analyzer. Check if this looks like any kind of educational document, certificate, or diploma.
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

Accept any document that looks like a certificate, diploma, training completion, or educational record.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this educational document:" },
                        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                    ]
                }
            ],
            max_tokens: 300,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            // Diploma is optional - accept on AI failure
            return { success: true, isCorrectType: true, qualityIssues: [], confidence: 0.7 };
        }

        const parsed = JSON.parse(content);

        // Diploma is REQUIRED but lenient - accept if it looks like an educational document
        return {
            success: parsed.is_diploma === true || parsed.readable === true,
            isCorrectType: parsed.is_diploma || false,
            qualityIssues: parsed.quality_issues || [],
            confidence: parsed.confidence || 0.8,
            extractedData: {
                institution_name: parsed.institution_name,
                degree_type: parsed.degree_type,
                graduation_year: parsed.graduation_year
            }
        };
    } catch (error) {
        console.error("Diploma verification error:", error);
        // Diploma is optional - accept on error
        return {
            success: true,
            isCorrectType: true,
            qualityIssues: [],
            confidence: 0.5
        };
    }
}

// Verify biometric photo quality - more lenient for user experience
export async function verifyBiometricPhoto(imageUrl: string): Promise<DocumentQualityResult> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a biometric photo quality analyzer for visa applications.
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

Be generous - if a face is visible and photo is usable, set is_valid_photo to true.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this biometric photo:" },
                        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                    ]
                }
            ],
            max_tokens: 200,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            // If AI fails, accept the photo anyway
            return { success: true, isCorrectType: true, qualityIssues: [], confidence: 0.7 };
        }

        const parsed = JSON.parse(content);

        // More lenient: accept if is_valid_photo is true, regardless of minor issues
        return {
            success: parsed.is_valid_photo === true,
            isCorrectType: parsed.is_valid_photo === true,
            qualityIssues: parsed.quality_issues || [],
            confidence: parsed.confidence || 0.7
        };
    } catch (error) {
        console.error("Photo verification error:", error);
        // On error, accept the photo - admin can review later
        return {
            success: true,
            isCorrectType: true,
            qualityIssues: ["Auto-accepted for manual review"],
            confidence: 0.5
        };
    }
}

