import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";
import { getWorkerCompletion, getEmployerCompletion } from "@/lib/profile-completion";
import { getEmailTemplate } from "@/lib/email-templates";

// ─── Main cron handler ──────────────────────────────────────────
// Runs daily via Vercel cron — sends profile completion reminders + auto-deletes after 30 days
// Applies to BOTH workers and employers

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

        // Get ALL auth users (except admins)
        const { data: authData } = await supabase.auth.admin.listUsers();
        const allUsers = authData?.users || [];

        const eligibleUsers = allUsers.filter((u: any) => {
            const ut = u.user_metadata?.user_type;
            // Skip admins — never delete admin accounts
            if (ut === "admin") return false;
            // Only check users who signed up more than 24h ago
            return new Date(u.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000);
        });

        if (eligibleUsers.length === 0) {
            return NextResponse.json({ sent: 0, message: "No users to check" });
        }

        let sent = 0;
        let skipped = 0;
        let warned = 0;
        let deleted = 0;

        const WARNING_DAYS = [23, 27, 29];
        const DELETE_AFTER_DAYS = 30;

        for (const user of eligibleUsers) {
            const userId = user.id;
            const email = user.email;
            const fullName = user.user_metadata?.full_name || "";
            const userType = user.user_metadata?.user_type;
            const isEmployer = userType === "employer";

            if (!email) continue;

            // Calculate account age in days
            const accountAgeDays = Math.floor(
                (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );

            // Get profile data
            const { data: profileData } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", userId)
                .single();

            let missingItems: string[];

            if (isEmployer) {
                // ── Employer: check company profile ──
                const { data: employer } = await supabase
                    .from("employers")
                    .select("*")
                    .eq("profile_id", userId)
                    .single();

                const result = getEmployerCompletion({ employer });
                missingItems = result.missingFields;
            } else {
                // ── Worker: check candidate profile + documents ──
                const { data: candidate } = await supabase
                    .from("candidates")
                    .select("*")
                    .eq("profile_id", userId)
                    .single();

                const { data: docs } = await supabase
                    .from("candidate_documents")
                    .select("document_type, status")
                    .eq("user_id", userId);

                // NEVER delete paid workers or workers with accepted offers
                if (candidate?.status === "IN_QUEUE" || candidate?.status === "OFFER_ACCEPTED") {
                    continue;
                }

                const result = getWorkerCompletion({
                    profile: profileData,
                    candidate,
                    documents: docs || []
                });
                missingItems = result.missingFields;
            }

            // Profile is complete — skip
            if (missingItems.length === 0) continue;

            const firstName = fullName?.split(" ")[0] || "there";
            const todoList = missingItems.map(item => `<li style="padding: 6px 0;">${item}</li>`).join("");

            // ========== DAY 30+: DELETE ACCOUNT ==========
            if (accountAgeDays >= DELETE_AFTER_DAYS) {

                // Send deletion notification email BEFORE deleting
                const { subject, html } = getEmailTemplate("profile_deletion", {
                    name: firstName,
                    isEmployer,
                });
                await sendEmail(email, subject, html);

                // Delete the auth user (cascades to profiles, candidates/employers, documents)
                const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
                if (deleteError) {
                    console.error(`[Reminders] Failed to delete user ${email}:`, deleteError);
                } else {
                    deleted++;
                }
                continue;
            }

            // ========== WARNING DAYS: SEND ESCALATING WARNINGS ==========
            const daysLeft = DELETE_AFTER_DAYS - accountAgeDays;
            const isWarningDay = WARNING_DAYS.includes(accountAgeDays);

            if (isWarningDay) {
                // Check if we already sent this specific warning
                const { subject: warningSubject, html } = getEmailTemplate("profile_warning", {
                    name: firstName,
                    isEmployer,
                    daysLeft,
                    todoList,
                });
                const { data: existingWarning } = await supabase
                    .from("email_queue")
                    .select("id")
                    .eq("recipient_email", email)
                    .eq("subject", warningSubject)
                    .limit(1);

                if (existingWarning && existingWarning.length > 0) {
                    skipped++;
                    continue;
                }

                const result = await sendEmail(email, warningSubject, html);

                if (result.success) {
                    await supabase.from("email_queue").insert({
                        user_id: userId,
                        email_type: "profile_warning",
                        recipient_email: email,
                        recipient_name: fullName || (isEmployer ? "Employer" : "Worker"),
                        subject: warningSubject,
                        template_data: { todoList, daysLeft, isEmployer },
                        status: "sent",
                        sent_at: new Date().toISOString(),
                        scheduled_for: new Date().toISOString(),
                    });
                    warned++;
                }
                continue;
            }

            // ========== NORMAL DAYS: REGULAR REMINDER ==========
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

            const { subject, html } = getEmailTemplate("profile_reminder", {
                name: firstName,
                isEmployer,
                todoList,
            });
            const result = await sendEmail(email, subject, html);

            if (result.success) {
                await supabase.from("email_queue").insert({
                    user_id: userId,
                    email_type: "profile_reminder",
                    recipient_email: email,
                    recipient_name: fullName || (isEmployer ? "Employer" : "Worker"),
                    subject,
                    template_data: { todoList, isEmployer },
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    scheduled_for: new Date().toISOString(),
                });
                sent++;
            } else {
                console.error(`[Reminders] Failed to send to ${email}:`, result.error);
            }
        }

        return NextResponse.json({ sent, warned, deleted, skipped, total_checked: eligibleUsers.length });
    } catch (err: any) {
        console.error("[Reminders] Error:", err);
        return NextResponse.json({ error: "Internal error", details: err.message }, { status: 500 });
    }
}
