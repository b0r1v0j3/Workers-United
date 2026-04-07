"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquareMore, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ConversationThread, { type ThreadMessage } from "@/components/messaging/ConversationThread";

type MatchInboxAudience = "worker" | "employer";

interface MatchConversationSummary {
    id: string;
    status: string | null;
    offerId: string | null;
    otherParticipantName: string;
    otherParticipantEmail: string | null;
    createdAt: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
}

interface ConversationThreadResponse {
    conversation: {
        id: string;
        type: string;
        status: string | null;
    };
    canWrite: boolean;
    messages: ThreadMessage[];
}

const MATCH_COPY: Record<
    MatchInboxAudience,
    {
        pill: string;
        title: string;
        description: string;
        emptyTitle: string;
        emptyDescription: string;
        threadTitle: string;
        threadSubtitle: string;
        placeholder: string;
        readOnlyPreviewTitle: string;
        readOnlyPreviewDescription: string;
        fallbackHref: string;
        fallbackLabel: string;
    }
> = {
    worker: {
        pill: "Match Inbox",
        title: "Employer match conversations",
        description:
            "Match threads unlock after your offer is accepted and placement payment is confirmed. Keep communication inside Workers United.",
        emptyTitle: "No unlocked match threads yet",
        emptyDescription:
            "As soon as an accepted offer is fully paid, your employer match thread appears here automatically.",
        threadTitle: "Match conversation",
        threadSubtitle:
            "Use this thread for offer-specific coordination. Direct phone/email/link sharing is blocked for compliance.",
        placeholder: "Write your update for this matched employer...",
        readOnlyPreviewTitle: "Match inbox preview is read-only in admin mode.",
        readOnlyPreviewDescription:
            "Use the real admin inbox to inspect and moderate live match conversations.",
        fallbackHref: "/profile/worker",
        fallbackLabel: "Back to Worker Profile",
    },
    employer: {
        pill: "Employer Inbox",
        title: "Matched worker conversations",
        description:
            "Every accepted and fully paid offer opens a dedicated worker thread here. Keep all communication on-platform.",
        emptyTitle: "No unlocked worker threads yet",
        emptyDescription:
            "When a worker accepts your offer and placement payment completes, their conversation appears automatically.",
        threadTitle: "Worker conversation",
        threadSubtitle:
            "Use this thread for role handoff details. Direct off-platform contact exchange is blocked for compliance.",
        placeholder: "Write your update for this worker...",
        readOnlyPreviewTitle: "Employer inbox preview is read-only in admin mode.",
        readOnlyPreviewDescription:
            "Use the real admin inbox to inspect and moderate live employer-worker conversations.",
        fallbackHref: "/profile/employer",
        fallbackLabel: "Back to Employer Workspace",
    },
};

function formatStatus(status: string | null): string {
    if (!status) {
        return "Open";
    }

    return status.replace(/_/g, " ");
}

export default function MatchInboxClient({
    audience,
    readOnlyPreview = false,
}: {
    audience: MatchInboxAudience;
    readOnlyPreview?: boolean;
}) {
    const copy = MATCH_COPY[audience];
    const [loadingList, setLoadingList] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(false);
    const [conversations, setConversations] = useState<MatchConversationSummary[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [thread, setThread] = useState<ConversationThreadResponse | null>(null);

    const selectedConversation = useMemo(
        () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
        [conversations, selectedConversationId]
    );

    const loadConversations = useCallback(async (mode: "initial" | "refresh" = "initial") => {
        try {
            if (mode === "initial") {
                setLoadingList(true);
            } else {
                setRefreshing(true);
            }

            const response = await fetch("/api/conversations/match", { cache: "no-store" });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Failed to load match inbox.");
            }

            const nextConversations = (payload.conversations || []) as MatchConversationSummary[];
            setConversations(nextConversations);
            setSelectedConversationId((current) => {
                if (current && nextConversations.some((conversation) => conversation.id === current)) {
                    return current;
                }

                return nextConversations[0]?.id || null;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load match inbox.";
            toast.error(message);
        } finally {
            setLoadingList(false);
            setRefreshing(false);
        }
    }, []);

    const loadThread = useCallback(async (conversationId: string) => {
        try {
            setLoadingThread(true);
            const response = await fetch(`/api/conversations/${conversationId}/messages`, {
                cache: "no-store",
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Failed to load conversation.");
            }
            setThread(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load conversation.";
            toast.error(message);
            setThread(null);
        } finally {
            setLoadingThread(false);
        }
    }, []);

    useEffect(() => {
        if (readOnlyPreview) {
            setLoadingList(false);
            return;
        }

        void loadConversations();
    }, [loadConversations, readOnlyPreview]);

    useEffect(() => {
        if (readOnlyPreview || !selectedConversationId) {
            setThread(null);
            return;
        }

        void loadThread(selectedConversationId);
    }, [loadThread, readOnlyPreview, selectedConversationId]);

    async function handleSend(body: string) {
        if (!selectedConversationId) {
            return;
        }

        try {
            setSending(true);
            const response = await fetch(`/api/conversations/${selectedConversationId}/messages`, {
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

            setThread((current) =>
                current
                    ? {
                        ...current,
                        conversation: {
                            ...current.conversation,
                            status: payload.conversationStatus,
                        },
                        messages: [...current.messages, payload.message],
                    }
                    : current
            );
            await loadConversations("refresh");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send message.";
            toast.error(message);
        } finally {
            setSending(false);
        }
    }

    if (readOnlyPreview) {
        return (
            <section className="rounded-[14px] border border-[#dbeafe] bg-[#eff6ff] p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.28)]">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1d4ed8]">
                    <MessageSquareMore size={14} />
                    Match Inbox Preview
                </div>
                <h1 className="mt-4 text-2xl font-semibold text-[#18181b]">{copy.readOnlyPreviewTitle}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#475569]">{copy.readOnlyPreviewDescription}</p>
                <div className="mt-5">
                    <Link
                        href="/admin/inbox"
                        className="inline-flex items-center rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f1f1f]"
                    >
                        Open Admin Inbox
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-[14px] sm:border sm:border-[#e7e7e5] sm:bg-white sm:p-6 sm:shadow-[0_24px_70px_-54px_rgba(15,23,42,0.28)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                            <MessageSquareMore size={14} />
                            {copy.pill}
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#18181b]">{copy.title}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b7280]">{copy.description}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadConversations("refresh")}
                        disabled={loadingList || refreshing}
                        className="inline-flex items-center gap-2 rounded-[14px] border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Refresh
                    </button>
                </div>
            </section>

            {loadingList ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-none border-0 bg-transparent sm:rounded-[14px] sm:border sm:border-[#e7e7e5] sm:bg-white">
                    <div className="flex items-center gap-3 text-sm font-medium text-[#6b7280]">
                        <Loader2 size={18} className="animate-spin" />
                        Loading match inbox...
                    </div>
                </div>
            ) : conversations.length === 0 ? (
                <section className="relative rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-[14px] sm:border sm:border-[#e7e7e5] sm:bg-white sm:p-6 sm:shadow-[0_18px_45px_-40px_rgba(15,23,42,0.28)] sm:before:hidden">
                    <h2 className="text-2xl font-semibold text-[#18181b]">{copy.emptyTitle}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b7280]">{copy.emptyDescription}</p>
                    <div className="mt-5">
                        <Link
                            href={copy.fallbackHref}
                            className="inline-flex items-center rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f1f1f]"
                        >
                            {copy.fallbackLabel}
                        </Link>
                    </div>
                </section>
            ) : (
                <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="rounded-[14px] border border-[#e7e7e5] bg-white p-5 shadow-[0_20px_45px_-40px_rgba(15,23,42,0.28)]">
                        <div className="space-y-3">
                            {conversations.map((conversation) => {
                                const isActive = conversation.id === selectedConversationId;
                                return (
                                    <button
                                        key={conversation.id}
                                        type="button"
                                        onClick={() => setSelectedConversationId(conversation.id)}
                                        className={`w-full rounded-[14px] border px-4 py-4 text-left transition ${
                                            isActive
                                                ? "border-[#111111] bg-[#111111] text-white"
                                                : "border-[#ebe7df] bg-[#fcfcfb] hover:border-[#d7d0c6] hover:bg-white"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className={`truncate text-sm font-semibold ${isActive ? "text-white" : "text-[#18181b]"}`}>
                                                    {conversation.otherParticipantName}
                                                </div>
                                                <div className={`mt-1 truncate text-xs ${isActive ? "text-white/65" : "text-[#78716c]"}`}>
                                                    {conversation.otherParticipantEmail || "No email"} • {conversation.offerId ? `Offer ${conversation.offerId.slice(0, 8)}` : "Offer"}
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                                isActive ? "bg-white/10 text-white" : "bg-[#f3f4f6] text-[#57534e]"
                                            }`}>
                                                {formatStatus(conversation.status)}
                                            </span>
                                        </div>
                                        <p className={`mt-3 line-clamp-2 text-xs leading-relaxed ${isActive ? "text-white/80" : "text-[#57534e]"}`}>
                                            {conversation.lastMessagePreview || "No messages yet"}
                                        </p>
                                        <div className={`mt-3 text-[11px] ${isActive ? "text-white/55" : "text-[#a8a29e]"}`}>
                                            {new Date(conversation.lastMessageAt || conversation.createdAt).toLocaleString("en-GB")}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {loadingThread ? (
                        <div className="flex min-h-[560px] items-center justify-center rounded-[14px] border border-[#e7e7e5] bg-white">
                            <div className="flex items-center gap-3 text-sm font-medium text-[#57534e]">
                                <Loader2 size={18} className="animate-spin" />
                                Loading conversation...
                            </div>
                        </div>
                    ) : selectedConversation && thread ? (
                        <ConversationThread
                            title={copy.threadTitle}
                            subtitle={copy.threadSubtitle}
                            messages={thread.messages}
                            placeholder={copy.placeholder}
                            canSend={thread.canWrite}
                            sending={sending}
                            readOnlyMessage="Messaging is currently read-only for this match thread."
                            emptyTitle="No thread messages yet"
                            emptyDescription="Use this thread for on-platform coordination only."
                            onSend={handleSend}
                        />
                    ) : (
                        <div className="flex min-h-[560px] items-center justify-center rounded-[14px] border border-dashed border-[#ddd6c8] bg-[#faf8f3] px-6 text-center text-sm text-[#78716c]">
                            Select a match thread to read and reply.
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

