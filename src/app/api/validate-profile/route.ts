import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ValidationIssue {
    field: string;
    profile_value: string;
    passport_value: string;
    message: string;
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { candidateId } = await request.json();
        const userId = candidateId || user.id;

        // Get candidate application data
        const { data: candidate } = await supabase
            .from("candidates")
            .select("application_data, profile_id")
            .eq("profile_id", userId)
            .single();

        if (!candidate) {
            return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
        }

        const applicationData = candidate.application_data as {
            personal?: {
                surname?: string;
                first_name?: string;
                date_of_birth?: string;
                citizenship?: string;
                gender?: string;
            };
        };

        if (!applicationData?.personal) {
            return NextResponse.json({
                success: false,
                status: 'incomplete',
                message: "Profile data not filled out yet",
                issues: [{ field: 'profile', message: 'Molimo popunite podatke za e-Uprava aplikaciju' }]
            });
        }

        // Get passport extracted data
        const { data: passportDoc } = await supabase
            .from("candidate_documents")
            .select("extracted_data, status")
            .eq("user_id", userId)
            .eq("document_type", "passport")
            .single();

        if (!passportDoc || passportDoc.status !== 'verified') {
            return NextResponse.json({
                success: false,
                status: 'no_passport',
                message: "Passport not verified yet",
                issues: [{ field: 'passport', message: 'Molimo uploadujte i verifikujte pasoš' }]
            });
        }

        const passportData = passportDoc.extracted_data as {
            surname?: string;
            given_names?: string;
            full_name?: string;
            date_of_birth?: string;
            nationality?: string;
            gender?: string;
        };

        if (!passportData || !passportData.surname) {
            return NextResponse.json({
                success: false,
                status: 'no_extracted_data',
                message: "Passport data not extracted",
                issues: [{ field: 'passport', message: 'Podaci iz pasoša nisu izvučeni - molimo ponovo uploadujte' }]
            });
        }

        // Compare data
        const issues: ValidationIssue[] = [];

        // Compare surname
        if (!compareStrings(applicationData.personal.surname || '', passportData.surname || '')) {
            issues.push({
                field: 'surname',
                profile_value: applicationData.personal.surname || '',
                passport_value: passportData.surname || '',
                message: `Prezime se ne poklapa: "${applicationData.personal.surname}" vs pasoš "${passportData.surname}"`
            });
        }

        // Compare first name
        if (!compareStrings(applicationData.personal.first_name || '', passportData.given_names || '')) {
            issues.push({
                field: 'first_name',
                profile_value: applicationData.personal.first_name || '',
                passport_value: passportData.given_names || '',
                message: `Ime se ne poklapa: "${applicationData.personal.first_name}" vs pasoš "${passportData.given_names}"`
            });
        }

        // Compare date of birth
        if (applicationData.personal.date_of_birth && passportData.date_of_birth) {
            const profileDOB = normalizeDate(applicationData.personal.date_of_birth);
            const passportDOB = normalizeDate(passportData.date_of_birth);

            if (profileDOB !== passportDOB) {
                issues.push({
                    field: 'date_of_birth',
                    profile_value: applicationData.personal.date_of_birth,
                    passport_value: passportData.date_of_birth,
                    message: `Datum rođenja se ne poklapa: "${applicationData.personal.date_of_birth}" vs pasoš "${passportData.date_of_birth}"`
                });
            }
        }

        // Compare gender
        if (applicationData.personal.gender && passportData.gender) {
            const profileGender = applicationData.personal.gender.toLowerCase();
            const passportGender = passportData.gender.toLowerCase();

            // Map variations
            const genderMap: Record<string, string> = {
                'm': 'male', 'f': 'female', 'muski': 'male', 'zenski': 'female',
                'male': 'male', 'female': 'female'
            };

            if (genderMap[profileGender] !== genderMap[passportGender]) {
                issues.push({
                    field: 'gender',
                    profile_value: applicationData.personal.gender,
                    passport_value: passportData.gender,
                    message: `Pol se ne poklapa: "${applicationData.personal.gender}" vs pasoš "${passportData.gender}"`
                });
            }
        }

        // Update candidate validation status
        const validationStatus = issues.length === 0 ? 'validated' : 'mismatch';

        await supabase
            .from("candidates")
            .update({
                profile_validation_status: validationStatus,
                validation_issues: issues,
                updated_at: new Date().toISOString()
            })
            .eq("profile_id", userId);

        return NextResponse.json({
            success: issues.length === 0,
            status: validationStatus,
            message: issues.length === 0
                ? "Svi podaci se poklapaju!"
                : "Pronađene su nepodudarnosti između profila i pasoša",
            issues
        });

    } catch (err) {
        console.error("Validation API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Helper functions
function compareStrings(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z\s]/gi, '');
    const normalizedA = normalize(a);
    const normalizedB = normalize(b);

    if (normalizedA === normalizedB) return true;

    // Check if one contains the other (for cases like "JOHN" vs "JOHN MICHAEL")
    if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true;

    return false;
}

function normalizeDate(dateStr: string): string {
    // Handle various date formats and return YYYY-MM-DD
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch {
        // Ignore parse errors
    }
    return dateStr;
}
