import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import { Users, Building2, ChevronRight, AlertTriangle } from "lucide-react";

export default async function AdminDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== 'admin' && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const adminClient = createAdminClient();

    // Parallel data fetching
    const [
        { data: allCandidates },
        { data: authData },
        { data: profiles },
        { data: employers },
        { data: allProfiles },
    ] = await Promise.all([
        adminClient.from("candidates").select("id, profile_id, status, queue_joined_at, admin_approved, created_at"),
        adminClient.auth.admin.listUsers(),
        adminClient.from("profiles").select("id, full_name, email"),
        adminClient.from("employers").select("id, profile_id, company_name, status, created_at"),
        adminClient.from("profiles").select("id, full_name, email"),
    ]);


    const allAuthUsers = authData?.users || [];
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

    // ─── Pipeline counts ───
    const statusCounts: Record<string, number> = {};
    const pipelineStatuses = [
        'NEW', 'PROFILE_COMPLETE', 'PENDING_APPROVAL', 'VERIFIED',
        'IN_QUEUE', 'OFFER_PENDING', 'OFFER_ACCEPTED',
        'VISA_PROCESS_STARTED', 'VISA_APPROVED', 'PLACED',
        'REJECTED', 'REFUND_FLAGGED'
    ];
    pipelineStatuses.forEach(s => statusCounts[s] = 0);
    allCandidates?.forEach((c: any) => {
        if (c.status && statusCounts[c.status] !== undefined) {
            statusCounts[c.status]++;
        }
    });
    const totalWorkers = allCandidates?.length || 0;
    const totalEmployers = employers?.length || 0;

    // ─── 90-day countdown ───
    const queueWorkers = (allCandidates || [])
        .filter((c: any) => c.status === 'IN_QUEUE' && c.queue_joined_at)
        .map((c: any) => {
            const joinedAt = new Date(c.queue_joined_at);
            const daysInQueue = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
            const daysRemaining = 90 - daysInQueue;
            const profileInfo = profileMap.get(c.profile_id);
            return {
                id: c.profile_id,
                name: profileInfo?.full_name || "Unknown",
                email: profileInfo?.email || "",
                daysInQueue,
                daysRemaining,
                joinedAt: joinedAt.toLocaleDateString('en-GB'),
            };
        })
        .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);

    // ─── Recent workers ───
    const recentWorkers = allAuthUsers
        .filter((u: any) => u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((u: any) => {
            const candidate = allCandidates?.find((c: any) => c.profile_id === u.id);
            return {
                id: u.id,
                name: profileMap.get(u.id)?.full_name || u.user_metadata?.full_name || "Unknown",
                email: u.email,
                status: candidate?.status || "NEW",
                createdAt: u.created_at,
            };
        });

    // ─── Recent employers ───
    const recentEmployers = (employers || [])
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((e: any) => ({
            id: e.profile_id,
            companyName: e.company_name || "Unnamed",
            email: profileMap.get(e.profile_id)?.email || "",
            status: e.status || "PENDING",
        }));

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-5">

                {/* ─── Pipeline Overview ─── */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-900 text-lg">Worker Pipeline</h2>
                        <span className="text-sm text-slate-400">{totalWorkers} total</span>
                    </div>

                    {/* Main flow */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        <PipelineBadge label="New" count={statusCounts['NEW']} color="slate" href="/admin/workers?filter=NEW" />
                        <PipelineArrow />
                        <PipelineBadge label="Profile Done" count={statusCounts['PROFILE_COMPLETE']} color="blue" href="/admin/workers?filter=PROFILE_COMPLETE" />
                        <PipelineArrow />
                        <PipelineBadge label="Approved" count={statusCounts['PENDING_APPROVAL'] + statusCounts['VERIFIED']} color="indigo" href="/admin/workers?filter=VERIFIED" />
                        <PipelineArrow />
                        <PipelineBadge label="In Queue" count={statusCounts['IN_QUEUE']} color="amber" href="/admin/workers?filter=IN_QUEUE" />
                        <PipelineArrow />
                        <PipelineBadge label="Offer" count={statusCounts['OFFER_PENDING'] + statusCounts['OFFER_ACCEPTED']} color="orange" href="/admin/workers?filter=OFFER_PENDING" />
                        <PipelineArrow />
                        <PipelineBadge label="Visa" count={statusCounts['VISA_PROCESS_STARTED'] + (statusCounts['VISA_APPROVED'] || 0)} color="emerald" href="/admin/workers?filter=VISA_PROCESS_STARTED" />
                        <PipelineArrow />
                        <PipelineBadge label="Placed" count={statusCounts['PLACED']} color="green" href="/admin/workers?filter=PLACED" />
                    </div>

                    {/* Problem statuses */}
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <PipelineBadge label="Rejected" count={statusCounts['REJECTED']} color="red" href="/admin/workers?filter=REJECTED" />
                        <PipelineBadge label="Refund" count={statusCounts['REFUND_FLAGGED']} color="rose" href="/admin/workers?filter=REFUND_FLAGGED" />
                    </div>
                </div>

                {/* ─── 90-Day Countdown ─── */}
                {queueWorkers.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle size={18} className="text-amber-500" />
                            <h2 className="font-bold text-slate-900 text-lg">90-Day Countdown</h2>
                        </div>
                        <div className="space-y-3">
                            {queueWorkers.map((w: any) => (
                                <Link key={w.id} href={`/admin/workers/${w.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-900 text-sm">{w.name}</p>
                                        <p className="text-xs text-slate-400">{w.email} • Joined {w.joinedAt}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-lg font-bold ${w.daysRemaining <= 14 ? 'text-red-600' : w.daysRemaining <= 30 ? 'text-amber-600' : 'text-slate-700'}`}>
                                            {w.daysRemaining}
                                        </span>
                                        <p className="text-[10px] text-slate-400 uppercase font-semibold">days left</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Recent Activity ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Recent Workers */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-blue-500" />
                                <h3 className="font-bold text-slate-800 text-sm">Recent Workers</h3>
                            </div>
                            <Link href="/admin/workers" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
                                View All <ChevronRight size={12} />
                            </Link>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {recentWorkers.length > 0 ? recentWorkers.map((w: any) => (
                                <Link key={w.id} href={`/admin/workers/${w.id}`}
                                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                        {w.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900 text-sm truncate">{w.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{w.email}</p>
                                    </div>
                                    <StatusBadge status={w.status} />
                                </Link>
                            )) : (
                                <div className="px-5 py-8 text-center text-slate-400 text-sm">No workers yet</div>
                            )}
                        </div>
                    </div>

                    {/* Recent Employers */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-violet-500" />
                                <h3 className="font-bold text-slate-800 text-sm">Recent Employers</h3>
                            </div>
                            <Link href="/admin/employers" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
                                View All <ChevronRight size={12} />
                            </Link>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {recentEmployers.length > 0 ? recentEmployers.map((e: any) => (
                                <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                                        <Building2 size={14} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900 text-sm truncate">{e.companyName}</p>
                                        <p className="text-xs text-slate-400 truncate">{e.email}</p>
                                    </div>
                                    <StatusBadge status={e.status} />
                                </div>
                            )) : (
                                <div className="px-5 py-8 text-center text-slate-400 text-sm">No employers yet</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </AppShell>
    );
}

// ─── Components ──────────────────────────────────────────────

function PipelineBadge({ label, count, color, href }: {
    label: string; count: number; color: string; href: string;
}) {
    const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
        slate: { bg: "bg-slate-50", text: "text-slate-700", ring: "ring-slate-200" },
        blue: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
        indigo: { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200" },
        amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
        orange: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
        emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
        green: { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-200" },
        red: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" },
        rose: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
    };
    const c = colorMap[color] || colorMap.slate;

    return (
        <Link href={href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ${c.bg} ${c.text} ${c.ring} hover:brightness-95 transition-all text-sm`}
        >
            <span className="font-bold text-base">{count}</span>
            <span className="font-medium text-xs">{label}</span>
        </Link>
    );
}

function PipelineArrow() {
    return <ChevronRight size={16} className="text-slate-300 self-center hidden sm:inline" />;
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        NEW: "bg-slate-100 text-slate-600",
        PROFILE_COMPLETE: "bg-blue-100 text-blue-700",
        PENDING_APPROVAL: "bg-indigo-100 text-indigo-700",
        VERIFIED: "bg-emerald-100 text-emerald-700",
        APPROVED: "bg-emerald-100 text-emerald-700",
        IN_QUEUE: "bg-amber-100 text-amber-700",
        OFFER_PENDING: "bg-orange-100 text-orange-700",
        OFFER_ACCEPTED: "bg-orange-100 text-orange-700",
        VISA_PROCESS_STARTED: "bg-green-100 text-green-700",
        VISA_APPROVED: "bg-green-100 text-green-700",
        PLACED: "bg-green-100 text-green-800",
        REJECTED: "bg-red-100 text-red-700",
        REFUND_FLAGGED: "bg-rose-100 text-rose-700",
        PENDING: "bg-amber-100 text-amber-700",
        ACTIVE: "bg-emerald-100 text-emerald-700",
    };
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${styles[status] || "bg-slate-100 text-slate-600"}`}>
            {status?.replace(/_/g, ' ') || 'UNKNOWN'}
        </span>
    );
}
