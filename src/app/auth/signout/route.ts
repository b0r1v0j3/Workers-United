import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        // Clear all Supabase cookies manually
        const response = NextResponse.redirect(new URL("/", request.url));

        // Delete auth cookies
        response.cookies.delete("sb-access-token");
        response.cookies.delete("sb-refresh-token");
        response.cookies.delete("admin_role");

        // Also try the project-specific cookie names
        const cookies = request.cookies.getAll();
        cookies.forEach(cookie => {
            if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
                response.cookies.delete(cookie.name);
            }
        });

        return response;
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
