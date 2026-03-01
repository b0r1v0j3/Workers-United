import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { logServerActivity } from "@/lib/activityLoggerServer";
import crypto from "crypto";

// ─── Meta Cloud API Webhook ─────────────────────────────────────────────────
// Handles:
// 1. GET  — Webhook verification (hub.challenge)
// 2. POST — Inbound messages + delivery status updates → forwards to n8n AI
//
// Architecture: User → WhatsApp → Meta → Vercel → n8n (GPT-4o) → Vercel → WhatsApp
// Vercel enriches the message with: user profile, documents, payments, 
// conversation history (100 messages), and profile completion %

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || process.env.CRON_SECRET || "workers-united-whatsapp-verify";
const N8N_WEBHOOK_URL = process.env.N8N_WHATSAPP_WEBHOOK_URL;
const APP_SECRET = process.env.META_APP_SECRET || "";
const CONVERSATION_HISTORY_LIMIT = 100; // Number of past messages to send for context

// ─── Meta signature verification ─────────────────────────────────────────────
function verifyMetaSignature(rawBody: string, signature: string | null): boolean {
    if (!APP_SECRET) {
        console.warn("[Webhook] META_APP_SECRET not set — skipping signature verification");
        return true; // Allow in dev, but log warning
    }
    if (!signature) return false;
    const expectedSig = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
}

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
        // ─── Verify Meta signature ──────────────────────────────────
        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256");

        if (!verifyMetaSignature(rawBody, signature)) {
            console.error("[Webhook] Invalid Meta signature — rejecting request");
            return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
        }

        const body = JSON.parse(rawBody);

        // Meta sends webhook events wrapped in entry[].changes[].value
        const entry = body?.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value) {
            return NextResponse.json({ status: "ok" });
        }

        const supabase = createAdminClient();

        // ─── Handle delivery status updates (keep locally) ──────────────
        if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
                const wamid = status.id;
                const statusValue = status.status;

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
                const phoneNumber = message.from;
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

                // ─── Fetch user profile (multi-layer phone lookup) ────────
                const candidateSelect = `
                    id, profile_id, status, queue_position, preferred_job, 
                    desired_countries, refund_deadline, refund_eligible,
                    entry_fee_paid, admin_approved, queue_joined_at,
                    nationality, current_country, gender, experience_years,
                    phone, marital_status
                `;

                // Layer 1: Direct phone match in candidates table
                let { data: candidate } = await supabase
                    .from("candidates")
                    .select(candidateSelect)
                    .or(`phone.eq.${normalizedPhone},phone.eq.${phoneNumber}`)
                    .maybeSingle();

                // Layer 2: If not found, search auth users by phone in metadata
                // (covers Google OAuth users who have phone in user_metadata but not in candidates)
                if (!candidate) {
                    const phoneDigits = phoneNumber.replace(/\D/g, "");
                    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
                    const matchedUser = authData?.users?.find(u => {
                        const metaPhone = (u.user_metadata?.phone || "").replace(/\D/g, "");
                        const userPhone = (u.phone || "").replace(/\D/g, "");
                        return (metaPhone && metaPhone === phoneDigits) ||
                            (userPhone && userPhone === phoneDigits);
                    });

                    if (matchedUser) {
                        // Found auth user — look up their candidate record by profile_id
                        const { data: linkedCandidate } = await supabase
                            .from("candidates")
                            .select(candidateSelect)
                            .eq("profile_id", matchedUser.id)
                            .maybeSingle();

                        if (linkedCandidate) {
                            candidate = linkedCandidate;
                            // Backfill phone in candidates table so future lookups are instant
                            await supabase
                                .from("candidates")
                                .update({ phone: normalizedPhone })
                                .eq("id", linkedCandidate.id);
                        }
                    }
                }

                const { data: profile } = candidate?.profile_id
                    ? await supabase
                        .from("profiles")
                        .select("full_name, email, user_type, created_at")
                        .eq("id", candidate.profile_id)
                        .single()
                    : { data: null };

                // ─── Fetch docs, payments, and history in parallel ────
                let documents: any[] = [];
                let payments: any[] = [];
                let conversationHistory: any[] = [];

                if (candidate?.profile_id) {
                    const [docsResult, paymentsResult, historyResult] = await Promise.all([
                        supabase
                            .from("candidate_documents")
                            .select("document_type, status, created_at, verified_at")
                            .eq("user_id", candidate.profile_id),
                        supabase
                            .from("payments")
                            .select("payment_type, status, amount, paid_at")
                            .eq("user_id", candidate.profile_id)
                            .order("created_at", { ascending: false }),
                        supabase
                            .from("whatsapp_messages")
                            .select("direction, content, created_at")
                            .eq("phone_number", normalizedPhone)
                            .order("created_at", { ascending: false })
                            .limit(CONVERSATION_HISTORY_LIMIT),
                    ]);

                    documents = docsResult.data || [];
                    payments = paymentsResult.data || [];
                    conversationHistory = (historyResult.data || []).reverse().map(msg => ({
                        role: msg.direction === "inbound" ? "user" : "assistant",
                        content: msg.content,
                        timestamp: msg.created_at,
                    }));
                } else {
                    // Unregistered user — only fetch history
                    const { data: history } = await supabase
                        .from("whatsapp_messages")
                        .select("direction, content, created_at")
                        .eq("phone_number", normalizedPhone)
                        .order("created_at", { ascending: false })
                        .limit(CONVERSATION_HISTORY_LIMIT);

                    conversationHistory = (history || []).reverse().map(msg => ({
                        role: msg.direction === "inbound" ? "user" : "assistant",
                        content: msg.content,
                        timestamp: msg.created_at,
                    }));
                }

                // ─── Calculate profile completion ───────────────────────
                let profileCompletion = 0;
                let missingFields: string[] = [];
                if (candidate && profile) {
                    const completionResult = getWorkerCompletion({
                        profile,
                        candidate,
                        documents,
                    });
                    profileCompletion = completionResult.completion;
                    missingFields = completionResult.missingFields;
                }

                // ─── Log inbound message ────────────────────────────────
                await supabase.from("whatsapp_messages").insert({
                    user_id: candidate?.profile_id || null,
                    phone_number: normalizedPhone,
                    direction: "inbound",
                    message_type: messageType,
                    content,
                    wamid,
                    status: "delivered",
                });

                // Log to activity tracking
                await logServerActivity(
                    candidate?.profile_id || "anonymous",
                    "whatsapp_message_received",
                    "documents",
                    { phone: normalizedPhone, message_type: messageType, content_preview: content.substring(0, 100), is_registered: !!candidate }
                );

                // ─── Forward enriched data to n8n AI ────────────────────
                let aiResponse: string | null = null;

                if (N8N_WEBHOOK_URL) {
                    try {
                        const controller = new AbortController();
                        const timeout = setTimeout(() => controller.abort(), 25000); // 25s for GPT-4o

                        const n8nPayload = {
                            phoneNumber: normalizedPhone,
                            messageText: content,
                            messageType,
                            wamid,
                            isRegistered: !!candidate,
                            // Full user profile
                            userProfile: candidate ? {
                                name: profile?.full_name || "Unknown",
                                email: profile?.email || null,
                                registeredAt: profile?.created_at || null,
                                status: candidate.status,
                                adminApproved: candidate.admin_approved,
                                entryFeePaid: candidate.entry_fee_paid,
                                queuePosition: candidate.queue_position,
                                queueJoinedAt: candidate.queue_joined_at,
                                preferredJob: candidate.preferred_job,
                                desiredCountries: candidate.desired_countries,
                                nationality: candidate.nationality,
                                currentCountry: candidate.current_country,
                                experienceYears: candidate.experience_years,
                                refundEligible: candidate.refund_eligible,
                                refundDeadline: candidate.refund_deadline,
                                profileCompletion,
                                missingFields,
                            } : null,
                            // Document statuses
                            documents: documents.map(d => ({
                                type: d.document_type,
                                status: d.status,
                                verifiedAt: d.verified_at,
                            })),
                            // Payment history
                            payments: payments.map(p => ({
                                type: p.payment_type,
                                status: p.status,
                                amount: p.amount,
                                paidAt: p.paid_at,
                            })),
                            // Conversation history (100 messages)
                            conversationHistory,
                        };

                        const n8nRes = await fetch(N8N_WEBHOOK_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            signal: controller.signal,
                            body: JSON.stringify(n8nPayload),
                        });
                        clearTimeout(timeout);

                        if (n8nRes.ok) {
                            const n8nData = await n8nRes.json();
                            aiResponse = n8nData?.output || n8nData?.text || n8nData?.message || (typeof n8nData === "string" ? n8nData : null);
                        }
                    } catch (n8nError) {
                        console.error("[WhatsApp Webhook] n8n AI failed:", n8nError);
                        await logServerActivity(
                            candidate?.profile_id || "anonymous",
                            "whatsapp_n8n_failed",
                            "error",
                            { phone: normalizedPhone, error: n8nError instanceof Error ? n8nError.message : "timeout" },
                            "error"
                        );
                    }
                }

                // Send reply via Vercel (using our existing WhatsApp token)
                const replyText = aiResponse || getFallbackResponse(content, candidate, profile);
                if (replyText) {
                    await sendWhatsAppText(normalizedPhone, replyText, candidate?.profile_id);
                    // Log GPT response for quality review
                    await logServerActivity(
                        candidate?.profile_id || "anonymous",
                        aiResponse ? "whatsapp_gpt_response" : "whatsapp_fallback_response",
                        "documents",
                        {
                            phone: normalizedPhone,
                            user_message: content.substring(0, 200),
                            bot_response: replyText.substring(0, 500),
                            response_type: aiResponse ? "gpt" : "fallback",
                        }
                    );
                }
            }
        }

        // Always return 200 to acknowledge (Meta retries on non-200)
        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("[WhatsApp Webhook] Error:", error);
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
        return `Hi ${name}! Type "status" to check your application, or visit workersunited.eu for full details. For complex questions, email contact@workersunited.eu`;
    }

    return `Hi ${name}! I'm the Workers United assistant. Our AI chatbot is temporarily offline — please try again shortly or email contact@workersunited.eu`;
}

