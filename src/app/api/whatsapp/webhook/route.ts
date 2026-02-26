import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";

// ─── Meta Cloud API Webhook ─────────────────────────────────────────────────
// Handles:
// 1. GET  — Webhook verification (hub.challenge)
// 2. POST — Inbound messages + delivery status updates

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || process.env.CRON_SECRET || "workers-united-whatsapp-verify";

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

        // ─── Handle delivery status updates ─────────────────────────────
        if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
                const wamid = status.id;
                const statusValue = status.status; // sent, delivered, read, failed

                if (wamid && statusValue) {
                    // Update message status in DB if we have this wamid
                    const updateData: Record<string, string> = { status: statusValue };

                    // If failed, capture error info
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
                const messageType = message.type; // text, image, document, etc.
                const wamid = message.id;
                const timestamp = message.timestamp;

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
                    .select("id, profile_id, status, queue_position, refund_deadline, refund_eligible")
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

                // Generate and send bot response (within 24h window, free-form is allowed)
                const response = generateBotResponse(
                    content.toLowerCase().trim(),
                    candidate,
                    profile
                );

                if (response) {
                    await sendWhatsAppText(normalizedPhone, response, candidate?.profile_id);
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

// ─── Bot Response Generator ─────────────────────────────────────────────────

function generateBotResponse(
    message: string,
    candidate: any,
    profile: any
): string {
    // If user not found
    if (!candidate) {
        return "Welcome to Workers United! We couldn't find your profile. Please register at our website first, then message us again from the phone number you registered with.";
    }

    const name = profile?.full_name?.split(" ")[0] || "there";

    // Status check
    if (message.includes("status") || message.includes("my status") || message.includes("profile")) {
        const statusMessages: Record<string, string> = {
            "NEW": `Hi ${name}! Your profile is registered. Please complete your documents to proceed.`,
            "PROFILE_COMPLETE": `Hi ${name}! Your profile is complete. Please wait for admin verification.`,
            "PENDING_APPROVAL": `Hi ${name}! Your profile is under review. We'll notify you once approved.`,
            "VERIFIED": `Hi ${name}! Great news — your profile is verified! Pay $9 to enter the job queue.`,
            "APPROVED": `Hi ${name}! You're approved! Pay $9 to activate your job search.`,
            "IN_QUEUE": `Hi ${name}! You're active in our job search queue. We'll notify you when we find a match!`,
            "OFFER_PENDING": `Hi ${name}! You have an active job offer! Check your email and respond within 24 hours.`,
            "OFFER_ACCEPTED": `Hi ${name}! Congratulations! Your job is confirmed. We're processing your visa application.`,
            "VISA_PROCESS_STARTED": `Hi ${name}! Your visa application is being processed. We'll keep you updated.`,
            "VISA_APPROVED": `Hi ${name}! Amazing news — your visa has been approved! We'll be in touch with next steps.`,
            "PLACED": `Hi ${name}! You've been successfully placed. Welcome to your new career!`,
            "REJECTED": `Hi ${name}. Unfortunately your profile was not approved. Please check your email for details.`,
            "REFUND_FLAGGED": `Hi ${name}. Your account has been flagged for a refund. Our team will process it shortly.`,
        };
        return statusMessages[candidate.status] || `Hi ${name}! Your current status is: ${candidate.status}`;
    }

    // Job search status
    if (message.includes("job") || message.includes("work") || message.includes("find")) {
        if (candidate.status === "IN_QUEUE") {
            return `Hi ${name}! We're actively searching for the right job for you. You'll receive a notification as soon as we find a match. Stay ready!`;
        } else if (candidate.status === "OFFER_PENDING") {
            return `You have an active job offer waiting! Check your email and accept within 24 hours or it will expire.`;
        } else if (candidate.status === "OFFER_ACCEPTED") {
            return `Your job is confirmed! We're processing your work permit application. We'll keep you updated on the progress.`;
        }
        return `Please complete your profile verification and payment first to start the job search.`;
    }

    // Refund inquiry
    if (message.includes("refund") || message.includes("money back") || message.includes("guarantee")) {
        if (!candidate.refund_eligible) {
            return `Hi ${name}. As per our policy, refund eligibility is lost after declining a job offer.`;
        }
        if (candidate.refund_deadline) {
            const deadline = new Date(candidate.refund_deadline);
            const now = new Date();
            const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysLeft > 0) {
                return `Hi ${name}! You have ${daysLeft} days remaining in your 90-day guarantee. If we don't find you a job by then, you'll receive a full refund.`;
            } else {
                return `Hi ${name}. Your 90-day period has ended. Please contact support if you haven't received your refund.`;
            }
        }
        return `The 90-day guarantee starts when you pay the $9 job search fee.`;
    }

    // Documents help
    if (message.includes("document") || message.includes("upload") || message.includes("passport")) {
        return `To upload or manage your documents, please visit your dashboard at workersunited.eu. You'll need:\n• Passport\n• Biometric photo\n• Diploma`;
    }

    // Help/commands
    if (message.includes("help") || message.includes("command") || message.includes("menu")) {
        return `Hi ${name}! Here's how I can help:\n\n• "status" — Check your profile status\n• "job" — Job search updates\n• "refund" — Refund eligibility info\n• "documents" — Document upload help\n\nJust type any of these keywords!`;
    }

    // Default response
    return `Hi ${name}! I'm the Workers United assistant. Type "help" to see what I can do, or type "status" to check your application status.`;
}
