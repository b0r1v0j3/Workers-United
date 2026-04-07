import { NextRequest, NextResponse } from "next/server";
import { markAdminWhatsAppThreadSeen } from "@/lib/admin-whatsapp";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);
    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const phoneNumber = typeof (body as { phoneNumber?: unknown })?.phoneNumber === "string"
        ? (body as { phoneNumber: string }).phoneNumber
        : "";
    const latestAt = typeof (body as { latestAt?: unknown })?.latestAt === "string"
        ? (body as { latestAt: string }).latestAt
        : "";

    if (!phoneNumber.trim() || !latestAt.trim()) {
        return NextResponse.json({ error: "phoneNumber and latestAt are required." }, { status: 400 });
    }

    try {
        const result = await markAdminWhatsAppThreadSeen(createAdminClient(), {
            adminProfileId: user.id,
            phoneNumber,
            latestAt,
        });

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
