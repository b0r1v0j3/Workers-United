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
type AdminClient = ReturnType<typeof createAdminClient>;
type SingleRowUpdateResult = {
    error: { message: string } | null;
    matched: boolean;
};

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
    admin: AdminClient,
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

    return updateSingleRowById(admin, table, recordId, payload);
}

async function updateSingleRowById(
    admin: AdminClient,
    table:
        | EditableTableName
        | "worker_onboarding"
        | "job_requests",
    recordId: string,
    payload: Record<string, string | number | null>
): Promise<SingleRowUpdateResult> {
    const { data, error } = await admin
        .from(table)
        .update(payload)
        .eq("id", recordId)
        .select("id")
        .maybeSingle();

    return {
        error,
        matched: !!data?.id,
    };
}

function getUpdateFailureResponse(
    result: SingleRowUpdateResult,
    notFoundMessage: string
) {
    if (result.error) {
        console.error("[Edit Data] Update error:", result.error);
        return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    if (!result.matched) {
        return NextResponse.json({ error: notFoundMessage }, { status: 404 });
    }

    return null;
}

async function syncRelatedAuthContact(
    admin: AdminClient,
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

            const updateResult = await updateGenericRecord(admin, table, recordId, field, normalizedValue);
            const updateFailureResponse = getUpdateFailureResponse(updateResult, `${table} record not found`);

            if (updateFailureResponse) {
                return updateFailureResponse;
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
            const workerId = contractBuild.worker?.id || null;

            if (DIRECT_CONTRACT_FIELDS.has(field)) {
                const updateResult = await updateSingleRowById(admin, "contract_data", recordId, {
                    [field]: normalizedValue,
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Contract record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "worker_full_name") {
                if (!contractBuild.workerProfile?.id) {
                    return NextResponse.json({ error: "Worker profile not found" }, { status: 404 });
                }

                const updateResult = await updateSingleRowById(admin, "profiles", contractBuild.workerProfile.id, {
                    full_name: normalizedValue ? String(normalizedValue) : null,
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Worker profile not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }

                await syncAuthContactFields(admin, {
                    userId: contractBuild.workerProfile.id,
                    fullName: normalizedValue ? String(normalizedValue) : null,
                }).catch((syncError) => {
                    console.warn("[Edit Data] Worker auth contact sync failed:", syncError);
                });
            } else if (field === "worker_passport_number") {
                if (!workerId) {
                    return NextResponse.json({ error: "Worker record not found" }, { status: 404 });
                }

                const updateResult = await updateSingleRowById(admin, "worker_onboarding", workerId, {
                    passport_number: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Worker record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "worker_nationality") {
                if (!workerId) {
                    return NextResponse.json({ error: "Worker record not found" }, { status: 404 });
                }

                const updateResult = await updateSingleRowById(admin, "worker_onboarding", workerId, {
                    nationality: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Worker record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "worker_date_of_birth") {
                if (!workerId) {
                    return NextResponse.json({ error: "Worker record not found" }, { status: 404 });
                }

                const updateResult = await updateSingleRowById(admin, "worker_onboarding", workerId, {
                    date_of_birth: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Worker record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "worker_passport_expiry") {
                if (!workerId) {
                    return NextResponse.json({ error: "Worker record not found" }, { status: 404 });
                }

                const updateResult = await updateSingleRowById(admin, "worker_onboarding", workerId, {
                    passport_expiry_date: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Worker record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "worker_address") {
                if (!workerId) {
                    return NextResponse.json({ error: "Worker record not found" }, { status: 404 });
                }

                const updateResult = await updateSingleRowById(admin, "worker_onboarding", workerId, {
                    address: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Worker record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "employer_company_name") {
                const updateResult = await updateSingleRowById(admin, "employers", contractBuild.employer.id, {
                    company_name: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Employer record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "employer_pib") {
                const updateResult = await updateSingleRowById(admin, "employers", contractBuild.employer.id, {
                    tax_id: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Employer record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "employer_address") {
                const updateResult = await updateSingleRowById(admin, "employers", contractBuild.employer.id, {
                    company_address: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Employer record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "employer_representative_name") {
                if (!contractBuild.employerProfile?.id) {
                    return NextResponse.json({ error: "Employer profile not found" }, { status: 404 });
                }

                const updateResult = await updateSingleRowById(admin, "profiles", contractBuild.employerProfile.id, {
                    full_name: normalizedValue ? String(normalizedValue) : null,
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Employer profile not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }

                await syncAuthContactFields(admin, {
                    userId: contractBuild.employerProfile.id,
                    fullName: normalizedValue ? String(normalizedValue) : null,
                }).catch((syncError) => {
                    console.warn("[Edit Data] Employer auth contact sync failed:", syncError);
                });
            } else if (field === "job_title") {
                const updateResult = await updateSingleRowById(admin, "job_requests", contractBuild.jobRequest.id, {
                    title: normalizedValue ? String(normalizedValue) : "",
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Job request not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "salary_rsd") {
                const updateResult = await updateSingleRowById(admin, "job_requests", contractBuild.jobRequest.id, {
                    salary_rsd: typeof normalizedValue === "number" ? normalizedValue : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Job request not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "accommodation_address") {
                const updateResult = await updateSingleRowById(admin, "job_requests", contractBuild.jobRequest.id, {
                    accommodation_address: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Job request not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "contract_duration_months") {
                const nextDuration = Number(normalizedValue);
                const nextEndDate = addMonths(contractBuild.contractData.start_date, nextDuration);

                const jobUpdateResult = await updateSingleRowById(admin, "job_requests", contractBuild.jobRequest.id, {
                    contract_duration_months: nextDuration,
                    updated_at: new Date().toISOString(),
                });
                const jobUpdateFailureResponse = getUpdateFailureResponse(jobUpdateResult, "Job request not found");

                if (jobUpdateFailureResponse) {
                    return jobUpdateFailureResponse;
                }

                const contractUpdateResult = await updateSingleRowById(admin, "contract_data", recordId, {
                    end_date: nextEndDate,
                });
                const contractUpdateFailureResponse = getUpdateFailureResponse(contractUpdateResult, "Contract record not found");

                if (contractUpdateFailureResponse) {
                    return contractUpdateFailureResponse;
                }
            } else if (field === "work_schedule") {
                const updateResult = await updateSingleRowById(admin, "job_requests", contractBuild.jobRequest.id, {
                    work_schedule: normalizedValue ? String(normalizedValue) : null,
                    updated_at: new Date().toISOString(),
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Job request not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else if (field === "start_date") {
                const nextStartDate = String(normalizedValue);
                const nextEndDate = addMonths(nextStartDate, contractBuild.durationMonths);

                const updateResult = await updateSingleRowById(admin, "contract_data", recordId, {
                    end_date: nextEndDate,
                });
                const updateFailureResponse = getUpdateFailureResponse(updateResult, "Contract record not found");

                if (updateFailureResponse) {
                    return updateFailureResponse;
                }
            } else {
                return NextResponse.json(
                    { error: `Editing '${field}' is not supported yet` },
                    { status: 400 }
                );
            }
        }

        const { error: auditError } = await admin.from("admin_audit_log").insert({
            admin_id: user.id,
            action: "edit",
            table_name: table,
            record_id: recordId,
            field,
            old_value: oldValue,
            new_value: String(normalizedValue ?? ""),
        });

        if (auditError) {
            console.warn("[Edit Data] Audit log insert failed:", auditError);
            return NextResponse.json({
                success: true,
                auditLogged: false,
                warning: "Data was updated, but the admin audit log entry failed to save.",
                field,
                value: normalizedValue,
            });
        }

        return NextResponse.json({ success: true, auditLogged: true, field, value: normalizedValue });
    } catch (error) {
        console.error("[Edit Data] System error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
