import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Brain Action Executor ──────────────────────────────────────────────────
// POST: Execute a specific action (send WhatsApp, retry email, etc.)
// Called by n8n Brain workflow when it decides to take action
//
// Auth: CRON_SECRET bearer token

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.text();
    console.log("[Brain Act] Raw request body:", rawBody.substring(0, 500));

    let body: any;
    try {
        body = JSON.parse(rawBody);
    } catch {
        // If JSON parsing fails, treat entire body as an observation
        const supabase = createAdminClient();
        await supabase.from("brain_actions").insert({
            action_type: "observation",
            description: rawBody.substring(0, 1000) || "Brain sent non-JSON data",
            metadata: { raw: rawBody.substring(0, 500) },
            result: "completed",
        });
        return NextResponse.json({ success: true, note: "Logged as observation" });
    }

    // Flexible parsing: try many possible formats n8n might send
    // Could be: { action, params }, { action, phone, message }, [{ action, params }], etc.
    const item = Array.isArray(body) ? body[0] : body;
    const inner = item?.json || item; // unwrap n8n { json: {} } wrapper

    const action = inner?.action || inner?.type || inner?.command || "log_observation";
    const params = inner?.params || inner?.parameters || inner || {};

    console.log("[Brain Act] Parsed action:", action, "params keys:", Object.keys(params));

    const supabase = createAdminClient();

    try {
        switch (action) {
            // ─── Send WhatsApp Message ─────────────────────────────────
            case "send_whatsapp": {
                const { phone, message } = params;
                if (!phone || !message) {
                    return NextResponse.json({ error: "phone and message required" }, { status: 400 });
                }

                const WA_TOKEN = process.env.WHATSAPP_TOKEN;
                const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

                if (!WA_TOKEN || !WA_PHONE_ID) {
                    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 500 });
                }

                const waRes = await fetch(
                    `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${WA_TOKEN}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            messaging_product: "whatsapp",
                            to: phone.replace(/\+/g, ""),
                            type: "text",
                            text: { body: message },
                        }),
                    }
                );

                const waData = await waRes.json();

                // Log the action
                await supabase.from("brain_actions").insert({
                    action_type: "user_reminder",
                    description: `Sent WhatsApp message to ${phone}: ${message.substring(0, 100)}`,
                    metadata: { phone, message_preview: message.substring(0, 200), wa_response: waData },
                    result: waRes.ok ? "completed" : "failed",
                    error_message: waRes.ok ? null : JSON.stringify(waData),
                });

                return NextResponse.json({ success: waRes.ok, data: waData });
            }

            // ─── Retry Failed Email ────────────────────────────────────
            case "retry_email": {
                const { email_id } = params;
                if (!email_id) {
                    return NextResponse.json({ error: "email_id required" }, { status: 400 });
                }

                // Reset email status to pending so the cron job picks it up
                const { error } = await supabase
                    .from("email_queue")
                    .update({ status: "pending", error_message: null })
                    .eq("id", email_id);

                await supabase.from("brain_actions").insert({
                    action_type: "retry_email",
                    description: `Retried failed email ${email_id}`,
                    metadata: { email_id },
                    result: error ? "failed" : "completed",
                    error_message: error?.message,
                });

                return NextResponse.json({ success: !error });
            }

            // ─── Update User Status ────────────────────────────────────
            case "update_candidate_status": {
                const { profile_id, status } = params;
                if (!profile_id || !status) {
                    return NextResponse.json({ error: "profile_id and status required" }, { status: 400 });
                }

                const { error } = await supabase
                    .from("candidates")
                    .update({ status })
                    .eq("profile_id", profile_id);

                await supabase.from("brain_actions").insert({
                    action_type: "status_update",
                    description: `Updated candidate ${profile_id} status to ${status}`,
                    target_user_id: profile_id,
                    metadata: { status },
                    result: error ? "failed" : "completed",
                    error_message: error?.message,
                });

                return NextResponse.json({ success: !error });
            }

            // ─── Log Observation ───────────────────────────────────────
            case "log_observation": {
                const { description, metadata: obsMetadata } = params;

                await supabase.from("brain_actions").insert({
                    action_type: "observation",
                    description,
                    metadata: obsMetadata || {},
                    result: "completed",
                });

                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error("[Brain Act] Error executing action:", error);

        await supabase.from("brain_actions").insert({
            action_type: action,
            description: `Failed to execute: ${action}`,
            metadata: { params, error: error.message },
            result: "failed",
            error_message: error.message,
        });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
