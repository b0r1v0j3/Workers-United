import { NextRequest, NextResponse } from "next/server";
import { syncAuthContactFields, normalizeAuthContactPhone } from "@/lib/auth-contact-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const rawPhone = typeof body?.phone === "string" ? body.phone : body?.phone === null ? null : undefined;
        const rawFullName = typeof body?.fullName === "string" ? body.fullName : body?.fullName === null ? null : undefined;

        if (typeof rawPhone === "string" && rawPhone.trim() && !normalizeAuthContactPhone(rawPhone)) {
            return NextResponse.json(
                { error: "Phone number must start with + and country code." },
                { status: 400 }
            );
        }

        const admin = createAdminClient();
        const result = await syncAuthContactFields(admin, {
            userId: user.id,
            phone: rawPhone,
            fullName: rawFullName,
        });

        return NextResponse.json({
            success: true,
            updated: result.updated,
            normalizedPhone: result.normalizedPhone,
        });
    } catch (error) {
        console.error("[ProfileAuthContact] Sync failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
