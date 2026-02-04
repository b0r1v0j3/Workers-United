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

    const baseUrl = origin.startsWith("http") ? origin : `https://${origin}`;

    // Create response and clear admin role cookie
    const response = NextResponse.redirect(new URL("/", baseUrl));

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
