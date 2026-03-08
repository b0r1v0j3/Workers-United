import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, standardLimiter } from "@/lib/rate-limit";

// ─── Lightweight Activity Tracker ────────────────────────────────────────────
// Accepts page views and funnel events from the client side.
// Stores them in user_activity for brain analysis.

const ALLOWED_ACTIONS = new Set([
    "payment_click",
    "payment_error",
    "signup_error",
    "signup_google_click",
    "signup_google_error",
    "signup_page_view",
    "signup_pending_email_confirmation",
    "signup_submit_attempt",
    "signup_success",
    "signup_validation_failed",
]);

const ALLOWED_CATEGORIES = new Set(["funnel", "tracking"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeDetails(value: unknown, depth = 0): Record<string, unknown> {
    if (!isPlainObject(value) || depth > 2) {
        return {};
    }

    const entries = Object.entries(value).slice(0, 12);
    const sanitized = entries.map(([key, rawValue]) => {
        if (rawValue == null || typeof rawValue === "boolean" || typeof rawValue === "number") {
            return [key, rawValue];
        }

        if (typeof rawValue === "string") {
            return [key, rawValue.slice(0, 200)];
        }

        if (Array.isArray(rawValue)) {
            return [
                key,
                rawValue
                    .slice(0, 10)
                    .map((item) => (typeof item === "string" ? item.slice(0, 100) : item))
                    .filter((item) => item == null || ["boolean", "number", "string"].includes(typeof item)),
            ];
        }

        if (isPlainObject(rawValue)) {
            return [key, sanitizeDetails(rawValue, depth + 1)];
        }

        return [key, String(rawValue).slice(0, 200)];
    });

    return Object.fromEntries(sanitized);
}

export async function POST(request: NextRequest) {
    const blocked = checkRateLimit(request, standardLimiter);
    if (blocked) {
        return blocked;
    }

    try {
        const body = await request.json();
        const action = typeof body?.action === "string" ? body.action.trim() : "";
        const category = typeof body?.category === "string" ? body.category.trim() : "tracking";
        const details = sanitizeDetails(body?.details);

        if (!action) {
            return NextResponse.json({ error: "action required" }, { status: 400 });
        }
        if (!ALLOWED_ACTIONS.has(action)) {
            return NextResponse.json({ error: "Unsupported tracking action" }, { status: 400 });
        }
        if (!ALLOWED_CATEGORIES.has(category)) {
            return NextResponse.json({ error: "Unsupported tracking category" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Use admin client to insert since anonymous users won't have RLS access
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        const anonymous = !user;

        const { error } = await admin.from("user_activity").insert({
            user_id: user?.id ?? null,
            action,
            category,
            status: "ok",
            details: { ...details, anonymous },
        });

        if (error) {
            console.error("[track] Failed to insert activity:", error);
            return NextResponse.json({ error: "Failed to record activity" }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[track] Unexpected error:", error);
        return NextResponse.json({ error: "Invalid tracking payload" }, { status: 400 });
    }
}
