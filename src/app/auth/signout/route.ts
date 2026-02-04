import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLE_COOKIE } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";

async function handleSignOut(request: NextRequest) {
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Get the origin from request headers or use fallback
    const origin = request.headers.get("origin") ||
        request.headers.get("x-forwarded-host") ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "https://www.workersunited.eu";

    // Ensure protocol
    let baseUrl = origin;
    if (!baseUrl.startsWith("http")) {
        baseUrl = `https://${baseUrl}`;
    }

    // Create response with 303 See Other to force GET on the redirect target
    // This is crucial because forms submit via POST, and we redirect to "/" which is a GET-only page
    const response = NextResponse.redirect(new URL("/", baseUrl), {
        status: 303,
    });

    // Clear the admin role cookie
    response.cookies.set(ADMIN_ROLE_COOKIE, "", {
        path: "/",
        maxAge: 0,
    });

    return response;
}

export async function POST(request: NextRequest) {
    return handleSignOut(request);
}

export async function GET(request: NextRequest) {
    return handleSignOut(request);
}
