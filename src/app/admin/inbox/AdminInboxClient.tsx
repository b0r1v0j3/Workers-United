"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MailOpen, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import ConversationThread, { type ThreadMessage } from "@/components/messaging/ConversationThread";

interface SupportConversationSummary {
    id: string;
    type: "support" | "match";
    status: string | null;
    participantRole: "worker" | "employer" | "agency";
    participantName: string;
    participantEmail: string | null;
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

function formatStatusLabel(status: string | null): string {
    if (!status) {
        return "Open";
    }

    return status.replace(/_/g, " ");
}

function formatConversationType(type: "support" | "match"): string {
    return type === "match" ? "Match" : "Support";
}

export default function AdminInboxClient() {
    const [loadingList, setLoadingList] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(false);
    const [search, setSearch] = useState("");
    const [conversations, setConversations] = useState<SupportConversationSummary[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [thread, setThread] = useState<ConversationThreadResponse | null>(null);

    const filteredConversations = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) {
            return conversations;
        }

        return conversations.filter((conversation) => {
            const haystack = `${conversation.participantName} ${conversation.participantEmail || ""} ${conversation.lastMessagePreview || ""}`.toLowerCase();
            return haystack.includes(query);
        });
    }, [conversations, search]);

    const waitingOnSupportCount = useMemo(
        () => conversations.filter((conversation) => conversation.status === "waiting_on_support").length,
        [conversations]
    );

    const loadList = useCallback(async (mode: "initial" | "refresh" = "initial") => {
        try {
            if (mode === "initial") {
                setLoadingList(true);
            } else {
                setRefreshing(true);
            }

            const response = await fetch("/api/admin/inbox/support", {
                cache: "no-store",
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Failed to load inbox.");
            }

            const nextConversations = payload.conversations as SupportConversationSummary[];
            setConversations(nextConversations);
            setSelectedConversationId((current) => {
                if (current && nextConversations.some((conversation) => conversation.id === current)) {
                    return current;
                }

                return nextConversations[0]?.id || null;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load inbox.";
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
        void loadList();
    }, [loadList]);

    useEffect(() => {
        if (!selectedConversationId) {
            setThread(null);
            return;
        }

        void loadThread(selectedConversationId);
    }, [loadThread, selectedConversationId]);

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
                throw new Error(payload.error || "Failed to send support reply.");
            }

            setThread((current) => current ? {
                ...current,
                conversation: {
                    ...current.conversation,
                    status: payload.conversationStatus,
                },
                messages: [...current.messages, payload.message],
            } : current);

            await loadList("refresh");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send support reply.";
            toast.error(message);
        } finally {
            setSending(false);
        }
    }

    const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) || null;

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#fcfbf7_0%,#f2eee4_100%)] p-6 shadow-[0_28px_70px_-50px_rgba(15,23,42,0.35)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#dfdbd0] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                            <MailOpen size={14} />
                            Support Inbox
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#18181b]">Support conversations</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                            Review worker support threads, answer inside the platform, and keep operations out of WhatsApp and ad-hoc email.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <MetricCard label="Threads" value={conversations.length} />
                        <MetricCard label="Waiting" value={waitingOnSupportCount} />
                        <button
                            type="button"
                            onClick={() => void loadList("refresh")}
                            disabled={loadingList || refreshing}
                            className="rounded-2xl border border-[#d8d2c6] bg-white px-4 py-3 text-left transition hover:border-[#bfb7a7] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <div className="flex items-center gap-2 text-sm font-semibold text-[#18181b]">
                                {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                Refresh
                            </div>
                            <div className="mt-1 text-xs text-[#78716c]">Reload list and latest messages</div>
                        </button>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-[28px] border border-[#e7e5e4] bg-white p-5 shadow-[0_20px_45px_-40px_rgba(15,23,42,0.28)]">
                    <div className="relative">
                        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search support threads"
                            className="w-full rounded-2xl border border-[#dedad1] bg-[#fcfcfb] py-3 pl-11 pr-4 text-sm text-[#18181b] outline-none transition placeholder:text-[#a8a29e] focus:border-[#111111]"
                        />
                    </div>

                    <div className="mt-4 space-y-3">
                        {loadingList ? (
                            <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-[#ddd6c8] bg-[#faf8f3] text-sm text-[#78716c]">
                                <div className="flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    Loading inbox...
                                </div>
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-[#ddd6c8] bg-[#faf8f3] px-5 text-center text-sm text-[#78716c]">
                                No support conversations yet.
                            </div>
                        ) : (
                            filteredConversations.map((conversation) => {
                                const isActive = conversation.id === selectedConversationId;
                                return (
                                    <button
                                        key={conversation.id}
                                        type="button"
                                        onClick={() => setSelectedConversationId(conversation.id)}
                                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${isActive
                                            ? "border-[#111111] bg-[#111111] text-white"
                                            : "border-[#ebe7df] bg-[#fcfcfb] hover:border-[#d7d0c6] hover:bg-white"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className={`truncate text-sm font-semibold ${isActive ? "text-white" : "text-[#18181b]"}`}>
                                                    {conversation.participantName}
                                                </div>
                                                <div className={`mt-1 truncate text-xs ${isActive ? "text-white/65" : "text-[#78716c]"}`}>
                                                    {conversation.participantEmail || "No email"} • {conversation.participantRole}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${isActive ? "bg-white/10 text-white" : "bg-[#f3f4f6] text-[#57534e]"}`}>
                                                    {formatStatusLabel(conversation.status)}
                                                </span>
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${isActive ? "bg-white/10 text-white/90" : "bg-[#eef2ff] text-[#4c51bf]"}`}>
                                                    {formatConversationType(conversation.type)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className={`mt-3 line-clamp-2 text-xs leading-relaxed ${isActive ? "text-white/80" : "text-[#57534e]"}`}>
                                            {conversation.lastMessagePreview || "No messages yet"}
                                        </p>
                                        <div className={`mt-3 text-[11px] ${isActive ? "text-white/55" : "text-[#a8a29e]"}`}>
                                            {new Date(conversation.lastMessageAt || conversation.createdAt).toLocaleString("en-GB")}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {loadingThread ? (
                    <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-[#e7e5e4] bg-white">
                        <div className="flex items-center gap-3 text-sm font-medium text-[#57534e]">
                            <Loader2 size={18} className="animate-spin" />
                            Loading conversation...
                        </div>
                    </div>
                ) : selectedConversation && thread ? (
                    <ConversationThread
                        title={selectedConversation.participantName}
                        subtitle={`${formatConversationType(selectedConversation.type)} • ${selectedConversation.participantRole}${selectedConversation.participantEmail ? ` • ${selectedConversation.participantEmail}` : ""}`}
                        messages={thread.messages}
                        placeholder="Write a support reply..."
                        canSend={thread.canWrite}
                        sending={sending}
                        readOnlyMessage="This support conversation is read-only."
                        emptyTitle="No support replies yet"
                        emptyDescription="The thread exists, but neither side has written anything yet."
                        onSend={handleSend}
                    />
                ) : (
                    <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-dashed border-[#ddd6c8] bg-[#faf8f3] px-6 text-center text-sm text-[#78716c]">
                        Select a support conversation from the left to read and reply.
                    </div>
                )}
            </section>
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_35px_-32px_rgba(15,23,42,0.45)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8479]">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-[#18181b]">{value}</div>
        </div>
    );
}
