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

const KNOWN_INVALID_ONLY_SUFFIXES = [
    "@workersunited.org",
];

const UNDELIVERABLE_EMAIL_PATTERNS = [
    "address not found",
    "account that you tried to reach does not exist",
    "domain name not found",
    "no such user",
    "user unknown",
    "recipient address rejected",
    "invalid recipient",
    "mailbox unavailable",
    "couldn't be found",
    "unable to receive mail",
    "badrcpt",
    "mx lookup",
    "nxdomain",
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

export function hasKnownInvalidOnlyEmailDomain(email?: string | null) {
    const normalized = email?.trim().toLowerCase() || "";
    if (!normalized) {
        return false;
    }

    return KNOWN_INVALID_ONLY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function getSuggestedEmailCorrection(email?: string | null) {
    const normalized = email?.trim().toLowerCase() || "";
    if (!normalized || !normalized.includes("@")) {
        return null;
    }

    const [localPart, domain] = normalized.split("@");
    const correctedDomain = COMMON_EMAIL_DOMAIN_TYPOS[domain || ""];
    if (!localPart || !correctedDomain) {
        return null;
    }

    return `${localPart}@${correctedDomain}`;
}

export function isLikelyUndeliverableEmailError(errorMessage?: string | null) {
    const normalized = errorMessage?.trim().toLowerCase() || "";
    if (!normalized) {
        return false;
    }

    return UNDELIVERABLE_EMAIL_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function isReportablePaymentProfile(profile?: PaymentReportingProfile | null) {
    const email = profile?.email?.trim();
    if (!email) {
        return false;
    }

    return !isInternalOrTestEmail(email)
        && !hasKnownTypoEmailDomain(email)
        && !hasKnownInvalidOnlyEmailDomain(email);
}
