type PaymentReportingProfile = {
    email?: string | null;
};

const TEST_EMAIL_MARKERS = [
    "+wu-codex-",
    "@example.com",
];

const INTERNAL_EMAIL_SUFFIXES = [
    "@workersunited.eu",
];

export function isInternalOrTestEmail(email?: string | null) {
    const normalized = email?.trim().toLowerCase() || "";
    if (!normalized) {
        return false;
    }

    return TEST_EMAIL_MARKERS.some((marker) => normalized.includes(marker))
        || INTERNAL_EMAIL_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function isReportablePaymentProfile(profile?: PaymentReportingProfile | null) {
    const email = profile?.email?.trim();
    if (!email) {
        return false;
    }

    return !isInternalOrTestEmail(email);
}
