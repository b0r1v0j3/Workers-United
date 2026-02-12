import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns recent notifications for the current user from email_queue
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get last 20 emails sent to this user as notifications
        const { data: notifications, error } = await supabase
            .from("email_queue")
            .select("id, email_type, status, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Transform email types into user-friendly notifications
        const items = (notifications || []).map((n) => ({
            id: n.id,
            type: n.email_type,
            title: getNotificationTitle(n.email_type),
            icon: getNotificationIcon(n.email_type),
            time: n.created_at,
            read: false, // Future: track read state
        }));

        return NextResponse.json({ notifications: items });
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

function getNotificationTitle(type: string): string {
    const titles: Record<string, string> = {
        welcome: "Welcome to Workers United!",
        profile_complete: "Your profile is complete! 🎉",
        profile_incomplete: "Action needed: complete your profile",
        payment_success: "Payment received — thank you!",
        job_offer: "New job offer available",
        offer_reminder: "Don't forget your pending offer",
        refund_approved: "Your refund has been approved",
        document_expiring: "Document expiring soon",
        job_match: "New job match found for you",
        admin_update: "Update from Workers United",
        announcement: "New announcement",
        profile_reminder: "Reminder: complete your profile",
        profile_warning: "Urgent: your account will be deleted soon",
        profile_deletion: "Your account has been removed",
    };
    return titles[type] || "Notification";
}

function getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
        welcome: "👋",
        profile_complete: "✅",
        profile_incomplete: "📝",
        payment_success: "💳",
        job_offer: "💼",
        offer_reminder: "⏰",
        refund_approved: "💸",
        document_expiring: "📄",
        job_match: "🎯",
        admin_update: "📢",
        announcement: "📣",
        profile_reminder: "📝",
        profile_warning: "⚠️",
        profile_deletion: "🗑️",
    };
    return icons[type] || "🔔";
}
