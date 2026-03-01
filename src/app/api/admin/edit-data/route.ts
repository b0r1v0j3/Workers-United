import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";

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
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { table, recordId, field, value } = await request.json();

        // Whitelist allowed tables and fields
        const ALLOWED: Record<string, string[]> = {
            candidates: [
                "phone", "country", "preferred_job",
                "experience_years", "status",
            ],
            profiles: [
                "full_name", "email",
            ],
            employers: [
                "company_name", "pib",
                "company_address", "contact_phone", "country",
                "company_website", "industry", "employees_count",
                "accommodation_address", "min_salary_rsd", "status",
            ],
            contract_data: [
                "candidate_full_name", "candidate_passport_number",
                "candidate_nationality", "candidate_date_of_birth",
                "candidate_passport_expiry", "candidate_address",
                "candidate_passport_issue_date", "candidate_passport_issuer",
                "candidate_place_of_birth", "candidate_gender",
                "employer_company_name", "employer_pib", "employer_address",
                "employer_representative_name", "employer_mb", "employer_director",
                "employer_city", "employer_founding_date", "employer_apr_number",
                "signing_city",
                "job_title", "job_description_sr", "job_description_en",
                "salary_rsd", "accommodation_address", "contract_duration_months",
                "work_schedule", "start_date", "end_date", "signing_date",
                "contact_email", "contact_phone",
            ],
        };

        if (!ALLOWED[table] || !ALLOWED[table].includes(field)) {
            return NextResponse.json(
                { error: `Editing '${field}' on '${table}' is not allowed` },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        // Fetch old value for audit trail
        const { data: oldRecord } = await admin
            .from(table)
            .select(field)
            .eq("id", recordId)
            .single();

        const oldValue = oldRecord ? String(oldRecord[field] ?? "") : "";

        const { error } = await admin
            .from(table)
            .update({ [field]: value, updated_at: new Date().toISOString() })
            .eq("id", recordId);

        if (error) {
            console.error("[Edit Data] Update error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Audit log: record who changed what
        await admin.from("admin_audit_log").insert({
            admin_id: user.id,
            action: "edit",
            table_name: table,
            record_id: recordId,
            field,
            old_value: oldValue,
            new_value: String(value ?? ""),
        });

        return NextResponse.json({ success: true, field, value });

    } catch (error) {
        console.error("[Edit Data] System error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
