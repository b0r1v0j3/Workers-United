import type { User } from "@supabase/supabase-js";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email-templates";
import { logServerActivity } from "@/lib/activityLoggerServer";
import { claimAgencyWorkerDraft, ensureAgencyRecord, getAgencySchemaState } from "@/lib/agencies";
import { ensureWorkerProfileRecord, ensureWorkerRecord, loadCanonicalWorkerRecord } from "@/lib/workers";

const SUPPORTED_SIGNUP_TYPES = new Set(["worker", "employer", "agency"]);

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

export async function resolvePostAuthRedirect({
    origin,
    user,
    next = null,
    userTypeParam = null,
    claimWorkerIdParam = null,
}: ResolvePostAuthRedirectOptions): Promise<string> {
    if (next) {
        return toAbsoluteHref(origin, next);
    }

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

    const { data: existingWelcomeEmail } = await adminClient
        .from("email_queue")
        .select("id")
        .eq("user_id", user.id)
        .eq("email_type", "welcome")
        .limit(1);

    if (!existingWelcomeEmail || existingWelcomeEmail.length === 0) {
        queueEmail(
            adminClient,
            user.id,
            "welcome",
            user.email || "",
            user.user_metadata?.full_name || user.email?.split("@")[0] || "there"
        ).catch(() => {
            /* welcome email is best-effort */
        });
    }

    if (normalizedUserType === "admin") {
        await logServerActivity(user.id, "auth_login", "auth", { role: "admin" });
        return `${origin}/admin`;
    }

    if (normalizedUserType === "employer") {
        const { data: employer } = await adminClient
            .from("employers")
            .select("id")
            .eq("profile_id", user.id)
            .maybeSingle();

        if (!employer) {
            await adminClient.from("employers").insert({
                profile_id: user.id,
                company_name: user.user_metadata?.company_name || null,
                status: "PENDING",
            });
        }

        await logServerActivity(user.id, "auth_login", "auth", { role: "employer", is_new: !employer });
        return `${origin}/profile/employer`;
    }

    if (normalizedUserType === "agency") {
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

        await logServerActivity(user.id, "auth_login", "auth", {
            role: "agency",
            is_new: agencyResult.agencyCreated,
        });
        return `${origin}/profile/agency`;
    }

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
        "id, phone, nationality, updated_at, entry_fee_paid, queue_joined_at, job_search_active, current_country, preferred_job, status"
    );

    if (!workerRecordCheck || !workerRecordCheck.phone || !workerRecordCheck.nationality) {
        if (workerRecordCheck?.phone) {
            try {
                const { sendWelcome } = await import("@/lib/whatsapp");
                const firstName = user.user_metadata?.full_name?.split(" ")[0] || "there";
                await sendWelcome(workerRecordCheck.phone, firstName, user.id);
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

        const claimQuery = claimResult ? `?claim=${claimResult.reason}` : "";
        return `${origin}/profile/worker${claimQuery}`;
    }

    await logServerActivity(user.id, "auth_login", "auth", {
        role: "worker",
        is_new: false,
        claim_result: claimResult?.reason || null,
    });

    const claimQuery = claimResult ? `?claim=${claimResult.reason}` : "";
    return `${origin}/profile/worker${claimQuery}`;
}
