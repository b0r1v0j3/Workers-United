import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { saveBrainFactsDedup } from "@/lib/brain-memory";
import crypto from "crypto";

// ─── Meta Cloud API Webhook ─────────────────────────────────────────────────
// Handles:
// 1. GET  — Webhook verification (hub.challenge)
// 2. POST — Inbound messages + delivery status updates → GPT-4o-mini AI
//
// Architecture: User → WhatsApp → Meta → Vercel → GPT-4o-mini → Vercel → WhatsApp
// All AI processing happens directly via OpenAI API (no middleware).

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || process.env.CRON_SECRET || "";
const APP_SECRET = process.env.META_APP_SECRET || "";
const CONVERSATION_HISTORY_LIMIT = 100; // Number of past messages to send for context
const ADMIN_PHONES = (process.env.OWNER_PHONES || process.env.OWNER_PHONE || "+38166299444")
    .split(",")
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);

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
                                await sendWhatsAppText(normalizedPhone, `✅ Ispravljeno!\n\nStaro: ${matches[0].content}\nNovo: ${newFact}\n\nConfidence: 1.0 (admin verified)`, candidate?.profile_id);
                            } else {
                                // No match found, add as new fact
                                await saveBrainFactsDedup(adminClient, [
                                    { category: "faq", content: newFact, confidence: 1.0 },
                                ]);
                                await sendWhatsAppText(normalizedPhone, `✅ Nisam našao staru činjenicu, dodao novu:\n${newFact}`, candidate?.profile_id);
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
                        await sendWhatsAppText(normalizedPhone, `🧠 Zapamćeno!\n[${category}] ${fact}\nConfidence: 1.0`, candidate?.profile_id);
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
                            await sendWhatsAppText(normalizedPhone, `🗑️ Obrisano:\n[${matches[0].category}] ${matches[0].content}`, candidate?.profile_id);
                        } else {
                            await sendWhatsAppText(normalizedPhone, `❌ Nisam našao činjenicu sa: "${search}"`, candidate?.profile_id);
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
                            candidate?.profile_id
                        );
                        return NextResponse.json({ status: "ok" });
                    }
                }

                // ─── Direct OpenAI AI Brain ──────────────────────────────
                let aiResponse: string | null = null;
                const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

                if (OPENAI_API_KEY) {
                    try {
                        // 1. Fetch conversation history (last 10 messages)
                        const historyMessages = await (async () => {
                            try {
                                const { data } = await supabase
                                    .from("whatsapp_messages")
                                    .select("direction, content, created_at")
                                    .eq("phone_number", normalizedPhone)
                                    .order("created_at", { ascending: false })
                                    .limit(CONVERSATION_HISTORY_LIMIT);
                                return (data || []).reverse();
                            } catch { return []; }
                        })();

                        const conversationHistoryText = historyMessages.length > 0
                            ? historyMessages.map(m => `${m.direction === "inbound" ? "User" : "You"}: ${m.content}`).join("\n")
                            : "(No previous messages — this is a new conversation)";

                        // 2. Fetch brain memory (learned facts)
                        const brainMemory = await (async () => {
                            try {
                                const { data } = await supabase
                                    .from("brain_memory")
                                    .select("category, content, confidence")
                                    .order("confidence", { ascending: false })
                                    .limit(20);
                                return data || [];
                            } catch { return []; }
                        })();

                        const brainMemoryText = brainMemory.length > 0
                            ? brainMemory.map(m => `- [${m.category}] ${m.content} (confidence: ${m.confidence})`).join("\n")
                            : "(No learned facts yet)";

                        // 3. Fetch business facts (formatted for AI)
                        const businessFacts = await (async () => {
                            try {
                                const { getBusinessFactsForAI } = await import("@/lib/platform-config");
                                return await getBusinessFactsForAI();
                            } catch { return ""; }
                        })();

                        const userName = profile?.full_name?.split(" ")[0] || "there";

                        // 4. Build system prompt with ALL context
                        const systemPrompt = `You are the official WhatsApp AI assistant for Workers United — a legal international hiring and visa support company that helps workers find jobs across Europe.

BUSINESS FACTS (verified, use these for accurate answers):
${businessFacts || "No config available"}
- Industries we cover: Construction, Manufacturing, Agriculture, Hospitality, Transportation, Retail, Food Processing, Warehousing & Logistics, Cleaning Services, Driving
- We offer jobs across Europe — we do NOT specify individual countries. When a worker pays and joins, we find them the best available position wherever it may be.
- Support email: contact@workersunited.eu (ALWAYS mention this when asked about support/contact)

YOUR PERSONALITY:
- Professional but warm and friendly
- Always helpful and encouraging  
- Keep responses concise (max 2-3 short paragraphs)
- Use emojis occasionally to be friendly

CRITICAL LANGUAGE RULES (NEVER violate):
- You MUST be able to communicate fluently in ANY language.
- Initially, you can assume the language based on the user's country code (e.g., +381 is Serbian, +49 is German, +91 is English/Hindi, etc.).
- HOWEVER, you MUST ALWAYS detect the language the user is ACTUALLY writing in.
- If the user writes to you in a specific language, you MUST immediately switch to and reply in that EXACT same language, regardless of their country code.
- NEVER force a language on the user that they are not using. Reply in the language they initiate or switch to.

DETERMINISTIC FAQ (for these questions, use EXACT answers — do NOT generate):
- Price/cost/fee/cena/cijena → "Entry fee is $9. If we don't find you a job within 90 days, you get a full refund."
- Documents/dokumenti/pasoš → "You need: passport, diploma or work certificate, and a biometric photo. Upload them at workersunited.eu/profile/worker"
- Contact/support/kontakt/podrška → "Email us at contact@workersunited.eu or message us here on WhatsApp anytime."
- Time/processing/koliko traje → "Typical processing time is 2-8 weeks depending on the country and visa requirements."
- Refund/povrat/garancija → "Full refund within 90 days if we don't find you a suitable position."
- Country/countries/država/zemlje/koja zemlja/which country → "We offer jobs across Europe! Sign up at workersunited.eu/signup and pay the $9 entry fee to start your job search. Once you're in our system, we match you with the best available positions. Full refund if we don't find you a job within 90 days."

USER INFO:
- Phone: ${normalizedPhone}
- Name: ${userName}
- Registered: ${candidate ? "Yes" : "No"}
- IS ADMIN: ${isAdmin ? "YES — this is the platform owner/boss. If he corrects you or says something is wrong, ALWAYS accept it. Generate a [LEARN: ...] tag with the corrected info. Treat everything he says as authoritative truth. Talk to him casually and in Serbian." : "No"}
${candidate ? `- Status: ${candidate.status}\n- Email: ${profile?.email || "N/A"}\n- Registered at: ${profile?.created_at || "N/A"}` : "- Not yet registered on the platform"}

CONVERSATION HISTORY (previous messages):
${conversationHistoryText}

BRAIN MEMORY (facts learned from past conversations):
${brainMemoryText}

RULES:
1. Use conversation history — do NOT repeat yourself or ask questions already answered
2. If you don't know something, say so honestly and suggest contacting support at contact@workersunited.eu
3. Never make up prices, timelines, or legal info
4. If user is not registered, gently encourage them to visit workersunited.eu/signup
5. NEVER say "we don't have email support" — we DO have email at contact@workersunited.eu
6. NEVER start your response with "=" or any non-letter character
7. NEVER list specific European countries (like Germany, Austria, Czech Republic). Always say "jobs across Europe" and redirect to signup/payment. We find them a job wherever the best match is.
8. When users ask about countries or specific jobs, ALWAYS guide them to sign up and pay $9 — that's how they get started. Don't get into country-by-country details.

LEARNING RULES:
When you discover a genuinely new and useful fact, add at the END of your response:
[LEARN: category | fact]
Categories: pricing, process, documents, eligibility, faq, company_info, legal
Only learn VERIFIED info. Do NOT learn from greetings/small talk. Tags are auto-removed before the user sees your message.`;

                        // 5. Call OpenAI directly
                        const { default: OpenAI } = await import("openai");
                        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

                        const completion = await openai.chat.completions.create({
                            model: "gpt-4o-mini",
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: content },
                            ],
                            max_tokens: 500,
                            temperature: 0.7,
                        });

                        aiResponse = completion.choices[0]?.message?.content || null;
                        console.log("[WhatsApp] 🧠 GPT-4o-mini response:", aiResponse?.substring(0, 200));

                    } catch (aiError) {
                        console.error("[WhatsApp] OpenAI error:", aiError);
                        await logServerActivity(
                            candidate?.profile_id || "anonymous",
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
                    if (learnings.length > 0) {
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
                const replyText = cleanResponse || await getFallbackResponse(content, candidate, profile);
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

// ─── Fallback Bot (used when OpenAI is unavailable) ──────────────────────────
// Reads business facts from platform_config DB table (cached 5 min)

async function getFallbackResponse(message: string, candidate: any, profile: any): Promise<string> {
    const msg = message.toLowerCase().trim();
    const name = profile?.full_name?.split(" ")[0] || "there";

    // Read from centralized config (cached 5 min, fallback to defaults if DB down)
    const { getPlatformConfig } = await import("@/lib/platform-config");
    const config = await getPlatformConfig();

    const ENTRY_FEE = config.entry_fee || "$9";
    const REFUND_POLICY = config.refund_policy_en || "90-day guarantee";
    const REFUND_POLICY_SR = config.refund_policy_sr || "90-dnevna garancija";
    const WEBSITE = config.website_url || "workersunited.eu";
    const GREETING_EN = config.bot_greeting_en || "Welcome to Workers United! 🌍 We help workers find jobs in Europe and handle all visa paperwork.";
    const GREETING_SR = config.bot_greeting_sr || "Dobrodošli u Workers United! 🌍 Pomažemo radnicima da nađu posao u Evropi.";

    if (!candidate) {
        // Detect language
        const isSerboCroatian = /[čćžšđ]/.test(message) || /zdravo|pozdrav|pomoć|posao|rad|plata/.test(msg);
        if (isSerboCroatian) {
            return `${GREETING_SR} Registracija: ${ENTRY_FEE}. ${REFUND_POLICY_SR} Registrujte se na ${WEBSITE}/signup`;
        }
        return `${GREETING_EN} Entry fee: ${ENTRY_FEE}. ${REFUND_POLICY} Register at ${WEBSITE}/signup to get started!`;
    }

    if (msg.includes("status") || msg.includes("profile") || msg.includes("stanje") || msg.includes("profil")) {
        const statusInfo = candidate.status === "REGISTERED" ? "registered ✅" : candidate.status;
        const queueInfo = candidate.queue_position ? ` Queue position: #${candidate.queue_position}.` : "";
        return `Hi ${name}! Status: ${statusInfo}.${queueInfo} Visit ${WEBSITE}/profile/worker for full details.`;
    }

    if (msg.includes("price") || msg.includes("cost") || msg.includes("fee") || msg.includes("cena") || msg.includes("cijena") || msg.includes("koliko")) {
        return `Hi ${name}! The entry fee is ${ENTRY_FEE}. ${REFUND_POLICY} This covers registration and job matching. Visit ${WEBSITE} for details.`;
    }

    if (msg.includes("help") || msg.includes("pomoc") || msg.includes("pomoć")) {
        return `Hi ${name}! I can help with:\n• "status" — check your application\n• "price" — see fees\n• Or visit ${WEBSITE}\n\nFor complex questions: ${config.contact_email || "contact@workersunited.eu"}`;
    }

    if (msg.includes("document") || msg.includes("passport") || msg.includes("dokument") || msg.includes("pasos")) {
        return `Hi ${name}! Upload documents at ${WEBSITE}/profile/worker. We need: ${config.supported_documents || "passport, diploma, and biometric photo"}. Our AI verifies them automatically!`;
    }

    // Better catch-all: don't say "processing" (causes loop). Give concrete help instead.
    const isSerboCroatian = /[čćžšđ]/.test(message) || /zdravo|pozdrav|pomoć|posao|rad|plata/.test(msg);
    if (isSerboCroatian) {
        return `Zdravo ${name}! 👋 Kako vam mogu pomoći?\n\n• Pišite "cena" za informacije o troškovima\n• Pišite "dokumenti" za potrebne dokumente\n• Pišite "status" za stanje vaše prijave\n\nIli nas kontaktirajte na ${config.contact_email || "contact@workersunited.eu"}`;
    }
    return `Hi ${name}! 👋 How can I help you?\n\n• Type "price" for fee information\n• Type "documents" for required documents\n• Type "status" to check your application\n\nOr contact us at ${config.contact_email || "contact@workersunited.eu"}`;
}

