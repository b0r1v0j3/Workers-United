import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import { deleteAdminTestEmployerJob, updateAdminTestEmployerJob } from "@/lib/admin-test-data";

interface RouteContext {
    params: Promise<{ jobId: string }>;
}

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

    return { admin, session };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const sandbox = await loadEmployerSandbox();
        if ("error" in sandbox) {
            return sandbox.error;
        }

        const { jobId } = await context.params;
        const body = await request.json();
        const job = await updateAdminTestEmployerJob(sandbox.admin, sandbox.session.activePersona!.id, jobId, {
            title: normalizeText(body.title) || undefined,
            description: normalizeText(body.description),
            industry: normalizeText(body.industry),
            positions_count: normalizeNumber(body.positions_count),
            positions_filled: normalizeNumber(body.positions_filled),
            work_city: normalizeText(body.work_city),
            salary_rsd: normalizeNumber(body.salary_rsd),
            accommodation_address: normalizeText(body.accommodation_address),
            work_schedule: normalizeText(body.work_schedule),
            contract_duration_months: normalizeNumber(body.contract_duration_months),
            experience_required_years: normalizeNumber(body.experience_required_years),
            destination_country: normalizeText(body.destination_country),
            status: normalizeText(body.status),
        });

        return NextResponse.json({ success: true, job });
    } catch (error) {
        console.error("[AdminTestEmployerJob PATCH] Error:", error);
        return NextResponse.json({ error: "Failed to update sandbox job request." }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    try {
        const sandbox = await loadEmployerSandbox();
        if ("error" in sandbox) {
            return sandbox.error;
        }

        const { jobId } = await context.params;
        await deleteAdminTestEmployerJob(sandbox.admin, sandbox.session.activePersona!.id, jobId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[AdminTestEmployerJob DELETE] Error:", error);
        return NextResponse.json({ error: "Failed to delete sandbox job request." }, { status: 500 });
    }
}
