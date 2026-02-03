import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
    console.warn("Missing OPENAI_API_KEY - document verification will not work");
}

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
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

// Verify diploma/certificate quality and authenticity
export async function verifyDiploma(imageUrl: string): Promise<DocumentQualityResult> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a document quality analyzer. Analyze educational certificates and diplomas.
Return a JSON object:
{
  "is_diploma": true/false,
  "readable": true/false,
  "quality_issues": ["list of issues like: blurry, too dark, cropped, etc"],
  "confidence": 0.0-1.0,
  "institution_name": "name if readable",
  "degree_type": "type if readable",
  "graduation_year": "year if readable"
}

Be strict about quality. Flag if:
- Image is blurry or low resolution
- Text is not clearly readable  
- Document appears cropped or incomplete
- This is clearly not a diploma/certificate`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this document for quality and verify it's an educational diploma or vocational certificate:" },
                        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                    ]
                }
            ],
            max_tokens: 300,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return { success: false, isCorrectType: false, qualityIssues: ["No AI response"], confidence: 0 };
        }

        const parsed = JSON.parse(content);

        return {
            success: parsed.readable && parsed.is_diploma,
            isCorrectType: parsed.is_diploma,
            qualityIssues: parsed.quality_issues || [],
            confidence: parsed.confidence || 0.5,
            extractedData: {
                institution_name: parsed.institution_name,
                degree_type: parsed.degree_type,
                graduation_year: parsed.graduation_year
            }
        };
    } catch (error) {
        console.error("Diploma verification error:", error);
        return {
            success: false,
            isCorrectType: false,
            qualityIssues: [`Processing error: ${error instanceof Error ? error.message : "Unknown"}`],
            confidence: 0
        };
    }
}

// Verify biometric photo quality
export async function verifyBiometricPhoto(imageUrl: string): Promise<DocumentQualityResult> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a biometric photo quality analyzer for visa applications.
Check if the photo meets standard requirements:
- Single person, face clearly visible
- Neutral expression
- Plain/light background
- Good lighting, no shadows
- Photo not blurry

Return JSON:
{
  "is_valid_photo": true/false,
  "quality_issues": ["list issues"],
  "confidence": 0.0-1.0
}`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this biometric photo for visa application quality:" },
                        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                    ]
                }
            ],
            max_tokens: 200,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return { success: false, isCorrectType: false, qualityIssues: ["No AI response"], confidence: 0 };
        }

        const parsed = JSON.parse(content);

        return {
            success: parsed.is_valid_photo && (parsed.quality_issues?.length === 0),
            isCorrectType: parsed.is_valid_photo,
            qualityIssues: parsed.quality_issues || [],
            confidence: parsed.confidence || 0.5
        };
    } catch (error) {
        console.error("Photo verification error:", error);
        return {
            success: false,
            isCorrectType: false,
            qualityIssues: [`Processing error: ${error instanceof Error ? error.message : "Unknown"}`],
            confidence: 0
        };
    }
}

