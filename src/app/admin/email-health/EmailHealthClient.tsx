"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, MailX, ShieldCheck, Trash2 } from "lucide-react";

export type FlaggedEmailProfile = {
    id: string;
    fullName: string;
    email: string;
    role: string;
    createdAt: string;
    reason: string;
    suggestedEmail: string | null;
    bounceCount: number;
    lastBounceAt: string;
    lastError: string | null;
    safeToDelete: boolean;
    activitySummary: string;
    workspaceHref: string;
};

export type BounceIssue = {
    recipientEmail: string;
    bounceCount: number;
    lastBounceAt: string;
    lastError: string;
    emailTypes: string[];
};

export default function EmailHealthClient({
    flaggedProfiles,
    orphanBounceIssues,
}: {
    flaggedProfiles: FlaggedEmailProfile[];
    orphanBounceIssues: BounceIssue[];
}) {
    const [items, setItems] = useState(flaggedProfiles);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const safeDeletes = useMemo(() => items.filter((item) => item.safeToDelete).length, [items]);

    const handleDelete = async (profile: FlaggedEmailProfile) => {
        if (!profile.safeToDelete || deletingId) {
            return;
        }

        const confirmed = window.confirm(
            `Delete ${profile.fullName} (${profile.email})?\n\nThis removes auth, profile, worker data, email queue, and related records.`
        );
        if (!confirmed) {
            return;
        }

        setDeletingId(profile.id);
        try {
            const response = await fetch("/api/admin/delete-user", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: profile.id }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error || "Delete failed");
            }

            setItems((current) => current.filter((item) => item.id !== profile.id));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Delete failed";
            window.alert(message);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-3">
                <InfoPanel
                    title="What appears here"
                    copy="Known typo domains, invalid internal domains, and profiles tied to recent undeliverable deliveries."
                    icon={<MailX size={18} />}
                    tone="dark"
                />
                <InfoPanel
                    title="Safe delete rule"
                    copy="Delete only when there are no payments, documents, inbox threads, employer or agency records, or advanced worker status."
                    icon={<ShieldCheck size={18} />}
                    tone="blue"
                />
                <InfoPanel
                    title="Current cleanup"
                    copy={`${safeDeletes} flagged profiles are safe for one-click deletion right now. The rest should be inspected before touching.`}
                    icon={<AlertTriangle size={18} />}
                    tone="amber"
                />
            </section>

            <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-[#18181b]">Flagged profiles</h2>
                    <p className="mt-1 text-sm text-[#71717a]">
                        Real accounts with typo domains, known invalid domains, or recent undeliverable sends.
                    </p>
                </div>

                {items.length === 0 ? (
                    <EmptyState copy="No invalid or bounced profile emails found right now." />
                ) : (
                    <div className="grid gap-4">
                        {items.map((item) => (
                            <div key={item.id} className="rounded-[24px] border border-[#e6e6e1] bg-[#fcfcfb] p-5 transition hover:border-[#d7d0c6] hover:bg-white">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="text-base font-bold text-slate-900">{item.fullName}</div>
                                            <StatusChip label={item.role} tone="neutral" />
                                            {item.safeToDelete ? <StatusChip label="Safe to delete" tone="success" /> : <StatusChip label="Inspect first" tone="warning" />}
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">{item.email}</div>

                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            <DetailBlock label="Reason" value={item.reason} />
                                            <DetailBlock label="Created" value={item.createdAt} />
                                            <DetailBlock label="Last bounce" value={item.lastBounceAt} />
                                            <DetailBlock label="Undeliverable count" value={String(item.bounceCount)} />
                                        </div>

                                        <div className="mt-4 rounded-2xl border border-[#ece8df] bg-white px-4 py-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Activity</div>
                                            <div className="mt-1 text-sm text-[#4b5563]">{item.activitySummary}</div>
                                        </div>

                                        {item.suggestedEmail ? (
                                            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                                Suggested fix: <span className="font-semibold">{item.suggestedEmail}</span>
                                            </div>
                                        ) : null}

                                        {item.lastError ? (
                                            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">Last delivery error</div>
                                                <div className="mt-1 break-words">{item.lastError}</div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="flex w-full flex-col gap-3 lg:w-[220px]">
                                        <Link
                                            href={item.workspaceHref}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:border-[#cfc9bf] hover:bg-[#fafaf9]"
                                        >
                                            <ExternalLink size={16} />
                                            Open workspace
                                        </Link>

                                        <button
                                            type="button"
                                            disabled={!item.safeToDelete || deletingId === item.id}
                                            onClick={() => handleDelete(item)}
                                            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                                item.safeToDelete
                                                    ? "bg-[#111111] text-white hover:bg-black"
                                                    : "cursor-not-allowed border border-[#e7e5e4] bg-[#f5f5f4] text-[#a8a29e]"
                                            }`}
                                        >
                                            <Trash2 size={16} />
                                            {deletingId === item.id ? "Deleting..." : "Delete profile"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-[#18181b]">Orphan bounce records</h2>
                    <p className="mt-1 text-sm text-[#71717a]">
                        Failed recipient addresses seen in delivery logs that are not linked to any current profile.
                    </p>
                </div>

                {orphanBounceIssues.length === 0 ? (
                    <EmptyState copy="No orphan bounce records found in the last 90 days." />
                ) : (
                    <div className="grid gap-4">
                        {orphanBounceIssues.map((issue) => (
                            <div key={issue.recipientEmail} className="rounded-[24px] border border-[#e6e6e1] bg-[#fcfcfb] p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-base font-bold text-slate-900">{issue.recipientEmail}</div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            {issue.bounceCount} undeliverable attempt{issue.bounceCount === 1 ? "" : "s"} • last seen {issue.lastBounceAt}
                                        </div>
                                        <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                            {issue.lastError}
                                        </div>
                                    </div>

                                    <div className="w-full rounded-2xl border border-[#ece8df] bg-white px-4 py-3 lg:w-[220px]">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Email types</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {issue.emailTypes.map((type) => (
                                                <span key={type} className="rounded-full border border-[#e7e5e4] bg-[#fafaf9] px-2.5 py-1 text-xs font-medium text-[#57534e]">
                                                    {type}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function InfoPanel({
    title,
    copy,
    icon,
    tone,
}: {
    title: string;
    copy: string;
    icon: ReactNode;
    tone: "dark" | "blue" | "amber";
}) {
    const toneClass = tone === "blue"
        ? "bg-blue-600 text-white"
        : tone === "amber"
            ? "bg-amber-500 text-white"
            : "bg-[#111111] text-white";

    return (
        <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
                {icon}
            </div>
            <h3 className="text-base font-semibold text-[#18181b]">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#71717a]">{copy}</p>
        </div>
    );
}

function StatusChip({ label, tone }: { label: string; tone: "neutral" | "success" | "warning" }) {
    const toneClass = tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-[#e5e7eb] bg-white text-[#57534e]";

    return (
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
            {label}
        </span>
    );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-[#ece8df] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">{label}</div>
            <div className="mt-1 text-sm text-[#18181b]">{value || "—"}</div>
        </div>
    );
}

function EmptyState({ copy }: { copy: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-[#ddd6c8] bg-[#fafaf9] p-10 text-center text-sm italic text-slate-400">
            {copy}
        </div>
    );
}
