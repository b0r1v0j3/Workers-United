import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queueEmail } from "@/lib/email-templates";

// Called after successful signup to queue welcome email
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { emailType } = body;

        const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";
        const userEmail = user.email || "";

        // Lookup phone number for WhatsApp dual-send
        const { data: candidate } = await supabase
            .from("candidates")
            .select("phone")
            .eq("profile_id", user.id)
            .maybeSingle();
        const phone = candidate?.phone || undefined;

        // Queue the appropriate email based on type
        switch (emailType) {
            case "welcome":
                await queueEmail(
                    supabase,
                    user.id,
                    "welcome",
                    userEmail,
                    userName,
                    {},
                    undefined,
                    phone
                );
                break;

            case "profile_complete":
                await queueEmail(
                    supabase,
                    user.id,
                    "profile_complete",
                    userEmail,
                    userName,
                    {},
                    undefined,
                    phone
                );
                break;

            case "payment_success":
                await queueEmail(
                    supabase,
                    user.id,
                    "payment_success",
                    userEmail,
                    userName,
                    { amount: "$9" },
                    undefined,
                    phone
                );
                break;

            default:
                return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Queue user email error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
