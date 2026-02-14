import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";

export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check admin access
        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { employerId, status } = body;

        if (!employerId || !status) {
            return NextResponse.json({ error: "employerId and status are required" }, { status: 400 });
        }

        const validStatuses = ["PENDING", "ACTIVE", "VERIFIED", "REJECTED", "SUSPENDED"];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
        }

        const adminClient = createAdminClient();

        const { error } = await adminClient
            .from("employers")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", employerId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, status });
    } catch (error) {
        console.error("Employer status update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
