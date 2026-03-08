import { NextResponse } from "next/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email-templates";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { hasKnownTypoEmailDomain, isInternalOrTestEmail } from "@/lib/reporting";
import { normalizeWorkerPhone, pickCanonicalWorkerRecord } from "@/lib/workers";

type RecoveryStep = 1 | 2 | 3;

interface PaymentRow {
    id: string;
    profile_id: string | null;
    status: string | null;
    payment_type: string;
    stripe_checkout_session_id: string | null;
    deadline_at: string | null;
    metadata: unknown;
}

interface ProfileRow {
    id: string;
    email: string | null;
    full_name: string | null;
}

interface WorkerRow {
    id: string | null;
    profile_id: string | null;
    phone: string | null;
    updated_at: string | null;
    entry_fee_paid: boolean | null;
    job_search_active: boolean | null;
    queue_joined_at: string | null;
    status: string | null;
}

interface EmailQueueRow {
    id: string;
    user_id: string | null;
    status: string;
    created_at: string | null;
    template_data: unknown;
}

interface ActivityRow {
    user_id: string | null;
    action: string;
    created_at: string | null;
    details: unknown;
}

const FIRST_RECOVERY_AFTER_HOURS = 1;
const SECOND_RECOVERY_AFTER_HOURS = 24;
const THIRD_RECOVERY_AFTER_HOURS = 72;

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function extractStringField(value: unknown, key: string): string | null {
    const objectValue = asObject(value);
    if (!objectValue) {
        return null;
    }

    const field = objectValue[key];
    return typeof field === "string" && field.trim() ? field.trim() : null;
}

function extractNumberField(value: unknown, key: string): number | null {
    const objectValue = asObject(value);
    if (!objectValue) {
        return null;
    }

    const field = objectValue[key];
    if (typeof field === "number" && Number.isFinite(field)) {
        return field;
    }

    if (typeof field === "string") {
        const parsed = Number.parseInt(field, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function parseIsoDate(value: string | null | undefined): Date | null {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRecoveryStep(hoursSinceCheckout: number): RecoveryStep | null {
    if (hoursSinceCheckout < FIRST_RECOVERY_AFTER_HOURS) {
        return null;
    }

    if (hoursSinceCheckout < SECOND_RECOVERY_AFTER_HOURS) {
        return 1;
    }

    if (hoursSinceCheckout < THIRD_RECOVERY_AFTER_HOURS) {
        return 2;
    }

    return 3;
}

function resolveCheckoutCreatedAt(payment: PaymentRow, activities: ActivityRow[]): Date | null {
    const metadataStartedAt = parseIsoDate(extractStringField(payment.metadata, "checkout_started_at"));
    if (metadataStartedAt) {
        return metadataStartedAt;
    }

    const activityByPaymentId = activities.find((activity) =>
        activity.action === "checkout_session_created"
        && extractStringField(activity.details, "payment_id") === payment.id
    );

    if (activityByPaymentId?.created_at) {
        return parseIsoDate(activityByPaymentId.created_at);
    }

    if (payment.stripe_checkout_session_id) {
        const activityBySession = activities.find((activity) =>
            activity.action === "checkout_session_created"
            && extractStringField(activity.details, "stripe_session_id") === payment.stripe_checkout_session_id
        );

        if (activityBySession?.created_at) {
            return parseIsoDate(activityBySession.created_at);
        }
    }

    const latestCheckoutActivity = activities.find((activity) => activity.action === "checkout_session_created");
    if (latestCheckoutActivity?.created_at) {
        return parseIsoDate(latestCheckoutActivity.created_at);
    }

    const deadlineAt = parseIsoDate(payment.deadline_at);
    if (deadlineAt) {
        return new Date(deadlineAt.getTime() - THIRD_RECOVERY_AFTER_HOURS * 60 * 60 * 1000);
    }

    return null;
}

function wasRecoveryStepAlreadyQueued(emails: EmailQueueRow[], paymentId: string, step: RecoveryStep) {
    return emails.some((email) =>
        extractStringField(email.template_data, "paymentId") === paymentId
        && extractNumberField(email.template_data, "recoveryStep") === step
    );
}

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createTypedAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();

    try {
        const { data: pendingPayments, error: pendingPaymentsError } = await admin
            .from("payments")
            .select("id, profile_id, status, payment_type, stripe_checkout_session_id, deadline_at, metadata")
            .eq("payment_type", "entry_fee")
            .eq("status", "pending")
            .not("profile_id", "is", null);

        if (pendingPaymentsError) {
            throw pendingPaymentsError;
        }

        const typedPendingPayments = ((pendingPayments || []) as PaymentRow[]).filter(
            (payment) => !!payment.profile_id
        );

        if (typedPendingPayments.length === 0) {
            return NextResponse.json({
                scannedProfiles: 0,
                remindersQueued: 0,
                step1: 0,
                step2: 0,
                step3: 0,
                markedAbandoned: 0,
                skipped: 0,
            });
        }

        const profileIds = [...new Set(typedPendingPayments.map((payment) => payment.profile_id).filter(Boolean))] as string[];

        const [
            { data: profiles, error: profilesError },
            { data: workerRows, error: workerRowsError },
            { data: completedPayments, error: completedPaymentsError },
            { data: recoveryEmails, error: recoveryEmailsError },
            { data: paymentActivities, error: paymentActivitiesError },
        ] = await Promise.all([
            admin.from("profiles").select("id, email, full_name").in("id", profileIds),
            admin
                .from("worker_onboarding")
                .select("id, profile_id, phone, updated_at, entry_fee_paid, job_search_active, queue_joined_at, status")
                .in("profile_id", profileIds)
                .order("updated_at", { ascending: false }),
            admin
                .from("payments")
                .select("profile_id")
                .eq("payment_type", "entry_fee")
                .in("status", ["completed", "paid"])
                .in("profile_id", profileIds),
            admin
                .from("email_queue")
                .select("id, user_id, status, created_at, template_data")
                .eq("email_type", "checkout_recovery")
                .in("status", ["pending", "sent"])
                .in("user_id", profileIds),
            admin
                .from("user_activity")
                .select("user_id, action, created_at, details")
                .in("user_id", profileIds)
                .in("action", ["checkout_session_created", "payment_completed"])
                .order("created_at", { ascending: false }),
        ]);

        if (profilesError) throw profilesError;
        if (workerRowsError) throw workerRowsError;
        if (completedPaymentsError) throw completedPaymentsError;
        if (recoveryEmailsError) throw recoveryEmailsError;
        if (paymentActivitiesError) throw paymentActivitiesError;

        const profileMap = new Map(((profiles || []) as ProfileRow[]).map((profile) => [profile.id, profile]));
        const completedProfileIds = new Set(
            ((completedPayments || []) as Array<{ profile_id: string | null }>)
                .map((payment) => payment.profile_id)
                .filter(Boolean)
        );

        const workersByProfileId = new Map<string, WorkerRow[]>();
        for (const worker of (workerRows || []) as WorkerRow[]) {
            if (!worker.profile_id) {
                continue;
            }

            if (!workersByProfileId.has(worker.profile_id)) {
                workersByProfileId.set(worker.profile_id, []);
            }
            workersByProfileId.get(worker.profile_id)?.push(worker);
        }

        const emailsByProfileId = new Map<string, EmailQueueRow[]>();
        for (const email of (recoveryEmails || []) as EmailQueueRow[]) {
            if (!email.user_id) {
                continue;
            }

            if (!emailsByProfileId.has(email.user_id)) {
                emailsByProfileId.set(email.user_id, []);
            }
            emailsByProfileId.get(email.user_id)?.push(email);
        }

        const activitiesByProfileId = new Map<string, ActivityRow[]>();
        for (const activity of (paymentActivities || []) as ActivityRow[]) {
            if (!activity.user_id) {
                continue;
            }

            if (!activitiesByProfileId.has(activity.user_id)) {
                activitiesByProfileId.set(activity.user_id, []);
            }
            activitiesByProfileId.get(activity.user_id)?.push(activity);
        }

        const latestPendingByProfile = new Map<string, { payment: PaymentRow; checkoutCreatedAt: Date }>();

        for (const payment of typedPendingPayments) {
            const profileId = payment.profile_id;
            if (!profileId) {
                continue;
            }

            const checkoutCreatedAt = resolveCheckoutCreatedAt(payment, activitiesByProfileId.get(profileId) || []);
            if (!checkoutCreatedAt) {
                continue;
            }

            const existing = latestPendingByProfile.get(profileId);
            if (!existing || checkoutCreatedAt > existing.checkoutCreatedAt) {
                latestPendingByProfile.set(profileId, { payment, checkoutCreatedAt });
            }
        }

        let remindersQueued = 0;
        let markedAbandoned = 0;
        let skipped = 0;
        let invalidEmailSkipped = 0;
        let alreadyPaidSkipped = 0;
        let noActivitySkipped = 0;
        let failed = 0;
        let step1 = 0;
        let step2 = 0;
        let step3 = 0;

        for (const profileId of profileIds) {
            const pendingEntry = latestPendingByProfile.get(profileId);
            if (!pendingEntry) {
                noActivitySkipped++;
                continue;
            }

            const profile = profileMap.get(profileId);
            const worker = pickCanonicalWorkerRecord(workersByProfileId.get(profileId) || []);
            const email = profile?.email?.trim() || "";

            if (!email || isInternalOrTestEmail(email) || hasKnownTypoEmailDomain(email)) {
                invalidEmailSkipped++;
                continue;
            }

            const workerAlreadyActivated = !!worker?.entry_fee_paid
                || !!worker?.job_search_active
                || !!worker?.queue_joined_at;

            if (completedProfileIds.has(profileId) || workerAlreadyActivated) {
                alreadyPaidSkipped++;
                continue;
            }

            const hoursSinceCheckout = (now.getTime() - pendingEntry.checkoutCreatedAt.getTime()) / (1000 * 60 * 60);
            const recoveryStep = getRecoveryStep(hoursSinceCheckout);

            if (!recoveryStep) {
                skipped++;
                continue;
            }

            const existingRecoveryEmails = emailsByProfileId.get(profileId) || [];
            if (wasRecoveryStepAlreadyQueued(existingRecoveryEmails, pendingEntry.payment.id, recoveryStep)) {
                skipped++;
                continue;
            }

            try {
                const recipientName = profile?.full_name?.trim() || email.split("@")[0] || "Worker";
                const recipientPhone = normalizeWorkerPhone(worker?.phone);

                await queueEmail(
                    admin,
                    profileId,
                    "checkout_recovery",
                    email,
                    recipientName,
                    {
                        amount: "$9",
                        recoveryStep,
                        paymentId: pendingEntry.payment.id,
                    },
                    undefined,
                    recipientPhone || undefined
                );

                await logServerActivity(profileId, "checkout_recovery_sent", "payment", {
                    step: recoveryStep,
                    payment_id: pendingEntry.payment.id,
                    stripe_session_id: pendingEntry.payment.stripe_checkout_session_id,
                    hours_since_checkout: Math.floor(hoursSinceCheckout),
                    channel: recipientPhone ? "email+whatsapp" : "email",
                });

                remindersQueued++;

                if (recoveryStep === 1) step1++;
                if (recoveryStep === 2) step2++;
                if (recoveryStep === 3) {
                    step3++;

                    const { error: abandonError } = await admin
                        .from("payments")
                        .update({
                            status: "abandoned",
                            deadline_at: nowIso,
                        })
                        .eq("payment_type", "entry_fee")
                        .eq("status", "pending")
                        .eq("profile_id", profileId);

                    if (abandonError) {
                        throw abandonError;
                    }

                    markedAbandoned++;

                    await logServerActivity(profileId, "checkout_marked_abandoned", "payment", {
                        payment_id: pendingEntry.payment.id,
                        hours_since_checkout: Math.floor(hoursSinceCheckout),
                    }, "warning");
                }
            } catch (sendError) {
                failed++;
                if (recoveryStep === 3) {
                    const { error: abandonError } = await admin
                        .from("payments")
                        .update({
                            status: "abandoned",
                            deadline_at: nowIso,
                        })
                        .eq("payment_type", "entry_fee")
                        .eq("status", "pending")
                        .eq("profile_id", profileId);

                    if (!abandonError) {
                        markedAbandoned++;
                    }
                }

                await logServerActivity(profileId, "checkout_recovery_failed", "payment", {
                    step: recoveryStep,
                    payment_id: pendingEntry.payment.id,
                    error: sendError instanceof Error ? sendError.message : "Unknown error",
                }, "error");
            }
        }

        return NextResponse.json({
            scannedProfiles: profileIds.length,
            remindersQueued,
            step1,
            step2,
            step3,
            markedAbandoned,
            skipped,
            invalidEmailSkipped,
            alreadyPaidSkipped,
            noActivitySkipped,
            failed,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[Checkout Recovery] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
