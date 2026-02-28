import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";

// ─── Meta Cloud API Webhook ─────────────────────────────────────────────────
// Handles:
// 1. GET  — Webhook verification (hub.challenge)
// 2. POST — Inbound messages + delivery status updates → forwards to n8n AI

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || process.env.CRON_SECRET || "workers-united-whatsapp-verify";
const N8N_WEBHOOK_URL = process.env.N8N_WHATSAPP_WEBHOOK_URL; // e.g. https://b0r1v0j3.app.n8n.cloud/webhook/whatsapp-webhook

// ─── GET: Webhook Verification ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ─── POST: Incoming Messages & Status Updates ───────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Meta sends webhook events wrapped in entry[].changes[].value
        const entry = body?.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value) {
            // Acknowledge but skip (Meta sometimes sends empty pings)
            return NextResponse.json({ status: "ok" });
        }

        const supabase = createAdminClient();

        // ─── Handle delivery status updates (keep locally) ──────────────
        if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
                const wamid = status.id;
                const statusValue = status.status; // sent, delivered, read, failed

                if (wamid && statusValue) {
                    const updateData: Record<string, string> = { status: statusValue };

                    if (statusValue === "failed" && status.errors?.[0]) {
                        updateData.error_message = `${status.errors[0].code}: ${status.errors[0].title}`;
                    }

                    await supabase
                        .from("whatsapp_messages")
                        .update(updateData)
                        .eq("wamid", wamid);
                }
            }
        }

        // ─── Handle incoming messages ───────────────────────────────────
        if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
                const phoneNumber = message.from; // sender's phone (digits only)
                const messageType = message.type;
                const wamid = message.id;

                // Extract text content
                let content = "";
                if (messageType === "text") {
                    content = message.text?.body || "";
                } else if (messageType === "button") {
                    content = message.button?.text || "";
                } else if (messageType === "interactive") {
                    content = message.interactive?.button_reply?.title
                        || message.interactive?.list_reply?.title
                        || `[${messageType}]`;
                } else {
                    content = `[${messageType} message]`;
                }

                // Normalize phone for DB lookup (add + prefix)
                const normalizedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

                // Find user by phone number
                const { data: candidate } = await supabase
                    .from("candidates")
                    .select("id, profile_id, status, queue_position, preferred_job, desired_countries, refund_deadline, refund_eligible")
                    .or(`phone.eq.${normalizedPhone},phone.eq.${phoneNumber}`)
                    .maybeSingle();

                const { data: profile } = candidate?.profile_id
                    ? await supabase
                        .from("profiles")
                        .select("full_name, email")
                        .eq("id", candidate.profile_id)
                        .single()
                    : { data: null };

                // Log inbound message
                await supabase.from("whatsapp_messages").insert({
                    user_id: candidate?.profile_id || null,
                    phone_number: normalizedPhone,
                    direction: "inbound",
                    message_type: messageType,
                    content,
                    wamid,
                    status: "delivered",
                });

                // ─── Forward to n8n AI Chatbot & send reply from Vercel ─
                let aiResponse: string | null = null;

                if (N8N_WEBHOOK_URL) {
                    try {
                        const controller = new AbortController();
                        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

                        const n8nRes = await fetch(N8N_WEBHOOK_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            signal: controller.signal,
                            body: JSON.stringify({
                                phoneNumber: normalizedPhone,
                                messageText: content,
                                messageType,
                                wamid,
                                userProfile: candidate ? {
                                    name: profile?.full_name || "Unknown",
                                    email: profile?.email || null,
                                    status: candidate.status,
                                    queuePosition: candidate.queue_position,
                                    preferredJob: candidate.preferred_job,
                                    desiredCountries: candidate.desired_countries,
                                    refundEligible: candidate.refund_eligible,
                                    refundDeadline: candidate.refund_deadline,
                                } : null,
                                isRegistered: !!candidate,
                            }),
                        });
                        clearTimeout(timeout);

                        if (n8nRes.ok) {
                            const n8nData = await n8nRes.json();
                            // n8n returns the AI response text via "Respond to Webhook" node
                            aiResponse = n8nData?.output || n8nData?.text || n8nData?.message || (typeof n8nData === "string" ? n8nData : null);
                        }
                    } catch (n8nError) {
                        console.error("[WhatsApp Webhook] n8n AI failed:", n8nError);
                    }
                }

                // Send reply via Vercel (using our existing WhatsApp token)
                const replyText = aiResponse || getFallbackResponse(content, candidate, profile);
                if (replyText) {
                    await sendWhatsAppText(normalizedPhone, replyText, candidate?.profile_id);
                }
            }
        }

        // Always return 200 to acknowledge (Meta retries on non-200)
        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("[WhatsApp Webhook] Error:", error);
        // Return 200 even on error to prevent Meta from retrying bad payloads
        return NextResponse.json({ status: "error" });
    }
}

// ─── Fallback Bot (used when n8n is unavailable) ─────────────────────────────

function getFallbackResponse(message: string, candidate: any, profile: any): string {
    const msg = message.toLowerCase().trim();
    const name = profile?.full_name?.split(" ")[0] || "there";

    if (!candidate) {
        return "Welcome to Workers United! 🌍 We help workers find jobs abroad and handle all visa paperwork. Register at workersunited.eu/signup to get started!";
    }

    if (msg.includes("status") || msg.includes("profile")) {
        return `Hi ${name}! Your current status is: ${candidate.status}. Visit workersunited.eu/profile/worker for details.`;
    }

    if (msg.includes("help")) {
        return `Hi ${name}! Type "status" to check your application, or visit workersunited.eu for full details. For complex questions, email support@workersunited.eu`;
    }

    return `Hi ${name}! I'm the Workers United assistant. Our AI chatbot is temporarily offline — please try again shortly or email support@workersunited.eu`;
}

