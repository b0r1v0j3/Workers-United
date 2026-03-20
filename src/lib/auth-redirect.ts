import type { User } from "@supabase/supabase-js";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email-templates";
import { ensureEmployerRecord } from "@/lib/employers";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { claimAgencyWorkerDraft, ensureAgencyRecord, getAgencySchemaState } from "@/lib/agencies";
import { syncAuthContactFields } from "@/lib/auth-contact-sync";
import { hasKnownTypoEmailDomain, isInternalOrTestEmail } from "@/lib/reporting";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";
import { ensureWorkerProfileRecord, ensureWorkerRecord, loadCanonicalWorkerRecord } from "@/lib/workers";
import { hasQueuedOrSentWelcomeEmail } from "@/lib/welcome-notifications";

const SUPPORTED_SIGNUP_TYPES = new Set(["worker", "employer", "agency"]);
const AUTH_WELCOME_WHATSAPP_ACTION = "auth_whatsapp_welcome_sent";

interface ResolvePostAuthRedirectOptions {
    origin: string;
    user: User;
    next?: string | null;
    userTypeParam?: string | null;
    claimWorkerIdParam?: string | null;
}

function toAbsoluteHref(origin: string, href: string): string {
    if (!href) return `${origin}/profile`;
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    return href.startsWith("/") ? `${origin}${href}` : `${origin}/${href}`;
}

async function hasRecordedAuthWhatsAppWelcome(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
    const { data, error } = await adminClient
        .from("user_activity")
        .select("id")
        .eq("user_id", userId)
        .eq("category", "auth")
        .eq("action", AUTH_WELCOME_WHATSAPP_ACTION)
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return Boolean(data);
}

async function hasSentWelcomeWhatsApp(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
    if (await hasRecordedAuthWhatsAppWelcome(adminClient, userId)) {
        return true;
    }

    const { data, error } = await adminClient
        .from("whatsapp_messages")
        .select("id")
        .eq("user_id", userId)
        .eq("direction", "outbound")
        .eq("template_name", "welcome_registration")
        .in("status", ["sent", "delivered", "read"])
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return Boolean(data);
}

async function recordAuthWhatsAppWelcome(adminClient: ReturnType<typeof createAdminClient>, userId: string) {
    const { error } = await adminClient.from("user_activity").insert({
        user_id: userId,
        action: AUTH_WELCOME_WHATSAPP_ACTION,
        category: "auth",
        details: {
            channel: "whatsapp",
        },
        status: "ok",
    });

    if (error) {
        throw error;
    }
}

export async function resolvePostAuthRedirect({
    origin,
    user,
    next = null,
    userTypeParam = null,
    claimWorkerIdParam = null,
}: ResolvePostAuthRedirectOptions): Promise<string> {
    const adminClient = createAdminClient();
    let userType = user.user_metadata?.user_type;

    if (!userType && userTypeParam && SUPPORTED_SIGNUP_TYPES.has(userTypeParam)) {
        await adminClient.auth.admin.updateUserById(user.id, {
            user_metadata: {
                ...user.user_metadata,
                user_type: userTypeParam,
                claimed_worker_id: claimWorkerIdParam || user.user_metadata?.claimed_worker_id || null,
                gdpr_consent: true,
                gdpr_consent_at: new Date().toISOString(),
            },
        });
        userType = userTypeParam;
    }

    const normalizedUserType = normalizeUserType(userType);

    if (!normalizedUserType) {
        await logServerActivity(user.id, "auth_no_role", "auth", { redirect: "/auth/select-role" });
        return `${origin}/auth/select-role`;
    }

    const normalizedUserEmail = user.email?.trim().toLowerCase() || "";
    const canSendAutomatedWelcome = Boolean(normalizedUserEmail)
        && !isInternalOrTestEmail(normalizedUserEmail)
        && !hasKnownTypoEmailDomain(normalizedUserEmail);

    const existingWelcomeEmail = canSendAutomatedWelcome
        ? await hasQueuedOrSentWelcomeEmail(adminClient, user.id).catch(() => false)
        : false;

    if (canSendAutomatedWelcome && !existingWelcomeEmail) {
        queueEmail(
            adminClient,
            user.id,
            "welcome",
            normalizedUserEmail,
            user.user_metadata?.full_name || user.email?.split("@")[0] || "there",
            normalizedUserType === "worker" || normalizedUserType === "employer" || normalizedUserType === "agency"
                ? { recipientRole: normalizedUserType }
                : {}
        ).catch(() => {
            /* welcome email is best-effort */
        });
    }

    let redirectHref = `${origin}/profile`;

    if (normalizedUserType === "admin") {
        await logServerActivity(user.id, "auth_login", "auth", { role: "admin" });
        redirectHref = `${origin}/admin`;
    } else if (normalizedUserType === "employer") {
        const employerResult = await ensureEmployerRecord(adminClient, {
            userId: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name,
            companyName: user.user_metadata?.company_name,
            contactPhone: null,
            contactEmail: user.email,
        });

        if (employerResult.employer) {
            await syncAuthContactFields(adminClient, {
                userId: user.id,
                phone: employerResult.employer.contact_phone,
            }).catch((error) => {
                console.warn("[Auth Redirect] Employer auth contact sync failed:", error);
            });
        }

        await logServerActivity(user.id, "auth_login", "auth", {
            role: "employer",
            is_new: employerResult.employerCreated,
            employer_duplicates: employerResult.duplicates,
        });
        redirectHref = `${origin}/profile/employer`;
    } else if (normalizedUserType === "agency") {
        const agencySchemaState = await getAgencySchemaState(adminClient);
        if (!agencySchemaState.ready) {
            await logServerActivity(user.id, "auth_login", "auth", { role: "agency", setup_required: true });
            return `${origin}/profile/agency?setup=required`;
        }

        const agencyResult = await ensureAgencyRecord(adminClient, {
            userId: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name,
            agencyName: user.user_metadata?.company_name,
        });

        await syncAuthContactFields(adminClient, {
            userId: user.id,
            phone: agencyResult.agency?.contact_phone || null,
        }).catch((error) => {
            console.warn("[Auth Redirect] Agency auth contact sync failed:", error);
        });

        await logServerActivity(user.id, "auth_login", "auth", {
            role: "agency",
            is_new: agencyResult.agencyCreated,
        });
        redirectHref = `${origin}/profile/agency`;
    } else {
        const claimWorkerId = claimWorkerIdParam || user.user_metadata?.claimed_worker_id || null;
        const attemptedClaim = typeof claimWorkerId === "string" && claimWorkerId.trim().length > 0;
        const profileResult = await ensureWorkerProfileRecord(adminClient, {
            userId: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name,
        });

        if (profileResult.profileCreated) {
            console.log(`[Auth Redirect] Created missing profile for ${user.id}`);
        }

        let claimResult: Awaited<ReturnType<typeof claimAgencyWorkerDraft>> | null = null;

        if (attemptedClaim) {
            const agencySchemaState = await getAgencySchemaState(adminClient);
            if (agencySchemaState.ready) {
                claimResult = await claimAgencyWorkerDraft(adminClient, {
                    workerId: claimWorkerId,
                    profileId: user.id,
                    email: user.email,
                    fullName: user.user_metadata?.full_name,
                });
            }

            await adminClient.auth.admin.updateUserById(user.id, {
                user_metadata: {
                    ...user.user_metadata,
                    claimed_worker_id: null,
                },
            });
        }

        if (!attemptedClaim) {
            const workerRecordResult = await ensureWorkerRecord(adminClient, {
                userId: user.id,
                email: user.email,
                fullName: user.user_metadata?.full_name,
            });

            if (workerRecordResult.workerCreated) {
                console.log(`[Auth Redirect] Created missing worker record for ${user.id}`);
            }
        }

        const { data: workerRecordCheck } = await loadCanonicalWorkerRecord(
            adminClient,
            user.id,
            "id, profile_id, agency_id, submitted_email, phone, nationality, updated_at, entry_fee_paid, queue_joined_at, job_search_active, current_country, preferred_job, status"
        );

        await syncAuthContactFields(adminClient, {
            userId: user.id,
            phone: workerRecordCheck?.phone || null,
            fullName: user.user_metadata?.full_name || null,
        }).catch((error) => {
            console.warn("[Auth Redirect] Worker auth contact sync failed:", error);
        });

        const claimQuery = claimResult ? `?claim=${claimResult.reason}` : "";
        redirectHref = `${origin}/profile/worker${claimQuery}`;

        if (!workerRecordCheck || !workerRecordCheck.phone || !workerRecordCheck.nationality) {
            const canSendWorkerNotifications = canSendWorkerDirectNotifications({
                email: normalizedUserEmail,
                phone: workerRecordCheck?.phone || undefined,
                worker: workerRecordCheck,
                isHiddenDraftOwner: Boolean(user.user_metadata?.hidden_draft_owner),
            });

            const hasWelcomeWhatsApp = workerRecordCheck?.phone
                ? await hasSentWelcomeWhatsApp(adminClient, user.id).catch(() => false)
                : true;

            if (workerRecordCheck?.phone && canSendWorkerNotifications && !hasWelcomeWhatsApp) {
                try {
                    const { sendWelcome } = await import("@/lib/whatsapp");
                    const firstName = user.user_metadata?.full_name?.split(" ")[0] || "there";
                    const welcomeResult = await sendWelcome(workerRecordCheck.phone, firstName, user.id);
                    if (welcomeResult.success) {
                        await recordAuthWhatsAppWelcome(adminClient, user.id).catch((error) => {
                            console.warn("[Auth Redirect] Failed to persist WhatsApp welcome marker:", error);
                        });
                    } else {
                        console.warn("[Auth Redirect] WhatsApp welcome send failed:", {
                            userId: user.id,
                            phone: workerRecordCheck.phone,
                            error: welcomeResult.error || null,
                            retryable: welcomeResult.retryable ?? false,
                            failureCategory: welcomeResult.failureCategory || null,
                        });
                    }
                } catch {
                    /* WhatsApp welcome is best-effort */
                }
            }

            await logServerActivity(user.id, "auth_login", "auth", {
                role: "worker",
                is_new: true,
                redirect: "/profile/worker",
                claim_result: claimResult?.reason || null,
            });

            redirectHref = `${origin}/profile/worker${claimQuery}`;
        } else {
            await logServerActivity(user.id, "auth_login", "auth", {
                role: "worker",
                is_new: false,
                claim_result: claimResult?.reason || null,
            });
        }
    }

    return next ? toAbsoluteHref(origin, next) : redirectHref;
}
