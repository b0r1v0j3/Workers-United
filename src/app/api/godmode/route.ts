import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import {
    clearActiveAdminTestPersonaCookie,
    getAdminTestSession,
    getAdminTestWorkspaceHref,
    setActiveAdminTestPersonaCookie,
} from "@/lib/admin-test-mode";
import { touchAdminTestPersona } from "@/lib/admin-test-data";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();
        const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        const user = session.user;
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check god mode access
        if (!isGodModeUser(user.email)) {
            return NextResponse.json({ error: "God mode not available" }, { status: 403 });
        }

        const body = await request.json();
        const { action } = body;

        const activateSandboxRole = async (role: "worker" | "employer" | "agency") => {
            if (!session.canUseAdminTestMode) {
                return NextResponse.json({ error: "Sandbox mode is not available." }, { status: 403 });
            }

            const persona = session.personas.find((entry) => entry.role === role) || null;
            if (!persona) {
                return NextResponse.json({ error: "Sandbox persona not found." }, { status: 404 });
            }

            await setActiveAdminTestPersonaCookie(persona.id);
            await touchAdminTestPersona(admin, persona.id);

            return NextResponse.json({
                success: true,
                action,
                sandbox: true,
                role,
                href: getAdminTestWorkspaceHref(role),
            });
        };

        switch (action) {
            case "verify":
                // Skip to verified status
                await supabase
                    .from("worker_onboarding")
                    .update({
                        status: "VERIFIED",
                        updated_at: new Date().toISOString()
                    })
                    .eq("profile_id", user.id);
                break;

            case "queue":
                // Skip to in queue status
                const nextPos = await getNextQueuePosition(supabase);
                await supabase
                    .from("worker_onboarding")
                    .update({
                        status: "IN_QUEUE",
                        entry_fee_paid: true,
                        queue_position: nextPos,
                        queue_joined_at: new Date().toISOString(),
                        refund_deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq("profile_id", user.id);
                break;

            case "offer":
                // Skip to offer pending
                await supabase
                    .from("worker_onboarding")
                    .update({
                        status: "OFFER_PENDING",
                        updated_at: new Date().toISOString()
                    })
                    .eq("profile_id", user.id);
                break;

            case "reset":
                // Reset to new
                await supabase
                    .from("worker_onboarding")
                    .update({
                        status: "NEW",
                        entry_fee_paid: false,
                        queue_position: null,
                        queue_joined_at: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq("profile_id", user.id);
                break;

            case "switch_to_employer":
                return activateSandboxRole("employer");

            case "switch_to_worker":
                return activateSandboxRole("worker");

            case "switch_to_agency":
                return activateSandboxRole("agency");

            case "switch_to_admin":
                await clearActiveAdminTestPersonaCookie();
                return NextResponse.json({
                    success: true,
                    action,
                    sandbox: false,
                    role: "admin",
                    href: "/admin",
                });

            default:
                return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, action });

    } catch (error) {
        console.error("God mode error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : "Unknown error";
};

async function getNextQueuePosition(supabase: SupabaseClient): Promise<number> {
    const { data } = await supabase
        .from("worker_onboarding")
        .select("queue_position")
        .not("queue_position", "is", null)
        .order("queue_position", { ascending: false })
        .limit(1);

    return (data?.[0]?.queue_position || 0) + 1;
}

// GET: Check god mode status
export async function GET() {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();
        const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        const user = session.user;
        const authError = user ? null : true;

        if (authError || !user) {
            // Not logged in — normal for public pages, not an error
            return NextResponse.json({ godMode: false });
        }

        const isGod = isGodModeUser(user.email);

        return NextResponse.json({
            godMode: isGod,
            email: user.email,
            activePersonaRole: session.activePersona?.role || null,
        });

    } catch (error: unknown) {
        console.error("God mode GET error:", error);
        return NextResponse.json({ godMode: false, error: getErrorMessage(error) });
    }
}
