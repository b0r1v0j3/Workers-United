export const DEFAULT_PLATFORM_WEBSITE_URL = "https://workersunited.eu";
export const DEFAULT_PLATFORM_SUPPORT_EMAIL = "workers.united.eu@gmail.com";
export const DEFAULT_PLATFORM_WHATSAPP_NUMBER = "15557839521";

export interface PlatformContactInfo {
    websiteUrl: string;
    signupUrl: string;
    workerProfileUrl: string;
    workerInboxUrl: string;
    supportEmail: string;
}

export function normalizePlatformWebsiteUrl(value?: string | null): string {
    const trimmed = (value || "").trim();
    const rawUrl = trimmed || DEFAULT_PLATFORM_WEBSITE_URL;
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    return withProtocol.replace(/\/+$/, "");
}

export function normalizePlatformSupportEmail(value?: string | null): string {
    return (value || "").trim() || DEFAULT_PLATFORM_SUPPORT_EMAIL;
}

export function normalizePlatformWhatsAppNumber(value?: string | null): string {
    const digitsOnly = (value || "").replace(/\D/g, "");
    return digitsOnly || DEFAULT_PLATFORM_WHATSAPP_NUMBER;
}

export function buildPlatformUrl(baseUrl?: string | null, path = "/"): string {
    const normalizedBase = normalizePlatformWebsiteUrl(baseUrl);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return normalizedPath === "/" ? normalizedBase : `${normalizedBase}${normalizedPath}`;
}

export function buildPlatformWhatsAppUrl(number?: string | null, message?: string | null): string {
    const normalizedNumber = normalizePlatformWhatsAppNumber(number);
    const trimmedMessage = (message || "").trim();
    const encodedMessage = trimmedMessage ? `?text=${encodeURIComponent(trimmedMessage)}` : "";
    return `https://wa.me/${normalizedNumber}${encodedMessage}`;
}

function normalizeHostname(hostname: string) {
    return hostname.trim().toLowerCase().replace(/^www\./, "");
}

export function toPlatformUrlSuffix(url: string, baseUrl?: string | null): string {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    try {
        const absoluteUrl = new URL(trimmed);
        const absoluteBase = new URL(normalizePlatformWebsiteUrl(baseUrl));

        if (normalizeHostname(absoluteUrl.hostname) !== normalizeHostname(absoluteBase.hostname)) {
            return trimmed;
        }

        return `${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}` || "/";
    } catch {
        return trimmed;
    }
}

export function getPlatformContactInfoFromValues(
    websiteUrl?: string | null,
    supportEmail?: string | null
): PlatformContactInfo {
    const normalizedWebsiteUrl = normalizePlatformWebsiteUrl(websiteUrl);
    return {
        websiteUrl: normalizedWebsiteUrl,
        signupUrl: buildPlatformUrl(normalizedWebsiteUrl, "/signup"),
        workerProfileUrl: buildPlatformUrl(normalizedWebsiteUrl, "/profile/worker"),
        workerInboxUrl: buildPlatformUrl(normalizedWebsiteUrl, "/profile/worker/inbox"),
        supportEmail: normalizePlatformSupportEmail(supportEmail),
    };
}
