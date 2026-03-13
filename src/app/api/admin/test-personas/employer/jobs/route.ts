import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import { createAdminTestEmployerJob } from "@/lib/admin-test-data";

function normalizeText(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();
        const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (!session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!session.canUseAdminTestMode || session.activePersona?.role !== "employer") {
            return NextResponse.json({ error: "Employer sandbox is not active." }, { status: 403 });
        }

        const body = await request.json();
        const job = await createAdminTestEmployerJob(admin, session.activePersona.id, {
            title: normalizeText(body.title) || "Untitled job request",
            description: normalizeText(body.description),
            industry: normalizeText(body.industry),
            positions_count: normalizeNumber(body.positions_count) ?? 1,
            positions_filled: normalizeNumber(body.positions_filled) ?? 0,
            work_city: normalizeText(body.work_city),
            salary_rsd: normalizeNumber(body.salary_rsd),
            accommodation_address: normalizeText(body.accommodation_address),
            work_schedule: normalizeText(body.work_schedule),
            contract_duration_months: normalizeNumber(body.contract_duration_months),
            experience_required_years: normalizeNumber(body.experience_required_years),
            destination_country: normalizeText(body.destination_country),
            status: normalizeText(body.status) || "open",
        });

        return NextResponse.json({ success: true, job });
    } catch (error) {
        console.error("[AdminTestEmployerJobs POST] Error:", error);
        return NextResponse.json({ error: "Failed to create sandbox job request." }, { status: 500 });
    }
}
