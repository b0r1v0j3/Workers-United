import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queueEmail } from "@/lib/email-templates";
import { isEmailDeliveryAccepted } from "@/lib/email-queue";
import { hasKnownTypoEmailDomain, isInternalOrTestEmail } from "@/lib/reporting";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { normalizeUserType } from "@/lib/domain";
import { hasQueuedOrSentWelcomeEmail } from "@/lib/welcome-notifications";

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
        if (emailType !== "welcome") {
            return NextResponse.json({ error: "Only welcome emails can be queued from this route." }, { status: 400 });
        }

        const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";
        const userEmail = user.email || "";
        const recipientRole = normalizeUserType(user.user_metadata?.user_type);
        const isWorker = user.user_metadata?.user_type === "worker";
        const canEmailThisUser = Boolean(userEmail) && !isInternalOrTestEmail(userEmail) && !hasKnownTypoEmailDomain(userEmail);

        // Lookup phone number for WhatsApp dual-send
        const { data: workerRecord } = await supabase
            .from("worker_onboarding")
            .select("profile_id, agency_id, submitted_email, phone")
            .eq("profile_id", user.id)
            .maybeSingle();
        const phone = workerRecord?.phone || undefined;
        const canNotifyWorkerDirectly = canEmailThisUser && (!isWorker || canSendWorkerDirectNotifications({
            email: userEmail,
            phone,
            worker: workerRecord,
            isHiddenDraftOwner: Boolean(user.user_metadata?.hidden_draft_owner),
        }));
        const hasActiveWelcomeEmail = await hasQueuedOrSentWelcomeEmail(supabase, user.id).catch(() => false);
        let emailResult: Awaited<ReturnType<typeof queueEmail>> | null = null;

        if (!canNotifyWorkerDirectly) {
            return NextResponse.json({ success: true, skipped: true, reason: "worker_direct_notifications_disabled" });
        }
        if (hasActiveWelcomeEmail) {
            return NextResponse.json({ success: true, skipped: true, reason: "welcome_already_queued" });
        }
        emailResult = await queueEmail(
            supabase,
            user.id,
            "welcome",
            userEmail,
            userName,
            recipientRole && recipientRole !== "admin" ? { recipientRole } : {},
            undefined,
            phone
        );

        if (emailResult && !isEmailDeliveryAccepted(emailResult)) {
            return NextResponse.json({
                success: false,
                queued: false,
                error: emailResult.error || "Email queue failed",
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            queued: true,
            deliveryStatus: emailResult?.status || "scheduled",
            whatsappDeliveryStatus: emailResult?.whatsapp?.attempted
                ? (emailResult.whatsapp.sent ? "sent" : "failed")
                : "not_attempted",
            whatsappError: emailResult?.whatsapp?.error || null,
        });

    } catch (error) {
        console.error("Queue user email error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
