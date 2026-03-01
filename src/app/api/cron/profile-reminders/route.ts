import { NextResponse } from "next/server";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";
import { getWorkerCompletion, getEmployerCompletion } from "@/lib/profile-completion";
import { getEmailTemplate } from "@/lib/email-templates";

// ─── Main cron handler ──────────────────────────────────────────
// Runs daily via Vercel cron — sends profile completion reminders + auto-deletes after 30 days
// Applies to BOTH workers and employers
// Performance: uses batch queries (~6 total) instead of per-user queries

export async function GET(request: Request) {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = createAdminClient();

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Get ALL auth users with pagination (listUsers defaults to 50/page)
        const allUsers = await getAllAuthUsers(supabase);

        const eligibleUsers = allUsers.filter((u: any) => {
            const ut = u.user_metadata?.user_type;
            if (ut === "admin") return false;
            return new Date(u.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000);
        });

        if (eligibleUsers.length === 0) {
            return NextResponse.json({ sent: 0, message: "No users to check" });
        }

        // ─── BATCH FETCH ALL DATA (6 queries total instead of ~3N) ─────────
        const [
            { data: allProfiles },
            { data: allCandidates },
            { data: allEmployers },
            { data: allDocs },
            { data: allEmails },
        ] = await Promise.all([
            supabase.from("profiles").select("id, full_name"),
            supabase.from("candidates").select("*"),
            supabase.from("employers").select("*"),
            supabase.from("candidate_documents").select("user_id, document_type, status"),
            supabase.from("email_queue").select("id, recipient_email, email_type, subject, created_at")
                .in("email_type", ["profile_reminder", "profile_warning"]),
        ]);

        // Build lookup maps for O(1) access
        const profileMap = new Map((allProfiles || []).map(p => [p.id, p]));
        const candidateMap = new Map((allCandidates || []).map(c => [c.profile_id, c]));
        const employerMap = new Map((allEmployers || []).map(e => [e.profile_id, e]));
        const docsByUser = new Map<string, typeof allDocs>();
        for (const d of allDocs || []) {
            if (!docsByUser.has(d.user_id)) docsByUser.set(d.user_id, []);
            docsByUser.get(d.user_id)!.push(d);
        }

        // Build email dedup sets
        const recentReminders = new Set<string>(); // emails sent <24h ago
        const warningSubjects = new Set<string>();  // "email|subject" combos already sent
        for (const e of allEmails || []) {
            if (e.email_type === "profile_reminder" && e.created_at > oneDayAgo) {
                recentReminders.add(e.recipient_email);
            }
            if (e.email_type === "profile_warning") {
                warningSubjects.add(`${e.recipient_email}|${e.subject}`);
            }
        }

        // ─── PROCESS EACH USER (no DB queries in this loop) ───────────────
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

            const accountAgeDays = Math.floor(
                (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );

            const profileData = profileMap.get(userId) || null;

            let missingItems: string[];

            if (isEmployer) {
                const employer = employerMap.get(userId) || null;
                const result = getEmployerCompletion({ employer });
                missingItems = result.missingFields;
            } else {
                const candidate = candidateMap.get(userId) || null;
                const docs = docsByUser.get(userId) || [];

                // NEVER delete paid workers or workers with accepted offers
                if (candidate?.status === "IN_QUEUE" || candidate?.status === "OFFER_PENDING") {
                    continue;
                }

                const result = getWorkerCompletion({
                    profile: profileData,
                    candidate,
                    documents: docs as { document_type: string }[]
                });
                missingItems = result.missingFields;
            }

            // Profile is complete — skip
            if (missingItems.length === 0) continue;

            const firstName = fullName?.split(" ")[0] || "there";
            const todoList = missingItems.map(item => `<li style="padding: 6px 0;">${item}</li>`).join("");

            // ========== DAY 30+: DELETE ACCOUNT ==========
            if (accountAgeDays >= DELETE_AFTER_DAYS) {
                // Safety flag: auto-deletion must be explicitly enabled
                if (process.env.ALLOW_AUTO_DELETION !== "true") {
                    console.warn(`[Reminders] Auto-deletion SKIPPED for ${email} (ALLOW_AUTO_DELETION not set)`);
                    skipped++;
                    continue;
                }

                const { subject, html } = getEmailTemplate("profile_deletion", {
                    name: firstName,
                    isEmployer,
                });
                await sendEmail(email, subject, html);

                // Clean up all related data before deleting auth user
                // (mirrors account/delete and admin/delete-user patterns)
                await supabase.from("candidate_documents").delete().eq("user_id", userId);
                await supabase.from("signatures").delete().eq("user_id", userId);
                await supabase.from("payments").delete().eq("user_id", userId);
                await supabase.from("email_queue").delete().eq("user_id", userId);
                await supabase.from("candidates").delete().eq("profile_id", userId);
                await supabase.from("employers").delete().eq("profile_id", userId);
                await supabase.from("profiles").delete().eq("id", userId);

                // Delete storage files
                for (const docType of ['passport', 'biometric_photo', 'diploma']) {
                    const { data: files } = await supabase.storage
                        .from("candidate-docs")
                        .list(`${userId}/${docType}`);
                    if (files && files.length > 0) {
                        const filePaths = files.map((f: any) => `${userId}/${docType}/${f.name}`);
                        await supabase.storage.from("candidate-docs").remove(filePaths);
                    }
                }

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
                const { subject: warningSubject, html } = getEmailTemplate("profile_warning", {
                    name: firstName,
                    isEmployer,
                    daysLeft,
                    todoList,
                });

                // Check dedup from pre-fetched data (no DB query)
                if (warningSubjects.has(`${email}|${warningSubject}`)) {
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
            // Check dedup from pre-fetched data (no DB query)
            if (recentReminders.has(email)) {
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
