/**
 * Senders the auto-reply email agent must never reply to.
 *
 * These are automated form-notification / no-reply / bounce addresses. Auto-replying
 * to them creates loops — e.g. Netlify's "Form Responses" helper, which bounces back
 * every time we reply to `formresponses@netlify.com`, and the web3forms `notify+...`
 * notifications. Real people (e.g. a worker on gmail) are NOT matched, so genuine
 * inquiries still get a reply.
 */

const NOTIFICATION_DOMAINS = [
    "netlify.com",
    "web3forms.com",
];

// Matches no-reply / bounce / form-notification style local-parts as whole tokens,
// so it also catches "formresponses+noreply@…" and "notify+hash@…".
const NOTIFICATION_LOCALPART =
    /(^|[._+-])(no-?reply|donotreply|do-?not-?reply|mailer-daemon|postmaster|bounces?|formresponses|form-responses|notify|notifications?)([._+-]|$)/i;

export function isAutomatedNotificationSender(fromEmail: string | null | undefined): boolean {
    const normalized = (fromEmail || "").trim().toLowerCase();
    const atIndex = normalized.lastIndexOf("@");
    if (atIndex <= 0 || atIndex === normalized.length - 1) {
        return false;
    }

    const localPart = normalized.slice(0, atIndex);
    const domain = normalized.slice(atIndex + 1);

    if (NOTIFICATION_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
        return true;
    }

    return NOTIFICATION_LOCALPART.test(localPart);
}
