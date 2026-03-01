import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

// ─── CSRF Protection ────────────────────────────────────────────────────────
// Validates Origin header on mutating requests to prevent cross-site attacks.
// Exempt: Stripe webhooks, WhatsApp webhooks, cron jobs (use Bearer token auth).

const CSRF_EXEMPT_PATHS = [
    "/api/stripe/webhook",
    "/api/whatsapp",
    "/api/cron/",
    "/api/brain/",
    "/api/health",
];

function isCsrfExempt(pathname: string): boolean {
    return CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

function validateOrigin(request: NextRequest): boolean {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    // For same-origin requests, origin/referer should match our host
    const host = request.headers.get("host") || "";

    if (origin) {
        try {
            const originHost = new URL(origin).host;
            return originHost === host;
        } catch {
            return false;
        }
    }

    if (referer) {
        try {
            const refererHost = new URL(referer).host;
            return refererHost === host;
        } catch {
            return false;
        }
    }

    // No origin or referer — could be server-to-server or old browser
    // Allow for GET/HEAD (safe methods), block for others
    return false;
}

// ─── Main Middleware ─────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const method = request.method;

    // CSRF check for mutating requests on non-exempt API routes
    if (
        pathname.startsWith("/api/") &&
        !isCsrfExempt(pathname) &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    ) {
        if (!validateOrigin(request)) {
            return NextResponse.json(
                { error: "CSRF validation failed" },
                { status: 403 }
            );
        }
    }

    // Session refresh + auth guard for protected routes
    return updateSession(request);
}

export const config = {
    matcher: [
        // Protected page routes
        "/profile/:path*",
        "/admin/:path*",
        // API routes (except static files and Next internals)
        "/api/:path*",
    ],
};
