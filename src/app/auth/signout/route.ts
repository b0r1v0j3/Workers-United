import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLE_COOKIE } from "@/lib/admin";
import { NextResponse } from "next/server";

async function handleSignOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Create response and clear admin role cookie
    const response = NextResponse.redirect(
        new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    );

    // Clear the admin role cookie
    response.cookies.set(ADMIN_ROLE_COOKIE, "", {
        path: "/",
        maxAge: 0,
    });

    return response;
}

export async function POST() {
    return handleSignOut();
}

export async function GET() {
    return handleSignOut();
}
