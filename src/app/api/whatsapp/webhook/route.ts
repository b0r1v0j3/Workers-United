import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { saveBrainFactsDedup } from "@/lib/brain-memory";
import { loadCanonicalWorkerRecord, pickCanonicalWorkerRecord } from "@/lib/workers";
import crypto from "crypto";

// ─── Meta Cloud API Webhook ─────────────────────────────────────────────────
// Handles:
// 1. GET  — Webhook verification (hub.challenge)
// 2. POST — Inbound messages + delivery status updates → intent router + GPT-5 mini AI
//
// Architecture: User → WhatsApp → Meta → Vercel → intent router → GPT-5 mini → Vercel → WhatsApp
// All AI processing happens directly via OpenAI API (no middleware).

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || process.env.CRON_SECRET || "";
const APP_SECRET = process.env.META_APP_SECRET || "";
const ROUTER_HISTORY_LIMIT = 8;
const RESPONSE_HISTORY_LIMIT = 12;
const BRAIN_MEMORY_LIMIT = 8;
const WHATSAPP_ROUTER_MODEL = process.env.WHATSAPP_ROUTER_MODEL || "gpt-5-mini";
const WHATSAPP_RESPONSE_MODEL = process.env.WHATSAPP_RESPONSE_MODEL || "gpt-5-mini";
const ADMIN_PHONES = (process.env.OWNER_PHONES || process.env.OWNER_PHONE || "+38166299444")
    .split(",")
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);

type WhatsAppIntent =
    | "job_intent"
    | "price"
    | "documents"
    | "support"
    | "status"
    | "general"
    | "off_topic";

interface WhatsAppRouterDecision {
    intent: WhatsAppIntent;
    language: string;
    confidence: "high" | "medium" | "low";
    reason: string;
}

interface WhatsAppWorkerRecord {
    id: string;
    profile_id: string | null;
    status: string | null;
    queue_position: number | null;
    preferred_job: string | null;
    desired_countries: string[] | null;
    refund_deadline: string | null;
    refund_eligible: boolean | null;
    entry_fee_paid: boolean | null;
    admin_approved: boolean | null;
    queue_joined_at: string | null;
    nationality: string | null;
    current_country: string | null;
    gender: string | null;
    experience_years: number | null;
    updated_at: string | null;
    phone: string | null;
    marital_status: string | null;
}

function normalizePhone(rawPhone: string): string {
    const digits = rawPhone.replace(/\D/g, "");
    return digits ? `+${digits}` : "";
}

// ─── Meta signature verification ─────────────────────────────────────────────
function verifyMetaSignature(rawBody: string, signature: string | null): boolean {
    if (!APP_SECRET) {
        console.warn("[Webhook] META_APP_SECRET not set — skipping signature verification");
        return true; // Allow in dev, but log warning
    }
    if (!signature || !signature.startsWith("sha256=")) return false;

    const expectedSig = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
    const provided = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedSig, "utf8");

    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(provided, expected);
}

// ─── GET: Webhook Verification ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
    if (!VERIFY_TOKEN) {
        return NextResponse.json({ error: "Webhook verify token is not configured" }, { status: 500 });
    }

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
                const normalizedPhone = normalizePhone(phoneNumber);

                // ─── Fetch user profile (multi-layer phone lookup) ────────
                const workerRecordSelect = `
                    id, profile_id, status, queue_position, preferred_job, 
                    desired_countries, refund_deadline, refund_eligible,
                    entry_fee_paid, admin_approved, queue_joined_at,
                    nationality, current_country, gender, experience_years,
                    updated_at,
                    phone, marital_status
                `;

                // Layer 1: Direct phone match in worker onboarding
                const { data: matchedWorkers } = await supabase
                    .from("worker_onboarding")
                    .select(workerRecordSelect)
                    .or(`phone.eq.${normalizedPhone},phone.eq.${phoneNumber}`)
                    .order("updated_at", { ascending: false })
                    .limit(25);
                let workerRecord = pickCanonicalWorkerRecord<WhatsAppWorkerRecord>(
                    (matchedWorkers || []) as WhatsAppWorkerRecord[]
                );

                // Layer 2: If not found, search auth users by phone in metadata
                // (covers Google OAuth users who have phone in user_metadata but not in worker_onboarding yet)
                if (!workerRecord) {
                    const phoneDigits = phoneNumber.replace(/\D/g, "");
                    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
                    const matchedUser = authData?.users?.find(u => {
                        const metaPhone = (u.user_metadata?.phone || "").replace(/\D/g, "");
                        const userPhone = (u.phone || "").replace(/\D/g, "");
                        return (metaPhone && metaPhone === phoneDigits) ||
                            (userPhone && userPhone === phoneDigits);
                    });

                    if (matchedUser) {
                        // Found auth user — look up their worker record by profile_id
                        const { data: linkedWorkerRecord } = await loadCanonicalWorkerRecord<WhatsAppWorkerRecord>(
                            supabase,
                            matchedUser.id,
                            workerRecordSelect
                        );

                        if (linkedWorkerRecord) {
                            workerRecord = linkedWorkerRecord;
                            // Backfill phone in the worker onboarding table so future lookups are instant
                            await supabase
                                .from("worker_onboarding")
                                .update({ phone: normalizedPhone })
                                .eq("id", linkedWorkerRecord.id);
                        }
                    }
                }

                const { data: profile } = workerRecord?.profile_id
                    ? await supabase
                        .from("profiles")
                        .select("full_name, email, user_type, created_at")
                        .eq("id", workerRecord.profile_id)
                        .single()
                    : { data: null };

                // ─── Log inbound message ────────────────────────────────
                await supabase.from("whatsapp_messages").insert({
                    user_id: workerRecord?.profile_id || null,
                    phone_number: normalizedPhone,
                    direction: "inbound",
                    message_type: messageType,
                    content,
                    wamid,
                    status: "delivered",
                });

                // Log to activity tracking
                await logServerActivity(
                    workerRecord?.profile_id || "anonymous",
                    "whatsapp_message_received",
                    "documents",
                    { phone: normalizedPhone, message_type: messageType, content_preview: content.substring(0, 100), is_registered: !!workerRecord }
                );
                // ─── Admin Phone Detection ────────────────────────────────
                const isAdmin = ADMIN_PHONES.includes(normalizedPhone);

                // ─── Admin Commands (direct brain control via WhatsApp) ───
                if (isAdmin) {
                    const adminClient = createAdminClient();
                    const trimContent = content.trim();

                    // Admin correction: "ispravi: old fact -> new fact"
                    if (trimContent.toLowerCase().startsWith("ispravi:")) {
                        const correction = trimContent.substring(8).trim();
                        const parts = correction.split("->");
                        if (parts.length === 2) {
                            const oldFact = parts[0].trim();
                            const newFact = parts[1].trim();
                            // Find and update matching memory
                            const { data: matches } = await adminClient.from("brain_memory")
                                .select("id, content")
                                .ilike("content", `%${oldFact}%`)
                                .limit(5);

                            if (matches && matches.length > 0) {
                                await adminClient.from("brain_memory")
                                    .update({ content: newFact, confidence: 1.0 })
                                    .eq("id", matches[0].id);
                                await sendWhatsAppText(normalizedPhone, `✅ Ispravljeno!\n\nStaro: ${matches[0].content}\nNovo: ${newFact}\n\nConfidence: 1.0 (admin verified)`, workerRecord?.profile_id || undefined);
                            } else {
                                // No match found, add as new fact
                                await saveBrainFactsDedup(adminClient, [
                                    { category: "faq", content: newFact, confidence: 1.0 },
                                ]);
                                await sendWhatsAppText(normalizedPhone, `✅ Nisam našao staru činjenicu, dodao novu:\n${newFact}`, workerRecord?.profile_id || undefined);
                            }
                            return NextResponse.json({ status: "ok" });
                        }
                    }

                    // Admin add: "zapamti: category | fact"
                    if (trimContent.toLowerCase().startsWith("zapamti:")) {
                        const factStr = trimContent.substring(8).trim();
                        const pipeParts = factStr.split("|");
                        const category = pipeParts.length > 1 ? pipeParts[0].trim() : "faq";
                        const fact = pipeParts.length > 1 ? pipeParts.slice(1).join("|").trim() : factStr;
                        await saveBrainFactsDedup(adminClient, [
                            { category, content: fact, confidence: 1.0 },
                        ]);
                        await sendWhatsAppText(normalizedPhone, `🧠 Zapamćeno!\n[${category}] ${fact}\nConfidence: 1.0`, workerRecord?.profile_id || undefined);
                        return NextResponse.json({ status: "ok" });
                    }

                    // Admin delete: "obrisi: fact text"
                    if (trimContent.toLowerCase().startsWith("obrisi:") || trimContent.toLowerCase().startsWith("obriši:")) {
                        const search = trimContent.substring(trimContent.indexOf(":") + 1).trim();
                        const { data: matches } = await adminClient.from("brain_memory")
                            .select("id, content, category")
                            .ilike("content", `%${search}%`)
                            .limit(5);

                        if (matches && matches.length > 0) {
                            await adminClient.from("brain_memory").delete().eq("id", matches[0].id);
                            await sendWhatsAppText(normalizedPhone, `🗑️ Obrisano:\n[${matches[0].category}] ${matches[0].content}`, workerRecord?.profile_id || undefined);
                        } else {
                            await sendWhatsAppText(normalizedPhone, `❌ Nisam našao činjenicu sa: "${search}"`, workerRecord?.profile_id || undefined);
                        }
                        return NextResponse.json({ status: "ok" });
                    }

                    // Admin list: "memorija" — show all brain memory
                    if (trimContent.toLowerCase() === "memorija" || trimContent.toLowerCase() === "memory") {
                        const { data: allMemory } = await adminClient.from("brain_memory")
                            .select("category, content, confidence")
                            .order("confidence", { ascending: false });
                        const list = (allMemory || []).map((m, i) =>
                            `${i + 1}. [${m.category}] ${m.content} (${m.confidence})`
                        ).join("\n");
                        await sendWhatsAppText(normalizedPhone,
                            `🧠 Brain Memory (${(allMemory || []).length} facts):\n\n${list || "(prazno)"}`,
                            workerRecord?.profile_id || undefined
                        );
                        return NextResponse.json({ status: "ok" });
                    }
                }

                // ─── Intent-routed OpenAI AI Brain ───────────────────────
                let aiResponse: string | null = null;
                const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

                if (OPENAI_API_KEY) {
                    try {
                        const [historyMessages, brainMemory, businessFacts] = await Promise.all([
                            loadConversationHistory(supabase, normalizedPhone, RESPONSE_HISTORY_LIMIT),
                            loadBrainMemory(supabase),
                            (async () => {
                                try {
                                    const { getBusinessFactsForAI } = await import("@/lib/platform-config");
                                    return await getBusinessFactsForAI();
                                } catch {
                                    return "";
                                }
                            })(),
                        ]);

                        const routerDecision = await classifyWhatsAppIntent({
                            apiKey: OPENAI_API_KEY,
                            message: content,
                            normalizedPhone,
                            workerRecord,
                            profile,
                            historyMessages,
                        });

                        await logServerActivity(
                            workerRecord?.profile_id || "anonymous",
                            "whatsapp_router_decision",
                            "documents",
                            {
                                phone: normalizedPhone,
                                intent: routerDecision.intent,
                                language: routerDecision.language,
                                confidence: routerDecision.confidence,
                                reason: routerDecision.reason,
                                model: WHATSAPP_ROUTER_MODEL,
                            }
                        );

                        aiResponse = await generateWhatsAppReply({
                            apiKey: OPENAI_API_KEY,
                            message: content,
                            normalizedPhone,
                            workerRecord,
                            profile,
                            isAdmin,
                            businessFacts,
                            brainMemory,
                            historyMessages,
                            routerDecision,
                        });

                        console.log(
                            `[WhatsApp] 🧠 ${WHATSAPP_RESPONSE_MODEL} (${routerDecision.intent}) response:`,
                            aiResponse?.substring(0, 200)
                        );
                    } catch (aiError) {
                        console.error("[WhatsApp] OpenAI error:", aiError);
                        await logServerActivity(
                            workerRecord?.profile_id || "anonymous",
                            "whatsapp_openai_failed",
                            "error",
                            { phone: normalizedPhone, error: aiError instanceof Error ? aiError.message : "unknown" },
                            "error"
                        );
                    }
                }

                // ─── AI Learning Loop ─────────────────────────────────────
                // GPT tags new learnings as [LEARN: category | fact]
                // We parse them, save to brain_memory, and strip from reply
                let cleanResponse = aiResponse;
                if (aiResponse) {
                    const learnRegex = /\[LEARN:\s*([^|]+?)\s*\|\s*(.+?)\s*\]/g;
                    const learnings: { category: string; content: string }[] = [];
                    let match;
                    while ((match = learnRegex.exec(aiResponse)) !== null) {
                        learnings.push({ category: match[1].trim(), content: match[2].trim() });
                    }
                    // Strip [LEARN: ...] tags from the message sent to WhatsApp
                    cleanResponse = aiResponse.replace(learnRegex, "").replace(/\n{3,}/g, "\n\n").trim();

                    // Save learnings to brain_memory in Supabase
                    if (learnings.length > 0 && isAdmin) {
                        try {
                            const admin = createAdminClient();
                            const learningSaveStats = await saveBrainFactsDedup(
                                admin,
                                learnings.map((learning) => ({
                                    category: learning.category,
                                    content: learning.content,
                                    confidence: 0.8,
                                }))
                            );
                            console.log(
                                `[WhatsApp] 🧠 Learning save stats — inserted: ${learningSaveStats.inserted}, updated: ${learningSaveStats.updated}, skipped: ${learningSaveStats.skipped}`
                            );
                        } catch (learnError) {
                            console.error("[WhatsApp] Failed to save learnings:", learnError);
                        }
                    }
                }

                // Send reply via Vercel (using our existing WhatsApp token)
                const replyText = cleanResponse || await getFallbackResponse(content, workerRecord, profile);
                if (replyText) {
                    await sendWhatsAppText(normalizedPhone, replyText, workerRecord?.profile_id || undefined);
                    // Log GPT response for quality review
                    await logServerActivity(
                        workerRecord?.profile_id || "anonymous",
                        aiResponse ? "whatsapp_gpt_response" : "whatsapp_fallback_response",
                        "documents",
                        {
                            phone: normalizedPhone,
                            user_message: content.substring(0, 200),
                            bot_response: replyText.substring(0, 500),
                            response_type: aiResponse ? "gpt" : "fallback",
                            model: aiResponse ? WHATSAPP_RESPONSE_MODEL : "fallback",
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

function formatHistory(
    historyMessages: Array<{ direction: string; content: string | null; created_at?: string | null }>,
    limit: number
): string {
    const trimmed = historyMessages.slice(-limit);
    if (trimmed.length === 0) {
        return "(No recent history)";
    }

    return trimmed
        .map((message) => `${message.direction === "inbound" ? "User" : "Assistant"}: ${(message.content || "").trim()}`)
        .join("\n");
}

function buildWorkerSnapshot(workerRecord: any, profile: any): string {
    if (!workerRecord) {
        return "Registered: no\nWorker status: not registered yet";
    }

    return [
        "Registered: yes",
        `Worker status: ${workerRecord.status || "unknown"}`,
        `Entry fee paid: ${workerRecord.entry_fee_paid ? "yes" : "no"}`,
        `Admin approved: ${workerRecord.admin_approved ? "yes" : "no"}`,
        `Queue joined: ${workerRecord.queue_joined_at ? "yes" : "no"}`,
        `Preferred job: ${workerRecord.preferred_job || "not set"}`,
        `Nationality: ${workerRecord.nationality || "not set"}`,
        `Current country: ${workerRecord.current_country || "not set"}`,
        `Email: ${profile?.email || "not set"}`,
    ].join("\n");
}

async function loadConversationHistory(
    supabase: ReturnType<typeof createAdminClient>,
    normalizedPhone: string,
    limit: number
): Promise<Array<{ direction: string; content: string | null; created_at?: string | null }>> {
    try {
        const { data } = await supabase
            .from("whatsapp_messages")
            .select("direction, content, created_at")
            .eq("phone_number", normalizedPhone)
            .order("created_at", { ascending: false })
            .limit(limit);
        return (data || []).reverse();
    } catch {
        return [];
    }
}

async function loadBrainMemory(
    supabase: ReturnType<typeof createAdminClient>
): Promise<Array<{ category: string; content: string; confidence: number }>> {
    try {
        const { data } = await supabase
            .from("brain_memory")
            .select("category, content, confidence")
            .order("confidence", { ascending: false })
            .limit(BRAIN_MEMORY_LIMIT);
        return (data || []).map((entry) => ({
            category: entry.category,
            content: entry.content,
            confidence: entry.confidence ?? 0,
        }));
    } catch {
        return [];
    }
}

async function callOpenAIResponseText(
    apiKey: string,
    options: {
        model: string;
        instructions: string;
        input: string;
        json?: boolean;
        maxOutputTokens?: number;
    }
): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: options.model,
            instructions: options.instructions,
            input: options.input,
            ...(options.maxOutputTokens ? { max_output_tokens: options.maxOutputTokens } : {}),
            ...(options.json ? {
                text: {
                    format: { type: "json_object" },
                },
            } : {}),
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI responses failed: ${response.status} - ${errText.substring(0, 300)}`);
    }

    const data = await response.json();
    // GPT-5-mini returns reasoning block at output[0] and message at output[1]
    // We need to find the message block with actual text content
    const outputText = data.output_text
        || (() => {
            const outputs = data.output || [];
            for (const item of outputs) {
                if (item.type === "message" && item.content?.[0]?.text) {
                    return item.content[0].text;
                }
            }
            // Fallback: try first item with content
            for (const item of outputs) {
                if (item.content?.[0]?.text) {
                    return item.content[0].text;
                }
            }
            return "";
        })();
    return (outputText || "").trim();
}

async function classifyWhatsAppIntent({
    apiKey,
    message,
    normalizedPhone,
    workerRecord,
    profile,
    historyMessages,
}: {
    apiKey: string;
    message: string;
    normalizedPhone: string;
    workerRecord: any;
    profile: any;
    historyMessages: Array<{ direction: string; content: string | null; created_at?: string | null }>;
}): Promise<WhatsAppRouterDecision> {
    const instructions = `You classify inbound WhatsApp messages for Workers United.

Return JSON only:
{
  "intent": "job_intent|price|documents|support|status|general|off_topic",
  "language": "short language name in English",
  "confidence": "high|medium|low",
  "reason": "short explanation"
}

Intent rules:
- job_intent: wants a job, asks how to start, how to register, or expresses interest in working in Europe
- price: asks about cost, payment, fee, refund
- documents: asks about passport, diploma, photo, upload, verification
- support: asks for help with a Workers United problem, complaint, support channel, or human assistance related to the platform
- status: asks about profile, approval, payment status, queue, verification, offer status
- general: greeting or vague first contact that is still about Workers United
- off_topic: unrelated civic issue, wrong number, spam, local complaint, or anything not actually about Workers United jobs/visa support

Important:
- If the user is talking about a local utility issue, accident, flooding, municipality, or unrelated complaint, classify as off_topic.
- Detect the actual language from the latest user message, not the phone country code.
- Registered worker context matters for status/support classification.
- Keep reason short.`;

    const input = `Latest user message:
${message}

Phone: ${normalizedPhone}
Registered worker: ${workerRecord ? "yes" : "no"}
Worker snapshot:
${buildWorkerSnapshot(workerRecord, profile)}

Recent history:
${formatHistory(historyMessages, ROUTER_HISTORY_LIMIT)}`;

    try {
        const raw = await callOpenAIResponseText(apiKey, {
            model: WHATSAPP_ROUTER_MODEL,
            instructions,
            input,
            json: true,
            maxOutputTokens: 1024,
        });

        const parsed = JSON.parse(raw) as Partial<WhatsAppRouterDecision>;
        const intent: WhatsAppIntent = parsed.intent && [
            "job_intent",
            "price",
            "documents",
            "support",
            "status",
            "general",
            "off_topic",
        ].includes(parsed.intent) ? parsed.intent as WhatsAppIntent : "general";

        return {
            intent,
            language: parsed.language?.trim() || "English",
            confidence: parsed.confidence === "high" || parsed.confidence === "low" ? parsed.confidence : "medium",
            reason: parsed.reason?.trim() || "No reason returned",
        };
    } catch {
        return {
            intent: "general",
            language: message.match(/[\u0400-\u04FF\u0100-\u017Fčćžšđ]/i) ? "Serbian" : "English",
            confidence: "low",
            reason: "Router fallback",
        };
    }
}

async function generateWhatsAppReply({
    apiKey,
    message,
    normalizedPhone,
    workerRecord,
    profile,
    isAdmin,
    businessFacts,
    brainMemory,
    historyMessages,
    routerDecision,
}: {
    apiKey: string;
    message: string;
    normalizedPhone: string;
    workerRecord: any;
    profile: any;
    isAdmin: boolean;
    businessFacts: string;
    brainMemory: Array<{ category: string; content: string; confidence: number }>;
    historyMessages: Array<{ direction: string; content: string | null; created_at?: string | null }>;
    routerDecision: WhatsAppRouterDecision;
}): Promise<string> {
    const userName = profile?.full_name?.split(" ")[0] || "there";
    const workerSnapshot = buildWorkerSnapshot(workerRecord, profile);
    const memoryText = brainMemory.length > 0
        ? brainMemory.map((entry) => `- [${entry.category}] ${entry.content}`).join("\n")
        : "(No stored facts)";

    const instructions = `You are the official WhatsApp assistant for Workers United, a legal hiring and visa support company operating across Europe.

IMPORTANT: You MUST reply in ${routerDecision.language}. Always match the language of the user's message. If they write in Serbian, reply in Serbian. If they write in English, reply in English. Never switch to a different language.

Current routed intent: ${routerDecision.intent}
Router confidence: ${routerDecision.confidence}
Router reason: ${routerDecision.reason}

Business facts:
${businessFacts || "No business facts available"}
- We operate across entire Europe, connecting verified workers with verified employers.
- We handle the complete process: documentation verification, contract creation, visa support, embassy communication, airport pickup, and ongoing support (residence extensions, etc).
- Job Finder is the entry fee: $9 USD, includes a 90-day job match guarantee with full refund if no job is found.
- Required worker documents: passport, diploma or work certificate, and a biometric photo.
- Support email: contact@workersunited.eu.
- Do NOT suggest emailing support unless the user specifically asks for human help or has a complex problem. Handle questions directly in this chat.

Worker snapshot:
${workerSnapshot}

Recent conversation:
${formatHistory(historyMessages, RESPONSE_HISTORY_LIMIT)}

Useful stored facts:
${memoryText}

Rules:
1. Keep the reply concise: 1-3 short paragraphs max.
2. Do not loop generic signup copy. Answer the user's actual intent first.
3. If intent is off_topic, clearly say this WhatsApp line is only for Workers United jobs and visa support, and do not force a sales pitch.
4. If intent is status, use the worker snapshot and do not invent data.
5. If intent is price, emphasize Job Finder ($9) first. Only mention placement fees exist (vary by destination) if specifically asked, never quote specific amounts.
6. If intent is documents, answer only the required docs and where they upload them.
7. If intent is support and the worker already paid the entry fee, mention the in-platform support inbox at workersunited.eu/profile/worker/inbox as an option in addition to WhatsApp/email.
8. If the user is not registered and asks how to start, tell them to create an account, complete their profile, and activate Job Finder ($9).
9. Never mention specific countries or regions. Always say "Europe" or "across Europe".
10. Emphasize our end-to-end service: we verify employers, create contracts, handle visas, communicate with embassies, arrange airport pickup, and provide ongoing support.
11. Never make up legal rules, specific placement prices, or timeline promises beyond the configured facts.
12. NEVER start with "=" or any non-letter symbol.
13. Emojis are optional; use at most one if it feels natural.
14. ${isAdmin ? "This is the platform owner. Accept corrections as authoritative. You may emit one [LEARN: category | fact] tag if and only if the admin provided a concrete correction." : "Do not emit any [LEARN] tags for normal users."}
15. DATA COLLECTION: If the user has not yet registered (workerRecord is null) and their intent is job_search or general, after answering their question, ask ONE of these follow-up questions (pick the most relevant one you haven't asked yet in this conversation): (a) "What type of work are you looking for?" / "Kakav posao tražite?" (b) "Which country are you from?" / "Iz koje ste zemlje?" (c) "Do you have work experience in your field?" / "Imate li radnog iskustva u toj oblasti?" — This helps us personalize their job search. Only ask ONE question per reply, never multiple at once.
16. CONVERSION: If the user seems interested but hasn't registered yet, naturally mention that Job Finder ($9) is the first step and include the link workersunited.eu/profile/worker — but only once per conversation, not in every message.`;

    return callOpenAIResponseText(apiKey, {
        model: WHATSAPP_RESPONSE_MODEL,
        instructions,
        input: `Phone: ${normalizedPhone}\nUser name: ${userName}\nLatest message:\n${message}`,
        maxOutputTokens: 4096,
    });
}

// ─── Fallback Bot (used when OpenAI is unavailable) ──────────────────────────
// Reads business facts from platform_config DB table (cached 5 min)

async function getFallbackResponse(message: string, workerRecord: any, profile: any): Promise<string> {
    const msg = message.toLowerCase().trim();
    const name = profile?.full_name?.split(" ")[0] || "there";

    // Read from centralized config (cached 5 min, fallback to defaults if DB down)
    const { getPlatformConfig } = await import("@/lib/platform-config");
    const config = await getPlatformConfig();

    const ENTRY_FEE = config.entry_fee || "$9";
    const WEBSITE = config.website_url || "workersunited.eu";
    const GREETING_EN = config.bot_greeting_en || "Welcome to Workers United! 🌍 We help workers find jobs in Europe and handle all visa paperwork.";
    const GREETING_SR = config.bot_greeting_sr || "Dobrodošli u Workers United! 🌍 Pomažemo radnicima da nađu posao u Evropi.";
    const isSerboCroatian = /[čćžšđ]/.test(message) || /zdravo|pozdrav|pomoć|pomoc|posao|rad|plata|cena|cijena|koliko|dokumenti|pasos|pasoš|profil|status|registr/i.test(msg);
    const startMessageSr = `Registrujte se na ${WEBSITE}/signup, popunite profil i pokrenite Job Finder. Kada to završite, mi vam tražimo odgovarajući posao širom Evrope.`;
    const startMessageEn = `Create your account at ${WEBSITE}/signup, complete your profile, and activate Job Finder. Once that is done, we match you with the best available job across Europe.`;

    if (!workerRecord) {
        if (isSerboCroatian) {
            return `${GREETING_SR} ${startMessageSr}`;
        }
        return `${GREETING_EN} ${startMessageEn}`;
    }

    if (msg.includes("status") || msg.includes("profile") || msg.includes("stanje") || msg.includes("profil")) {
        const statusInfo = workerRecord.status === "REGISTERED" ? "registered ✅" : workerRecord.status;
        const queueInfo = workerRecord.queue_position ? ` Queue position: #${workerRecord.queue_position}.` : "";
        if (isSerboCroatian) {
            return `Zdravo ${name}! Vaš status je: ${statusInfo}.${queueInfo} Detalje možete videti na ${WEBSITE}/profile/worker.`;
        }
        return `Hi ${name}! Your status is: ${statusInfo}.${queueInfo} You can see full details at ${WEBSITE}/profile/worker.`;
    }

    if (msg.includes("price") || msg.includes("cost") || msg.includes("fee") || msg.includes("payment") || msg.includes("cena") || msg.includes("cijena") || msg.includes("koliko")) {
        if (isSerboCroatian) {
            return `Zdravo ${name}! Job Finder košta ${ENTRY_FEE}. Ako vam ne pronađemo posao u roku od 90 dana, novac vam se vraća.`;
        }
        return `Hi ${name}! Job Finder costs ${ENTRY_FEE}. If we don't find you a job within 90 days, you get a full refund.`;
    }

    if (msg.includes("help") || msg.includes("pomoc") || msg.includes("pomoć")) {
        if (isSerboCroatian) {
            return `Zdravo ${name}! Mogu pomoći oko registracije, profila, Job Finder-a, statusa prijave i dokumenata. Ako želite da krenete: ${startMessageSr}`;
        }
        return `Hi ${name}! I can help with registration, your profile, Job Finder, application status, and documents. If you'd like to get started: ${startMessageEn}`;
    }

    if (msg.includes("document") || msg.includes("passport") || msg.includes("dokument") || msg.includes("pasos")) {
        if (isSerboCroatian) {
            return `Zdravo ${name}! Dokumenta možete dodati na ${WEBSITE}/profile/worker. Potrebni su: ${config.supported_documents || "pasoš, diploma ili potvrda o radu, i biometrijska fotografija"}.`;
        }
        return `Hi ${name}! You can upload documents at ${WEBSITE}/profile/worker. We need: ${config.supported_documents || "passport, diploma or work certificate, and a biometric photo"}.`;
    }

    // Better catch-all: don't say "processing" (causes loop). Give concrete help instead.
    if (isSerboCroatian) {
        return `Zdravo ${name}! 👋 ${startMessageSr} Ako želite dodatne informacije, pišite nam ovde ili na ${config.contact_email || "contact@workersunited.eu"}.`;
    }
    return `Hi ${name}! 👋 ${startMessageEn} If you want more details, message us here or contact ${config.contact_email || "contact@workersunited.eu"}.`;
}

