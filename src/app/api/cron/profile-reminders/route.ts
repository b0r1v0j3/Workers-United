import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";

// Runs daily via Vercel cron — sends profile completion reminders
export async function GET(request: Request) {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const supabase = createAdminClient();

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Get worker profiles created more than 24h ago
        const { data: workerProfiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, email, created_at")
            .eq("user_type", "worker")
            .lt("created_at", oneDayAgo);

        if (profileError) {
            console.error("[Reminders] Profile query error:", profileError);
            return NextResponse.json({ error: "Database error", details: profileError.message }, { status: 500 });
        }

        if (!workerProfiles?.length) {
            return NextResponse.json({ sent: 0, message: "No workers to check" });
        }

        let sent = 0;
        let skipped = 0;

        for (const profile of workerProfiles) {
            if (!profile.email) continue;

            // Get their candidate record
            const { data: candidate } = await supabase
                .from("candidates")
                .select("id, status, entry_fee_paid")
                .eq("profile_id", profile.id)
                .single();

            // Get their documents
            const { data: docs } = await supabase
                .from("candidate_documents")
                .select("document_type, status")
                .eq("user_id", profile.id);

            // Skip users who are already in queue or have accepted offers
            if (candidate?.status === "IN_QUEUE" || candidate?.status === "OFFER_ACCEPTED") {
                continue;
            }

            // Determine what's missing
            const missingItems: string[] = [];

            if (!candidate) {
                missingItems.push("Complete your worker profile");
            } else {
                const docTypes = (docs || []).map((d: any) => d.document_type);

                if (!docTypes.includes("passport")) missingItems.push("Upload your passport");
                if (!docTypes.includes("biometric_photo")) missingItems.push("Upload a biometric photo");
                if (!docTypes.includes("diploma")) missingItems.push("Upload your diploma or certificate");

                const verifiedDocs = (docs || []).filter((d: any) => d.status === "verified");
                if (verifiedDocs.length === (docs || []).length && (docs || []).length >= 2 && !candidate.entry_fee_paid) {
                    missingItems.push("Pay the activation fee to join the queue");
                }
            }

            if (missingItems.length === 0) continue;

            // Check if we already sent a reminder recently (within 7 days)
            const { data: recentEmail } = await supabase
                .from("email_queue")
                .select("id")
                .eq("recipient_email", profile.email)
                .eq("email_type", "profile_reminder")
                .gt("created_at", oneWeekAgo)
                .limit(1);

            if (recentEmail && recentEmail.length > 0) {
                skipped++;
                continue;
            }

            // Build the reminder email
            const firstName = profile.full_name?.split(" ")[0] || "there";
            const todoList = missingItems.map(item => `<li style="padding: 6px 0;">${item}</li>`).join("");

            const html = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1b2430;">
                    <div style="background: linear-gradient(135deg, #2f6fed, #1c4dd6); padding: 24px; border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 20px;">Workers United</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">Complete your profile to get matched</p>
                    </div>
                    <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                        <p style="margin-top: 0;">Hi ${firstName},</p>
                        <p style="line-height: 1.6;">Thanks for signing up with Workers United! We noticed your profile isn't complete yet. To start receiving job opportunities, please finish these steps:</p>
                        <ul style="background: #f8fafc; padding: 16px 16px 16px 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
                            ${todoList}
                        </ul>
                        <p style="line-height: 1.6;">The sooner you complete your profile, the sooner we can match you with suitable job opportunities.</p>
                        <div style="text-align: center; margin: 24px 0;">
                            <a href="https://workersunited.eu/profile/worker/edit" 
                               style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #2f6fed, #1c4dd6); color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Complete My Profile
                            </a>
                        </div>
                    </div>
                    <div style="padding: 16px 24px; background: #f8fafc; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #6c7a89;">
                            Workers United LLC &middot; 75 E 3rd St., Sheridan, Wyoming 82801, USA<br>
                            <a href="https://workersunited.eu" style="color: #2f6fed;">workersunited.eu</a>
                        </p>
                    </div>
                </div>
            `;

            // Send the reminder email
            const result = await sendEmail(
                profile.email,
                "Your Workers United profile is almost ready!",
                html
            );

            if (result.success) {
                // Track that we sent this reminder
                await supabase.from("email_queue").insert({
                    user_id: profile.id,
                    email_type: "profile_reminder",
                    recipient_email: profile.email,
                    recipient_name: profile.full_name || "Worker",
                    subject: "Your Workers United profile is almost ready!",
                    template_data: { html },
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    scheduled_for: new Date().toISOString(),
                });
                sent++;
            } else {
                console.error(`[Reminders] Failed to send to ${profile.email}:`, result.error);
            }
        }

        console.log(`[Reminders] Sent ${sent} reminders, skipped ${skipped} (recent)`);
        return NextResponse.json({ sent, skipped, total_checked: workerProfiles.length });
    } catch (err: any) {
        console.error("[Reminders] Error:", err);
        return NextResponse.json({ error: "Internal error", details: err.message }, { status: 500 });
    }
}
