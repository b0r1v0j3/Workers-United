import { createServerClient } from "@supabase/ssr";
import { ADMIN_ROLE_COOKIE } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

async function handleSignOut(request: NextRequest) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                },
            },
        }
    );

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

    // Create response with redirect to home
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
