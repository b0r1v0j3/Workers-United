import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import { getAdminTestEmployerWorkspace, saveAdminTestEmployerProfile } from "@/lib/admin-test-data";

function normalizeText(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

async function loadEmployerSandbox() {
    const supabase = await createClient();
    const admin = createAdminClient();
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

    if (!session.user) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (!session.canUseAdminTestMode || session.activePersona?.role !== "employer") {
        return { error: NextResponse.json({ error: "Employer sandbox is not active." }, { status: 403 }) };
    }

    const workspace = await getAdminTestEmployerWorkspace(admin, session.activePersona.id);
    return { admin, session, workspace };
}

export async function GET() {
    try {
        const input = await loadEmployerSandbox();
        if ("error" in input) {
            return input.error;
        }

        return NextResponse.json({
            persona: input.session.activePersona,
            employer: input.workspace.employer,
            jobs: input.workspace.jobs,
        });
    } catch (error) {
        console.error("[AdminTestEmployer GET] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const input = await loadEmployerSandbox();
        if ("error" in input) {
            return input.error;
        }

        const body = await request.json();
        const employer = await saveAdminTestEmployerProfile(input.admin, input.session.activePersona!.id, {
            company_name: normalizeText(body.company_name),
            tax_id: normalizeText(body.tax_id),
            company_registration_number: normalizeText(body.company_registration_number),
            company_address: normalizeText(body.company_address),
            contact_phone: normalizeText(body.contact_phone),
            contact_email: normalizeText(body.contact_email),
            status: normalizeText(body.status),
            website: normalizeText(body.website),
            industry: normalizeText(body.industry),
            company_size: normalizeText(body.company_size),
            founded_year: normalizeText(body.founded_year),
            description: normalizeText(body.description),
            country: normalizeText(body.country),
            city: normalizeText(body.city),
            postal_code: normalizeText(body.postal_code),
            founding_date: normalizeText(body.founding_date),
        });

        return NextResponse.json({ success: true, employer });
    } catch (error) {
        console.error("[AdminTestEmployer PUT] Error:", error);
        return NextResponse.json({ error: "Failed to save employer sandbox profile." }, { status: 500 });
    }
}
