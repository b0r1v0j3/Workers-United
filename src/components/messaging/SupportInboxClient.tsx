"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LifeBuoy, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ConversationThread, { type ThreadMessage } from "@/components/messaging/ConversationThread";

type SupportInboxAudience = "worker" | "agency";

interface SupportAccess {
    allowed: boolean;
    reason: string | null;
}

interface SupportConversationResponse {
    access: SupportAccess;
    conversation: {
        id: string;
        status: string;
        type: string;
    } | null;
    messages: ThreadMessage[];
}

const SUPPORT_COPY: Record<
    SupportInboxAudience,
    {
        pill: string;
        title: string;
        description: string;
        loading: string;
        unavailableTitle: string;
        unavailableDescription: string;
        threadTitle: string;
        threadSubtitle: string;
        placeholder: string;
        emptyTitle: string;
        emptyDescription: string;
        previewTitle: string;
        previewDescription: string;
        lockedTitle: string;
        lockedDescription: string;
        primaryHref: string;
        primaryLabel: string;
        secondaryHref?: string;
        secondaryLabel?: string;
    }
> = {
    worker: {
        pill: "Support Inbox",
        title: "Workers United support",
        description: "Ask for help with your profile, documents, payment, or application status after Job Finder is active.",
        loading: "Loading support inbox...",
        unavailableTitle: "Support inbox is unavailable right now",
        unavailableDescription: "The support thread could not be loaded. Refresh the page or try again in a moment.",
        threadTitle: "Support conversation",
        threadSubtitle: "Workers United replies here once your support thread is active.",
        placeholder: "Write your question for Workers United support...",
        emptyTitle: "Support is ready",
        emptyDescription: "Ask about profile completion, document review, payments, or your application status. All replies stay inside the platform.",
        previewTitle: "Support inbox is disabled in admin preview.",
        previewDescription: "Worker preview stays read-only. Use the real admin inbox to inspect and reply to live support threads without touching the admin profile.",
        lockedTitle: "Support unlocks after Job Finder payment",
        lockedDescription: "Pay $9, activate Job Finder, and your support inbox will open automatically.",
        primaryHref: "/profile/worker",
        primaryLabel: "Go to Worker Profile",
        secondaryHref: "/profile/worker/queue",
        secondaryLabel: "Open Application Status",
    },
    agency: {
        pill: "Agency Support",
        title: "Workers United agency support",
        description: "Ask for help with worker setup, documents, payments, queue movement, or any issue across your agency workspace. Agency support is always open.",
        loading: "Loading agency support...",
        unavailableTitle: "Agency support is unavailable right now",
        unavailableDescription: "The agency support thread could not be loaded. Refresh the page or try again in a moment.",
        threadTitle: "Agency support conversation",
        threadSubtitle: "Workers United replies here and keeps every support message inside your agency workspace.",
        placeholder: "Write your question for Workers United agency support...",
        emptyTitle: "Agency support is ready",
        emptyDescription: "Ask about worker setup, documents, payments, queue movement, or next steps. All replies stay inside the platform.",
        previewTitle: "Agency support stays read-only in admin preview.",
        previewDescription: "Inspect the agency inbox safely from preview mode, but use the real admin inbox when you need to reply to live support threads.",
        lockedTitle: "Agency support should already be open",
        lockedDescription: "If you see this message, refresh the page first. Agency support does not depend on Job Finder payment.",
        primaryHref: "/profile/agency",
        primaryLabel: "Back to Agency Workspace",
    },
};

const mobileFlatSurfaceClass = "rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-[14px] sm:border sm:border-[#e7e7e5] sm:bg-white sm:p-6 sm:shadow-[0_18px_45px_-40px_rgba(15,23,42,0.28)]";
const mobileFlatHeroClass = "rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-[14px] sm:border sm:border-[#e7e7e5] sm:bg-white sm:p-6 sm:shadow-[0_24px_70px_-54px_rgba(15,23,42,0.28)]";

export default function SupportInboxClient({
    audience,
    readOnlyPreview = false,
}: {
    audience: SupportInboxAudience;
    readOnlyPreview?: boolean;
}) {
    const copy = SUPPORT_COPY[audience];
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(false);
    const [data, setData] = useState<SupportConversationResponse | null>(null);

    const loadConversation = useCallback(async (mode: "initial" | "refresh" = "initial") => {
        try {
            if (mode === "initial") {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            const response = await fetch("/api/conversations/support", {
                cache: "no-store",
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Failed to load support inbox.");
            }

            setData(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load support inbox.";
            toast.error(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (readOnlyPreview) {
            setLoading(false);
            return;
        }

        void loadConversation();
    }, [loadConversation, readOnlyPreview]);

    async function handleSend(body: string) {
        if (!data?.conversation?.id) {
            return;
        }

        try {
            setSending(true);
            const response = await fetch(`/api/conversations/${data.conversation.id}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ body }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Failed to send message.");
            }

            setData((current) => current ? {
                ...current,
                conversation: current.conversation ? { ...current.conversation, status: payload.conversationStatus } : current.conversation,
                messages: [...current.messages, payload.message],
            } : current);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send message.";
            toast.error(message);
        } finally {
            setSending(false);
        }
    }

    if (readOnlyPreview) {
        return (
            <div className="space-y-6">
                <section className="rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-[14px] sm:border sm:border-[#dbeafe] sm:bg-[#eff6ff] sm:p-6 sm:shadow-[0_18px_45px_-40px_rgba(15,23,42,0.28)]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1d4ed8]">
                        <LifeBuoy size={14} />
                        Support Preview
                    </div>
                    <h1 className="mt-4 text-2xl font-semibold text-[#18181b]">{copy.previewTitle}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#475569]">
                        {copy.previewDescription}
                    </p>
                    <div className="mt-5">
                        <Link
                            href="/admin/inbox"
                            className="inline-flex items-center rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f1f1f]"
                        >
                            Open Admin Inbox
                        </Link>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className={mobileFlatHeroClass}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                            <LifeBuoy size={14} />
                            {copy.pill}
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#18181b]">{copy.title}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b7280]">
                            {copy.description}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadConversation("refresh")}
                        disabled={loading || refreshing}
                        className="inline-flex items-center gap-2 rounded-[14px] border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Refresh
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-none border-0 bg-transparent sm:rounded-[14px] sm:border sm:border-[#e7e7e5] sm:bg-white">
                    <div className="flex items-center gap-3 text-sm font-medium text-[#6b7280]">
                        <Loader2 size={18} className="animate-spin" />
                        {copy.loading}
                    </div>
                </div>
            ) : !data ? (
                <section className={mobileFlatSurfaceClass}>
                    <h2 className="text-2xl font-semibold text-[#18181b]">{copy.unavailableTitle}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b7280]">
                        {copy.unavailableDescription}
                    </p>
                    <div className="mt-5">
                        <button
                            type="button"
                            onClick={() => void loadConversation("refresh")}
                            className="inline-flex items-center rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f1f1f]"
                        >
                            Try Again
                        </button>
                    </div>
                </section>
            ) : !data.access.allowed ? (
                <section className={mobileFlatSurfaceClass}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <LockKeyhole size={22} />
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold text-[#18181b]">{copy.lockedTitle}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b7280]">
                        {data?.access.reason || copy.lockedDescription}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                            href={copy.primaryHref}
                            className="inline-flex items-center rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f1f1f]"
                        >
                            {copy.primaryLabel}
                        </Link>
                        {copy.secondaryHref && copy.secondaryLabel ? (
                            <Link
                                href={copy.secondaryHref}
                                className="inline-flex items-center rounded-2xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:bg-[#fafafa]"
                            >
                                {copy.secondaryLabel}
                            </Link>
                        ) : null}
                    </div>
                </section>
            ) : (
                <ConversationThread
                    title={copy.threadTitle}
                    subtitle={copy.threadSubtitle}
                    messages={data?.messages || []}
                    placeholder={copy.placeholder}
                    canSend={Boolean(data?.conversation)}
                    sending={sending}
                    onSend={handleSend}
                    emptyTitle={copy.emptyTitle}
                    emptyDescription={copy.emptyDescription}
                />
            )}
        </div>
    );
}
