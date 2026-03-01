import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEmailTemplate } from "@/lib/email-templates";
import { isGodModeUser } from "@/lib/godmode";
import type { EmailType } from "@/lib/email-templates";

const VALID_TYPES: EmailType[] = [
    "welcome", "profile_complete", "payment_success", "job_offer",
    "offer_reminder", "refund_approved", "document_expiring", "job_match",
    "admin_update", "announcement", "profile_incomplete",
    "profile_reminder", "profile_warning", "profile_deletion",
    "announcement_document_fix"
];

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { type, data } = body;

        if (!type || !VALID_TYPES.includes(type)) {
            return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
        }

        const template = getEmailTemplate(type as EmailType, data || {});
        return NextResponse.json({
            subject: template.subject,
            html: template.html,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
    }
}
