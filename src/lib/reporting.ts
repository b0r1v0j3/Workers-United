type PaymentReportingProfile = {
    email?: string | null;
};

const COMMON_EMAIL_DOMAIN_TYPOS: Record<string, string> = {
    "gmai.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmail.con": "gmail.com",
    "yahoo.coms": "yahoo.com",
    "yahoo.con": "yahoo.com",
    "1yahoo.com": "yahoo.com",
    "1gmail.com": "gmail.com",
    "hotmail.con": "hotmail.com",
};

const TEST_EMAIL_MARKERS = [
    "+wu-codex-",
    "@example.com",
];

const INTERNAL_EMAIL_SUFFIXES = [
    "@workersunited.eu",
    "@workersunited.org",
];

export function isInternalOrTestEmail(email?: string | null) {
    const normalized = email?.trim().toLowerCase() || "";
    if (!normalized) {
        return false;
    }

    return TEST_EMAIL_MARKERS.some((marker) => normalized.includes(marker))
        || INTERNAL_EMAIL_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function hasKnownTypoEmailDomain(email?: string | null) {
    const normalized = email?.trim().toLowerCase() || "";
    if (!normalized || !normalized.includes("@")) {
        return false;
    }

    const domain = normalized.split("@")[1] || "";
    return domain in COMMON_EMAIL_DOMAIN_TYPOS;
}

export function isReportablePaymentProfile(profile?: PaymentReportingProfile | null) {
    const email = profile?.email?.trim();
    if (!email) {
        return false;
    }

    return !isInternalOrTestEmail(email) && !hasKnownTypoEmailDomain(email);
}
