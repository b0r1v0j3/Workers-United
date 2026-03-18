import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAuthContactFields } from "@/lib/auth-contact-sync";
import { isGodModeUser } from "@/lib/godmode";
import { buildContractDataForMatch } from "@/lib/contract-data";

export const dynamic = "force-dynamic";

const ALLOWED = {
    workers: [
        "phone", "country", "preferred_job",
        "experience_years", "status",
    ],
    profiles: [
        "full_name", "email",
    ],
    employers: [
        "company_name", "tax_id", "company_registration_number",
        "company_address", "contact_phone", "country", "city", "postal_code",
        "website", "industry", "company_size", "description",
        "business_registry_number", "founded_year", "founding_date",
        "status",
    ],
    contract_data: [
        "worker_full_name", "worker_passport_number",
        "worker_nationality", "worker_date_of_birth",
        "worker_passport_expiry", "worker_address",
        "worker_passport_issue_date", "worker_passport_issuer",
        "worker_place_of_birth", "worker_gender",
        "employer_company_name", "employer_pib", "employer_address",
        "employer_representative_name", "employer_mb", "employer_director",
        "employer_city", "employer_founding_date", "employer_apr_number",
        "signing_city",
        "job_title", "job_description_sr", "job_description_en",
        "salary_rsd", "accommodation_address", "contract_duration_months",
        "work_schedule", "start_date", "end_date", "signing_date",
        "contact_email", "contact_phone",
    ],
} as const;

const TABLE_HAS_UPDATED_AT = {
    workers: true,
    employers: true,
    profiles: false,
    contract_data: false,
} as const;

type EditableTableName = keyof typeof ALLOWED;

const DIRECT_CONTRACT_FIELDS = new Set([
    "worker_passport_issue_date",
    "worker_passport_issuer",
    "worker_place_of_birth",
    "worker_gender",
    "employer_mb",
    "employer_director",
    "employer_city",
    "employer_founding_date",
    "employer_apr_number",
    "signing_city",
    "job_description_sr",
    "job_description_en",
    "end_date",
    "signing_date",
    "contact_email",
    "contact_phone",
]);

function normalizeIsoDate(value: unknown): string {
    const raw = String(value || "").trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : new Date(raw);
    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid date value");
    }

    return date.toISOString().split("T")[0];
}

function addMonths(isoDate: string, months: number): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().split("T")[0];
}

function normalizeFieldValue(field: string, value: unknown): string | number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (field === "salary_rsd") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            throw new Error("salary_rsd must be a number");
        }
        return numeric;
    }

    if (field === "contract_duration_months" || field === "experience_years") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            throw new Error(`${field} must be a positive number`);
        }
        return Math.round(numeric);
    }

    if (field.endsWith("_date") || field === "start_date" || field === "end_date" || field === "signing_date") {
        return normalizeIsoDate(value);
    }

    return String(value);
}

async function updateGenericRecord(
    admin: ReturnType<typeof createAdminClient>,
    table: EditableTableName,
    recordId: string,
    field: string,
    value: string | number | null
) {
    const payload: Record<string, string | number | null> = {
        [field]: value,
    };

    if (TABLE_HAS_UPDATED_AT[table]) {
        payload.updated_at = new Date().toISOString();
    }

    return admin
        .from(table)
        .update(payload)
        .eq("id", recordId);
}

async function syncRelatedAuthContact(
    admin: ReturnType<typeof createAdminClient>,
    table: EditableTableName,
    recordId: string,
    field: string,
    normalizedValue: string | number | null
) {
    if (table === "profiles" && field === "full_name") {
        await syncAuthContactFields(admin, {
            userId: recordId,
            fullName: typeof normalizedValue === "string" ? normalizedValue : null,
        });
        return;
    }

    if (table === "employers" && field === "contact_phone") {
        const { data: employer } = await admin
            .from("employers")
            .select("profile_id")
            .eq("id", recordId)
            .maybeSingle();

        if (employer?.profile_id) {
            await syncAuthContactFields(admin, {
                userId: employer.profile_id,
                phone: typeof normalizedValue === "string" ? normalizedValue : null,
            });
        }
        return;
    }

    if (table === "workers" && field === "phone") {
        const { data: worker } = await admin
            .from("workers")
            .select("profile_id")
            .eq("id", recordId)
            .maybeSingle();

        if (worker?.profile_id) {
            await syncAuthContactFields(admin, {
                userId: worker.profile_id,
                phone: typeof normalizedValue === "string" ? normalizedValue : null,
            });
        }
    }
}

function normalizeEditableTableName(table: unknown): EditableTableName | null {
    if (typeof table !== "string") {
        return null;
    }

    return table in ALLOWED ? (table as EditableTableName) : null;
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { table: rawTable, recordId, field, value } = await request.json();
        const table = normalizeEditableTableName(rawTable);
        const isAllowedField =
            typeof field === "string" &&
            !!table &&
            (ALLOWED[table] as readonly string[]).includes(field);

        if (!isAllowedField) {
            return NextResponse.json(
                { error: `Editing '${field}' on '${String(rawTable)}' is not allowed` },
                { status: 400 }
            );
        }

        const admin = createAdminClient();
        const normalizedValue = normalizeFieldValue(field, value);
        let oldValue = "";

        if (table !== "contract_data") {
            const { data: oldRecord } = await admin
                .from(table)
                .select(field)
                .eq("id", recordId)
                .maybeSingle();

            const oldRecordValues = oldRecord as Record<string, unknown> | null;
            oldValue = oldRecordValues ? String(oldRecordValues[field] ?? "") : "";

            const { error } = await updateGenericRecord(admin, table, recordId, field, normalizedValue);

            if (error) {
                console.error("[Edit Data] Update error:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            await syncRelatedAuthContact(admin, table, recordId, field, normalizedValue).catch((syncError) => {
                console.warn("[Edit Data] Auth contact sync failed:", syncError);
            });
        } else {
            const { data: contractRecord, error: contractError } = await admin
                .from("contract_data")
                .select("id, match_id")
                .eq("id", recordId)
                .maybeSingle();

            if (contractError) {
                return NextResponse.json({ error: contractError.message }, { status: 500 });
            }

            if (!contractRecord?.match_id) {
                return NextResponse.json({ error: "Contract record not found" }, { status: 404 });
            }

            const contractBuild = await buildContractDataForMatch(admin, contractRecord.match_id);
            oldValue = String(
                contractBuild.contractData[field as keyof typeof contractBuild.contractData] ?? ""
            );

            if (DIRECT_CONTRACT_FIELDS.has(field)) {
                const { error } = await admin
                    .from("contract_data")
                    .update({ [field]: normalizedValue })
                    .eq("id", recordId);

                if (error) {
                    console.error("[Edit Data] Contract override update error:", error);
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "worker_full_name") {
                if (!contractBuild.workerProfile?.id) {
                    return NextResponse.json({ error: "Worker profile not found" }, { status: 404 });
                }

                const { error } = await admin
                    .from("profiles")
                    .update({ full_name: normalizedValue ? String(normalizedValue) : null })
                    .eq("id", contractBuild.workerProfile.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                await syncAuthContactFields(admin, {
                    userId: contractBuild.workerProfile.id,
                    fullName: normalizedValue ? String(normalizedValue) : null,
                }).catch((syncError) => {
                    console.warn("[Edit Data] Worker auth contact sync failed:", syncError);
                });
            } else if (field === "worker_passport_number") {
                const { error } = await admin
                    .from("worker_onboarding")
                    .update({
                        passport_number: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.worker.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "worker_nationality") {
                const { error } = await admin
                    .from("worker_onboarding")
                    .update({
                        nationality: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.worker.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "worker_date_of_birth") {
                const { error } = await admin
                    .from("worker_onboarding")
                    .update({
                        date_of_birth: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.worker.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "worker_passport_expiry") {
                const { error } = await admin
                    .from("worker_onboarding")
                    .update({
                        passport_expiry_date: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.worker.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "worker_address") {
                const { error } = await admin
                    .from("worker_onboarding")
                    .update({
                        address: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.worker.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "employer_company_name") {
                const { error } = await admin
                    .from("employers")
                    .update({
                        company_name: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.employer.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "employer_pib") {
                const { error } = await admin
                    .from("employers")
                    .update({
                        tax_id: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.employer.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "employer_address") {
                const { error } = await admin
                    .from("employers")
                    .update({
                        company_address: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.employer.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "employer_representative_name") {
                if (!contractBuild.employerProfile?.id) {
                    return NextResponse.json({ error: "Employer profile not found" }, { status: 404 });
                }

                const { error } = await admin
                    .from("profiles")
                    .update({ full_name: normalizedValue ? String(normalizedValue) : null })
                    .eq("id", contractBuild.employerProfile.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                await syncAuthContactFields(admin, {
                    userId: contractBuild.employerProfile.id,
                    fullName: normalizedValue ? String(normalizedValue) : null,
                }).catch((syncError) => {
                    console.warn("[Edit Data] Employer auth contact sync failed:", syncError);
                });
            } else if (field === "job_title") {
                const { error } = await admin
                    .from("job_requests")
                    .update({
                        title: normalizedValue ? String(normalizedValue) : "",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.jobRequest.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "salary_rsd") {
                const { error } = await admin
                    .from("job_requests")
                    .update({
                        salary_rsd: typeof normalizedValue === "number" ? normalizedValue : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.jobRequest.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "accommodation_address") {
                const { error } = await admin
                    .from("job_requests")
                    .update({
                        accommodation_address: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.jobRequest.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "contract_duration_months") {
                const nextDuration = Number(normalizedValue);
                const nextEndDate = addMonths(contractBuild.contractData.start_date, nextDuration);

                const { error: jobError } = await admin
                    .from("job_requests")
                    .update({
                        contract_duration_months: nextDuration,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.jobRequest.id);

                if (jobError) {
                    return NextResponse.json({ error: jobError.message }, { status: 500 });
                }

                const { error: contractErrorUpdate } = await admin
                    .from("contract_data")
                    .update({ end_date: nextEndDate })
                    .eq("id", recordId);

                if (contractErrorUpdate) {
                    return NextResponse.json({ error: contractErrorUpdate.message }, { status: 500 });
                }
            } else if (field === "work_schedule") {
                const { error } = await admin
                    .from("job_requests")
                    .update({
                        work_schedule: normalizedValue ? String(normalizedValue) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", contractBuild.jobRequest.id);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else if (field === "start_date") {
                const nextStartDate = String(normalizedValue);
                const nextEndDate = addMonths(nextStartDate, contractBuild.durationMonths);

                const { error } = await admin
                    .from("contract_data")
                    .update({ end_date: nextEndDate })
                    .eq("id", recordId);

                if (error) {
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }
            } else {
                return NextResponse.json(
                    { error: `Editing '${field}' is not supported yet` },
                    { status: 400 }
                );
            }
        }

        await admin.from("admin_audit_log").insert({
            admin_id: user.id,
            action: "edit",
            table_name: table,
            record_id: recordId,
            field,
            old_value: oldValue,
            new_value: String(normalizedValue ?? ""),
        });

        return NextResponse.json({ success: true, field, value: normalizedValue });
    } catch (error) {
        console.error("[Edit Data] System error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
