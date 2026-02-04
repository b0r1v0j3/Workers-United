import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            try {
                                cookieStore.set(name, value, options);
                            } catch {
                                // Ignore errors in read-only context
                            }
                        });
                    },
                },
            }
        );

        // Sign out from Supabase
        await supabase.auth.signOut();

        // Redirect to home
        const response = NextResponse.redirect("https://www.workersunited.eu/");

        // Clear ALL supabase cookies
        const allCookies = cookieStore.getAll();
        allCookies.forEach(cookie => {
            if (cookie.name.includes("supabase") || cookie.name.startsWith("sb-")) {
                response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
            }
        });

        // Also clear admin role cookie
        response.cookies.set("admin_role", "", { path: "/", maxAge: 0 });

        return response;
    } catch (error) {
        console.error("Signout error:", error);
        // Even on error, redirect to home
        return NextResponse.redirect("https://www.workersunited.eu/");
    }
}

export async function POST() {
    return GET();
}
