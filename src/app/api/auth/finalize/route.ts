import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePostAuthRedirect } from "@/lib/auth-redirect";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const accessToken = typeof body.accessToken === "string" ? body.accessToken : null;
        const origin = new URL(request.url).origin;

        let user = null;

        if (accessToken) {
            const admin = createAdminClient();
            const {
                data: { user: tokenUser },
                error,
            } = await admin.auth.getUser(accessToken);

            if (error || !tokenUser) {
                return NextResponse.json({ error: error?.message || "Unauthorized" }, { status: 401 });
            }

            user = tokenUser;
        } else {
            const supabase = await createClient();
            const {
                data: { user: sessionUser },
            } = await supabase.auth.getUser();

            if (!sessionUser) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            user = sessionUser;
        }

        const href = await resolvePostAuthRedirect({ origin, user });
        return NextResponse.json({ href });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
