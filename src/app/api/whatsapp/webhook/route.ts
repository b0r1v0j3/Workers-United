import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { saveBrainFactsDedup } from "@/lib/brain-memory";
import {
    buildRegisteredWorkerWhatsAppReply,
    buildUnregisteredWorkerWhatsAppReply,
    buildWhatsAppAutoHandoffReply,
    detectExplicitWhatsAppLanguagePreference,
    replyMatchesExpectedWhatsAppLanguage,
    resolveWhatsAppLanguageName,
    shouldStartWhatsAppOnboarding,
} from "@/lib/whatsapp-brain";
import {
    analyzeWhatsAppConfusion,
} from "@/lib/whatsapp-quality";
import { getSupportAccessState } from "@/lib/messaging";
import {
    applyWhatsAppReplyGuardrails,
    getMediaAttachmentResponse,
} from "@/lib/whatsapp-reply-guardrails";
import {
    createWhatsAppAutoHandoff,
    loadWhatsAppBrainMemory,
    loadWhatsAppConversationHistory,
    maybeEscalateWhatsAppReplyDeliveryFailure,
} from "@/lib/whatsapp-conversation-helpers";
import { handleWhatsAppAdminCommand } from "@/lib/whatsapp-admin-commands";
import {
    generateEmployerWhatsAppReply,
    getEmployerWhatsAppDefaultReply,
    getEmployerWhatsAppErrorReply,
    getEmployerWhatsAppStaticReply,
    resolveEmployerWhatsAppLead,
} from "@/lib/whatsapp-employer-flow";
import {
    classifyWhatsAppIntent,
    generateWorkerWhatsAppReply,
    type WhatsAppRouterDecision,
} from "@/lib/whatsapp-worker-ai";
import { getWhatsAppFallbackResponse } from "@/lib/whatsapp-fallback";
import { persistWhatsAppDeliveryStatuses } from "@/lib/whatsapp-status-events";
import {
    attachInboundWhatsAppMessageUser,
    extractWhatsAppMessageContent,
    isTextLikeWhatsAppMessage,
    normalizeWhatsAppPhone,
    recordInboundWhatsAppMessage,
} from "@/lib/whatsapp-inbound-events";
import { resolveWhatsAppWorkerIdentity } from "@/lib/whatsapp-identity";
import { callOpenAIResponseText } from "@/lib/openai-response-text";
import crypto from "crypto";

// ─── Meta Cloud API Webhook ─────────────────────────────────────────────────
// Handles:
// 1. GET  — Webhook verification (hub.challenge)
// 2. POST — Inbound messages + delivery status updates → intent router + OpenAI response model
//
// Architecture: User → WhatsApp → Meta → Vercel → intent router → OpenAI response model → Vercel → WhatsApp
// All AI processing happens directly via OpenAI API (no middleware).

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || process.env.CRON_SECRET || "";
const APP_SECRET = process.env.META_APP_SECRET || "";
const RESPONSE_HISTORY_LIMIT = 12;
const BRAIN_MEMORY_LIMIT = 8;
const ONBOARDING_STATE_TTL_MS = 24 * 60 * 60 * 1000;
const WHATSAPP_ROUTER_MODEL = process.env.WHATSAPP_ROUTER_MODEL || "gpt-5-mini";
const WHATSAPP_RESPONSE_MODEL = process.env.WHATSAPP_RESPONSE_MODEL || "gpt-5.4-mini";
const ADMIN_PHONES = (process.env.OWNER_PHONES || process.env.OWNER_PHONE || "+38166299444")
    .split(",")
    .map((phone) => normalizeWhatsAppPhone(phone))
    .filter(Boolean);

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
    onboarding_completed: boolean | null;
}

interface SupportAccessSnapshot {
    allowed: boolean;
    reason: string | null;
}

function isLinkedWhatsAppWorker(
    workerRecord: Pick<WhatsAppWorkerRecord, "profile_id"> | null | undefined
): workerRecord is Pick<WhatsAppWorkerRecord, "profile_id"> & { profile_id: string } {
    return typeof workerRecord?.profile_id === "string" && workerRecord.profile_id.trim().length > 0;
}

async function logDeterministicWhatsAppReply(params: {
    userId: string | null;
    phone: string;
    userMessage: string;
    botResponse: string;
    language: string;
    intent: string;
    flowKey: string;
    responseType?: "deterministic" | "auto_handoff";
}) {
    await logServerActivity(
        params.userId,
        "whatsapp_deterministic_response",
        "messaging",
        {
            phone: params.phone,
            user_message: params.userMessage.substring(0, 200),
            bot_response: params.botResponse.substring(0, 500),
            language: params.language,
            intent: params.intent,
            flow_key: params.flowKey,
            response_type: params.responseType || "deterministic",
        }
    );
}

async function sendWhatsAppRouteReply(params: {
    admin: ReturnType<typeof createAdminClient>;
    phone: string;
    text: string;
    userId?: string;
    activityUserId?: string | null;
    supportRole?: "worker" | "employer" | "agency" | null;
    failureContext: string;
}) {
    const result = await sendWhatsAppText(params.phone, params.text, params.userId);
    if (!result.success) {
        await logServerActivity(
            params.activityUserId || "anonymous",
            "whatsapp_reply_delivery_failed",
            "messaging",
            {
                phone: params.phone,
                failure_context: params.failureContext,
                error: result.error || "unknown",
                reply_preview: params.text.substring(0, 500),
                retryable: !!result.retryable,
                failure_category: result.failureCategory || "unknown",
            },
            "error"
        );
        if (result.retryable && params.activityUserId && params.supportRole) {
            try {
                await maybeEscalateWhatsAppReplyDeliveryFailure({
                    admin: params.admin,
                    profileId: params.activityUserId,
                    role: params.supportRole,
                    normalizedPhone: params.phone,
                    failureContext: params.failureContext,
                    failureCategory: result.failureCategory || "unknown",
                    replyPreview: params.text,
                });
            } catch (handoffError) {
                console.error("[WhatsApp] Failed to escalate retryable reply delivery failure:", handoffError);
            }
        }
        return {
            success: false,
            retryable: !!result.retryable,
            failureCategory: result.failureCategory || "unknown",
        };
    }

    return {
        success: true,
        retryable: false,
        failureCategory: null as null,
    };
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
        const entries = Array.isArray(body?.entry) ? body.entry : [];

        if (entries.length === 0) {
            return NextResponse.json({ status: "ok" });
        }

        const supabase = createAdminClient();
        const attachmentReplySent = new Set<string>();
        let hadProcessingError = false;

        for (const entry of entries) {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];

            for (const change of changes) {
                const value = change?.value;
                if (!value) {
                    continue;
                }

                // ─── Handle delivery status updates (keep locally) ──────────────
                try {
                    await persistWhatsAppDeliveryStatuses(supabase, value.statuses);
                } catch (statusError) {
                    hadProcessingError = true;
                    console.error("[WhatsApp Webhook] Failed to persist delivery statuses:", statusError);
                }

                // ─── Handle incoming messages ───────────────────────────────────
                if (!value.messages || value.messages.length === 0) {
                    continue;
                }

                for (const message of value.messages) {
                    const phoneNumber = message.from;
                    const messageType = message.type;
                    const wamid = message.id;
                    const content = extractWhatsAppMessageContent(message);
                    const normalizedPhone = normalizeWhatsAppPhone(phoneNumber);

                    if (!normalizedPhone || !wamid) {
                        hadProcessingError = true;
                        console.error("[WhatsApp Webhook] Malformed inbound message payload:", {
                            phone: phoneNumber || null,
                            normalizedPhone,
                            wamid: wamid || null,
                            messageType: messageType || null,
                        });
                        await logServerActivity(
                            "anonymous",
                            "whatsapp_webhook_message_malformed",
                            "error",
                            {
                                phone: phoneNumber || null,
                                normalized_phone: normalizedPhone || null,
                                wamid: wamid || null,
                                message_type: messageType || null,
                            },
                            "error"
                        );
                        continue;
                    }

                    try {
                        const inboundRecord = await recordInboundWhatsAppMessage(supabase, {
                            userId: null,
                            normalizedPhone,
                            messageType,
                            content,
                            wamid,
                        });
                        const isDuplicateInboundMessage = inboundRecord.duplicate;

                        const workerRecordSelect = `
                            id, profile_id, status, queue_position, preferred_job, 
                            desired_countries, refund_deadline, refund_eligible,
                            entry_fee_paid, admin_approved, queue_joined_at,
                            nationality, current_country, gender, experience_years,
                            updated_at,
                            phone, marital_status, onboarding_completed
                        `;
                        const { workerRecord, profile } = await resolveWhatsAppWorkerIdentity<
                            WhatsAppWorkerRecord,
                            { full_name?: string | null; email?: string | null; user_type?: string | null; created_at?: string | null }
                        >({
                            admin: supabase,
                            rawPhone: phoneNumber,
                            normalizedPhone,
                            workerSelect: workerRecordSelect,
                        });
                        const linkedWorkerRecord = isLinkedWhatsAppWorker(workerRecord) ? workerRecord : null;
                        const isAdmin = ADMIN_PHONES.includes(normalizedPhone);
                        const employerLead = await resolveEmployerWhatsAppLead({
                            admin: supabase,
                            normalizedPhone,
                            content,
                            isAdmin,
                            hasRegisteredWorker: !!linkedWorkerRecord,
                        });
                        const employerRecord = employerLead.employerRecord;
                        const isEmployer = employerLead.isEmployer;
                        const activityUserId = linkedWorkerRecord?.profile_id || employerRecord?.profile_id || null;
                        const supportRole = linkedWorkerRecord
                            ? "worker"
                            : employerRecord
                                ? "employer"
                                : null;

                        if (activityUserId) {
                            let attachFailed = false;
                            try {
                                const attachResult = await attachInboundWhatsAppMessageUser(supabase, {
                                    wamid,
                                    userId: activityUserId,
                                });
                                if (isDuplicateInboundMessage && attachResult.attached) {
                                    console.warn("[WhatsApp Webhook] Repaired missing inbound user identity on duplicate delivery:", {
                                        wamid,
                                        userId: activityUserId,
                                        phone: normalizedPhone,
                                    });
                                }
                            } catch (attachError) {
                                hadProcessingError = true;
                                console.error("[WhatsApp Webhook] Failed to attach inbound user identity:", attachError);
                                await logServerActivity(
                                    activityUserId || "anonymous",
                                    "whatsapp_inbound_identity_attach_failed",
                                    "messaging",
                                    {
                                        phone: normalizedPhone,
                                        wamid,
                                        error: attachError instanceof Error ? attachError.message : "unknown",
                                        duplicate_delivery: isDuplicateInboundMessage,
                                    },
                                    "error"
                                );
                                attachFailed = true;
                            }

                            if (attachFailed) {
                                continue;
                            }
                        }

                        if (isDuplicateInboundMessage) {
                            console.log(`[Webhook] Duplicate wamid ${wamid} — skipping reply`);
                            continue;
                        }

                        // Log to activity tracking
                        await logServerActivity(
                            activityUserId || "anonymous",
                            "whatsapp_message_received",
                            "messaging",
                            {
                                phone: normalizedPhone,
                                message_type: messageType,
                                content_preview: content.substring(0, 100),
                                is_registered: !!linkedWorkerRecord || !!employerRecord,
                                role: linkedWorkerRecord ? "worker" : employerRecord ? "employer" : isAdmin ? "admin" : "anonymous",
                            }
                        );

                        // ─── Admin Commands (direct brain control via WhatsApp) ───
                        if (isAdmin) {
                            const adminClient = createAdminClient();
                            const adminCommandResult = await handleWhatsAppAdminCommand({
                                admin: adminClient,
                                normalizedPhone,
                                content,
                                profileId: activityUserId,
                                sendReply: async (text) => {
                                    const replyResult = await sendWhatsAppRouteReply({
                                        admin: supabase,
                                        phone: normalizedPhone,
                                        text,
                                        userId: activityUserId || undefined,
                                        activityUserId,
                                        supportRole,
                                        failureContext: "admin_command_reply",
                                    });
                                    if (!replyResult.success && replyResult.retryable) {
                                        hadProcessingError = true;
                                    }
                                    return replyResult.success;
                                },
                            });

                            if (adminCommandResult.handled) {
                                continue;
                            }
                        }

                // ─── WhatsApp Onboarding Flow (before GPT) ───────────────
                // Detect language from router or simple heuristic
                let sharedHistoryMessages: Awaited<ReturnType<typeof loadWhatsAppConversationHistory>> | null = null;
                const ensureHistoryMessages = async () => {
                    if (sharedHistoryMessages === null) {
                        sharedHistoryMessages = await loadWhatsAppConversationHistory(
                            supabase,
                            normalizedPhone,
                            RESPONSE_HISTORY_LIMIT
                        );
                    }
                    return sharedHistoryMessages;
                };
                const latestMessageLanguage = resolveWhatsAppLanguageName(
                    content,
                    null,
                    await ensureHistoryMessages()
                );

                if (!isTextLikeWhatsAppMessage(messageType)) {
                    if (!attachmentReplySent.has(normalizedPhone)) {
                        const mediaFallbackReply = getMediaAttachmentResponse(latestMessageLanguage);
                        const mediaReplyResult = await sendWhatsAppRouteReply({
                            admin: supabase,
                            phone: normalizedPhone,
                            text: mediaFallbackReply,
                            userId: activityUserId || undefined,
                            activityUserId,
                            supportRole,
                            failureContext: "media_fallback",
                        });
                        if (!mediaReplyResult.success && mediaReplyResult.retryable) {
                            hadProcessingError = true;
                        }
                        if (mediaReplyResult.success) {
                            await logServerActivity(
                                activityUserId || "anonymous",
                                "whatsapp_media_fallback",
                                "messaging",
                                {
                                    phone: normalizedPhone,
                                    message_type: messageType,
                                    bot_response: mediaFallbackReply.substring(0, 500),
                                },
                                "warning"
                            );
                            attachmentReplySent.add(normalizedPhone);
                        }
                    }
                    continue;
                }

                // ─── Employer WhatsApp Flow ───────────────────────────────
                if (isEmployer) {
                    const OPENAI_API_KEY_EMP = process.env.OPENAI_API_KEY;
                    const employerHistory = await ensureHistoryMessages();
                    const employerLanguage = resolveWhatsAppLanguageName(content, null, employerHistory);
                    if (OPENAI_API_KEY_EMP) {
                        try {
                            const empBrainMemory = await loadWhatsAppBrainMemory(supabase, BRAIN_MEMORY_LIMIT);
                            const employerReply = await generateEmployerWhatsAppReply({
                                callResponseText: (options) => callOpenAIResponseText(OPENAI_API_KEY_EMP, options),
                                model: WHATSAPP_RESPONSE_MODEL,
                                message: content,
                                normalizedPhone,
                                employerRecord,
                                historyMessages: employerHistory,
                                brainMemory: empBrainMemory,
                                language: employerLanguage,
                            });
                            const finalEmployerReply = employerReply || getEmployerWhatsAppDefaultReply(employerLanguage);
                            const employerReplyResult = await sendWhatsAppRouteReply({
                                admin: supabase,
                                phone: normalizedPhone,
                                text: finalEmployerReply,
                                userId: activityUserId || undefined,
                                activityUserId,
                                supportRole,
                                failureContext: "employer_ai_reply",
                            });
                            if (!employerReplyResult.success && employerReplyResult.retryable) {
                                hadProcessingError = true;
                            }
                            continue;
                        } catch (empErr) {
                            console.error("[WhatsApp] Employer AI error:", empErr);
                            const fallbackEmployer = getEmployerWhatsAppErrorReply(employerLanguage);
                            const employerFallbackResult = await sendWhatsAppRouteReply({
                                admin: supabase,
                                phone: normalizedPhone,
                                text: fallbackEmployer,
                                userId: activityUserId || undefined,
                                activityUserId,
                                supportRole,
                                failureContext: "employer_error_fallback",
                            });
                            if (!employerFallbackResult.success && employerFallbackResult.retryable) {
                                hadProcessingError = true;
                            }
                            continue;
                        }
                    }
                    const staticEmployer = getEmployerWhatsAppStaticReply(employerLanguage);
                    const employerStaticResult = await sendWhatsAppRouteReply({
                        admin: supabase,
                        phone: normalizedPhone,
                        text: staticEmployer,
                        userId: activityUserId || undefined,
                        activityUserId,
                        supportRole,
                        failureContext: "employer_static_fallback",
                    });
                    if (!employerStaticResult.success && employerStaticResult.retryable) {
                        hadProcessingError = true;
                    }
                    continue;
                }

                const onboardingReply = await handleWhatsAppOnboarding(
                    supabase,
                    normalizedPhone,
                    content,
                    linkedWorkerRecord,
                    latestMessageLanguage,
                    await ensureHistoryMessages()
                );

                if (onboardingReply !== null) {
                    const onboardingReplyResult = await sendWhatsAppRouteReply({
                        admin: supabase,
                        phone: normalizedPhone,
                        text: onboardingReply,
                        userId: activityUserId || undefined,
                        activityUserId,
                        supportRole,
                        failureContext: "onboarding_reply",
                    });
                    if (!onboardingReplyResult.success && onboardingReplyResult.retryable) {
                        hadProcessingError = true;
                    }
                    continue;
                }

                // ─── Intent-routed OpenAI AI Brain ───────────────────────
                let aiResponse: string | null = null;
                let routerDecision: WhatsAppRouterDecision | null = null;
                let deterministicReplyFlowKey: string | null = null;
                let responseType: "gpt" | "fallback" | "deterministic" | "auto_handoff" = "fallback";
                let historyMessages: Awaited<ReturnType<typeof loadWhatsAppConversationHistory>> = [];
                let brainMemory: Awaited<ReturnType<typeof loadWhatsAppBrainMemory>> = [];
                let businessFacts = "";
                let supportAccess: SupportAccessSnapshot | null = null;
                const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

                if (OPENAI_API_KEY) {
                    try {
                        [historyMessages, brainMemory, businessFacts, supportAccess] = await Promise.all([
                            sharedHistoryMessages
                                ? Promise.resolve(sharedHistoryMessages)
                                : loadWhatsAppConversationHistory(supabase, normalizedPhone, RESPONSE_HISTORY_LIMIT),
                            loadWhatsAppBrainMemory(supabase, BRAIN_MEMORY_LIMIT),
                            (async () => {
                                try {
                                    const { getBusinessFactsForAI } = await import("@/lib/platform-config");
                                    return await getBusinessFactsForAI();
                                } catch {
                                    return "";
                                }
                            })(),
                            linkedWorkerRecord?.profile_id
                                ? getSupportAccessState(supabase, linkedWorkerRecord.profile_id, "worker")
                                : Promise.resolve(null as SupportAccessSnapshot | null),
                        ]);

                        routerDecision = await classifyWhatsAppIntent({
                            callResponseText: (options) => callOpenAIResponseText(OPENAI_API_KEY, options),
                            model: WHATSAPP_ROUTER_MODEL,
                            message: content,
                            normalizedPhone,
                            workerRecord: linkedWorkerRecord,
                            profile,
                            historyMessages,
                        });
                        routerDecision.language = resolveWhatsAppLanguageName(content, routerDecision.language, historyMessages);

                        await logServerActivity(
                            activityUserId || "anonymous",
                            "whatsapp_router_decision",
                            "messaging",
                            {
                                phone: normalizedPhone,
                                intent: routerDecision.intent,
                                language: routerDecision.language,
                                confidence: routerDecision.confidence,
                                reason: routerDecision.reason,
                                model: WHATSAPP_ROUTER_MODEL,
                            }
                        );

                        const deterministicUnregisteredReply = !linkedWorkerRecord && !isEmployer && !isAdmin
                            ? buildUnregisteredWorkerWhatsAppReply({
                                message: content,
                                language: routerDecision.language,
                                intent: routerDecision.intent,
                                historyMessages,
                                isFirstContact: historyMessages.length === 0,
                            })
                            : null;

                        const deterministicRegisteredReply = linkedWorkerRecord && !isEmployer && !isAdmin
                            ? buildRegisteredWorkerWhatsAppReply({
                                message: content,
                                language: routerDecision.language,
                                intent: routerDecision.intent,
                                historyMessages,
                                workerStatus: linkedWorkerRecord.status,
                                entryFeePaid: linkedWorkerRecord.entry_fee_paid,
                                adminApproved: linkedWorkerRecord.admin_approved,
                                queueJoinedAt: linkedWorkerRecord.queue_joined_at,
                                hasSupportAccess: !!supportAccess?.allowed,
                            })
                            : null;

                        const confusionAnalysis = linkedWorkerRecord && supportAccess?.allowed
                            ? analyzeWhatsAppConfusion(historyMessages.map((entry) => ({
                                direction: entry.direction,
                                content: entry.content,
                                created_at: entry.created_at,
                                status: entry.status,
                                message_type: entry.message_type,
                                template_name: entry.template_name,
                            })))
                            : null;

                        if (confusionAnalysis?.triggered && linkedWorkerRecord?.profile_id) {
                            await createWhatsAppAutoHandoff({
                                admin: supabase,
                                profileId: linkedWorkerRecord.profile_id,
                                normalizedPhone,
                                latestMessage: content,
                                language: routerDecision.language,
                                reason: confusionAnalysis.reason || "support_loop",
                                snippets: confusionAnalysis.snippets,
                            });
                            aiResponse = buildWhatsAppAutoHandoffReply({
                                language: routerDecision.language,
                                hasSupportAccess: true,
                            });
                            deterministicReplyFlowKey = `auto_handoff_${confusionAnalysis.reason || "support_loop"}`;
                            responseType = "auto_handoff";
                        } else if (deterministicUnregisteredReply) {
                            aiResponse = deterministicUnregisteredReply;
                            deterministicReplyFlowKey = `unregistered_${routerDecision.intent}`;
                            responseType = "deterministic";
                        } else if (deterministicRegisteredReply) {
                            aiResponse = deterministicRegisteredReply;
                            deterministicReplyFlowKey = `registered_${routerDecision.intent}`;
                            responseType = "deterministic";
                        } else {
                            aiResponse = await generateWorkerWhatsAppReply({
                                callResponseText: (options) => callOpenAIResponseText(OPENAI_API_KEY, options),
                                model: WHATSAPP_RESPONSE_MODEL,
                                message: content,
                                normalizedPhone,
                                workerRecord: linkedWorkerRecord,
                                profile,
                                isAdmin,
                                businessFacts,
                                brainMemory,
                                historyMessages,
                                routerDecision,
                            });
                            responseType = "gpt";
                        }

                        console.log(
                            `[WhatsApp] 🧠 ${WHATSAPP_RESPONSE_MODEL} (${routerDecision.intent}) response:`,
                            aiResponse?.substring(0, 200)
                        );
                    } catch (aiError) {
                        console.error("[WhatsApp] OpenAI error:", aiError);
                        await logServerActivity(
                            activityUserId || "anonymous",
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
                const effectiveReplyLanguage = routerDecision?.language || latestMessageLanguage;
                const guardrailResult = applyWhatsAppReplyGuardrails({
                    responseText: cleanResponse,
                    language: effectiveReplyLanguage,
                    workerRecord: linkedWorkerRecord,
                });
                const replyText = guardrailResult.text || await getWhatsAppFallbackResponse(
                    content,
                    linkedWorkerRecord,
                    profile,
                    effectiveReplyLanguage,
                    historyMessages
                );
                const finalReplyText = replyText && !replyMatchesExpectedWhatsAppLanguage(effectiveReplyLanguage, replyText)
                    ? await getWhatsAppFallbackResponse(content, linkedWorkerRecord, profile, effectiveReplyLanguage, historyMessages)
                    : replyText;

                    if (finalReplyText) {
                        const replyResult = await sendWhatsAppRouteReply({
                            admin: supabase,
                            phone: normalizedPhone,
                            text: finalReplyText,
                            userId: activityUserId || undefined,
                            activityUserId,
                            supportRole,
                            failureContext: aiResponse ? "ai_reply" : "fallback_reply",
                        });
                        if (!replyResult.success) {
                            if (replyResult.retryable) {
                                hadProcessingError = true;
                            }
                            continue;
                        }

                        if (responseType === "deterministic" || responseType === "auto_handoff") {
                            await logDeterministicWhatsAppReply({
                                userId: activityUserId,
                                phone: normalizedPhone,
                                userMessage: content,
                                botResponse: finalReplyText,
                                language: effectiveReplyLanguage,
                                intent: routerDecision?.intent || "general",
                                flowKey: deterministicReplyFlowKey || "deterministic",
                                responseType,
                            });
                        } else {
                            await logServerActivity(
                                activityUserId || "anonymous",
                                aiResponse ? "whatsapp_gpt_response" : "whatsapp_fallback_response",
                                "messaging",
                                {
                                    phone: normalizedPhone,
                                    user_message: content.substring(0, 200),
                                    bot_response: finalReplyText.substring(0, 500),
                                    response_type: aiResponse
                                        ? (guardrailResult.triggered ? "gpt_guarded" : (finalReplyText !== replyText ? "gpt_language_fallback" : "gpt"))
                                        : "fallback",
                                    model: aiResponse ? WHATSAPP_RESPONSE_MODEL : "fallback",
                                    guardrail_reason: guardrailResult.reason,
                                    expected_language: effectiveReplyLanguage,
                                    language_forced_to_fallback: finalReplyText !== replyText,
                                }
                            );
                        }
                    }
                    } catch (messageError) {
                        hadProcessingError = true;
                        console.error("[WhatsApp Webhook] Failed to process inbound message:", {
                            phone: normalizedPhone,
                            wamid,
                            error: messageError,
                        });
                        await logServerActivity(
                            "anonymous",
                            "whatsapp_webhook_message_failed",
                            "error",
                            {
                                phone: normalizedPhone,
                                wamid,
                                message_type: messageType,
                                content_preview: content.substring(0, 120),
                                error: messageError instanceof Error ? messageError.message : "unknown",
                            },
                            "error"
                        );
                    }
                }
            }
        }

        if (hadProcessingError) {
            return NextResponse.json({ status: "partial_failure" }, { status: 500 });
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("[WhatsApp Webhook] Error:", error);
        return NextResponse.json({ status: "error" }, { status: 500 });
    }
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
    updated_at?: string | null;
}

// ─── Translations ─────────────────────────────────────────────────────────────
// Keys: en, sr, hi, ar, fr, pt
type LangKey = "en" | "sr" | "hi" | "ar" | "fr" | "pt";

const T: Record<string, Record<LangKey, string>> = {
    ask_start: {
        en: "Would you like to fill in your worker profile right here on WhatsApp? I'll guide you step by step — it only takes a few minutes. Reply *Yes* to start, or *No* to do it on the website.",
        sr: "Želite li da popunite radnički profil odmah ovde na WhatsApp-u? Vodiću vas korak po korak — traje samo nekoliko minuta. Odgovorite *Da* da počnete, ili *Ne* ako želite na sajtu.",
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
    return /^(yes|da|da!|yep|sure|ok|okay|haan|ha|نعم|oui|sim|ja|ano|oo|हाँ|हां)/.test(l);
}

function isNo(msg: string): boolean {
    const l = msg.toLowerCase().trim();
    return /^(no|ne|nope|nahi|la|non|não|nein|hindi|नहीं|لا)/.test(l);
}

function parseYesNoAnswer(msg: string): "yes" | "no" | null {
    if (isYes(msg)) {
        return "yes";
    }

    if (isNo(msg)) {
        return "no";
    }

    return null;
}

function isSkip(msg: string): boolean {
    const l = msg.toLowerCase().trim();
    return /^(skip|preskoči|preskoci|pular|passer|تخطي|छोड़|skip)/.test(l);
}

function isCancelOnboarding(msg: string): boolean {
    const l = msg.toLowerCase().trim();
    return /^(cancel|stop|exit|quit|start over|restart|reset|otkaži|otkazi|prekini|izađi|izadji|odustani|ispočetka|ispocetka|annuler|arr[êe]ter|recommencer|cancelar|parar|reiniciar|إلغاء|الغاء|توقف|ابدأ من جديد|cancel karo|band karo|ruk jao|restart karo|शुरू से|रद्द)/.test(l);
}

function getOnboardingCancelledReply(language: string): string {
    const lk = getLangKey(language);
    const messages: Record<LangKey, string> = {
        en: "No problem — I stopped the WhatsApp profile flow. If you want to continue later, say that you want to fill in your profile on WhatsApp, or use workersunited.eu/profile/worker.",
        sr: "Nema problema — zaustavio sam popunjavanje profila preko WhatsApp-a. Ako želite kasnije da nastavite, recite da želite da popunite profil na WhatsApp-u ili koristite workersunited.eu/profile/worker.",
        hi: "कोई बात नहीं — मैंने WhatsApp profile flow रोक दिया है। अगर बाद में जारी रखना हो, तो लिखें कि आप WhatsApp पर profile भरना चाहते हैं, या workersunited.eu/profile/worker खोलें।",
        ar: "لا مشكلة — أوقفتُ تعبئة الملف عبر WhatsApp. إذا أردت المتابعة لاحقًا، أخبرني أنك تريد ملء الملف على WhatsApp أو استخدم workersunited.eu/profile/worker.",
        fr: "Pas de problème — j’ai arrêté le remplissage du profil sur WhatsApp. Si vous voulez continuer plus tard, dites que vous voulez remplir votre profil sur WhatsApp ou utilisez workersunited.eu/profile/worker.",
        pt: "Sem problema — parei o preenchimento do perfil pelo WhatsApp. Se quiser continuar depois, diga que quer preencher o perfil no WhatsApp ou use workersunited.eu/profile/worker.",
    };
    return messages[lk];
}

function getYesNoOnboardingReprompt(language: string, step: OnboardingStep): string {
    const lk = getLangKey(language);
    const prompts: Record<LangKey, string> = {
        en: "Please reply with Yes or No so I can continue.",
        sr: "Molim Vas odgovorite sa Da ili Ne da bih mogao da nastavim.",
        hi: "कृपया Yes या No में जवाब दें ताकि मैं आगे बढ़ सकूँ।",
        ar: "يرجى الرد بـ نعم أو لا حتى أتمكن من المتابعة.",
        fr: "Veuillez répondre par Oui ou Non pour que je puisse continuer.",
        pt: "Por favor, responda com Sim ou Não para que eu possa continuar.",
    };

    const currentQuestion = getQ(step, language);
    return `${prompts[lk]}\n\n${currentQuestion}`;
}

function getDateOnboardingReprompt(language: string, step: OnboardingStep): string {
    const lk = getLangKey(language);
    const prompts: Record<LangKey, string> = {
        en: "Please use the format DD/MM/YYYY so I can continue.",
        sr: "Molim Vas koristite format DD/MM/YYYY da bih mogao da nastavim.",
        hi: "कृपया DD/MM/YYYY format का उपयोग करें ताकि मैं आगे बढ़ सकूँ।",
        ar: "يرجى استخدام التنسيق DD/MM/YYYY حتى أتمكن من المتابعة.",
        fr: "Veuillez utiliser le format DD/MM/YYYY pour que je puisse continuer.",
        pt: "Por favor, use o formato DD/MM/YYYY para que eu possa continuar.",
    };

    const currentQuestion = getQ(step, language);
    return `${prompts[lk]}\n\n${currentQuestion}`;
}

function getOnboardingLanguageSwitchedReply(language: string, step: string): string {
    const lk = getLangKey(language);
    const currentQuestion = getQ(step, language);
    const intros: Record<LangKey, string> = {
        en: "Of course — I'll continue in English.",
        sr: "Naravno — nastaviću na srpskom.",
        hi: "ज़रूर — मैं हिंदी में जारी रखूँगा।",
        ar: "بالتأكيد — سأكمل بالعربية.",
        fr: "Bien sûr — je continue en français.",
        pt: "Claro — vou continuar em português.",
    };

    return `${intros[lk]}\n\n${currentQuestion}`;
}

function getHumanSupportFallbackReply(language: string): string {
    const lk = getLangKey(language);
    const messages: Record<LangKey, string> = {
        en: "I understand you'd like to speak with a person — that option isn't available just yet, but I'm here for you and I'm getting smarter every day. My team is constantly upgrading me. What can I help you with?",
        sr: "Razumem da želite da razgovarate sa pravom osobom — ta opcija još nije dostupna, ali ja sam tu za Vas i svakog dana sam sve bolji. Moj tim me stalno unapređuje. Kako mogu da pomognem?",
        hi: "मैं समझता हूँ कि आप किसी real person से बात करना चाहते हैं — वह विकल्प अभी उपलब्ध नहीं है, लेकिन मैं आपकी मदद के लिए यहाँ हूँ और हर दिन बेहतर हो रहा हूँ। मेरी team मुझे लगातार upgrade कर रही है। मैं कैसे मदद कर सकता हूँ?",
        ar: "أتفهم أنك تريد التحدث مع شخص حقيقي — هذا الخيار غير متاح بعد، لكنني هنا لمساعدتك وأصبح أفضل كل يوم. فريقي يطوّرني باستمرار. كيف يمكنني مساعدتك؟",
        fr: "Je comprends que vous souhaitiez parler à une vraie personne — cette option n’est pas encore disponible, mais je suis là pour vous aider et je deviens meilleur chaque jour. Mon équipe m’améliore constamment. Comment puis-je vous aider ?",
        pt: "Entendo que você queira falar com uma pessoa de verdade — essa opção ainda não está disponível, mas eu estou aqui para ajudar e fico melhor a cada dia. Minha equipe me aprimora constantemente. Como posso ajudar?",
    };
    return messages[lk];
}

function getAgencyRegistrationFallbackReply(language: string): string {
    const lk = getLangKey(language);
    const messages: Record<LangKey, string> = {
        en: "Welcome! You can register as an agency at workersunited.eu/signup and manage all your workers' profiles through your agency dashboard. If you have any questions, I'm here to help.",
        sr: "Dobro došli! Možete da se registrujete kao agencija na workersunited.eu/signup i upravljate profilima svih svojih radnika kroz agency dashboard. Ako imate pitanja, tu sam da pomognem.",
        hi: "स्वागत है! आप workersunited.eu/signup पर agency के रूप में register कर सकते हैं और अपने dashboard से सभी workers के profile manage कर सकते हैं। अगर आपके कोई सवाल हों, मैं मदद के लिए यहाँ हूँ।",
        ar: "مرحبًا بك! يمكنك التسجيل كوكالة على workersunited.eu/signup وإدارة ملفات جميع العمال من خلال لوحة الوكالة. إذا كان لديك أي سؤال فأنا هنا للمساعدة.",
        fr: "Bienvenue ! Vous pouvez vous inscrire comme agence sur workersunited.eu/signup et gérer les profils de tous vos travailleurs depuis votre tableau de bord agence. Si vous avez des questions, je suis là pour vous aider.",
        pt: "Bem-vindo! Você pode se registrar como agência em workersunited.eu/signup e gerenciar os perfis de todos os seus trabalhadores pelo painel da agência. Se tiver dúvidas, estou aqui para ajudar.",
    };
    return messages[lk];
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

    const state = data as OnboardingState | null;
    if (!state) {
        return null;
    }

    const updatedAt = state.updated_at ? Date.parse(state.updated_at) : NaN;
    const isExpired = Number.isFinite(updatedAt) && Date.now() - updatedAt > ONBOARDING_STATE_TTL_MS;
    const hasKnownStep = ONBOARDING_STEPS.includes(state.current_step);

    if (isExpired || !hasKnownStep) {
        await clearOnboardingState(supabase, phone);
        return null;
    }

    return state;
}

function isValidOnboardingDateInput(raw: string): boolean {
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (!match) {
        return false;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
        return false;
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
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

// Save collected data only when the phone already belongs to a linked worker account.
// Unregistered WhatsApp onboarding should not create ghost worker rows.
async function saveWorkerFromOnboarding(supabase: any, phone: string, data: Record<string, string>): Promise<boolean> {
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
        .select("id, profile_id")
        .eq("phone", phone)
        .single();

    if (!existing?.id || !existing.profile_id) {
        return false;
    }

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

    const { error } = await adminClient.from("workers").update(record).eq("id", existing.id);
    if (error) {
        throw error;
    }

    return true;
}

// ─── Main onboarding handler ──────────────────────────────────────────────────
// Returns reply string, or null if not in onboarding flow (let GPT handle it).

export async function handleWhatsAppOnboarding(
    supabase: any,
    phone: string,
    message: string,
    workerRecord: any,
    detectedLanguage: string,
    historyMessages: { direction?: string | null; content?: string | null }[] = []
): Promise<string | null> {
    const state = await getOnboardingState(supabase, phone);
    const seededLanguage = resolveWhatsAppLanguageName(message, detectedLanguage, historyMessages);
    const lang = state?.language || seededLanguage || detectedLanguage || "en";
    const isRegisteredWorker = Boolean(workerRecord?.profile_id);

    if (state && isCancelOnboarding(message)) {
        await clearOnboardingState(supabase, phone);
        return getOnboardingCancelledReply(lang);
    }

    if (isRegisteredWorker) {
        if (state) {
            await clearOnboardingState(supabase, phone);
        }
        return null;
    }

    if (state?.current_step === "done") {
        if (shouldStartWhatsAppOnboarding(message)) {
            await saveOnboardingState(supabase, phone, "ask_start", {}, seededLanguage || lang);
            return getQ("ask_start", seededLanguage || lang);
        }
        return null;
    }

    // ── No state yet: only offer onboarding when the user explicitly asks to fill it on WhatsApp ──
    if (!state) {
        if (shouldStartWhatsAppOnboarding(message)) {
            await saveOnboardingState(supabase, phone, "ask_start", {}, seededLanguage);
            return getQ("ask_start", seededLanguage || "en");
        }
        return null; // Let GPT handle normal questions
    }

    const collected = { ...state.collected_data };
    const step = state.current_step;
    const explicitLanguagePreference = detectExplicitWhatsAppLanguagePreference(message);

    if (explicitLanguagePreference) {
        const currentLangKey = getLangKey(lang);
        if (explicitLanguagePreference !== currentLangKey) {
            await saveOnboardingState(supabase, phone, step, collected, explicitLanguagePreference);
            return getOnboardingLanguageSwitchedReply(explicitLanguagePreference, step);
        }
    }

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
        return getHumanSupportFallbackReply(lang);
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
        return getAgencyRegistrationFallbackReply(lang);
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
        if (!isValidOnboardingDateInput(message)) {
            return getDateOnboardingReprompt(lang, step);
        }
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
        const yesNoAnswer = parseYesNoAnswer(message);
        if (!yesNoAnswer) {
            return getYesNoOnboardingReprompt(lang, step);
        }
        collected.lives_abroad = yesNoAnswer === "yes" ? "Yes" : "No";
        await saveOnboardingState(supabase, phone, "previous_visas", collected, lang);
        return getQ("previous_visas", lang);
    }

    // ── previous_visas ──
    if (step === "previous_visas") {
        const yesNoAnswer = parseYesNoAnswer(message);
        if (!yesNoAnswer) {
            return getYesNoOnboardingReprompt(lang, step);
        }
        collected.previous_visas = yesNoAnswer === "yes" ? "Yes" : "No";
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
        if (!isValidOnboardingDateInput(message)) {
            return getDateOnboardingReprompt(lang, step);
        }
        collected.passport_issue_date = message.trim();
        await saveOnboardingState(supabase, phone, "passport_expiry_date", collected, lang);
        return getQ("passport_expiry_date", lang);
    }

    // ── passport_expiry_date ──
    if (step === "passport_expiry_date") {
        if (!isValidOnboardingDateInput(message)) {
            return getDateOnboardingReprompt(lang, step);
        }
        collected.passport_expiry_date = message.trim();
        await saveOnboardingState(supabase, phone, "has_spouse", collected, lang);
        return getQ("has_spouse", lang);
    }

    // ── has_spouse ──
    if (step === "has_spouse") {
        const yesNoAnswer = parseYesNoAnswer(message);
        if (!yesNoAnswer) {
            return getYesNoOnboardingReprompt(lang, step);
        }
        collected.has_spouse = yesNoAnswer === "yes" ? "Yes" : "No";
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
        const yesNoAnswer = parseYesNoAnswer(message);
        if (!yesNoAnswer) {
            return getYesNoOnboardingReprompt(lang, step);
        }
        collected.has_children = yesNoAnswer === "yes" ? "Yes" : "No";
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

        let savedToLinkedWorker = false;
        try {
            savedToLinkedWorker = await saveWorkerFromOnboarding(supabase, phone, collected);
        } catch (e) {
            console.warn("[Onboarding] Could not save worker:", e);
        }
        if (savedToLinkedWorker) {
            await clearOnboardingState(supabase, phone);
        } else {
            await saveOnboardingState(supabase, phone, "done", collected, lang);
        }

        const name = collected.full_name?.split(" ")[0] || "";
        const lk = getLangKey(lang);
        const savedToWorkerMessage: Record<LangKey, string> = {
            en: `Thank you, ${name}! 🎉 Your profile has been saved.\n\nThe last step is to register on our website and activate *Job Finder* — then we start searching for your job across Europe!\n\n👉 workersunited.eu/profile/worker\n\nWe'll also need your documents (passport photo, biometric photo, and a final school, university, or formal vocational diploma) — you can upload them on the website. If you have any questions, I'm here!`,
            sr: `Hvala, ${name}! 🎉 Vaš profil je sačuvan.\n\nPoslednji korak je da se registrujete na sajtu i aktivirate *Job Finder* — i mi počinjemo da tražimo posao za vas širom Evrope!\n\n👉 workersunited.eu/profile/worker\n\nTreba nam i vaša dokumentacija (fotografija pasoša, biometrijska fotografija i završna školska, univerzitetska ili formalna stručna diploma) — možete je dodati na sajtu. Ako imate pitanja, tu sam!`,
            hi: `धन्यवाद, ${name}! 🎉 आपका प्रोफ़ाइल सहेज लिया गया है।\n\nअंतिम चरण है वेबसाइट पर रजिस्टर करना और *Job Finder* सक्रिय करना — फिर हम पूरे यूरोप में आपके लिए नौकरी खोजना शुरू करते हैं!\n\n👉 workersunited.eu/profile/worker`,
            ar: `شكراً، ${name}! 🎉 تم حفظ ملفك الشخصي.\n\nالخطوة الأخيرة هي التسجيل على الموقع وتفعيل *Job Finder* — ثم نبدأ في البحث عن وظيفة لك في جميع أنحاء أوروبا!\n\n👉 workersunited.eu/profile/worker`,
            fr: `Merci, ${name}! 🎉 Votre profil a été sauvegardé.\n\nLa dernière étape est de vous inscrire sur le site et d'activer *Job Finder* — puis nous commençons à chercher votre emploi dans toute l'Europe!\n\n👉 workersunited.eu/profile/worker`,
            pt: `Obrigado, ${name}! 🎉 Seu perfil foi salvo.\n\nO último passo é se registrar no site e ativar o *Job Finder* — então começamos a procurar seu emprego em toda a Europa!\n\n👉 workersunited.eu/profile/worker`,
        };
        const draftOnlyMessage: Record<LangKey, string> = {
            en: `Thank you, ${name}! 🎉 I saved your answers in this WhatsApp draft for now.\n\nYour real worker account still starts on the website, so please register and continue there:\n\n👉 workersunited.eu/profile/worker\n\nAfter that, upload your passport photo, biometric photo, and a final school, university, or formal vocational diploma on the website to continue.`,
            sr: `Hvala, ${name}! 🎉 Sačuvao sam vaše odgovore ovde u WhatsApp nacrtu za sada.\n\nVaš pravi worker nalog ipak počinje na sajtu, zato se registrujte i nastavite tamo:\n\n👉 workersunited.eu/profile/worker\n\nPosle toga dodajte fotografiju pasoša, biometrijsku fotografiju i završnu školsku, univerzitetsku ili formalnu stručnu diplomu na sajtu da biste nastavili dalje.`,
            hi: `धन्यवाद, ${name}! 🎉 मैंने आपके जवाब फिलहाल इस WhatsApp draft में सेव कर दिए हैं।\n\nलेकिन आपका असली worker account वेबसाइट पर शुरू होता है, इसलिए वहाँ register करें और वहीं आगे बढ़ें:\n\n👉 workersunited.eu/profile/worker`,
            ar: `شكراً، ${name}! 🎉 لقد حفظت إجاباتك مؤقتاً في مسودة WhatsApp هذه.\n\nلكن حساب العامل الحقيقي يبدأ على الموقع، لذلك يرجى التسجيل والمتابعة هناك:\n\n👉 workersunited.eu/profile/worker`,
            fr: `Merci, ${name}! 🎉 J’ai enregistré vos réponses pour l’instant dans ce brouillon WhatsApp.\n\nMais votre vrai compte travailleur commence sur le site, alors inscrivez-vous et continuez là-bas :\n\n👉 workersunited.eu/profile/worker`,
            pt: `Obrigado, ${name}! 🎉 Salvei suas respostas por enquanto neste rascunho do WhatsApp.\n\nMas sua conta real de worker começa no site, então registre-se e continue por lá:\n\n👉 workersunited.eu/profile/worker`,
        };
        return savedToLinkedWorker ? savedToWorkerMessage[lk] : draftOnlyMessage[lk];
    }

    return null;
}
