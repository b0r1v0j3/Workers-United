// ─── Server-side Activity Logger ───────────────────────────────────────────
// For use in API routes (server component context).
// Uses admin client to bypass RLS for inserting logs.

import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type ActivityCategory = "profile" | "documents" | "payment" | "auth" | "navigation" | "error" | "system" | "messaging";
type ActivityStatus = "ok" | "error" | "warning" | "blocked";

interface ActivityDetails {
    [key: string]: unknown;
}

/**
 * Log a user activity event from a server-side context.
 * Uses admin client to bypass RLS. Fire-and-forget.
 */
export async function logServerActivity(
    userId: string | null,
    action: string,
    category: ActivityCategory,
    details: ActivityDetails = {},
    status: ActivityStatus = "ok"
): Promise<void> {
    try {
        const admin = createTypedAdminClient();
        await admin.from("user_activity").insert({
            user_id: userId,
            action,
            category,
            details: details as Json,
            status,
        });
    } catch {
        // Never throw from logging — server logs should not break API routes
        console.warn("[ActivityLogger] Failed to log server activity:", action);
    }
}
