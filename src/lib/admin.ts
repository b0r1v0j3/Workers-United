// Admin configuration for dual-role authentication
// Set ADMIN_EMAIL in .env.local to enable God Mode

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export function isAdmin(email: string | undefined | null): boolean {
    if (!email || !ADMIN_EMAIL) return false;
    return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export type AdminRole = "worker" | "employer";

export const ADMIN_ROLE_COOKIE = "admin_role";
