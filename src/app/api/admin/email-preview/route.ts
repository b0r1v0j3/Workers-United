import { NextResponse } from "next/server";
import { getEmailTemplate } from "@/lib/email-templates";
import type { EmailType } from "@/lib/email-templates";

const VALID_TYPES: EmailType[] = [
    "welcome", "profile_complete", "payment_success", "job_offer",
    "offer_reminder", "refund_approved", "document_expiring", "job_match",
    "admin_update", "announcement", "profile_incomplete",
];

export async function POST(request: Request) {
    try {
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
