import type { TemplateData } from "@/lib/email-templates";
import { canSendWorkerDirectNotifications, isHiddenDraftWorker } from "@/lib/worker-notification-eligibility";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu";

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

export function buildWorkerPaymentUnlockedEmailData(): TemplateData {
    return {
        subject: "Job Finder Is Now Unlocked",
        title: "Profile Approved",
        message: "Your profile has been approved by our team. Job Finder checkout is now unlocked in your dashboard, so you can activate the $9 service whenever you are ready.",
        actionText: "Open Job Finder",
        actionLink: `${BASE_URL}/profile/worker`,
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

    const email = workerProfileEmail?.trim().toLowerCase()
        || authEmail?.trim().toLowerCase()
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
