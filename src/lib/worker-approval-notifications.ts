import type { TemplateData } from "@/lib/email-templates";
import { buildPlatformUrl, normalizePlatformWebsiteUrl } from "@/lib/platform-contact";
import { canSendWorkerDirectNotifications, isHiddenDraftWorker } from "@/lib/worker-notification-eligibility";

const BASE_URL = normalizePlatformWebsiteUrl(process.env.NEXT_PUBLIC_BASE_URL);

type WorkerApprovalNotificationWorker = {
    agency_id?: string | null;
    profile_id?: string | null;
    submitted_email?: string | null;
    phone?: string | null;
};

interface ResolveWorkerApprovalNotificationRecipientInput {
    worker?: WorkerApprovalNotificationWorker | null;
    workerProfileEmail?: string | null;
    authEmail?: string | null;
    displayName?: string | null;
}

export function buildWorkerPaymentUnlockedEmailData({ manualOverride = false }: {
    manualOverride?: boolean;
} = {}): TemplateData {
    return {
        subject: manualOverride ? "Job Finder Is Now Available" : "Job Finder Is Now Unlocked",
        title: manualOverride ? "Job Finder Unlocked" : "Profile Approved",
        message: manualOverride
            ? "Our team unlocked Job Finder checkout for your case in the dashboard. You can complete the $9 Job Finder checkout whenever you are ready, and any remaining profile or document details can still be updated from the same workspace."
            : "Your profile has been approved by our team. Job Finder checkout is now unlocked in your dashboard, so you can complete the $9 Job Finder checkout whenever you are ready.",
        actionText: "Open Job Finder",
        actionLink: buildPlatformUrl(BASE_URL, "/profile/worker"),
    };
}

export function resolveWorkerApprovalNotificationRecipient({
    worker = null,
    workerProfileEmail = null,
    authEmail = null,
    displayName = null,
}: ResolveWorkerApprovalNotificationRecipientInput) {
    if (isHiddenDraftWorker(worker)) {
        return null;
    }

    const email = authEmail?.trim().toLowerCase()
        || workerProfileEmail?.trim().toLowerCase()
        || null;

    if (!email) {
        return null;
    }

    if (!canSendWorkerDirectNotifications({
        email,
        phone: worker?.phone || undefined,
        worker,
    })) {
        return null;
    }

    return {
        email,
        name: displayName?.trim() || "there",
    };
}
