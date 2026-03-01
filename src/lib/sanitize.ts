// HTML sanitization utilities for email templates and user-facing content

/**
 * Escapes HTML special characters to prevent XSS in email templates.
 * Use this for any user-supplied data that gets injected into HTML emails.
 */
export function escapeHtml(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Sanitizes user input for safe display in HTML.
 * Removes potential script injection while preserving safe text.
 */
export function sanitizeForDisplay(text: string | null | undefined): string {
    if (!text) return "";
    // Remove script tags and event handlers
    return text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
}
