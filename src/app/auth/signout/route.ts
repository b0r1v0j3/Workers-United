import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const response = NextResponse.redirect("https://www.workersunited.eu/");

    // Clear common auth cookies
    response.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 });
    response.cookies.set("sb-refresh-token", "", { path: "/", maxAge: 0 });
    response.cookies.set("admin_role", "", { path: "/", maxAge: 0 });

    return response;
}

export async function POST() {
    return GET();
}
