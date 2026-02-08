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

        // Get all auth users who are candidates (not employers/admins)
        const { data: authData } = await supabase.auth.admin.listUsers();
        const allUsers = authData?.users || [];

        const candidateUsers = allUsers.filter((u: any) => {
            const ut = u.user_metadata?.user_type;
            return ut !== "employer" && ut !== "admin";
        });

        // Only check users who signed up more than 24h ago
        const eligibleUsers = candidateUsers.filter((u: any) =>
            new Date(u.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        if (eligibleUsers.length === 0) {
            return NextResponse.json({ sent: 0, message: "No workers to check" });
        }

        let sent = 0;
        let skipped = 0;

        for (const user of eligibleUsers) {
            const userId = user.id;
            const email = user.email;
            const fullName = user.user_metadata?.full_name || "";

            if (!email) continue;

            // Get their candidate record
            const { data: candidate } = await supabase
                .from("candidates")
                .select("id, status, entry_fee_paid")
                .eq("profile_id", userId)
                .single();

            // Get their documents
            const { data: docs } = await supabase
                .from("candidate_documents")
                .select("document_type, status")
                .eq("user_id", userId);

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
            }

            if (missingItems.length === 0) continue;

            // Check if we already sent a reminder recently (within 7 days)
            const { data: recentEmail } = await supabase
                .from("email_queue")
                .select("id")
                .eq("recipient_email", email)
                .eq("email_type", "profile_reminder")
                .gt("created_at", oneDayAgo)
                .limit(1);

            if (recentEmail && recentEmail.length > 0) {
                skipped++;
                continue;
            }

            // Build the reminder email
            const firstName = fullName?.split(" ")[0] || "there";
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
                email,
                "Your Workers United profile is almost ready!",
                html
            );

            if (result.success) {
                // Track that we sent this reminder
                await supabase.from("email_queue").insert({
                    user_id: userId,
                    email_type: "profile_reminder",
                    recipient_email: email,
                    recipient_name: fullName || "Worker",
                    subject: "Your Workers United profile is almost ready!",
                    template_data: { html },
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    scheduled_for: new Date().toISOString(),
                });
                sent++;
            } else {
                console.error(`[Reminders] Failed to send to ${email}:`, result.error);
            }
        }

        console.log(`[Reminders] Sent ${sent} reminders, skipped ${skipped} (recent)`);
        return NextResponse.json({ sent, skipped, total_checked: eligibleUsers.length });
    } catch (err: any) {
        console.error("[Reminders] Error:", err);
        return NextResponse.json({ error: "Internal error", details: err.message }, { status: 500 });
    }
}
