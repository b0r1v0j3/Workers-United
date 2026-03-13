import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import { getAdminTestWorkerWorkspace, saveAdminTestWorkerProfile } from "@/lib/admin-test-data";
import { normalizeWorkerPhone } from "@/lib/workers";

function normalizeText(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function normalizeDate(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function normalizeCountries(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const countries = value
        .filter((country): country is string => typeof country === "string")
        .map((country) => country.trim())
        .filter(Boolean);

    return countries.length > 0 ? countries : null;
}

async function loadWorkerSandbox() {
    const supabase = await createClient();
    const admin = createAdminClient();
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

    if (!session.user) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (!session.canUseAdminTestMode || session.activePersona?.role !== "worker") {
        return { error: NextResponse.json({ error: "Worker sandbox is not active." }, { status: 403 }) };
    }

    const workspace = await getAdminTestWorkerWorkspace(admin, session.activePersona.id);
    return {
        admin,
        session,
        workspace,
    };
}

function buildWorkerResponse(input: Awaited<ReturnType<typeof loadWorkerSandbox>>) {
    if ("error" in input) {
        return input.error;
    }

    const { session, workspace } = input;
    const worker = workspace.worker;
    const profile = {
        id: session.activePersona!.id,
        email: worker?.email || session.ownerProfile?.email || session.user!.email || "",
        full_name: worker?.full_name || session.activePersona!.label,
        user_type: "worker",
    };

    return NextResponse.json({
        persona: session.activePersona,
        profile,
        worker,
        documents: workspace.documents,
    });
}

export async function GET() {
    try {
        const input = await loadWorkerSandbox();
        return buildWorkerResponse(input);
    } catch (error) {
        console.error("[AdminTestWorker GET] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const input = await loadWorkerSandbox();
        if ("error" in input) {
            return input.error;
        }

        const body = await request.json();
        const fullName = normalizeText(body.fullName);

        const updatedWorker = await saveAdminTestWorkerProfile(input.admin, input.session.activePersona!.id, {
            full_name: fullName,
            email: normalizeText(body.email),
            phone: normalizeWorkerPhone(typeof body.phone === "string" ? body.phone : null),
            nationality: normalizeText(body.nationality),
            current_country: normalizeText(body.currentCountry),
            preferred_job: normalizeText(body.preferredJob),
            desired_countries: normalizeCountries(body.desiredCountries),
            date_of_birth: normalizeDate(body.dateOfBirth),
            birth_country: normalizeText(body.birthCountry),
            birth_city: normalizeText(body.birthCity),
            citizenship: normalizeText(body.citizenship),
            original_citizenship: normalizeText(body.originalCitizenship),
            maiden_name: normalizeText(body.maidenName),
            father_name: normalizeText(body.fatherName),
            mother_name: normalizeText(body.motherName),
            marital_status: normalizeText(body.maritalStatus),
            gender: normalizeText(body.gender),
            address: normalizeText(body.address),
            family_data: body.familyData && typeof body.familyData === "object" && !Array.isArray(body.familyData)
                ? body.familyData as Record<string, unknown>
                : null,
            passport_number: normalizeText(body.passportNumber),
            passport_issued_by: normalizeText(body.passportIssuedBy),
            passport_issue_date: normalizeDate(body.passportIssueDate),
            passport_expiry_date: normalizeDate(body.passportExpiryDate),
            lives_abroad: normalizeText(body.livesAbroad),
            previous_visas: normalizeText(body.previousVisas),
        });

        return NextResponse.json({
            success: true,
            profile: {
                id: input.session.activePersona!.id,
                email: updatedWorker.email || input.session.ownerProfile?.email || input.session.user!.email || "",
                full_name: updatedWorker.full_name || input.session.activePersona!.label,
                user_type: "worker",
            },
            worker: updatedWorker,
        });
    } catch (error) {
        console.error("[AdminTestWorker PUT] Error:", error);
        return NextResponse.json({ error: "Failed to save worker sandbox profile." }, { status: 500 });
    }
}
