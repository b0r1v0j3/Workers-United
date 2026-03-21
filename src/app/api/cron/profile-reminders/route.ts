import { NextResponse } from "next/server";
import { hasValidCronBearerToken } from "@/lib/cron-auth";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { normalizeUserType } from "@/lib/domain";
import { getWorkerCompletion, getEmployerCompletion, getAgencyCompletion } from "@/lib/profile-completion";
import { getEmailTemplate, queueEmail } from "@/lib/email-templates";
import { isEmailDeliveryAccepted } from "@/lib/email-queue";
import { hasKnownTypoEmailDomain, isInternalOrTestEmail } from "@/lib/reporting";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { deleteUserData } from "@/lib/user-management";
import {
    getProfileRetentionState,
    PROFILE_RETENTION_ACTIVITY_CATEGORIES,
    PROFILE_RETENTION_CASE_EMAIL_TYPES,
} from "@/lib/profile-retention";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import { pickCanonicalWorkerRecord } from "@/lib/workers";

type ProfileReminderWorkerRow = {
    profile_id: string | null;
    agency_id?: string | null;
    submitted_email?: string | null;
    phone?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    entry_fee_paid?: boolean | null;
    status?: string | null;
};

// ─── Main cron handler ──────────────────────────────────────────
// Runs daily via Vercel cron — sends profile completion reminders + auto-deletes only after long inactivity
// Applies to worker, employer, and agency accounts
// Performance: uses batch queries instead of per-user queries

export async function GET(request: Request) {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get("authorization");
    if (!hasValidCronBearerToken(authHeader)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = createAdminClient();

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Get ALL auth users with pagination (listUsers defaults to 50/page)
        const allUsers = await getAllAuthUsers(supabase);

        const eligibleUsers = allUsers.filter((u: { user_metadata?: { user_type?: string }; created_at: string }) => {
            const ut = u.user_metadata?.user_type;
            if (ut === "admin") return false;
            return new Date(u.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000);
        });

        if (eligibleUsers.length === 0) {
            return NextResponse.json({ sent: 0, message: "No users to check" });
        }
        const eligibleUserIds = eligibleUsers.map((entry) => entry.id);

        // ─── BATCH FETCH ALL DATA ─────────────────────────────────────────
        const [
            { data: allProfiles },
            { data: allWorkerRecords },
            { data: allEmployers },
            { data: allAgencies },
            { data: allDocs },
            { data: allEmails },
            { data: allSignatures },
            { data: allActivity },
        ] = await Promise.all([
            supabase.from("profiles").select("id, full_name, created_at"),
            supabase.from("worker_onboarding").select("*"),
            supabase.from("employers").select("*"),
            supabase.from("agencies").select("profile_id, display_name, legal_name, contact_email, created_at, updated_at"),
            supabase.from("worker_documents").select("user_id, document_type, status, created_at, updated_at"),
            supabase.from("email_queue").select("id, user_id, recipient_email, email_type, subject, status, created_at, sent_at")
                .in("user_id", eligibleUserIds)
                .in("email_type", ["profile_reminder", "profile_warning", ...PROFILE_RETENTION_CASE_EMAIL_TYPES]),
            supabase.from("signatures").select("user_id, created_at").in("user_id", eligibleUserIds),
            supabase.from("user_activity").select("user_id, category, created_at")
                .in("user_id", eligibleUserIds)
                .in("category", [...PROFILE_RETENTION_ACTIVITY_CATEGORIES]),
        ]);

        // Build lookup maps for O(1) access
        const profileMap = new Map((allProfiles || []).map(p => [p.id, p]));
        const workerRecordGroups = new Map<string, ProfileReminderWorkerRow[]>();
        for (const workerRow of (allWorkerRecords || []) as ProfileReminderWorkerRow[]) {
            if (!workerRow.profile_id) continue;
            const current = workerRecordGroups.get(workerRow.profile_id) || [];
            current.push(workerRow);
            workerRecordGroups.set(workerRow.profile_id, current);
        }
        const workerRecordMap = new Map<string, ProfileReminderWorkerRow | null>(
            Array.from(workerRecordGroups.entries()).map(([profileId, rows]) => [profileId, pickCanonicalWorkerRecord(rows) || null])
        );
        const employerMap = new Map((allEmployers || []).map(e => [e.profile_id, e]));
        const agencyMap = new Map((allAgencies || []).map(a => [a.profile_id, a]));
        const docsByUser = new Map<string, typeof allDocs>();
        for (const d of allDocs || []) {
            if (!docsByUser.has(d.user_id)) docsByUser.set(d.user_id, []);
            docsByUser.get(d.user_id)!.push(d);
        }
        const latestSignatureByUser = new Map<string, string>();
        for (const signature of allSignatures || []) {
            if (!signature.user_id || !signature.created_at) continue;
            const previous = latestSignatureByUser.get(signature.user_id);
            if (!previous || new Date(signature.created_at).getTime() > new Date(previous).getTime()) {
                latestSignatureByUser.set(signature.user_id, signature.created_at);
            }
        }
        const latestActivityByUser = new Map<string, string>();
        for (const activity of allActivity || []) {
            if (!activity.user_id || !activity.created_at) continue;
            const previous = latestActivityByUser.get(activity.user_id);
            if (!previous || new Date(activity.created_at).getTime() > new Date(previous).getTime()) {
                latestActivityByUser.set(activity.user_id, activity.created_at);
            }
        }
        const latestCaseEmailByUser = new Map<string, string>();

        // Build email dedup sets
        const recentReminders = new Set<string>(); // emails sent <24h ago
        const warningSubjects = new Set<string>();  // "email|subject" combos already sent
        for (const e of allEmails || []) {
            if ((e.status === "pending" || e.status === "sent") && e.email_type === "profile_reminder" && e.created_at > oneDayAgo) {
                recentReminders.add(e.recipient_email);
            }
            if ((e.status === "pending" || e.status === "sent") && e.email_type === "profile_warning") {
                warningSubjects.add(`${e.recipient_email}|${e.subject}`);
            }
            if (
                e.status === "sent"
                && e.sent_at
                && e.user_id
                && PROFILE_RETENTION_CASE_EMAIL_TYPES.includes(e.email_type as (typeof PROFILE_RETENTION_CASE_EMAIL_TYPES)[number])
            ) {
                const activityAt = e.sent_at;
                if (!activityAt) continue;
                const previous = latestCaseEmailByUser.get(e.user_id);
                if (!previous || new Date(activityAt).getTime() > new Date(previous).getTime()) {
                    latestCaseEmailByUser.set(e.user_id, activityAt);
                }
            }
        }

        // ─── PROCESS EACH USER (no DB queries in this loop) ───────────────
        let sent = 0;
        let skipped = 0;
        let warned = 0;
        let deleted = 0;

        for (const user of eligibleUsers) {
            const userId = user.id;
            const email = user.email;
            const fullName = user.user_metadata?.full_name || "";
            const userType = normalizeUserType(user.user_metadata?.user_type);
            const recipientRole = userType === "employer" || userType === "agency" ? userType : "worker";
            const isHiddenDraftOwner = Boolean(user.user_metadata?.hidden_draft_owner);

            if (!email || isHiddenDraftOwner || isInternalOrTestEmail(email) || hasKnownTypoEmailDomain(email)) {
                skipped++;
                continue;
            }

            const profileData = profileMap.get(userId) || null;
            const commonRetentionSignals = {
                authCreatedAt: user.created_at,
                profileCreatedAt: profileData?.created_at || null,
                latestSignatureAt: latestSignatureByUser.get(userId) || null,
                latestCaseEmailAt: latestCaseEmailByUser.get(userId) || null,
                latestUserActivityAt: latestActivityByUser.get(userId) || null,
            };

            let missingItems: string[];
            let retentionState;

            if (recipientRole === "employer") {
                const employer = employerMap.get(userId) || null;
                const result = getEmployerCompletion({ employer });
                missingItems = result.missingFields;
                retentionState = getProfileRetentionState({
                    ...commonRetentionSignals,
                    roleRecordCreatedAt: employer?.created_at || null,
                    roleRecordUpdatedAt: employer?.updated_at || null,
                });
            } else if (recipientRole === "agency") {
                const agency = agencyMap.get(userId) || null;
                const result = getAgencyCompletion({ agency });
                missingItems = result.missingFields;
                retentionState = getProfileRetentionState({
                    ...commonRetentionSignals,
                    roleRecordCreatedAt: agency?.created_at || null,
                    roleRecordUpdatedAt: agency?.updated_at || null,
                });
            } else {
                const workerRecord = workerRecordMap.get(userId) || null;
                const docs = docsByUser.get(userId) || [];

                if (!canSendWorkerDirectNotifications({
                    email,
                    phone: workerRecord?.phone,
                    worker: workerRecord,
                    isHiddenDraftOwner,
                })) {
                    skipped++;
                    continue;
                }

                // NEVER delete paid or post-payment worker cases.
                if (workerRecord?.entry_fee_paid || isPostEntryFeeWorkerStatus(workerRecord?.status)) {
                    continue;
                }

                const result = getWorkerCompletion({
                    profile: profileData,
                    worker: workerRecord,
                    documents: docs as { document_type: string }[]
                });
                missingItems = result.missingFields;
                const latestDocumentAt = (docs || []).reduce<string | null>((latest, document) => {
                    const candidate = document.updated_at || document.created_at || null;
                    if (!candidate) return latest;
                    if (!latest || new Date(candidate).getTime() > new Date(latest).getTime()) {
                        return candidate;
                    }
                    return latest;
                }, null);
                retentionState = getProfileRetentionState({
                    ...commonRetentionSignals,
                    roleRecordCreatedAt: workerRecord?.created_at || null,
                    roleRecordUpdatedAt: workerRecord?.updated_at || null,
                    latestDocumentAt,
                });
            }

            // Profile is complete — skip
            if (missingItems.length === 0) continue;
            if (!retentionState) continue;

            const firstName = fullName?.split(" ")[0] || "there";
            const todoList = missingItems.map(item => `<li style="padding: 6px 0;">${item}</li>`).join("");

            // ========== LONG INACTIVITY: DELETE ACCOUNT ==========
            if (retentionState.shouldDelete) {
                // Safety flag: auto-deletion must be explicitly enabled
                if (process.env.ALLOW_AUTO_DELETION !== "true") {
                    console.warn(`[Reminders] Auto-deletion SKIPPED for ${email} (ALLOW_AUTO_DELETION not set)`);
                    skipped++;
                    continue;
                }

                const deletionResult = await queueEmail(
                    supabase,
                    userId,
                    "profile_deletion",
                    email,
                    fullName || (recipientRole === "employer" ? "Employer" : recipientRole === "agency" ? "Agency" : "Worker"),
                    { recipientRole }
                );

                if (!deletionResult.sent) {
                    console.error(`[Reminders] Failed to queue/send deletion notice to ${email}:`, deletionResult.error);
                    skipped++;
                    continue;
                }

                try {
                    await deleteUserData(supabase, userId);
                    deleted++;
                } catch (deleteError) {
                    console.error(`[Reminders] Failed to delete user ${email}:`, deleteError);
                }
                continue;
            }

            // ========== WARNING DAYS: SEND ESCALATING WARNINGS ==========
            const daysLeft = retentionState.daysUntilDeletion;
            const isWarningDay = retentionState.isWarningDay;

            if (isWarningDay) {
                const { subject: warningSubject } = getEmailTemplate("profile_warning", {
                    name: firstName,
                    recipientRole,
                    daysLeft,
                    todoList,
                });

                // Check dedup from pre-fetched data (no DB query)
                if (warningSubjects.has(`${email}|${warningSubject}`)) {
                    skipped++;
                    continue;
                }

                const result = await queueEmail(
                    supabase,
                    userId,
                    "profile_warning",
                    email,
                    fullName || (recipientRole === "employer" ? "Employer" : recipientRole === "agency" ? "Agency" : "Worker"),
                    { todoList, daysLeft, recipientRole }
                );

                if (isEmailDeliveryAccepted(result)) {
                    warned++;
                } else {
                    console.error(`[Reminders] Failed to queue/send warning to ${email}:`, result.error);
                }
                continue;
            }

            // ========== NORMAL DAYS: REGULAR REMINDER ==========
            // Check dedup from pre-fetched data (no DB query)
            if (recentReminders.has(email)) {
                skipped++;
                continue;
            }

            const result = await queueEmail(
                supabase,
                userId,
                "profile_reminder",
                email,
                fullName || (recipientRole === "employer" ? "Employer" : recipientRole === "agency" ? "Agency" : "Worker"),
                { todoList, recipientRole }
            );

            if (isEmailDeliveryAccepted(result)) {
                sent++;
            } else {
                console.error(`[Reminders] Failed to queue/send reminder to ${email}:`, result.error);
            }
        }

        return NextResponse.json({ sent, warned, deleted, skipped, total_checked: eligibleUsers.length });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Reminders] Error:", message);
        return NextResponse.json({ error: "Internal error", details: message }, { status: 500 });
    }
}
