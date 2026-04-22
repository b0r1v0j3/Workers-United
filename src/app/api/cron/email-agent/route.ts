import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { ParsedMail } from "mailparser";
import {
    CONTACT_EMAIL,
    handleInboundEmailAgent,
    isValidEmail,
    normalizeEmail,
    stripHtml,
} from "@/lib/email-agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type ParsedAddress = {
    address?: string;
    name?: string;
};

const DEFAULT_IMAP_HOST = "imap.gmail.com";
const DEFAULT_IMAP_PORT = 993;
const DEFAULT_MAX_MESSAGES = 5;
const DEFAULT_LOOKBACK_DAYS = 7;

function getCronSecret(): string {
    return process.env.CRON_SECRET || "";
}

function getBearerToken(request: NextRequest): string {
    const authorization = request.headers.get("authorization") || "";
    return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

function getMaxMessages(): number {
    const parsed = Number.parseInt(process.env.EMAIL_AGENT_MAX_MESSAGES || "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_MAX_MESSAGES;
    }

    return Math.min(parsed, 20);
}

function getSearchSinceDate(): Date | null {
    const parsed = Number.parseInt(process.env.EMAIL_AGENT_LOOKBACK_DAYS || "", 10);
    const days = Number.isFinite(parsed) ? parsed : DEFAULT_LOOKBACK_DAYS;
    if (days <= 0) {
        return null;
    }

    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function getHeaderText(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(getHeaderText).filter(Boolean).join(", ");
    return String(value);
}

function getFirstAddress(value: unknown): ParsedAddress | null {
    const maybeAddressObject = value as { value?: ParsedAddress[] } | undefined;
    const first = maybeAddressObject?.value?.[0];
    if (!first?.address) {
        return null;
    }

    return first;
}

function shouldSkipEmail({
    fromEmail,
    subject,
    headers,
    smtpUser,
}: {
    fromEmail: string;
    subject: string;
    headers: Map<string, unknown>;
    smtpUser: string;
}): string | null {
    const normalizedFrom = normalizeEmail(fromEmail);
    const normalizedSmtpUser = normalizeEmail(smtpUser);
    const normalizedContact = normalizeEmail(CONTACT_EMAIL);

    if (!isValidEmail(normalizedFrom)) {
        return "invalid_sender";
    }

    if (normalizedFrom === normalizedSmtpUser || normalizedFrom === normalizedContact) {
        return "own_message";
    }

    if (/^(no-?reply|do-?not-?reply|mailer-daemon|postmaster)@/i.test(normalizedFrom)) {
        return "system_sender";
    }

    const autoSubmitted = getHeaderText(headers.get("auto-submitted")).trim().toLowerCase();
    if (autoSubmitted && autoSubmitted !== "no") {
        return "auto_submitted";
    }

    const precedence = getHeaderText(headers.get("precedence")).trim().toLowerCase();
    if (["bulk", "junk", "list"].includes(precedence)) {
        return "bulk_email";
    }

    if (headers.has("list-id")) {
        return "mailing_list";
    }

    if (/(delivery status notification|undeliverable|failure notice|returned mail|out of office|automatic reply)/i.test(subject)) {
        return "automatic_subject";
    }

    return null;
}

export async function GET(request: NextRequest) {
    const cronSecret = getCronSecret();
    if (!cronSecret || getBearerToken(request) !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    if (!smtpUser || !smtpPass) {
        return NextResponse.json({ error: "SMTP_USER/SMTP_PASS are required for Gmail IMAP polling." }, { status: 500 });
    }

    const client = new ImapFlow({
        host: process.env.EMAIL_AGENT_IMAP_HOST || DEFAULT_IMAP_HOST,
        port: Number.parseInt(process.env.EMAIL_AGENT_IMAP_PORT || "", 10) || DEFAULT_IMAP_PORT,
        secure: process.env.EMAIL_AGENT_IMAP_SECURE !== "false",
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        logger: false,
    });

    const summary = {
        checked: 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        details: [] as Array<{ uid: number; status: string; reason?: string }>,
    };

    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        try {
            const since = getSearchSinceDate();
            const unreadSearchResult = await client.search(since ? { seen: false, since } : { seen: false });
            const unreadUids = Array.isArray(unreadSearchResult) ? unreadSearchResult : [];
            const selectedUids = unreadUids.slice(-getMaxMessages());

            if (selectedUids.length === 0) {
                return NextResponse.json({ success: true, ...summary });
            }

            for await (const message of client.fetch(selectedUids, { uid: true, source: true }, { uid: true })) {
                summary.checked++;
                const uid = Number(message.uid);
                try {
                    if (!message.source) {
                        summary.skipped++;
                        summary.details.push({ uid, status: "skipped", reason: "missing_source" });
                        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
                        continue;
                    }

                    const parsed = await (simpleParser(message.source) as Promise<ParsedMail>);
                    const from = getFirstAddress(parsed.from);
                    const fromEmail = normalizeEmail(from?.address);
                    const fromName = (from?.name || "").trim();
                    const subject = (parsed.subject || "Workers United").trim();
                    const text = (parsed.text || "").trim();
                    const html = typeof parsed.html === "string" ? parsed.html : "";
                    const body = text || stripHtml(html);
                    const skipReason = shouldSkipEmail({
                        fromEmail,
                        subject,
                        headers: parsed.headers as Map<string, unknown>,
                        smtpUser,
                    });

                    if (skipReason || !body.trim()) {
                        summary.skipped++;
                        summary.details.push({ uid, status: "skipped", reason: skipReason || "empty_body" });
                        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
                        continue;
                    }

                    await handleInboundEmailAgent({
                        fromEmail,
                        fromName,
                        subject,
                        text,
                        html,
                        messageId: parsed.messageId || String(uid),
                        threadId: parsed.inReplyTo || (Array.isArray(parsed.references) ? parsed.references.at(-1) : parsed.references) || parsed.messageId || String(uid),
                    });

                    await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
                    summary.processed++;
                    summary.details.push({ uid, status: "processed" });
                } catch (error) {
                    summary.errors++;
                    summary.details.push({
                        uid,
                        status: "error",
                        reason: error instanceof Error ? error.message.slice(0, 180) : "unknown_error",
                    });
                    console.error("[Email Agent Cron] Failed to process message:", error);
                }
            }
        } finally {
            lock.release();
        }
    } catch (error) {
        console.error("[Email Agent Cron] IMAP polling failed:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Email agent cron failed.",
            ...summary,
        }, { status: 500 });
    } finally {
        await client.logout().catch(() => undefined);
    }

    return NextResponse.json({
        success: summary.errors === 0,
        ...summary,
    }, { status: summary.errors === 0 ? 200 : 207 });
}
