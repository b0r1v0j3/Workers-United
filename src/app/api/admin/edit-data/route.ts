import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST: Admin edits candidate or employer data
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Admin check
        const { data: profile } = await supabase
            .from("profiles")
            .select("role, user_type")
            .eq("id", user.id)
            .single();

        if (profile?.role !== "admin" && profile?.user_type !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { table, recordId, field, value } = await request.json();

        // Whitelist allowed tables and fields
        const ALLOWED: Record<string, string[]> = {
            candidates: [
                "phone", "nationality", "current_country", "preferred_job",
                "experience_years", "desired_countries", "status",
                "date_of_birth", "gender", "address", "education_level",
            ],
            profiles: [
                "full_name", "email",
            ],
            employers: [
                "company_name", "tax_id", "company_registration_number",
                "company_address", "contact_phone", "country", "city",
                "website", "industry", "company_size", "founded_year",
                "description", "status",
            ],
            contract_data: [
                "candidate_full_name", "candidate_passport_number",
                "candidate_nationality", "candidate_date_of_birth",
                "candidate_passport_expiry", "candidate_address",
                "employer_company_name", "employer_pib", "employer_address",
                "employer_representative_name", "job_title", "salary_rsd",
                "accommodation_address", "contract_duration_months",
                "work_schedule", "start_date",
                "candidate_passport_issue_date", "candidate_passport_issuer",
                "job_description_sr", "job_description_en",
            ],
        };

        if (!ALLOWED[table] || !ALLOWED[table].includes(field)) {
            return NextResponse.json(
                { error: `Editing '${field}' on '${table}' is not allowed` },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        const { error } = await admin
            .from(table)
            .update({ [field]: value, updated_at: new Date().toISOString() })
            .eq("id", recordId);

        if (error) {
            console.error("[Edit Data] Update error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, field, value });

    } catch (error) {
        console.error("[Edit Data] System error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
