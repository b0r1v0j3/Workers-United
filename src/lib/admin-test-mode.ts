import { cookies } from "next/headers";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { normalizeUserType, type CanonicalUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";

export const ADMIN_TEST_PERSONA_COOKIE = "wu_admin_test_persona";
export const ADMIN_TEST_ROLES = ["worker", "employer", "agency"] as const;

export type AdminTestRole = (typeof ADMIN_TEST_ROLES)[number];

export interface AdminTestPersonaRecord {
    id: string;
    owner_profile_id: string;
    role: AdminTestRole;
    label: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    last_used_at: string | null;
}

export interface AdminTestOwnerProfile {
    id: string;
    email: string | null;
    full_name: string | null;
    user_type: string | null;
}

export interface AdminTestSession {
    user: SupabaseUser | null;
    ownerProfile: AdminTestOwnerProfile | null;
    liveUserType: CanonicalUserType | null;
    canUseAdminTestMode: boolean;
    personas: AdminTestPersonaRecord[];
    activePersona: AdminTestPersonaRecord | null;
}

const ROLE_ORDER: Record<AdminTestRole, number> = {
    worker: 0,
    employer: 1,
    agency: 2,
};

export function isAdminTestRole(value: string | null | undefined): value is AdminTestRole {
    return value === "worker" || value === "employer" || value === "agency";
}

export function sortAdminTestPersonas<T extends { role: AdminTestRole }>(personas: T[]): T[] {
    return [...personas].sort((left, right) => ROLE_ORDER[left.role] - ROLE_ORDER[right.role]);
}

export function buildAdminTestEmail(email: string | null | undefined, role: AdminTestRole): string {
    if (!email || !email.includes("@")) {
        return `admin-test-${role}@workersunited.local`;
    }

    const [localPart, domain] = email.split("@");
    const safeLocal = (localPart || "admin").replace(/\+.*$/, "");
    return `${safeLocal}+test-${role}@${domain}`;
}

export function buildAdminTestLabel(ownerName: string | null | undefined, role: AdminTestRole): string {
    const baseName = ownerName?.trim() || "Admin";
    if (role === "worker") return `${baseName} Worker Test`;
    if (role === "employer") return `${baseName} Employer Test`;
    return `${baseName} Agency Test`;
}

export function getAdminTestWorkspaceHref(role: AdminTestRole): string {
    if (role === "worker") return "/profile/worker";
    if (role === "employer") return "/profile/employer";
    return "/profile/agency";
}

export function buildAdminTestUser<TUser extends SupabaseUser>(
    user: TUser,
    input: {
        persona: AdminTestPersonaRecord;
        displayName?: string | null;
        email?: string | null;
    }
): TUser {
    return {
        ...user,
        email: input.email || user.email,
        user_metadata: {
            ...user.user_metadata,
            user_type: input.persona.role,
            full_name: input.displayName || input.persona.label,
            admin_test_mode: true,
            admin_test_persona_id: input.persona.id,
            admin_test_persona_role: input.persona.role,
            admin_test_persona_label: input.persona.label,
            admin_test_real_user_type: normalizeUserType(user.user_metadata?.user_type),
        },
    };
}

export async function setActiveAdminTestPersonaCookie(personaId: string) {
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_TEST_PERSONA_COOKIE, personaId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
    });
}

export async function clearActiveAdminTestPersonaCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_TEST_PERSONA_COOKIE);
}

export async function getActiveAdminTestPersonaCookie(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(ADMIN_TEST_PERSONA_COOKIE)?.value || null;
}

async function fetchOwnerProfile(
    admin: any,
    userId: string
): Promise<AdminTestOwnerProfile | null> {
    const { data, error } = await admin
        .from("profiles")
        .select("id, email, full_name, user_type")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (data as AdminTestOwnerProfile | null) ?? null;
}

export async function getAdminTestSession(input: {
    supabase: any;
    admin: any;
    ensurePersonas?: boolean;
}): Promise<AdminTestSession> {
    const { supabase, admin, ensurePersonas = false } = input;
    void ensurePersonas;
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            user: null,
            ownerProfile: null,
            liveUserType: null,
            canUseAdminTestMode: false,
            personas: [],
            activePersona: null,
        };
    }

    const ownerProfile = await fetchOwnerProfile(admin, user.id);
    const liveUserType = normalizeUserType(ownerProfile?.user_type || user.user_metadata?.user_type);
    const canUseAdminTestMode = liveUserType === "admin" || isGodModeUser(user.email);

    if (!canUseAdminTestMode || !ownerProfile) {
        return {
            user,
            ownerProfile,
            liveUserType,
            canUseAdminTestMode: false,
            personas: [],
            activePersona: null,
        };
    }

    const { ensureAdminTestPersonas } = await import("@/lib/admin-test-data");
    const personas = await ensureAdminTestPersonas(admin, ownerProfile);

    const activePersonaId = await getActiveAdminTestPersonaCookie();
    const activePersona = activePersonaId
        ? personas.find((persona) => persona.id === activePersonaId) || null
        : null;

    return {
        user,
        ownerProfile,
        liveUserType,
        canUseAdminTestMode,
        personas,
        activePersona,
    };
}
