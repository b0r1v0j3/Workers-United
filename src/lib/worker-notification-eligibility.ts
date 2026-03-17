import { hasKnownTypoEmailDomain, isInternalOrTestEmail } from "@/lib/reporting";

type WorkerNotificationRecord = {
    agency_id?: string | null;
    profile_id?: string | null;
    submitted_email?: string | null;
    phone?: string | null;
};

type WorkerNotificationEligibilityInput = {
    email?: string | null;
    phone?: string | null;
    worker?: WorkerNotificationRecord | null;
    isHiddenDraftOwner?: boolean;
};

function normalizeEmail(email?: string | null) {
    const normalized = email?.trim().toLowerCase() || "";
    return normalized || null;
}

function normalizePhone(phone?: string | null) {
    const normalized = phone?.replace(/[\s\-()]/g, "").trim() || "";
    return normalized || null;
}

export function canSendWorkerDirectNotifications({
    email,
    phone,
    worker,
    isHiddenDraftOwner = false,
}: WorkerNotificationEligibilityInput) {
    if (isHiddenDraftOwner) {
        return false;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return false;
    }

    if (isInternalOrTestEmail(normalizedEmail) || hasKnownTypoEmailDomain(normalizedEmail)) {
        return false;
    }

    if (worker?.agency_id && !worker?.profile_id) {
        const submittedEmail = normalizeEmail(worker.submitted_email);
        const directPhone = normalizePhone(phone || worker.phone);
        return Boolean(submittedEmail && directPhone && submittedEmail === normalizedEmail);
    }

    return true;
}
