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
        <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[28px] border border-[#e7e5e4] bg-white shadow-[0_20px_45px_-40px_rgba(15,23,42,0.28)]">
            <div className="border-b border-[#f0eeea] px-6 py-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a8a29e]">Conversation</div>
                <h2 className="mt-2 text-xl font-semibold text-[#18181b]">{title}</h2>
                <p className="mt-1 text-sm text-[#57534e]">{subtitle}</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#fafaf9] px-6 py-6">
                {orderedMessages.length === 0 ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center">
                        <div className="max-w-md rounded-[24px] border border-dashed border-[#ddd6c8] bg-white px-6 py-10 text-center">
                            <div className="text-lg font-semibold text-[#18181b]">{emptyTitle}</div>
                            <p className="mt-2 text-sm leading-relaxed text-[#78716c]">{emptyDescription}</p>
                        </div>
                    </div>
                ) : (
                    orderedMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
                        >
                            <div className={`max-w-[85%] rounded-[24px] px-4 py-3 ${message.isOwn ? "bg-[#111111] text-white" : "border border-[#e7e5e4] bg-white text-[#18181b]"}`}>
                                <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${message.isOwn ? "text-white/70" : "text-[#a8a29e]"}`}>
                                    {message.senderName}
                                </div>
                                <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${message.isOwn ? "text-white" : "text-[#292524]"}`}>
                                    {message.body}
                                </p>
                                <div className={`mt-3 text-[11px] ${message.isOwn ? "text-white/55" : "text-[#a8a29e]"}`}>
                                    {new Date(message.createdAt).toLocaleString("en-GB")}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="border-t border-[#f0eeea] bg-white px-6 py-5">
                {canSend ? (
                    <div className="space-y-3">
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder={placeholder}
                            rows={4}
                            className="w-full resize-none rounded-2xl border border-[#dedad1] bg-[#fcfcfb] px-4 py-3 text-sm text-[#18181b] outline-none transition placeholder:text-[#a8a29e] focus:border-[#111111]"
                        />
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-[#78716c]">
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
                    <div className="rounded-2xl border border-[#e7e5e4] bg-[#fafaf9] px-4 py-4 text-sm text-[#57534e]">
                        {readOnlyMessage || "Messaging is read-only for this conversation."}
                    </div>
                )}
            </div>
        </div>
    );
}
