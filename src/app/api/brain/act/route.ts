import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Brain Action Executor ──────────────────────────────────────────────────
// POST: Execute a specific action (send WhatsApp, retry email, etc.)
// Called by Brain Monitor when it decides to take action
//
// Auth: CRON_SECRET bearer token

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.text();
    console.log("[Brain Act] Raw request body:", rawBody.substring(0, 500));

    let body: unknown;
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

    // Flexible parsing: try many possible formats the caller might send
    // Could be: { action, params }, { action, phone, message }, [{ action, params }], etc.
    const item = Array.isArray(body) ? body[0] : body;
    const innerCandidate = isRecord(item) && isRecord(item.json) ? item.json : item;
    const inner = isRecord(innerCandidate) ? innerCandidate : {};

    const actionCandidate = inner.action ?? inner.type ?? inner.command;
    const action = typeof actionCandidate === "string" && actionCandidate.trim()
        ? actionCandidate
        : "log_observation";
    const paramsCandidate = inner.params ?? inner.parameters ?? inner;
    const params = isRecord(paramsCandidate) ? paramsCandidate : {};

    console.log("[Brain Act] Parsed action:", action, "params keys:", Object.keys(params));

    const supabase = createAdminClient();

    try {
        switch (action) {
            // ─── Send WhatsApp Message ─────────────────────────────────
            case "send_whatsapp": {
                const phone = getStringValue(params.phone);
                const message = getStringValue(params.message);
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
                const emailId = getStringValue(params.email_id);
                if (!emailId) {
                    return NextResponse.json({ error: "email_id required" }, { status: 400 });
                }

                // Reset email status to pending so the cron job picks it up
                const { error } = await supabase
                    .from("email_queue")
                    .update({ status: "pending", error_message: null })
                    .eq("id", emailId);

                await supabase.from("brain_actions").insert({
                    action_type: "retry_email",
                    description: `Retried failed email ${emailId}`,
                    metadata: { email_id: emailId },
                    result: error ? "failed" : "completed",
                    error_message: error?.message,
                });

                return NextResponse.json({ success: !error });
            }

            // ─── Update User Status ────────────────────────────────────
            case "update_worker_status": {
                const profileId = getStringValue(params.profile_id);
                const status = getStringValue(params.status);
                if (!profileId || !status) {
                    return NextResponse.json({ error: "profile_id and status required" }, { status: 400 });
                }

                const { error } = await supabase
                    .from("worker_onboarding")
                    .update({ status })
                    .eq("profile_id", profileId);

                await supabase.from("brain_actions").insert({
                    action_type: "status_update",
                    description: `Updated worker ${profileId} status to ${status}`,
                    target_user_id: profileId,
                    metadata: { status },
                    result: error ? "failed" : "completed",
                    error_message: error?.message,
                });

                return NextResponse.json({ success: !error });
            }

            // ─── Log Observation ───────────────────────────────────────
            case "log_observation": {
                const description = getStringValue(params.description) || "Brain logged observation";
                const obsMetadata = isRecord(params.metadata) ? params.metadata : {};

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
    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        console.error("[Brain Act] Error executing action:", error);

        await supabase.from("brain_actions").insert({
            action_type: action,
            description: `Failed to execute: ${action}`,
            metadata: { params, error: errorMessage },
            result: "failed",
            error_message: errorMessage,
        });

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
