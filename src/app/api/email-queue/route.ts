import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasValidCronBearerToken } from "@/lib/cron-auth";
import { attachEmailQueueMeta, processQueuedEmailRecord } from "@/lib/email-queue";

// This endpoint is called to get pending emails
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!hasValidCronBearerToken(authHeader)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createAdminClient();

        // Get pending emails scheduled for now or earlier
        const { data: emails, error } = await supabase
            .from("email_queue")
            .select("*")
            .eq("status", "pending")
            .lte("scheduled_for", new Date().toISOString())
            .order("scheduled_for", { ascending: true })
            .limit(500);

        if (error) {
            console.error("Email queue GET query error:", error);
            return NextResponse.json({ error: "Failed to load email queue" }, { status: 500 });
        }

        return NextResponse.json({ emails: emails || [] });

    } catch (error) {
        console.error("Email queue GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Queue an email and send it immediately via SMTP
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!hasValidCronBearerToken(authHeader)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createAdminClient();
        const body = await request.json();

        const {
            userId,
            emailType,
            recipientEmail,
            recipientName,
            subject,
            templateData,
            scheduledFor
        } = body;

        const queueTemplateData = attachEmailQueueMeta(
            { ...(templateData || {}) },
            { attempts: 0, maxAttempts: 3 }
        );

        // Insert into queue
        const { data, error } = await supabase
            .from("email_queue")
            .insert({
                user_id: userId,
                email_type: emailType,
                recipient_email: recipientEmail,
                recipient_name: recipientName,
                subject: subject,
                template_data: queueTemplateData,
                scheduled_for: scheduledFor || new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Email queue insert error:", error);
            return NextResponse.json({ error: "Failed to queue email" }, { status: 500 });
        }

        // If not scheduled for later, send immediately via SMTP
        if (!scheduledFor) {
            const result = await processQueuedEmailRecord(supabase, {
                id: data.id,
                recipient_email: recipientEmail,
                subject,
                template_data: queueTemplateData,
                scheduled_for: data.scheduled_for,
            });

            return NextResponse.json({
                success: result.sent || result.queued,
                emailId: data.id,
                deliveryStatus: result.status,
                retryScheduledFor: result.retryScheduledFor || null,
                error: result.error || null,
            });
        }

        return NextResponse.json({ success: true, emailId: data.id, deliveryStatus: "scheduled" });

    } catch (error) {
        console.error("Email queue POST error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Called to mark emails as sent
export async function PATCH(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!hasValidCronBearerToken(authHeader)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createAdminClient();
        const body = await request.json();
        const { emailId, status, errorMessage } = body;

        const updateData: Record<string, string | null> = {
            status: status,
            sent_at: status === "sent" ? new Date().toISOString() : null
        };

        if (errorMessage) {
            updateData.error_message = errorMessage;
        }

        const { error } = await supabase
            .from("email_queue")
            .update(updateData)
            .eq("id", emailId);

        if (error) {
            console.error("Email queue PATCH update error:", error);
            return NextResponse.json({ error: "Failed to update email queue row" }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Email queue PATCH error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
