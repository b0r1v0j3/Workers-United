"use client";

import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";

export interface ThreadMessage {
    id: string;
    body: string;
    createdAt: string;
    senderRole: string;
    senderName: string;
    isOwn: boolean;
}

interface ConversationThreadProps {
    title: string;
    subtitle: string;
    messages: ThreadMessage[];
    placeholder: string;
    canSend: boolean;
    sending?: boolean;
    readOnlyMessage?: string | null;
    emptyTitle?: string;
    emptyDescription?: string;
    onSend: (body: string) => Promise<void> | void;
}

export default function ConversationThread({
    title,
    subtitle,
    messages,
    placeholder,
    canSend,
    sending = false,
    readOnlyMessage = null,
    emptyTitle = "No messages yet",
    emptyDescription = "Start the thread when you need help with profile, documents, or application steps.",
    onSend,
}: ConversationThreadProps) {
    const [draft, setDraft] = useState("");

    const orderedMessages = useMemo(
        () => [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
        [messages]
    );

    async function handleSubmit() {
        const trimmed = draft.trim();
        if (!trimmed || !canSend || sending) {
            return;
        }

        await onSend(trimmed);
        setDraft("");
    }

    return (
        <div className="relative flex min-h-[560px] flex-col overflow-hidden rounded-none border-0 bg-transparent pt-5 shadow-none before:absolute before:left-2 before:right-2 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-[14px] sm:border sm:border-[#e7e7e5] sm:bg-white sm:pt-0 sm:shadow-[0_20px_45px_-40px_rgba(15,23,42,0.28)] sm:before:hidden">
            <div className="border-b border-[#f1f1ef] px-0 py-4 sm:px-6 sm:py-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">Conversation</div>
                <h2 className="mt-2 text-xl font-semibold text-[#18181b]">{title}</h2>
                <p className="mt-1 text-sm text-[#6b7280]">{subtitle}</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-transparent px-0 py-5 sm:bg-[#fafafa] sm:px-6 sm:py-6">
                {orderedMessages.length === 0 ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center">
                        <div className="max-w-md rounded-[14px] border border-dashed border-[#e5e7eb] bg-white px-6 py-10 text-center">
                            <div className="text-lg font-semibold text-[#18181b]">{emptyTitle}</div>
                            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">{emptyDescription}</p>
                        </div>
                    </div>
                ) : (
                    orderedMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
                        >
                            <div className={`max-w-[85%] rounded-[14px] px-4 py-3 ${message.isOwn ? "bg-[#111111] text-white" : "border border-[#e7e7e5] bg-white text-[#18181b]"}`}>
                                <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${message.isOwn ? "text-white/70" : "text-[#9ca3af]"}`}>
                                    {message.senderName}
                                </div>
                                <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${message.isOwn ? "text-white" : "text-[#292524]"}`}>
                                    {message.body}
                                </p>
                                <div className={`mt-3 text-[11px] ${message.isOwn ? "text-white/55" : "text-[#9ca3af]"}`}>
                                    {new Date(message.createdAt).toLocaleString("en-GB")}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="border-t border-[#f1f1ef] bg-transparent px-0 py-5 sm:bg-white sm:px-6">
                {canSend ? (
                    <div className="space-y-3">
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder={placeholder}
                            rows={4}
                            className="w-full resize-none rounded-[14px] border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-sm text-[#18181b] outline-none transition placeholder:text-[#9ca3af] focus:border-[#111111]"
                        />
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-[#6b7280]">
                                Keep all communication inside Workers United.
                            </p>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={sending || !draft.trim()}
                                className="inline-flex items-center gap-2 rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                Send
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-[14px] border border-[#e7e7e5] bg-[#fafafa] px-4 py-4 text-sm text-[#6b7280]">
                        {readOnlyMessage || "Messaging is read-only for this conversation."}
                    </div>
                )}
            </div>
        </div>
    );
}
