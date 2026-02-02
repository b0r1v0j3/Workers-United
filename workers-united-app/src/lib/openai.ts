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
