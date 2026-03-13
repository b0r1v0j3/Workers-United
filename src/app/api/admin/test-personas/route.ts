import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    clearActiveAdminTestPersonaCookie,
    getAdminTestSession,
    getAdminTestWorkspaceHref,
    type AdminTestRole,
    isAdminTestRole,
    setActiveAdminTestPersonaCookie,
} from "@/lib/admin-test-mode";
import { touchAdminTestPersona } from "@/lib/admin-test-data";

export async function GET() {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();
        const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (!session.user) {
            return NextResponse.json({ available: false, personas: [], activePersona: null });
        }

        if (!session.canUseAdminTestMode) {
            return NextResponse.json({
                available: false,
                personas: [],
                activePersona: null,
                liveRole: session.liveUserType,
            });
        }

        return NextResponse.json({
            available: true,
            liveRole: session.liveUserType,
            email: session.user.email,
            personas: session.personas.map((persona) => ({
                ...persona,
                href: getAdminTestWorkspaceHref(persona.role),
            })),
            activePersona: session.activePersona
                ? {
                    ...session.activePersona,
                    href: getAdminTestWorkspaceHref(session.activePersona.role),
                }
                : null,
        });
    } catch (error) {
        console.error("[AdminTestPersonas GET] Error:", error);
        return NextResponse.json({ available: false, personas: [], activePersona: null });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();
        const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (!session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!session.canUseAdminTestMode) {
            return NextResponse.json({ error: "Admin test mode is not available." }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const action = typeof body.action === "string" ? body.action : null;

        if (action === "deactivate") {
            await clearActiveAdminTestPersonaCookie();
            return NextResponse.json({ success: true, href: "/admin" });
        }

        if (action !== "activate") {
            return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
        }

        const personaId = typeof body.personaId === "string" ? body.personaId : null;
        const role = typeof body.role === "string" && isAdminTestRole(body.role) ? (body.role as AdminTestRole) : null;
        const persona = personaId
            ? session.personas.find((entry) => entry.id === personaId) || null
            : role
                ? session.personas.find((entry) => entry.role === role) || null
                : null;

        if (!persona) {
            return NextResponse.json({ error: "Sandbox persona not found." }, { status: 404 });
        }

        await setActiveAdminTestPersonaCookie(persona.id);
        await touchAdminTestPersona(admin, persona.id);

        return NextResponse.json({
            success: true,
            href: getAdminTestWorkspaceHref(persona.role),
            persona,
        });
    } catch (error) {
        console.error("[AdminTestPersonas POST] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
