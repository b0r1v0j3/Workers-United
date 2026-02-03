import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Webhook endpoint for incoming WhatsApp messages (from Twilio/360dialog)
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();

        // Parse message based on provider format (adjust for Twilio/360dialog)
        const phoneNumber = body.From || body.from || body.phone;
        const messageContent = body.Body || body.text?.body || body.message;

        if (!phoneNumber || !messageContent) {
            return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
        }

        // Normalize phone number (remove + and spaces)
        const normalizedPhone = phoneNumber.replace(/[\s+\-()]/g, "");

        // Find user by phone number
        const { data: candidate } = await supabase
            .from("candidates")
            .select("id, profile_id, status, queue_position, refund_deadline, refund_eligible")
            .eq("phone", normalizedPhone)
            .single();

        const { data: profile } = candidate?.profile_id
            ? await supabase
                .from("profiles")
                .select("full_name, email")
                .eq("id", candidate.profile_id)
                .single()
            : { data: null };

        // Log inbound message
        await supabase.from("whatsapp_messages").insert({
            user_id: candidate?.profile_id,
            phone_number: normalizedPhone,
            direction: "inbound",
            message_type: "text",
            content: messageContent,
            status: "delivered"
        });

        // Process message and generate response
        const response = generateBotResponse(
            messageContent.toLowerCase().trim(),
            candidate,
            profile
        );

        // Log outbound message
        await supabase.from("whatsapp_messages").insert({
            user_id: candidate?.profile_id,
            phone_number: normalizedPhone,
            direction: "outbound",
            message_type: "text",
            content: response,
            status: "pending"
        });

        // Return response (for Twilio TwiML or 360dialog format)
        return NextResponse.json({
            message: response,
            // For Twilio XML response if needed:
            // twiml: `<Response><Message>${response}</Message></Response>`
        });

    } catch (error) {
        console.error("WhatsApp webhook error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

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
            "DOCS_PENDING": `Hi ${name}! We're waiting for your documents. Please upload them in your dashboard.`,
            "DOCS_VERIFYING": `Hi ${name}! Your documents are being verified. This usually takes 24 hours.`,
            "VERIFIED": `Hi ${name}! Great news - your profile is verified! Pay $9 to enter the job queue.`,
            "IN_QUEUE": `Hi ${name}! You're active in our job search queue. We'll notify you when we find a match!`,
            "OFFER_PENDING": `Hi ${name}! You have an active job offer! Check your email and accept within 24 hours.`,
            "OFFER_ACCEPTED": `Hi ${name}! Congratulations! Your job is confirmed. We're processing your application.`,
            "REJECTED_TWICE": `Hi ${name}. Unfortunately you missed 2 job offers. Please pay $9 again to restart your search.`
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
        return `To upload or manage your documents, please visit your dashboard at our website. You'll need:\n• Passport photo\n• CV/Resume\n• Any relevant certificates`;
    }

    // Help/commands
    if (message.includes("help") || message.includes("command") || message.includes("menu")) {
        return `Hi ${name}! Here's how I can help:\n\n• "status" - Check your profile status\n• "job" - Job search updates\n• "refund" - Refund eligibility info\n• "documents" - Document upload help\n\nJust type any of these keywords!`;
    }

    // Default response
    return `Hi ${name}! I'm the Workers United assistant. Type "help" to see what I can do, or type "status" to check your application status.`;
}
