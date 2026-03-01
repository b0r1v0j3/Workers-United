// ─── User Activity Logger ──────────────────────────────────────────────────
// Fire-and-forget client-side activity logging.
// Writes to `user_activity` table in Supabase.
// Used across the app to track user actions for debugging & AI analysis.

import { createClient } from "@/lib/supabase/client";

type ActivityCategory = "profile" | "documents" | "payment" | "auth" | "navigation" | "error";
type ActivityStatus = "ok" | "error" | "warning" | "blocked";

interface ActivityDetails {
    page?: string;
    error?: string;
    doc_type?: string;
    step?: string;
    field?: string;
    [key: string]: unknown;
}

/**
 * Log a user activity event. Fire-and-forget — never blocks the UI.
 */
export function logActivity(
    action: string,
    category: ActivityCategory,
    details: ActivityDetails = {},
    status: ActivityStatus = "ok"
): void {
    // Run async but don't await — fire and forget
    _logAsync(action, category, details, status).catch(() => {
        // Silently fail — logging should never break the app
    });
}

async function _logAsync(
    action: string,
    category: ActivityCategory,
    details: ActivityDetails,
    status: ActivityStatus
): Promise<void> {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // Not logged in — skip

        await supabase.from("user_activity").insert({
            user_id: user.id,
            action,
            category,
            details,
            status,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });
    } catch {
        // Never throw from logging
    }
}

/**
 * Log an error event with full context.
 */
export function logError(
    action: string,
    category: ActivityCategory,
    error: unknown,
    extraDetails: ActivityDetails = {}
): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logActivity(action, category, { ...extraDetails, error: errorMessage }, "error");
}
