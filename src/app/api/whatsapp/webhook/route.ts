import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { saveBrainFactsDedup } from "@/lib/brain-memory";
import {
    buildCanonicalWhatsAppFacts,
    buildEmployerWhatsAppRules,
    buildWorkerWhatsAppRules,
    shouldStartWhatsAppOnboarding,
} from "@/lib/whatsapp-brain";
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
const TEXT_LIKE_MESSAGE_TYPES = new Set(["text", "button", "interactive"]);
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
    | "off_topic"
    | "employer_inquiry"
    | "employer_hiring"
    | "employer_support";

// European country codes (Serbia + EU/EEA/Balkans)
const EUROPEAN_COUNTRY_CODES = [
    "381", // Serbia
    "43",  // Austria
    "32",  // Belgium
    "359", // Bulgaria
    "385", // Croatia
    "357", // Cyprus
    "420", // Czech Republic
    "45",  // Denmark
    "372", // Estonia
    "358", // Finland
    "33",  // France
    "49",  // Germany
    "30",  // Greece
    "36",  // Hungary
    "353", // Ireland
    "39",  // Italy
    "371", // Latvia
    "370", // Lithuania
    "352", // Luxembourg
    "356", // Malta
    "31",  // Netherlands
    "47",  // Norway
    "48",  // Poland
    "351", // Portugal
    "40",  // Romania
    "421", // Slovakia
    "386", // Slovenia
    "34",  // Spain
    "46",  // Sweden
    "41",  // Switzerland
    "44",  // UK
    "387", // Bosnia
    "382", // Montenegro
    "389", // North Macedonia
    "355", // Albania
];

function isEuropeanPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, "");
    return EUROPEAN_COUNTRY_CODES.some(code => digits.startsWith(code));
}

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

function isTextLikeMessageType(messageType: string): boolean {
    return TEXT_LIKE_MESSAGE_TYPES.has(messageType);
}

function isWorkerPaymentUnlocked(workerRecord: WhatsAppWorkerRecord | null | undefined): boolean {
    return Boolean(
        workerRecord
        && !workerRecord.entry_fee_paid
        && workerRecord.admin_approved
        && workerRecord.status === "APPROVED"
    );
}

function buildWorkerPaymentSnapshot(workerRecord: WhatsAppWorkerRecord | null | undefined): string {
    if (!workerRecord) {
        return "Job Finder payment unlocked: no (registration and profile completion come first)";
    }

    if (workerRecord.entry_fee_paid) {
        return "Job Finder payment unlocked: already paid";
    }

    if (isWorkerPaymentUnlocked(workerRecord)) {
        return "Job Finder payment unlocked: yes (worker is approved and may start checkout from the dashboard)";
    }

    if (!workerRecord.admin_approved) {
        return "Job Finder payment unlocked: no (worker must finish the profile/doc requirements and pass admin review first)";
    }

    return "Job Finder payment unlocked: no (worker should use the dashboard rather than a direct payment link)";
}

function getMediaAttachmentResponse(language: string): string {
    const normalizedLanguage = language.toLowerCase();
    if (normalizedLanguage.startsWith("sr")) {
        return "Hvala — vidim da ste poslali prilog. WhatsApp slike i dokumenti se trenutno ne vezuju automatski za profil, zato dokumenta i screenshot-ove pošaljite kroz dashboard ili na contact@workersunited.eu, uz kratko objašnjenje problema.";
    }
    if (normalizedLanguage.startsWith("ar")) {
        return "شكرًا — استلمت المرفق. صور ووثائق WhatsApp لا ترتبط بملفك تلقائيًا حاليًا، لذلك ارفع المستندات من لوحة التحكم أو أرسل لقطات الشاشة إلى contact@workersunited.eu مع وصف قصير للمشكلة.";
    }
    if (normalizedLanguage.startsWith("fr")) {
        return "Merci — j’ai bien reçu la pièce jointe. Les images et documents WhatsApp ne sont pas encore reliés automatiquement à votre profil, donc veuillez téléverser les documents dans le tableau de bord ou envoyer les captures à contact@workersunited.eu avec une courte description du problème.";
    }
    if (normalizedLanguage.startsWith("pt")) {
        return "Obrigado — recebi o anexo. Imagens e documentos enviados pelo WhatsApp ainda não são vinculados automaticamente ao seu perfil, então envie os documentos pelo painel ou mande as capturas para contact@workersunited.eu com uma breve descrição do problema.";
    }
    if (normalizedLanguage.startsWith("hi")) {
        return "धन्यवाद — मुझे आपका अटैचमेंट मिला। WhatsApp पर भेजी गई तस्वीरें और दस्तावेज़ अभी अपने-आप आपके प्रोफ़ाइल से नहीं जुड़ते, इसलिए दस्तावेज़ डैशबोर्ड में अपलोड करें या screenshot/contact details के साथ contact@workersunited.eu पर भेजें।";
    }

    return "Thanks — I received the attachment. WhatsApp images and documents are not linked to your Workers United profile automatically yet, so please upload documents in the dashboard or email screenshots to contact@workersunited.eu with a short description of the issue.";
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
        const attachmentReplySent = new Set<string>();

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

                // ─── Deduplication: skip if this wamid was already processed ──
                const { data: existingMsg } = await supabase
                    .from("whatsapp_messages")
                    .select("id")
                    .eq("wamid", wamid)
                    .eq("direction", "inbound")
                    .maybeSingle();
                if (existingMsg) {
                    console.log(`[Webhook] Duplicate wamid ${wamid} — skipping`);
                    continue;
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

                // ─── Employer Detection ───────────────────────────────────
                // European phones that are NOT registered workers → potential employers
                const isEuropean = isEuropeanPhone(normalizedPhone);
                const isRegisteredWorker = !!workerRecord;

                // Check if this phone is a registered employer in DB
                const { data: employerRecord } = await supabase
                    .from("employers")
                    .select("id, company_name, contact_name, status")
                    .or(`phone.eq.${normalizedPhone},contact_phone.eq.${normalizedPhone}`)
                    .maybeSingle();
                const isLikelyEmployer = isEuropean && !isRegisteredWorker && !isAdmin;
                const isEmployer = !!employerRecord || isLikelyEmployer;

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

                // ─── WhatsApp Onboarding Flow (before GPT) ───────────────
                // Detect language from router or simple heuristic
                const quickLang = /[\u0900-\u097F]/.test(content) ? "hi"
                    : /[\u0600-\u06FF]/.test(content) ? "ar"
                    : /[čćžšđ]/i.test(content) ? "sr"
                    : "en";

                if (!isTextLikeMessageType(messageType)) {
                    if (!attachmentReplySent.has(normalizedPhone)) {
                        await sendWhatsAppText(
                            normalizedPhone,
                            getMediaAttachmentResponse(quickLang),
                            workerRecord?.profile_id || undefined
                        );
                        attachmentReplySent.add(normalizedPhone);
                    }
                    continue;
                }

                // ─── Employer WhatsApp Flow ───────────────────────────────
                if (isEmployer) {
                    const OPENAI_API_KEY_EMP = process.env.OPENAI_API_KEY;
                    if (OPENAI_API_KEY_EMP) {
                        try {
                            const [empHistory, empBrainMemory] = await Promise.all([
                                loadConversationHistory(supabase, normalizedPhone, RESPONSE_HISTORY_LIMIT),
                                loadBrainMemory(supabase),
                            ]);
                            const employerReply = await generateEmployerWhatsAppReply({
                                apiKey: OPENAI_API_KEY_EMP,
                                message: content,
                                normalizedPhone,
                                employerRecord,
                                historyMessages: empHistory,
                                brainMemory: empBrainMemory,
                                language: quickLang,
                            });
                            const finalEmployerReply = employerReply || (quickLang === "sr"
                                ? "Zdravo! Ja sam WhatsApp asistent Workers United. Pomažemo kompanijama da pronađu strane radnike — besplatno za poslodavce. Kako mogu da Vam pomognem?"
                                : "Hi! I'm the Workers United WhatsApp assistant. We help companies hire foreign workers — completely free for employers. How can I help you?");
                            await sendWhatsAppText(normalizedPhone, finalEmployerReply, undefined);
                            return NextResponse.json({ status: "ok" }); // Always return — never fall through to worker flow
                        } catch (empErr) {
                            console.error("[WhatsApp] Employer AI error:", empErr);
                            // Even on error, send fallback and return — do not fall through to worker flow
                            const fallbackEmployer = quickLang === "sr"
                                ? "Zdravo! Ja sam WhatsApp asistent Workers United. Pomažemo kompanijama da pronađu strane radnike besplatno. Pišite nam na contact@workersunited.eu ili posetite workersunited.eu."
                                : "Hi! I'm the Workers United assistant. We help companies hire foreign workers for free. Contact us at contact@workersunited.eu or visit workersunited.eu.";
                            await sendWhatsAppText(normalizedPhone, fallbackEmployer, undefined);
                            return NextResponse.json({ status: "ok" });
                        }
                    }
                    // No API key — send static employer fallback
                    const staticEmployer = quickLang === "sr"
                        ? "Zdravo! Workers United pomaže kompanijama da pronađu strane radnike — besplatno za poslodavce. Registrujte se na workersunited.eu/signup."
                        : "Hi! Workers United helps companies hire foreign workers — free for employers. Register at workersunited.eu/signup.";
                    await sendWhatsAppText(normalizedPhone, staticEmployer, undefined);
                    return NextResponse.json({ status: "ok" });
                }

                const onboardingReply = await handleWhatsAppOnboarding(
                    supabase,
                    normalizedPhone,
                    content,
                    workerRecord,
                    quickLang
                );

                if (onboardingReply !== null) {
                    await sendWhatsAppText(normalizedPhone, onboardingReply, workerRecord?.profile_id || undefined);
                    return NextResponse.json({ status: "ok" });
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
        return [
            "Registered: no",
            "Worker status: not registered yet",
            buildWorkerPaymentSnapshot(null),
        ].join("\n");
    }

    return [
        "Registered: yes",
        `Worker status: ${workerRecord.status || "unknown"}`,
        `Entry fee paid: ${workerRecord.entry_fee_paid ? "yes" : "no"}`,
        `Admin approved: ${workerRecord.admin_approved ? "yes" : "no"}`,
        `Queue joined: ${workerRecord.queue_joined_at ? "yes" : "no"}`,
        buildWorkerPaymentSnapshot(workerRecord),
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
    const canonicalFacts = buildCanonicalWhatsAppFacts();
    const instructions = `You are the official WhatsApp assistant for Workers United.

Personality:
- Friendly, warm, practical, and calm.
- Treat the person with respect and keep things easy to understand.
- If something is not available, say it simply and move them to the next safe step.

Canonical facts (never contradict these):
${canonicalFacts}

Platform config facts (secondary; if they conflict with canonical facts, follow canonical facts):
${businessFacts || "(No additional platform facts available)"}

Worker snapshot:
${workerSnapshot}

Useful stored facts:
${memoryText}

${buildWorkerWhatsAppRules({
        language: routerDecision.language,
        intent: routerDecision.intent,
        confidence: routerDecision.confidence,
        reason: routerDecision.reason,
        isAdmin,
    })}`;

    return callOpenAIResponseText(apiKey, {
        model: WHATSAPP_RESPONSE_MODEL,
        instructions,
        input: `Phone: ${normalizedPhone}\nUser name: ${userName}\nLatest message:\n${message}\n\nRecent conversation:\n${formatHistory(historyMessages, RESPONSE_HISTORY_LIMIT)}`,
        maxOutputTokens: 4096,
    });
}

// ─── Employer WhatsApp AI Handler ─────────────────────────────────────────────
// Handles inbound messages from European phone numbers (potential/registered employers)

async function generateEmployerWhatsAppReply({
    apiKey,
    message,
    normalizedPhone,
    employerRecord,
    historyMessages,
    brainMemory,
    language,
}: {
    apiKey: string;
    message: string;
    normalizedPhone: string;
    employerRecord: any;
    historyMessages: Array<{ direction: string; content: string | null; created_at?: string | null }>;
    brainMemory: Array<{ category: string; content: string; confidence: number }>;
    language: string;
}): Promise<string> {
    const isRegistered = !!employerRecord;
    const companyName = employerRecord?.company_name || "";
    const contactName = employerRecord?.contact_name || "";
    const memoryText = brainMemory.length > 0
        ? brainMemory.map(e => `- [${e.category}] ${e.content}`).join("\n")
        : "(No stored facts)";
    const canonicalFacts = buildCanonicalWhatsAppFacts();
    const instructions = `You are the official WhatsApp assistant for Workers United.

Personality:
- Warm, professional, direct, and operational.
- Answer first, then move the employer to one concrete next step.
- Do not oversell or invent inventory.

Canonical facts (never contradict these):
${canonicalFacts}

Useful stored facts:
${memoryText}

${buildEmployerWhatsAppRules({
        language,
        isRegistered,
        companyName,
        contactName,
        employerStatus: employerRecord?.status || null,
    })}`;

    return callOpenAIResponseText(apiKey, {
        model: WHATSAPP_RESPONSE_MODEL,
        instructions,
        input: `Phone: ${normalizedPhone}\nLatest message:\n${message}\n\nRecent conversation:\n${formatHistory(historyMessages, 10)}`,
        maxOutputTokens: 2048,
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
    const GREETING_EN = config.bot_greeting_en || "Welcome to Workers United! 🌍 We help workers through the full job-search and visa process in Europe.";
    const GREETING_SR = config.bot_greeting_sr || "Dobrodošli u Workers United! 🌍 Pomažemo radnicima kroz ceo proces traženja posla i vize u Evropi.";
    // Language detection for fallback
    const isSerboCroatian = /[čćžšđ]/.test(message) || /zdravo|pozdrav|pomoć|pomoc|posao|rad|plata|cena|cijena|koliko|dokumenti|pasos|pasoš|profil|status|registr/i.test(msg);
    const isNepali = /[\u0900-\u097F]/.test(message);
    const isArabic = /[\u0600-\u06FF]/.test(message);
    const isFrench = /bonjour|salut|emploi|travail|passeport|comment|merci|oui|non/i.test(msg);
    const isPortuguese = /olá|ola|emprego|trabalho|passaporte|obrigado|sim|não|nao/i.test(msg);
    const isHindi = /[\u0900-\u097F]/.test(message) && !/[\u0900-\u097F\u0966-\u096F]/.test(message); // Hindi subset
    
    // Determine active language for fallback
    const fallbackLang = isSerboCroatian ? 'sr' : isNepali ? 'ne' : isArabic ? 'ar' : isFrench ? 'fr' : isPortuguese ? 'pt' : 'en';
    // Multilingual fallback messages
    const greetings: Record<string, string> = {
        sr: GREETING_SR,
        ne: "Workers United मा स्वागत छ! 🌍 हामी युरोपमा काम खोज्न र भिसा प्रक्रियामा मद्दत गर्छौं।",
        ar: "مرحباً بك في Workers United! 🌍 نساعد العمال في إيجاد وظائف في أوروبا وإجراءات التأشيرة.",
        fr: "Bienvenue chez Workers United! 🌍 Nous aidons les travailleurs à trouver des emplois en Europe.",
        pt: "Bem-vindo à Workers United! 🌍 Ajudamos trabalhadores a encontrar empregos na Europa.",
        en: GREETING_EN,
    };
    const startMessages: Record<string, string> = {
        sr: `Registrujte se na ${WEBSITE}/signup i popunite profil. Posle registracije možete nastaviti pitanja ovde na WhatsApp-u, ali profil i dokumenta završavate kroz dashboard. Job Finder se otključava tek kada je profil kompletan i admin ga odobri.`,
        ne: `${WEBSITE}/signup मा खाता बनाउनुहोस् र प्रोफाइल पूरा गर्नुहोस्। दर्ता भएपछि प्रश्नहरू यहाँ WhatsApp मा गर्न सक्नुहुन्छ, तर प्रोफाइल र कागजातहरू ड्यासबोर्डमार्फत पूरा हुन्छन्। Job Finder प्रोफाइल पूरा भएर admin approval भएपछि मात्र खुल्छ।`,
        ar: `أنشئ حسابك على ${WEBSITE}/signup وأكمل ملفك الشخصي. بعد التسجيل يمكنك متابعة الأسئلة هنا على WhatsApp، لكن الملف والمستندات تُستكمل من لوحة التحكم. يتم فتح Job Finder فقط بعد اكتمال الملف وموافقة الإدارة.`,
        fr: `Créez votre compte sur ${WEBSITE}/signup et complétez votre profil. Après inscription, vous pouvez poser vos questions ici sur WhatsApp, mais le profil et les documents se terminent dans le tableau de bord. Job Finder ne s’ouvre qu’après profil complet et validation admin.`,
        pt: `Crie sua conta em ${WEBSITE}/signup e complete seu perfil. Depois do registro, você pode continuar com perguntas aqui no WhatsApp, mas o perfil e os documentos são concluídos no painel. O Job Finder só é liberado após perfil completo e aprovação administrativa.`,
        en: `Create your account at ${WEBSITE}/signup and complete your profile. After signup, you can keep asking questions here on WhatsApp, but profile completion and document uploads happen in the dashboard. Job Finder unlocks only after the profile is complete and admin approves it.`,
    };
    const greeting = greetings[fallbackLang] || greetings.en;
    const startMessage = startMessages[fallbackLang] || startMessages.en;

    if (!workerRecord) {
        return `${greeting} ${startMessage}`;
    }

    if (msg.includes("status") || msg.includes("profile") || msg.includes("stanje") || msg.includes("profil") || msg.includes("स्थिति") || msg.includes("حالة")) {
        const statusInfo = workerRecord.status === "REGISTERED" ? "registered ✅" : workerRecord.status;
        const queueInfo = workerRecord.queue_position ? ` Queue position: #${workerRecord.queue_position}.` : "";
        if (fallbackLang === 'sr') return `Zdravo ${name}! Vaš status je: ${statusInfo}.${queueInfo} Detalje možete videti na ${WEBSITE}/profile/worker.`;
        if (fallbackLang === 'ne') return `नमस्ते ${name}! तपाईंको स्थिति: ${statusInfo}.${queueInfo} विवरण ${WEBSITE}/profile/worker मा हेर्नुहोस्।`;
        if (fallbackLang === 'ar') return `مرحباً ${name}! حالتك: ${statusInfo}.${queueInfo} يمكنك رؤية التفاصيل على ${WEBSITE}/profile/worker.`;
        return `Hi ${name}! Your status is: ${statusInfo}.${queueInfo} You can see full details at ${WEBSITE}/profile/worker.`;
    }

    if (msg.includes("price") || msg.includes("cost") || msg.includes("fee") || msg.includes("payment") || msg.includes("cena") || msg.includes("cijena") || msg.includes("koliko") || msg.includes("शुल्क") || msg.includes("سعر")) {
        if (!workerRecord) {
            if (fallbackLang === 'sr') return `Zdravo ${name}! Job Finder košta ${ENTRY_FEE}, ali uplata se ne otključava odmah. Prvo napravite profil na ${WEBSITE}/signup, popunite ga do kraja i sačekajte admin odobrenje; tek tada se otvara checkout. Ako ne pronađemo posao u roku od 90 dana, iznos se vraća u potpunosti.`;
            if (fallbackLang === 'ne') return `नमस्ते ${name}! Job Finder को शुल्क ${ENTRY_FEE} हो, तर भुक्तानी तुरुन्त खुल्दैन। पहिले ${WEBSITE}/signup मा प्रोफाइल बनाउनुहोस्, पूरा गर्नुहोस्, अनि admin approval पछि मात्र checkout खुल्छ। ९० दिनभित्र काम नपाए पूरा फिर्ता हुन्छ।`;
            if (fallbackLang === 'ar') return `مرحباً ${name}! تكلفة Job Finder هي ${ENTRY_FEE}، لكن الدفع لا يُفتح فورًا. أنشئ ملفك أولاً على ${WEBSITE}/signup وأكمله بالكامل ثم انتظر موافقة الإدارة، وبعدها فقط يفتح الدفع. إذا لم نجد وظيفة خلال 90 يومًا فسيتم رد المبلغ بالكامل.`;
            return `Hi ${name}! Job Finder costs ${ENTRY_FEE}, but payment does not unlock immediately. First create your profile at ${WEBSITE}/signup, complete it fully, and wait for admin approval; only then does checkout unlock. If no job is found within 90 days, the full amount is refunded.`;
        }
        if (workerRecord.entry_fee_paid) {
            if (fallbackLang === 'sr') return `Zdravo ${name}! Vaša Job Finder uplata je već evidentirana. Sledeći korak i status možete pratiti na ${WEBSITE}/profile/worker.`;
            if (fallbackLang === 'ne') return `नमस्ते ${name}! तपाईंको Job Finder भुक्तानी पहिले नै evidentirana छ। अर्को चरण र status ${WEBSITE}/profile/worker मा हेर्नुहोस्।`;
            if (fallbackLang === 'ar') return `مرحباً ${name}! تم تسجيل دفعة Job Finder بالفعل. يمكنك متابعة الحالة والخطوة التالية على ${WEBSITE}/profile/worker.`;
            return `Hi ${name}! Your Job Finder payment is already recorded. You can follow the next step and your status at ${WEBSITE}/profile/worker.`;
        }
        if (!isWorkerPaymentUnlocked(workerRecord)) {
            if (fallbackLang === 'sr') return `Zdravo ${name}! Checkout za Job Finder još nije otključan. Potrebno je da profil bude kompletan i da prođe admin review; zatim pokrećete bezbednu uplatu iz dashboard-a na ${WEBSITE}/profile/worker.`;
            if (fallbackLang === 'ne') return `नमस्ते ${name}! Job Finder checkout अझै खुलेको छैन। प्रोफाइल पूरा भई admin review पास भएपछि मात्र ${WEBSITE}/profile/worker ड्यासबोर्डबाट सुरक्षित भुक्तानी सुरु हुन्छ।`;
            if (fallbackLang === 'ar') return `مرحباً ${name}! لم يتم فتح Checkout الخاص بـ Job Finder بعد. يجب أن يكتمل الملف ويمر بمراجعة الإدارة أولاً، ثم تبدأ الدفع الآمن من لوحة التحكم على ${WEBSITE}/profile/worker.`;
            return `Hi ${name}! Job Finder checkout is not unlocked yet. Your profile must be complete and pass admin review first; after that, you start the secure payment from the dashboard at ${WEBSITE}/profile/worker.`;
        }
        if (fallbackLang === 'sr') return `Zdravo ${name}! Job Finder je spreman za aktivaciju. Otvorite dashboard na ${WEBSITE}/profile/worker i odatle pokrenite bezbedan checkout za ${ENTRY_FEE}. Ako ne pronađemo posao u roku od 90 dana, iznos se vraća u potpunosti.`;
        if (fallbackLang === 'ne') return `नमस्ते ${name}! Job Finder अब activate गर्न तयार छ। ${WEBSITE}/profile/worker ड्यासबोर्ड खोल्नुहोस् र त्यहाँबाट ${ENTRY_FEE} को सुरक्षित checkout सुरु गर्नुहोस्। ९० दिनभित्र काम नपाए पूरा फिर्ता हुन्छ।`;
        if (fallbackLang === 'ar') return `مرحباً ${name}! أصبح Job Finder جاهزًا للتفعيل. افتح لوحة التحكم على ${WEBSITE}/profile/worker وابدأ الدفع الآمن من هناك مقابل ${ENTRY_FEE}. إذا لم نجد وظيفة خلال 90 يومًا فسيتم رد المبلغ بالكامل.`;
        return `Hi ${name}! Job Finder is ready to activate. Open your dashboard at ${WEBSITE}/profile/worker and start the secure checkout there for ${ENTRY_FEE}. If we do not find you a job within 90 days, the full amount is refunded.`;
    }

    if (msg.includes("document") || msg.includes("passport") || msg.includes("dokument") || msg.includes("pasos") || msg.includes("पासपोर्ट") || msg.includes("جواز")) {
        if (fallbackLang === 'sr') return `Zdravo ${name}! Dokumenta uploadujete na ${WEBSITE}/profile/worker. Potrebni su: ${config.supported_documents || "pasoš, diploma ili potvrda o radu, i biometrijska fotografija"}. WhatsApp prilozi se trenutno ne vezuju automatski za profil.`;
        if (fallbackLang === 'ne') return `नमस्ते ${name}! कागजातहरू ${WEBSITE}/profile/worker मा अपलोड गर्नुहोस्। आवश्यक: ${config.supported_documents || "पासपोर्ट, डिप्लोमा वा काम प्रमाणपत्र, र बायोमेट्रिक फोटो"}. WhatsApp attachment हरू अहिले प्रोफाइलसँग स्वतः जोडिँदैनन्।`;
        if (fallbackLang === 'ar') return `مرحباً ${name}! يمكنك رفع المستندات على ${WEBSITE}/profile/worker. المطلوب: ${config.supported_documents || "جواز السفر، شهادة أو شهادة عمل، وصورة بيومترية"}. مرفقات WhatsApp لا ترتبط بالملف تلقائيًا حاليًا.`;
        return `Hi ${name}! Upload documents at ${WEBSITE}/profile/worker. We need: ${config.supported_documents || "passport, diploma or work certificate, and a biometric photo"}. WhatsApp attachments are not linked to the profile automatically yet.`;
    }

    // Catch-all
    if (fallbackLang === 'sr') return `Zdravo ${name}! 👋 ${startMessage}`;
    if (fallbackLang === 'ne') return `नमस्ते ${name}! 👋 ${startMessage}`;
    if (fallbackLang === 'ar') return `مرحباً ${name}! 👋 ${startMessage}`;
    return `Hi ${name}! 👋 ${startMessage}`;
}


// ─── WhatsApp Onboarding Flow ─────────────────────────────────────────────────
// Mirrors the exact fields in the worker profile form (ProfileClient.tsx).
// Guides unregistered users step by step in their own language.
// State is stored in the whatsapp_onboarding_state table.
//
// Profile fields covered:
//   Personal:  first_name, last_name, gender, marital_status, nationality,
//              date_of_birth, birth_country, birth_city, citizenship,
//              father_name, mother_name, current_country, address
//   Family:    has_spouse → spouse details, has_children → children details
//   Passport:  passport_number, passport_issued_by, passport_issue_date,
//              passport_expiry_date, lives_abroad, previous_visas
//   Job prefs: preferred_job (WORKER_INDUSTRIES), desired_countries (EUROPEAN_COUNTRIES + "Any")
// ──────────────────────────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
    "ask_start",            // Offer to fill profile via WhatsApp
    "full_name",            // First + Last name
    "gender",               // Male / Female
    "marital_status",       // Single / Married / Divorced / Widowed / Separated
    "date_of_birth",        // DD/MM/YYYY
    "nationality",          // e.g. Serbian
    "birth_country",        // Country of birth
    "birth_city",           // City of birth
    "citizenship",          // Current citizenship
    "father_name",          // Father's first name (optional)
    "mother_name",          // Mother's first name (optional)
    "current_country",      // Where they live now
    "address",              // Full address (optional)
    "lives_abroad",         // Yes / No
    "previous_visas",       // Yes / No
    "passport_number",      // Passport number
    "passport_issued_by",   // Issuing authority
    "passport_issue_date",  // DD/MM/YYYY
    "passport_expiry_date", // DD/MM/YYYY
    "has_spouse",           // Yes / No
    "spouse_details",       // If yes: first name, last name, DOB, birth country, birth city (one message)
    "has_children",         // Yes / No
    "children_details",     // If yes: collect children one by one
    "preferred_job",        // Industry from WORKER_INDUSTRIES
    "desired_countries",    // European countries or "Any"
    "done",                 // Summary + link
] as const;

type OnboardingStep = typeof ONBOARDING_STEPS[number];

interface OnboardingState {
    phone_number: string;
    current_step: OnboardingStep;
    collected_data: Record<string, string>;
    language: string;
}

// ─── Translations ─────────────────────────────────────────────────────────────
// Keys: en, sr, hi, ar, fr, pt
type LangKey = "en" | "sr" | "hi" | "ar" | "fr" | "pt";

const T: Record<string, Record<LangKey, string>> = {
    ask_start: {
        en: "Would you like to fill in your worker profile right here on WhatsApp? I'll guide you step by step — it only takes a few minutes. Reply *Yes* to start, or *No* to do it on the website.",
        sr: "Želite li da popunite radnički profil odmah ovde na WhatsApp-u? Vodiću vas korak po korak — traje samo nekoliko minuta. Odgovorite *Da* da počnete, ili *Ne* ako wolite na sajtu.",
        hi: "क्या आप यहाँ WhatsApp पर अपना वर्कर प्रोफ़ाइल भरना चाहते हैं? मैं आपको चरण दर चरण मार्गदर्शन करूँगा। शुरू करने के लिए *हाँ* लिखें।",
        ar: "هل تريد ملء ملف العامل الخاص بك هنا على WhatsApp؟ سأرشدك خطوة بخطوة. اكتب *نعم* للبدء.",
        fr: "Souhaitez-vous remplir votre profil de travailleur ici sur WhatsApp? Je vous guiderai étape par étape. Répondez *Oui* pour commencer.",
        pt: "Gostaria de preencher seu perfil de trabalhador aqui no WhatsApp? Vou guiá-lo passo a passo. Responda *Sim* para começar.",
    },
    full_name: {
        en: "What is your *full name*? (First name and last name, e.g. John Smith)",
        sr: "Koje je vaše *puno ime i prezime*? (npr. Marko Marković)",
        hi: "आपका *पूरा नाम* क्या है? (पहला और अंतिम नाम, जैसे Rahul Sharma)",
        ar: "ما هو *اسمك الكامل*؟ (الاسم الأول والأخير، مثل Ahmed Ali)",
        fr: "Quel est votre *nom complet*? (Prénom et nom, ex. Jean Dupont)",
        pt: "Qual é o seu *nome completo*? (Primeiro e último nome, ex. João Silva)",
    },
    gender: {
        en: "What is your *gender*?\n\nReply: *Male* or *Female*",
        sr: "Koji je vaš *pol*?\n\nOdgovorite: *Muški* ili *Ženski*",
        hi: "आपका *लिंग* क्या है?\n\nलिखें: *पुरुष* या *महिला*",
        ar: "ما هو *جنسك*؟\n\nاكتب: *ذكر* أو *أنثى*",
        fr: "Quel est votre *genre*?\n\nRépondez: *Homme* ou *Femme*",
        pt: "Qual é o seu *gênero*?\n\nResponda: *Masculino* ou *Feminino*",
    },
    marital_status: {
        en: "What is your *marital status*?\n\nOptions:\n1 - Single\n2 - Married\n3 - Divorced\n4 - Widowed\n5 - Separated\n\nReply with the number or the word.",
        sr: "Koji je vaš *bračni status*?\n\nOpcije:\n1 - Slobodan/na\n2 - Oženjen/Udata\n3 - Razveden/a\n4 - Udovac/Udovica\n5 - Razdvojen/a\n\nOdgovorite brojem ili rečju.",
        hi: "आपकी *वैवाहिक स्थिति* क्या है?\n\nविकल्प:\n1 - अविवाहित\n2 - विवाहित\n3 - तलाकशुदा\n4 - विधवा/विधुर\n5 - अलग\n\nनंबर या शब्द से जवाब दें।",
        ar: "ما هي *حالتك الاجتماعية*؟\n\nالخيارات:\n1 - أعزب/عزباء\n2 - متزوج/ة\n3 - مطلق/ة\n4 - أرمل/ة\n5 - منفصل/ة\n\nاكتب الرقم أو الكلمة.",
        fr: "Quel est votre *statut matrimonial*?\n\nOptions:\n1 - Célibataire\n2 - Marié(e)\n3 - Divorcé(e)\n4 - Veuf/Veuve\n5 - Séparé(e)\n\nRépondez avec le numéro ou le mot.",
        pt: "Qual é o seu *estado civil*?\n\nOpções:\n1 - Solteiro/a\n2 - Casado/a\n3 - Divorciado/a\n4 - Viúvo/a\n5 - Separado/a\n\nResponda com o número ou a palavra.",
    },
    date_of_birth: {
        en: "What is your *date of birth*? (Format: DD/MM/YYYY, e.g. 15/06/1990)",
        sr: "Koji je vaš *datum rođenja*? (Format: DD/MM/GGGG, npr. 15/06/1990)",
        hi: "आपकी *जन्म तिथि* क्या है? (प्रारूप: DD/MM/YYYY, जैसे 15/06/1990)",
        ar: "ما هو *تاريخ ميلادك*؟ (الصيغة: DD/MM/YYYY، مثل 15/06/1990)",
        fr: "Quelle est votre *date de naissance*? (Format: JJ/MM/AAAA, ex. 15/06/1990)",
        pt: "Qual é a sua *data de nascimento*? (Formato: DD/MM/AAAA, ex. 15/06/1990)",
    },
    nationality: {
        en: "What is your *nationality*? (e.g. Serbian, Indian, Moroccan)",
        sr: "Koja je vaša *nacionalnost*? (npr. Srpska, Bosanska, Hrvatska)",
        hi: "आपकी *राष्ट्रीयता* क्या है? (जैसे Indian, Nepali, Bangladeshi)",
        ar: "ما هي *جنسيتك*؟ (مثل سوري، مصري، مغربي)",
        fr: "Quelle est votre *nationalité*? (ex. Française, Marocaine, Algérienne)",
        pt: "Qual é a sua *nacionalidade*? (ex. Brasileira, Portuguesa, Angolana)",
    },
    birth_country: {
        en: "In which *country were you born*?",
        sr: "U kojoj *zemlji ste rođeni*?",
        hi: "आप किस *देश में पैदा हुए थे*?",
        ar: "في أي *بلد وُلدت*؟",
        fr: "Dans quel *pays êtes-vous né(e)*?",
        pt: "Em qual *país você nasceu*?",
    },
    birth_city: {
        en: "In which *city were you born*?",
        sr: "U kom *gradu ste rođeni*?",
        hi: "आप किस *शहर में पैदा हुए थे*?",
        ar: "في أي *مدينة وُلدت*؟",
        fr: "Dans quelle *ville êtes-vous né(e)*?",
        pt: "Em qual *cidade você nasceu*?",
    },
    citizenship: {
        en: "What is your *current citizenship* (the country whose passport you hold)?",
        sr: "Koje je vaše *trenutno državljanstvo* (zemlja čiji pasoš posedujete)?",
        hi: "आपकी *वर्तमान नागरिकता* क्या है (आप किस देश का पासपोर्ट रखते हैं)?",
        ar: "ما هي *جنسيتك الحالية* (البلد الذي تحمل جواز سفره)؟",
        fr: "Quelle est votre *nationalité actuelle* (le pays dont vous avez le passeport)?",
        pt: "Qual é a sua *cidadania atual* (o país cujo passaporte você possui)?",
    },
    father_name: {
        en: "What is your *father's first name*? (Optional — reply *Skip* to skip)",
        sr: "Koje je *ime vašeg oca*? (Opciono — odgovorite *Preskoči* za preskakanje)",
        hi: "आपके *पिता का नाम* क्या है? (वैकल्पिक — *Skip* लिखें छोड़ने के लिए)",
        ar: "ما هو *اسم والدك*؟ (اختياري — اكتب *تخطي* للتخطي)",
        fr: "Quel est le *prénom de votre père*? (Optionnel — répondez *Passer* pour ignorer)",
        pt: "Qual é o *nome do seu pai*? (Opcional — responda *Pular* para pular)",
    },
    mother_name: {
        en: "What is your *mother's first name*? (Optional — reply *Skip* to skip)",
        sr: "Koje je *ime vaše majke*? (Opciono — odgovorite *Preskoči* za preskakanje)",
        hi: "आपकी *माँ का नाम* क्या है? (वैकल्पिक — *Skip* लिखें छोड़ने के लिए)",
        ar: "ما هو *اسم والدتك*؟ (اختياري — اكتب *تخطي* للتخطي)",
        fr: "Quel est le *prénom de votre mère*? (Optionnel — répondez *Passer* pour ignorer)",
        pt: "Qual é o *nome da sua mãe*? (Opcional — responda *Pular* para pular)",
    },
    current_country: {
        en: "Which *country do you currently live in*?",
        sr: "U kojoj *zemlji trenutno živite*?",
        hi: "आप वर्तमान में किस *देश में रहते हैं*?",
        ar: "في أي *بلد تعيش حاليًا*؟",
        fr: "Dans quel *pays vivez-vous actuellement*?",
        pt: "Em qual *país você mora atualmente*?",
    },
    address: {
        en: "What is your *full address*? (Street, city, postal code — Optional, reply *Skip* to skip)",
        sr: "Koja je vaša *puna adresa*? (Ulica, grad, poštanski broj — Opciono, odgovorite *Preskoči*)",
        hi: "आपका *पूरा पता* क्या है? (सड़क, शहर, पिन कोड — वैकल्पिक, *Skip* लिखें छोड़ने के लिए)",
        ar: "ما هو *عنوانك الكامل*؟ (الشارع، المدينة، الرمز البريدي — اختياري، اكتب *تخطي*)",
        fr: "Quelle est votre *adresse complète*? (Rue, ville, code postal — Optionnel, répondez *Passer*)",
        pt: "Qual é o seu *endereço completo*? (Rua, cidade, CEP — Opcional, responda *Pular*)",
    },
    lives_abroad: {
        en: "Do you *currently live outside your home country*?\n\nReply: *Yes* or *No*",
        sr: "Da li trenutno *živite van svoje matične zemlje*?\n\nOdgovorite: *Da* ili *Ne*",
        hi: "क्या आप वर्तमान में *अपने मूल देश के बाहर रहते हैं*?\n\nलिखें: *हाँ* या *नहीं*",
        ar: "هل تعيش حاليًا *خارج بلدك الأصلي*؟\n\nاكتب: *نعم* أو *لا*",
        fr: "Vivez-vous actuellement *en dehors de votre pays d'origine*?\n\nRépondez: *Oui* ou *Non*",
        pt: "Você mora atualmente *fora do seu país de origem*?\n\nResponda: *Sim* ou *Não*",
    },
    previous_visas: {
        en: "Have you had *any visas in the last 3 years*? (e.g. Schengen, work visa, tourist visa)\n\nReply: *Yes* or *No*",
        sr: "Da li ste imali *bilo kakve vize u poslednjih 3 godine*? (npr. Šengen, radna viza, turistička viza)\n\nOdgovorite: *Da* ili *Ne*",
        hi: "क्या आपके पास *पिछले 3 वर्षों में कोई वीज़ा* था? (जैसे शेंगेन, वर्क वीज़ा, टूरिस्ट वीज़ा)\n\nलिखें: *हाँ* या *नहीं*",
        ar: "هل حصلت على *أي تأشيرات في السنوات الثلاث الماضية*؟ (مثل شنغن، تأشيرة عمل، تأشيرة سياحية)\n\nاكتب: *نعم* أو *لا*",
        fr: "Avez-vous eu *des visas au cours des 3 dernières années*? (ex. Schengen, visa de travail, visa touristique)\n\nRépondez: *Oui* ou *Non*",
        pt: "Você teve *algum visto nos últimos 3 anos*? (ex. Schengen, visto de trabalho, visto turístico)\n\nResponda: *Sim* ou *Não*",
    },
    passport_number: {
        en: "What is your *passport number*? (e.g. AB1234567)",
        sr: "Koji je vaš *broj pasoša*? (npr. AB1234567)",
        hi: "आपका *पासपोर्ट नंबर* क्या है? (जैसे AB1234567)",
        ar: "ما هو *رقم جواز سفرك*؟ (مثل AB1234567)",
        fr: "Quel est votre *numéro de passeport*? (ex. AB1234567)",
        pt: "Qual é o seu *número de passaporte*? (ex. AB1234567)",
    },
    passport_issued_by: {
        en: "Who *issued your passport*? (The authority or ministry that issued it, e.g. Ministry of Interior, Police Department)",
        sr: "Ko je *izdao vaš pasoš*? (Organ koji ga je izdao, npr. MUP, Policijska uprava)",
        hi: "आपका पासपोर्ट *किसने जारी किया*? (जैसे गृह मंत्रालय, पुलिस विभाग)",
        ar: "من *أصدر جواز سفرك*؟ (الجهة التي أصدرته، مثل وزارة الداخلية)",
        fr: "Qui a *émis votre passeport*? (L'autorité qui l'a émis, ex. Ministère de l'Intérieur)",
        pt: "Quem *emitiu seu passaporte*? (A autoridade que o emitiu, ex. Ministério do Interior)",
    },
    passport_issue_date: {
        en: "What is the *issue date* of your passport? (Format: DD/MM/YYYY, e.g. 10/03/2020)",
        sr: "Koji je *datum izdavanja* vašeg pasoša? (Format: DD/MM/GGGG, npr. 10/03/2020)",
        hi: "आपके पासपोर्ट की *जारी करने की तारीख* क्या है? (प्रारूप: DD/MM/YYYY, जैसे 10/03/2020)",
        ar: "ما هو *تاريخ إصدار* جواز سفرك؟ (الصيغة: DD/MM/YYYY، مثل 10/03/2020)",
        fr: "Quelle est la *date d'émission* de votre passeport? (Format: JJ/MM/AAAA, ex. 10/03/2020)",
        pt: "Qual é a *data de emissão* do seu passaporte? (Formato: DD/MM/AAAA, ex. 10/03/2020)",
    },
    passport_expiry_date: {
        en: "What is the *expiry date* of your passport? (Format: DD/MM/YYYY, e.g. 10/03/2030)",
        sr: "Koji je *datum isteka* vašeg pasoša? (Format: DD/MM/GGGG, npr. 10/03/2030)",
        hi: "आपके पासपोर्ट की *समाप्ति तिथि* क्या है? (प्रारूप: DD/MM/YYYY, जैसे 10/03/2030)",
        ar: "ما هو *تاريخ انتهاء صلاحية* جواز سفرك؟ (الصيغة: DD/MM/YYYY، مثل 10/03/2030)",
        fr: "Quelle est la *date d'expiration* de votre passeport? (Format: JJ/MM/AAAA, ex. 10/03/2030)",
        pt: "Qual é a *data de validade* do seu passaporte? (Formato: DD/MM/AAAA, ex. 10/03/2030)",
    },
    has_spouse: {
        en: "Do you have a *spouse or partner*?\n\nReply: *Yes* or *No*",
        sr: "Da li imate *supružnika ili partnera*?\n\nOdgovorite: *Da* ili *Ne*",
        hi: "क्या आपका *जीवनसाथी या साथी* है?\n\nलिखें: *हाँ* या *नहीं*",
        ar: "هل لديك *زوج/ة أو شريك*؟\n\nاكتب: *نعم* أو *لا*",
        fr: "Avez-vous un(e) *conjoint(e) ou partenaire*?\n\nRépondez: *Oui* ou *Non*",
        pt: "Você tem um(a) *cônjuge ou parceiro(a)*?\n\nResponda: *Sim* ou *Não*",
    },
    spouse_details: {
        en: "Please provide your spouse's details in this format:\n*First name, Last name, DD/MM/YYYY (date of birth), Country of birth, City of birth*\n\nExample: Maria, Smith, 20/04/1992, Serbia, Belgrade",
        sr: "Molim vas unesite podatke o supružniku u ovom formatu:\n*Ime, Prezime, DD/MM/GGGG (datum rođenja), Zemlja rođenja, Grad rođenja*\n\nPrimer: Marija, Marković, 20/04/1992, Srbija, Beograd",
        hi: "कृपया अपने जीवनसाथी का विवरण इस प्रारूप में दें:\n*पहला नाम, अंतिम नाम, DD/MM/YYYY (जन्म तिथि), जन्म देश, जन्म शहर*\n\nउदाहरण: Priya, Sharma, 20/04/1992, India, Mumbai",
        ar: "يرجى تقديم تفاصيل زوجك/ـتك بهذا التنسيق:\n*الاسم الأول، اسم العائلة، DD/MM/YYYY (تاريخ الميلاد)، بلد الميلاد، مدينة الميلاد*\n\nمثال: فاطمة، أحمد، 20/04/1992، سوريا، دمشق",
        fr: "Veuillez fournir les détails de votre conjoint(e) dans ce format:\n*Prénom, Nom, JJ/MM/AAAA (date de naissance), Pays de naissance, Ville de naissance*\n\nExemple: Marie, Dupont, 20/04/1992, France, Paris",
        pt: "Por favor, forneça os detalhes do seu cônjuge neste formato:\n*Primeiro nome, Sobrenome, DD/MM/AAAA (data de nascimento), País de nascimento, Cidade de nascimento*\n\nExemplo: Maria, Silva, 20/04/1992, Brasil, São Paulo",
    },
    has_children: {
        en: "Do you have *children*?\n\nReply: *Yes* or *No*",
        sr: "Da li imate *dece*?\n\nOdgovorite: *Da* ili *Ne*",
        hi: "क्या आपके *बच्चे* हैं?\n\nलिखें: *हाँ* या *नहीं*",
        ar: "هل لديك *أطفال*؟\n\nاكتب: *نعم* أو *لا*",
        fr: "Avez-vous des *enfants*?\n\nRépondez: *Oui* ou *Non*",
        pt: "Você tem *filhos*?\n\nResponda: *Sim* ou *Não*",
    },
    children_details: {
        en: "Please list your children, one per line, in this format:\n*First name, Last name, DD/MM/YYYY*\n\nExample:\nAna, Smith, 05/09/2010\nLuka, Smith, 12/03/2015\n\nWhen done, reply *Done*.",
        sr: "Molim vas navedite svoju decu, jedno po liniji, u ovom formatu:\n*Ime, Prezime, DD/MM/GGGG*\n\nPrimer:\nAna, Marković, 05/09/2010\nLuka, Marković, 12/03/2015\n\nKada završite, odgovorite *Gotovo*.",
        hi: "कृपया अपने बच्चों की सूची दें, प्रत्येक पंक्ति में एक, इस प्रारूप में:\n*पहला नाम, अंतिम नाम, DD/MM/YYYY*\n\nउदाहरण:\nAanya, Sharma, 05/09/2010\nRohan, Sharma, 12/03/2015\n\nसमाप्त होने पर *Done* लिखें।",
        ar: "يرجى سرد أطفالك، واحد في كل سطر، بهذا التنسيق:\n*الاسم الأول، اسم العائلة، DD/MM/YYYY*\n\nمثال:\nسارة، أحمد، 05/09/2010\nعمر، أحمد، 12/03/2015\n\nعند الانتهاء، اكتب *تم*.",
        fr: "Veuillez lister vos enfants, un par ligne, dans ce format:\n*Prénom, Nom, JJ/MM/AAAA*\n\nExemple:\nLéa, Dupont, 05/09/2010\nThéo, Dupont, 12/03/2015\n\nQuand vous avez terminé, répondez *Terminé*.",
        pt: "Por favor, liste seus filhos, um por linha, neste formato:\n*Primeiro nome, Sobrenome, DD/MM/AAAA*\n\nExemplo:\nAna, Silva, 05/09/2010\nLucas, Silva, 12/03/2015\n\nQuando terminar, responda *Concluído*.",
    },
    preferred_job: {
        en: "What *type of work* are you looking for?\n\nOptions:\n1 - Construction\n2 - Manufacturing\n3 - Agriculture\n4 - Hospitality\n5 - Transportation\n6 - Retail\n7 - Food Processing\n8 - Warehousing & Logistics\n9 - Cleaning Services\n10 - Driving\n11 - *Any* (open to all — higher chances! 💪)\n\nReply with the number or the name.",
        sr: "Kakav *posao tražite*?\n\nOpcije:\n1 - Građevina\n2 - Industrija/Fabrika\n3 - Poljoprivreda\n4 - Ugostiteljstvo\n5 - Transport\n6 - Maloprodaja\n7 - Prehrambena industrija\n8 - Magacin i logistika\n9 - Čišćenje\n10 - Vozač\n11 - *Bilo koji* (otvoren za sve — veće šanse! 💪)\n\nOdgovorite brojem ili imenom.",
        hi: "आप किस *प्रकार का काम* ढूंढ रहे हैं?\n\nविकल्प:\n1 - निर्माण\n2 - विनिर्माण/कारखाना\n3 - कृषि\n4 - आतिथ्य\n5 - परिवहन\n6 - खुदरा\n7 - खाद्य प्रसंस्करण\n8 - वेयरहाउसिंग\n9 - सफाई\n10 - ड्राइविंग\n11 - *कोई भी* (सभी के लिए खुला — अधिक संभावनाएं! 💪)\n\nनंबर या नाम से जवाब दें।",
        ar: "ما نوع *العمل الذي تبحث عنه*؟\n\nالخيارات:\n1 - البناء\n2 - التصنيع/المصنع\n3 - الزراعة\n4 - الضيافة\n5 - النقل\n6 - التجزئة\n7 - معالجة الأغذية\n8 - المستودعات واللوجستيات\n9 - خدمات التنظيف\n10 - القيادة\n11 - *أي عمل* (منفتح على الكل — فرص أكبر! 💪)\n\nاكتب الرقم أو الاسم.",
        fr: "Quel *type de travail* recherchez-vous?\n\nOptions:\n1 - Construction\n2 - Fabrication/Usine\n3 - Agriculture\n4 - Hôtellerie\n5 - Transport\n6 - Commerce de détail\n7 - Transformation alimentaire\n8 - Entreposage & Logistique\n9 - Services de nettoyage\n10 - Conduite\n11 - *N'importe lequel* (ouvert à tout — plus de chances! 💪)\n\nRépondez avec le numéro ou le nom.",
        pt: "Que *tipo de trabalho* você está procurando?\n\nOpções:\n1 - Construção\n2 - Manufatura/Fábrica\n3 - Agricultura\n4 - Hotelaria\n5 - Transporte\n6 - Varejo\n7 - Processamento de alimentos\n8 - Armazenagem & Logística\n9 - Serviços de limpeza\n10 - Motorista\n11 - *Qualquer um* (aberto a tudo — mais chances! 💪)\n\nResponda com o número ou o nome.",
    },
    desired_countries: {
        en: "Which *European countries* would you like to work in?\n\nYou can name specific countries (e.g. Germany, Netherlands, Austria) or reply *Any country* — we strongly recommend this! Candidates open to all countries get jobs *much faster*. 🌍",
        sr: "U kojim *evropskim zemljama* biste želeli da radite?\n\nMožete navesti konkretne zemlje (npr. Nemačka, Holandija, Austrija) ili odgovoriti *Bilo koja zemlja* — toplo preporučujemo! Kandidati otvoreni za sve zemlje dobijaju posao *mnogo brže*. 🌍",
        hi: "आप यूरोप के किन *देशों में काम* करना चाहते हैं?\n\nआप विशिष्ट देशों के नाम ले सकते हैं (जैसे Germany, Netherlands, Austria) या *Any country* लिखें — हम इसकी दृढ़ता से सिफारिश करते हैं! 🌍",
        ar: "في أي *دول أوروبية* تريد العمل؟\n\nيمكنك ذكر دول محددة (مثل ألمانيا، هولندا، النمسا) أو اكتب *أي دولة* — نوصي بذلك بشدة! المرشحون المنفتحون يحصلون على وظائف *أسرع بكثير*. 🌍",
        fr: "Dans quels *pays européens* souhaitez-vous travailler?\n\nVous pouvez nommer des pays spécifiques (ex. Allemagne, Pays-Bas, Autriche) ou répondre *N'importe quel pays* — nous le recommandons vivement! 🌍",
        pt: "Em quais *países europeus* você gostaria de trabalhar?\n\nVocê pode nomear países específicos (ex. Alemanha, Holanda, Áustria) ou responder *Qualquer país* — recomendamos fortemente! 🌍",
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLangKey(language: string): LangKey {
    const l = language.toLowerCase();
    if (l.startsWith("sr") || l.includes("serb") || l.includes("croat") || l.includes("bosnian") || l.includes("montenegrin")) return "sr";
    if (l.startsWith("hi") || l.includes("hindi") || l.includes("nepali") || l.includes("bengali")) return "hi";
    if (l.startsWith("ar") || l.includes("arab")) return "ar";
    if (l.startsWith("fr") || l.includes("french")) return "fr";
    if (l.startsWith("pt") || l.includes("portug") || l.includes("brazil")) return "pt";
    return "en";
}

function getQ(step: string, language: string): string {
    const lk = getLangKey(language);
    return T[step]?.[lk] || T[step]?.["en"] || "";
}

function isYes(msg: string): boolean {
    const l = msg.toLowerCase().trim();
    return /^(yes|da|da!|yep|sure|ok|okay|haan|ha|نعم|oui|sim|ja|ano|oo|हाँ|हां|gotovo|done|terminé|concluído|تم)/.test(l);
}

function isNo(msg: string): boolean {
    const l = msg.toLowerCase().trim();
    return /^(no|ne|nope|nahi|la|non|não|nein|hindi|नहीं|لا)/.test(l);
}

function isSkip(msg: string): boolean {
    const l = msg.toLowerCase().trim();
    return /^(skip|preskoči|preskoci|pular|passer|تخطي|छोड़|skip)/.test(l);
}

// Map numbered/worded marital status answer to English value
function parseMaritalStatus(msg: string): string {
    const l = msg.toLowerCase().trim();
    if (l === "1" || /single|slobodan|slobodna|celibataire|solteiro|solteira|أعزب|عزباء|अविवाहित/.test(l)) return "Single";
    if (l === "2" || /married|oženjen|udata|marié|casado|casada|متزوج|विवाहित/.test(l)) return "Married";
    if (l === "3" || /divorced|razveden|razvedena|divorcé|divorciado|مطلق|तलाकशुदा/.test(l)) return "Divorced";
    if (l === "4" || /widow|udovac|udovica|veuf|viúvo|viúva|أرمل|विधवा|विधुर/.test(l)) return "Widowed";
    if (l === "5" || /separat|razdvojen|séparé|separado|منفصل|अलग/.test(l)) return "Separated";
    return msg.trim();
}

// Map numbered/worded gender answer to English value
function parseGender(msg: string): string {
    const l = msg.toLowerCase().trim();
    if (l === "1" || /male|muški|muski|homme|masculino|ذكر|पुरुष/.test(l)) return "Male";
    if (l === "2" || /female|ženski|zenski|femme|feminino|أنثى|महिला/.test(l)) return "Female";
    return msg.trim();
}

// Map numbered job type to English value
function parseJobType(msg: string): string {
    const map: Record<string, string> = {
        "1": "Construction", "2": "Manufacturing", "3": "Agriculture",
        "4": "Hospitality", "5": "Transportation", "6": "Retail",
        "7": "Food Processing", "8": "Warehousing & Logistics",
        "9": "Cleaning Services", "10": "Driving", "11": "Any",
    };
    const l = msg.toLowerCase().trim();
    if (map[l]) return map[l];
    // Fuzzy match
    if (/građevin|constru|bau/.test(l)) return "Construction";
    if (/manufactur|fabrik|industri/.test(l)) return "Manufacturing";
    if (/agri|poljopriv|farm/.test(l)) return "Agriculture";
    if (/hospitality|ugostiteljst|hotel/.test(l)) return "Hospitality";
    if (/transport/.test(l)) return "Transportation";
    if (/retail|maloprod/.test(l)) return "Retail";
    if (/food|prehrambena/.test(l)) return "Food Processing";
    if (/warehouse|magacin|logistik/.test(l)) return "Warehousing & Logistics";
    if (/clean|čišćenje|ciscenje/.test(l)) return "Cleaning Services";
    if (/driv|vozač|vozac/.test(l)) return "Driving";
    if (/any|bilo koji|bilo koja/.test(l)) return "Any";
    return msg.trim();
}

// Parse desired countries from free text
function parseDesiredCountries(msg: string): string[] {
    const l = msg.toLowerCase().trim();
    if (/any|bilo koja|n'importe|qualquer|أي دولة|कोई भी देश/.test(l)) return ["Any"];
    // Split by comma or newline and clean up
    return msg.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function getOnboardingState(supabase: any, phone: string): Promise<OnboardingState | null> {
    const { data } = await supabase
        .from("whatsapp_onboarding_state")
        .select("*")
        .eq("phone_number", phone)
        .single();
    return data || null;
}

async function saveOnboardingState(supabase: any, phone: string, step: OnboardingStep, collectedData: Record<string, string>, language: string): Promise<void> {
    await supabase
        .from("whatsapp_onboarding_state")
        .upsert({
            phone_number: phone,
            current_step: step,
            collected_data: collectedData,
            language,
            updated_at: new Date().toISOString(),
        }, { onConflict: "phone_number" });
}

async function clearOnboardingState(supabase: any, phone: string): Promise<void> {
    await supabase
        .from("whatsapp_onboarding_state")
        .delete()
        .eq("phone_number", phone);
}

// Save collected data into the workers table (upsert by phone)
async function saveWorkerFromOnboarding(supabase: any, phone: string, data: Record<string, string>): Promise<void> {
    const adminClient = createAdminClient();

    // Parse date_of_birth DD/MM/YYYY → YYYY-MM-DD
    function parseDate(raw: string | undefined): string | null {
        if (!raw) return null;
        const m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (!m) return null;
        return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }

    // Parse children from multiline text
    function parseChildren(raw: string | undefined): any[] {
        if (!raw) return [];
        return raw.split("\n").map(line => {
            const parts = line.split(",").map(s => s.trim());
            return {
                first_name: parts[0] || "",
                last_name: parts[1] || "",
                dob: parseDate(parts[2]) || parts[2] || "",
            };
        }).filter(c => c.first_name);
    }

    // Parse spouse from comma-separated text
    function parseSpouse(raw: string | undefined): any | null {
        if (!raw) return null;
        const parts = raw.split(",").map(s => s.trim());
        return {
            first_name: parts[0] || "",
            last_name: parts[1] || "",
            dob: parseDate(parts[2]) || parts[2] || "",
            birth_country: parts[3] || "",
            birth_city: parts[4] || "",
        };
    }

    const familyData: any = {};
    if (data.has_spouse === "Yes" && data.spouse_details) {
        familyData.spouse = parseSpouse(data.spouse_details);
    }
    if (data.has_children === "Yes" && data.children_details) {
        familyData.children = parseChildren(data.children_details);
    }

    const desiredCountries = data.desired_countries
        ? data.desired_countries.split("|").map(s => s.trim()).filter(Boolean)
        : [];

    // Try to find existing worker record by phone
    const { data: existing } = await adminClient
        .from("workers")
        .select("id")
        .eq("phone", phone)
        .single();

    const record: any = {
        phone,
        nationality: data.nationality || null,
        date_of_birth: parseDate(data.date_of_birth) || null,
        birth_country: data.birth_country || null,
        birth_city: data.birth_city || null,
        citizenship: data.citizenship || null,
        father_name: data.father_name || null,
        mother_name: data.mother_name || null,
        current_country: data.current_country || null,
        address: data.address || null,
        lives_abroad: data.lives_abroad || null,
        previous_visas: data.previous_visas || null,
        passport_number: data.passport_number || null,
        passport_issued_by: data.passport_issued_by || null,
        passport_issue_date: parseDate(data.passport_issue_date) || null,
        passport_expiry_date: parseDate(data.passport_expiry_date) || null,
        gender: data.gender || null,
        marital_status: data.marital_status || null,
        preferred_job: data.preferred_job || null,
        desired_countries: desiredCountries.length > 0 ? desiredCountries : null,
        family_data: Object.keys(familyData).length > 0 ? familyData : null,
        source_type: "whatsapp_onboarding",
        application_data: { collected_via: "whatsapp", language: data.language || "en" },
        updated_at: new Date().toISOString(),
    };

    // Also set full_name on profile if we have it
    if (data.full_name) {
        record.submitted_full_name = data.full_name;
    }

    if (existing?.id) {
        await adminClient.from("workers").update(record).eq("id", existing.id);
    } else {
        record.created_at = new Date().toISOString();
        await adminClient.from("workers").insert(record);
    }
}

// ─── Main onboarding handler ──────────────────────────────────────────────────
// Returns reply string, or null if not in onboarding flow (let GPT handle it).

export async function handleWhatsAppOnboarding(
    supabase: any,
    phone: string,
    message: string,
    workerRecord: any,
    detectedLanguage: string
): Promise<string | null> {
    // Only handle unregistered/incomplete users
    if (workerRecord?.onboarding_completed) return null;

    const state = await getOnboardingState(supabase, phone);
    const lang = state?.language || detectedLanguage || "en";

    // ── No state yet: only offer onboarding when the user explicitly asks to fill it on WhatsApp ──
    if (!state) {
        if (shouldStartWhatsAppOnboarding(message)) {
            await saveOnboardingState(supabase, phone, "ask_start", {}, detectedLanguage);
            return getQ("ask_start", detectedLanguage || "en");
        }
        return null; // Let GPT handle normal questions
    }

    const collected = { ...state.collected_data };
    const step = state.current_step;
    const lowerMsg = message.toLowerCase().trim();

    // ── Intercept: "connect me with a person" / human agent request ──
    const wantsHuman = /connect.*(person|human|agent|someone)|talk.*(person|human|real|agent)|speak.*(person|human|someone|agent)|real person|operator|customer service|live (agent|chat|person)|human (agent|support|help)|want.*(person|human)|need.*(person|human)|razgovaraj.*(osob|čovek|agent)|poveži.*(osob|čovek)|živa osoba|pravi čovek|personne|persona|kişi|ব্যক্তি|व्यक्ति|orang|người|人/i.test(lowerMsg);
    if (wantsHuman) {
        // Use GPT to generate response in ANY language the user is writing in
        const apiKey = process.env.OPENAI_API_KEY || "";
        try {
            const humanReply = await callOpenAIResponseText(apiKey, {
                model: WHATSAPP_RESPONSE_MODEL,
                instructions: `You are a friendly WhatsApp assistant for Workers United. The user wants to talk to a human/real person. You MUST reply in ${lang} (the user's language). Your response must:
1. Acknowledge their request warmly
2. Explain that the option to talk to a human is not available right now
3. Say that YOU are here to help and you are getting smarter every day because your team is constantly upgrading you
4. Encourage them to try again tomorrow if something doesn't work today — you might surprise them!
5. Ask what you can help them with
6. Keep it to 2-3 sentences, warm and friendly tone
7. You may use one emoji if it feels natural`,
                input: message,
            });
            if (humanReply) return humanReply;
        } catch (e) {
            console.error("[WhatsApp] GPT human-request fallback error:", e);
        }
        // Fallback to English if GPT fails
        return "I understand you'd like to speak with a person — that option isn't available just yet, but I'm here for you and I'm getting smarter every single day! My team is constantly upgrading me. 😊 What can I help you with?";
    }

    // ── Intercept: Agent/agency identification ──
    const isAgent = /i am.*(agent|agency|recruiter)|i register.*(client|worker|people)|agency.*(register|client)|recruiter|agencij|agent.*registr|registruj.*klijent|agence|agenzia|ajans|এজেন্ট|एजेंट|agen/i.test(lowerMsg);
    if (isAgent) {
        await clearOnboardingState(supabase, phone);
        // Use GPT to generate response in ANY language the user is writing in
        const apiKey = process.env.OPENAI_API_KEY || "";
        try {
            const agentReply = await callOpenAIResponseText(apiKey, {
                model: WHATSAPP_RESPONSE_MODEL,
                instructions: `You are a friendly WhatsApp assistant for Workers United. The user has identified themselves as an agent/agency/recruiter who registers workers. You MUST reply in ${lang} (the user's language). Your response must:
1. Welcome them warmly as an agency partner
2. Explain they can register as an agency at workersunited.eu/signup
3. Tell them they can manage all their workers' profiles through the agency dashboard on the website
4. Say it's much easier to handle multiple workers from the website dashboard
5. Offer to help with any questions
6. Keep it to 2-3 sentences, professional but warm tone
7. You may use one emoji if it feels natural`,
                input: message,
            });
            if (agentReply) return agentReply;
        } catch (e) {
            console.error("[WhatsApp] GPT agent-detection fallback error:", e);
        }
        // Fallback to English if GPT fails
        return "Welcome! You can register as an agency at workersunited.eu/signup and manage all your workers' profiles through your agency dashboard. If you have any questions, I'm here to help! 🤝";
    }

    // ── ask_start ──
    if (step === "ask_start") {
        if (isYes(message)) {
            await saveOnboardingState(supabase, phone, "full_name", {}, lang);
            return getQ("full_name", lang);
        }
        if (isNo(message)) {
            await clearOnboardingState(supabase, phone);
            const lk = getLangKey(lang);
            const msgs: Record<LangKey, string> = {
                en: "No problem! You can fill in your profile at workersunited.eu/profile/worker whenever you're ready. I'm here if you have questions.",
                sr: "Nema problema! Profil možete popuniti na workersunited.eu/profile/worker kada budete spremni. Tu sam ako imate pitanja.",
                hi: "कोई बात नहीं! आप workersunited.eu/profile/worker पर जाकर अपना प्रोफ़ाइल भर सकते हैं। कोई सवाल हो तो बताएं।",
                ar: "لا بأس! يمكنك ملء ملفك الشخصي على workersunited.eu/profile/worker متى كنت مستعدًا.",
                fr: "Pas de problème! Vous pouvez remplir votre profil sur workersunited.eu/profile/worker quand vous êtes prêt.",
                pt: "Sem problema! Você pode preencher seu perfil em workersunited.eu/profile/worker quando estiver pronto.",
            };
            return msgs[lk];
        }
        await clearOnboardingState(supabase, phone);
        return null; // Let GPT handle anything except explicit yes/no
    }

    // ── full_name ──
    if (step === "full_name") {
        collected.full_name = message.trim();
        await saveOnboardingState(supabase, phone, "gender", collected, lang);
        return getQ("gender", lang);
    }

    // ── gender ──
    if (step === "gender") {
        collected.gender = parseGender(message);
        await saveOnboardingState(supabase, phone, "marital_status", collected, lang);
        return getQ("marital_status", lang);
    }

    // ── marital_status ──
    if (step === "marital_status") {
        collected.marital_status = parseMaritalStatus(message);
        await saveOnboardingState(supabase, phone, "date_of_birth", collected, lang);
        return getQ("date_of_birth", lang);
    }

    // ── date_of_birth ──
    if (step === "date_of_birth") {
        collected.date_of_birth = message.trim();
        await saveOnboardingState(supabase, phone, "nationality", collected, lang);
        return getQ("nationality", lang);
    }

    // ── nationality ──
    if (step === "nationality") {
        collected.nationality = message.trim();
        await saveOnboardingState(supabase, phone, "birth_country", collected, lang);
        return getQ("birth_country", lang);
    }

    // ── birth_country ──
    if (step === "birth_country") {
        collected.birth_country = message.trim();
        await saveOnboardingState(supabase, phone, "birth_city", collected, lang);
        return getQ("birth_city", lang);
    }

    // ── birth_city ──
    if (step === "birth_city") {
        collected.birth_city = message.trim();
        await saveOnboardingState(supabase, phone, "citizenship", collected, lang);
        return getQ("citizenship", lang);
    }

    // ── citizenship ──
    if (step === "citizenship") {
        collected.citizenship = message.trim();
        await saveOnboardingState(supabase, phone, "father_name", collected, lang);
        return getQ("father_name", lang);
    }

    // ── father_name (optional) ──
    if (step === "father_name") {
        if (!isSkip(message)) collected.father_name = message.trim();
        await saveOnboardingState(supabase, phone, "mother_name", collected, lang);
        return getQ("mother_name", lang);
    }

    // ── mother_name (optional) ──
    if (step === "mother_name") {
        if (!isSkip(message)) collected.mother_name = message.trim();
        await saveOnboardingState(supabase, phone, "current_country", collected, lang);
        return getQ("current_country", lang);
    }

    // ── current_country ──
    if (step === "current_country") {
        collected.current_country = message.trim();
        await saveOnboardingState(supabase, phone, "address", collected, lang);
        return getQ("address", lang);
    }

    // ── address (optional) ──
    if (step === "address") {
        if (!isSkip(message)) collected.address = message.trim();
        await saveOnboardingState(supabase, phone, "lives_abroad", collected, lang);
        return getQ("lives_abroad", lang);
    }

    // ── lives_abroad ──
    if (step === "lives_abroad") {
        collected.lives_abroad = isYes(message) ? "Yes" : "No";
        await saveOnboardingState(supabase, phone, "previous_visas", collected, lang);
        return getQ("previous_visas", lang);
    }

    // ── previous_visas ──
    if (step === "previous_visas") {
        collected.previous_visas = isYes(message) ? "Yes" : "No";
        await saveOnboardingState(supabase, phone, "passport_number", collected, lang);
        return getQ("passport_number", lang);
    }

    // ── passport_number ──
    if (step === "passport_number") {
        collected.passport_number = message.trim().toUpperCase();
        await saveOnboardingState(supabase, phone, "passport_issued_by", collected, lang);
        return getQ("passport_issued_by", lang);
    }

    // ── passport_issued_by ──
    if (step === "passport_issued_by") {
        collected.passport_issued_by = message.trim();
        await saveOnboardingState(supabase, phone, "passport_issue_date", collected, lang);
        return getQ("passport_issue_date", lang);
    }

    // ── passport_issue_date ──
    if (step === "passport_issue_date") {
        collected.passport_issue_date = message.trim();
        await saveOnboardingState(supabase, phone, "passport_expiry_date", collected, lang);
        return getQ("passport_expiry_date", lang);
    }

    // ── passport_expiry_date ──
    if (step === "passport_expiry_date") {
        collected.passport_expiry_date = message.trim();
        await saveOnboardingState(supabase, phone, "has_spouse", collected, lang);
        return getQ("has_spouse", lang);
    }

    // ── has_spouse ──
    if (step === "has_spouse") {
        collected.has_spouse = isYes(message) ? "Yes" : "No";
        if (collected.has_spouse === "Yes") {
            await saveOnboardingState(supabase, phone, "spouse_details", collected, lang);
            return getQ("spouse_details", lang);
        } else {
            await saveOnboardingState(supabase, phone, "has_children", collected, lang);
            return getQ("has_children", lang);
        }
    }

    // ── spouse_details ──
    if (step === "spouse_details") {
        collected.spouse_details = message.trim();
        await saveOnboardingState(supabase, phone, "has_children", collected, lang);
        return getQ("has_children", lang);
    }

    // ── has_children ──
    if (step === "has_children") {
        collected.has_children = isYes(message) ? "Yes" : "No";
        if (collected.has_children === "Yes") {
            await saveOnboardingState(supabase, phone, "children_details", collected, lang);
            return getQ("children_details", lang);
        } else {
            await saveOnboardingState(supabase, phone, "preferred_job", collected, lang);
            return getQ("preferred_job", lang);
        }
    }

    // ── children_details ──
    if (step === "children_details") {
        // Accumulate lines until user says "Done"
        const isDone = /^(done|gotovo|terminé|concluído|تم|готово)/i.test(message.trim());
        const existing = collected.children_details || "";
        if (!isDone) {
            collected.children_details = existing ? existing + "\n" + message.trim() : message.trim();
            await saveOnboardingState(supabase, phone, "children_details", collected, lang);
            // Confirm and ask for more or done
            const lk = getLangKey(lang);
            const moreMsg: Record<LangKey, string> = {
                en: "Got it! Add another child or reply *Done* when finished.",
                sr: "Primljeno! Dodajte još jedno dete ili odgovorite *Gotovo* kada završite.",
                hi: "समझ गया! एक और बच्चा जोड़ें या समाप्त होने पर *Done* लिखें।",
                ar: "تم! أضف طفلاً آخر أو اكتب *تم* عند الانتهاء.",
                fr: "Reçu! Ajoutez un autre enfant ou répondez *Terminé* quand vous avez fini.",
                pt: "Entendido! Adicione outro filho ou responda *Concluído* quando terminar.",
            };
            return moreMsg[lk];
        }
        await saveOnboardingState(supabase, phone, "preferred_job", collected, lang);
        return getQ("preferred_job", lang);
    }

    // ── preferred_job ──
    if (step === "preferred_job") {
        collected.preferred_job = parseJobType(message);
        await saveOnboardingState(supabase, phone, "desired_countries", collected, lang);
        return getQ("desired_countries", lang);
    }

    // ── desired_countries ──
    if (step === "desired_countries") {
        const countries = parseDesiredCountries(message);
        collected.desired_countries = countries.join("|");
        collected.language = lang;

        // Save to workers table
        try {
            await saveWorkerFromOnboarding(supabase, phone, collected);
        } catch (e) {
            console.warn("[Onboarding] Could not save worker:", e);
        }

        await clearOnboardingState(supabase, phone);

        const name = collected.full_name?.split(" ")[0] || "";
        const lk = getLangKey(lang);
        const finalMsg: Record<LangKey, string> = {
            en: `Thank you, ${name}! 🎉 Your profile has been saved.\n\nThe last step is to register on our website and activate *Job Finder* — then we start searching for your job across Europe!\n\n👉 workersunited.eu/profile/worker\n\nWe'll also need your documents (passport photo, diploma/work certificate, biometric photo) — you can upload them on the website. If you have any questions, I'm here!`,
            sr: `Hvala, ${name}! 🎉 Vaš profil je sačuvan.\n\nPoslednji korak je da se registrujete na sajtu i aktivirate *Job Finder* — i mi počinjemo da tražimo posao za vas širom Evrope!\n\n👉 workersunited.eu/profile/worker\n\nTreba nam i vaša dokumentacija (fotografija pasoša, diploma/potvrda o radu, biometrijska fotografija) — možete je dodati na sajtu. Ako imate pitanja, tu sam!`,
            hi: `धन्यवाद, ${name}! 🎉 आपका प्रोफ़ाइल सहेज लिया गया है।\n\nअंतिम चरण है वेबसाइट पर रजिस्टर करना और *Job Finder* सक्रिय करना — फिर हम पूरे यूरोप में आपके लिए नौकरी खोजना शुरू करते हैं!\n\n👉 workersunited.eu/profile/worker`,
            ar: `شكراً، ${name}! 🎉 تم حفظ ملفك الشخصي.\n\nالخطوة الأخيرة هي التسجيل على الموقع وتفعيل *Job Finder* — ثم نبدأ في البحث عن وظيفة لك في جميع أنحاء أوروبا!\n\n👉 workersunited.eu/profile/worker`,
            fr: `Merci, ${name}! 🎉 Votre profil a été sauvegardé.\n\nLa dernière étape est de vous inscrire sur le site et d'activer *Job Finder* — puis nous commençons à chercher votre emploi dans toute l'Europe!\n\n👉 workersunited.eu/profile/worker`,
            pt: `Obrigado, ${name}! 🎉 Seu perfil foi salvo.\n\nO último passo é se registrar no site e ativar o *Job Finder* — então começamos a procurar seu emprego em toda a Europa!\n\n👉 workersunited.eu/profile/worker`,
        };
        return finalMsg[lk];
    }

    return null;
}
