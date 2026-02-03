import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// This endpoint is called by n8n to get pending emails
export async function GET(request: NextRequest) {
    try {
        // Verify API key for n8n access
        const apiKey = request.headers.get("x-api-key");
        if (apiKey !== process.env.N8N_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = await createClient();

        // Get pending emails scheduled for now or earlier
        const { data: emails } = await supabase
            .from("email_queue")
            .select("*")
            .eq("status", "pending")
            .lte("scheduled_for", new Date().toISOString())
            .order("scheduled_for", { ascending: true })
            .limit(50);

        return NextResponse.json({ emails: emails || [] });

    } catch (error) {
        console.error("Email queue GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// n8n calls this to add emails to queue
export async function POST(request: NextRequest) {
    try {
        const apiKey = request.headers.get("x-api-key");
        if (apiKey !== process.env.N8N_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = await createClient();
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

        const { data, error } = await supabase
            .from("email_queue")
            .insert({
                user_id: userId,
                email_type: emailType,
                recipient_email: recipientEmail,
                recipient_name: recipientName,
                subject: subject,
                template_data: templateData || {},
                scheduled_for: scheduledFor || new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Email queue insert error:", error);
            return NextResponse.json({ error: "Failed to queue email" }, { status: 500 });
        }

        return NextResponse.json({ success: true, emailId: data.id });

    } catch (error) {
        console.error("Email queue POST error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// n8n calls this to mark emails as sent
export async function PATCH(request: NextRequest) {
    try {
        const apiKey = request.headers.get("x-api-key");
        if (apiKey !== process.env.N8N_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = await createClient();
        const body = await request.json();
        const { emailId, status, errorMessage } = body;

        const updateData: any = {
            status: status,
            sent_at: status === "sent" ? new Date().toISOString() : null
        };

        if (errorMessage) {
            updateData.error_message = errorMessage;
        }

        await supabase
            .from("email_queue")
            .update(updateData)
            .eq("id", emailId);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Email queue PATCH error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
