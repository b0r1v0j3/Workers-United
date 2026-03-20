import type { EmailType, TemplateData } from "@/lib/email-templates";

export type EmailPreviewDataValue = string | number | boolean;
export type EmailPreviewData = Record<string, EmailPreviewDataValue>;

export const ADMIN_EMAIL_PREVIEW_TYPES = [
    "welcome",
    "profile_complete",
    "payment_success",
    "checkout_recovery",
    "job_offer",
    "offer_reminder",
    "offer_expired",
    "refund_approved",
    "document_expiring",
    "job_match",
    "admin_update",
    "announcement",
    "employer_outreach",
    "profile_incomplete",
    "document_review_result",
    "profile_reminder",
    "profile_warning",
    "profile_deletion",
    "announcement_document_fix",
] as const satisfies readonly EmailType[];

const ADMIN_EMAIL_PREVIEW_TYPE_SET = new Set<EmailType>(ADMIN_EMAIL_PREVIEW_TYPES);

function sanitizePreviewData(data: TemplateData | EmailPreviewData | null | undefined): EmailPreviewData {
    const previewData: EmailPreviewData = {};

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return previewData;
    }

    for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            previewData[key] = value;
        }
    }

    return previewData;
}

export function isAdminEmailPreviewType(value: string | null | undefined): value is EmailType {
    if (!value) {
        return false;
    }

    return ADMIN_EMAIL_PREVIEW_TYPE_SET.has(value as EmailType);
}

export function buildAdminEmailPreviewHref(
    type: EmailType,
    data?: TemplateData | EmailPreviewData | null,
    basePath = "/admin/email-preview"
) {
    const params = new URLSearchParams({ type });
    const previewData = sanitizePreviewData(data);

    if (Object.keys(previewData).length > 0) {
        params.set("data", JSON.stringify(previewData));
    }

    return `${basePath}?${params.toString()}`;
}

export function parseAdminEmailPreviewData(rawData: string | null | undefined): EmailPreviewData | null {
    if (!rawData) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawData);
        const previewData = sanitizePreviewData(parsed as EmailPreviewData);
        return Object.keys(previewData).length > 0 ? previewData : null;
    } catch {
        return null;
    }
}
