import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import { ExternalLink, ShieldCheck } from "lucide-react";

export default async function AdminQueuePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const adminClient = createAdminClient();

    const { count: queueCount } = await adminClient
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("status", "IN_QUEUE")
        .eq("entry_fee_paid", true);

    const { count: pendingOffersCount } = await adminClient
        .from("offers")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

    const { count: refundFlaggedCount } = await adminClient
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("status", "REFUND_FLAGGED");

    const { data: queuedCandidatesRaw } = await adminClient
        .from("candidates")
        .select(`
            *,
            profiles(email, full_name)
        `)
        .eq("entry_fee_paid", true)
        .in("status", ["IN_QUEUE", "OFFER_PENDING"])
        .order("queue_position", { ascending: true })
        .limit(50);

    const nowMs = getCurrentTimeMs();
    const queuedCandidates = (queuedCandidatesRaw || []).map((candidate: any) => {
        const joinedAt = candidate.queue_joined_at ? new Date(candidate.queue_joined_at) : null;
        const daysInQueue = joinedAt ? Math.floor((nowMs - joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const daysRemaining = Math.max(0, 90 - daysInQueue);
        return { ...candidate, joinedAt, daysInQueue, daysRemaining };
    });
    const urgentQueueCount = queuedCandidates.filter((candidate: any) => candidate.daysRemaining <= 30).length;
    const criticalQueueCount = queuedCandidates.filter((candidate: any) => candidate.daysRemaining <= 14).length;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Admin queue"
                    title="Queue Operations"
                    description="Monitor workers already inside Job Finder, watch the 90-day guarantee window, and jump directly into either workspace inspection or the admin case view."
                    metrics={[
                        { label: "In Queue", value: queueCount || 0, meta: `${criticalQueueCount} critical` },
                        { label: "Offers", value: pendingOffersCount || 0, meta: "Pending decisions" },
                        { label: "Refunds", value: refundFlaggedCount || 0, meta: "Flagged for review" },
                        { label: "Urgent", value: urgentQueueCount, meta: "30-day watch" },
                    ]}
                />

                <section className="grid gap-4 md:grid-cols-3">
                    <InfoPanel
                        title="Inspect queue"
                        copy="Use inspect links when you want the worker-facing queue and status view with the exact same data the worker sees."
                        tone="dark"
                    />
                    <InfoPanel
                        title="Open case"
                        copy="Use the admin case when you need documents, approvals, payment history, refunds, or matching actions."
                        tone="blue"
                    />
                    <InfoPanel
                        title="Guarantee watch"
                        copy="Workers inside the last 30 days of the 90-day promise need first attention. The table highlights those countdowns directly."
                        tone="amber"
                    />
                </section>

                <div className="overflow-hidden rounded-[28px] border border-[#e6e6e1] bg-white shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="border-b border-[#f0ede6] bg-[#faf8f3] px-6 py-4">
                        <h2 className="text-lg font-semibold text-[#18181b]">Queue registry</h2>
                        <p className="mt-1 text-sm text-[#71717a]">Workers currently in active matching or waiting on an offer decision.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">#</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">Worker</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">Joined</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">90-Day Watch</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {queuedCandidates.map((candidate: any) => (
                                    <tr key={candidate.id} className="transition-colors hover:bg-slate-50">
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                                            {candidate.queue_position}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="text-sm font-medium text-slate-900">
                                                {candidate.profiles?.full_name || "No name"}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {candidate.profiles?.email || "No email"}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <StatusBadge status={candidate.status} />
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {candidate.joinedAt ? candidate.joinedAt.toLocaleDateString("en-GB") : "No date"}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            <div className="font-medium text-slate-700">{candidate.daysInQueue} days in queue</div>
                                            <div className={`text-xs font-semibold ${candidate.daysRemaining <= 14 ? "text-red-600" : candidate.daysRemaining <= 30 ? "text-amber-600" : "text-slate-500"}`}>
                                                {candidate.daysRemaining} days remaining
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/profile/worker/queue?inspect=${candidate.profile_id}`}
                                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                                >
                                                    <ExternalLink size={12} />
                                                    Inspect queue
                                                </Link>
                                                <Link
                                                    href={`/admin/workers/${candidate.profile_id}`}
                                                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                                                >
                                                    <ShieldCheck size={12} />
                                                    Open case
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {queuedCandidates.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-400">
                                                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                        <path d="M9 14l2 2 4-4" />
                                                    </svg>
                                                </div>
                                                <h3 className="mb-1 text-lg font-bold text-slate-800">Queue is Empty</h3>
                                                <p className="max-w-[320px] text-sm text-slate-500">
                                                    Workers will appear here once they complete the profile, verify documents, and pay the Job Finder fee.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

function InfoPanel({ title, copy, tone }: { title: string; copy: string; tone: "dark" | "blue" | "amber" }) {
    const toneClass = tone === "blue"
        ? "bg-blue-600 text-white"
        : tone === "amber"
            ? "bg-amber-500 text-white"
            : "bg-[#111111] text-white";

    return (
        <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className={`mb-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
                {title}
            </div>
            <p className="text-sm leading-relaxed text-[#57534e]">{copy}</p>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        IN_QUEUE: "border border-blue-200 bg-blue-100 text-blue-800",
        OFFER_PENDING: "border border-amber-200 bg-amber-100 text-amber-800",
        VISA_PROCESS_STARTED: "border border-green-200 bg-green-100 text-green-800",
        REFUND_FLAGGED: "border border-red-200 bg-red-100 text-red-800",
    };

    return (
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${styles[status] || "bg-gray-100 text-gray-800"}`}>
            {status.replace(/_/g, " ")}
        </span>
    );
}

function getCurrentTimeMs() {
    return Date.now();
}
