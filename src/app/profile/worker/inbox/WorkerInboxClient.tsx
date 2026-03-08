"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LifeBuoy, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ConversationThread, { type ThreadMessage } from "@/components/messaging/ConversationThread";

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

export default function WorkerInboxClient({ readOnlyPreview = false }: { readOnlyPreview?: boolean }) {
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
                <section className="rounded-[28px] border border-blue-200 bg-blue-50 p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.28)]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                        <LifeBuoy size={14} />
                        Support Preview
                    </div>
                    <h1 className="mt-4 text-2xl font-semibold text-[#18181b]">Support inbox is disabled in admin preview.</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                        Worker preview stays read-only. Use the real admin inbox to inspect and reply to live support threads without touching the admin profile.
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
            <section className="rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#fcfbf7_0%,#f2eee4_100%)] p-6 shadow-[0_28px_70px_-50px_rgba(15,23,42,0.35)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#dfdbd0] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                            <LifeBuoy size={14} />
                            Support Inbox
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#18181b]">Workers United support</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                            Ask for help with your profile, documents, payment, or application status after Job Finder is active.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadConversation("refresh")}
                        disabled={loading || refreshing}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#d8d2c6] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:border-[#bfb7a7] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Refresh
                    </button>
                </div>
            </section>

            {loading ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-[#e7e5e4] bg-white">
                    <div className="flex items-center gap-3 text-sm font-medium text-[#57534e]">
                        <Loader2 size={18} className="animate-spin" />
                        Loading support inbox...
                    </div>
                </div>
            ) : !data ? (
                <section className="rounded-[28px] border border-[#e7e5e4] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.28)]">
                    <h2 className="text-2xl font-semibold text-[#18181b]">Support inbox is unavailable right now</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                        The support thread could not be loaded. Refresh the page or try again in a moment.
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
                <section className="rounded-[28px] border border-[#e7e5e4] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.28)]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <LockKeyhole size={22} />
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold text-[#18181b]">Support unlocks after Job Finder payment</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                        {data?.access.reason || "Pay $9, activate Job Finder, and your support inbox will open automatically."}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                            href="/profile/worker"
                            className="inline-flex items-center rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f1f1f]"
                        >
                            Go to Worker Profile
                        </Link>
                        <Link
                            href="/profile/worker/queue"
                            className="inline-flex items-center rounded-2xl border border-[#dedad1] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:border-[#bfb7a7]"
                        >
                            Open Application Status
                        </Link>
                    </div>
                </section>
            ) : (
                <ConversationThread
                    title="Support conversation"
                    subtitle="Workers United replies here once your support thread is active."
                    messages={data?.messages || []}
                    placeholder="Write your question for Workers United support..."
                    canSend={Boolean(data?.conversation)}
                    sending={sending}
                    onSend={handleSend}
                    emptyTitle="Support is ready"
                    emptyDescription="Ask about profile completion, document review, payments, or your application status. All replies stay inside the platform."
                />
            )}
        </div>
    );
}
