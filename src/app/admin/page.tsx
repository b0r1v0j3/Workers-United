import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { getWorkerCompletion } from "@/lib/profile-completion";
import AppShell from "@/components/AppShell";
import { Users, Building2, ChevronRight, AlertTriangle, ArrowRight, TrendingUp, UserCheck, Clock, DollarSign, BarChart3, ShieldCheck } from "lucide-react";

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
        allAuthUsers,
        { data: profiles },
        { data: employers },
        { data: allDocs },
        { data: payments },
    ] = await Promise.all([
        adminClient.from("candidates").select("id, profile_id, status, queue_joined_at, admin_approved, created_at, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, lives_abroad, previous_visas"),
        getAllAuthUsers(adminClient),
        adminClient.from("profiles").select("id, full_name, email"),
        adminClient.from("employers").select("id, profile_id, company_name, status, created_at"),
        adminClient.from("candidate_documents").select("user_id, document_type, status"),
        adminClient.from("payments").select("id, amount, status, payment_type, created_at"),
    ]);


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
        const status = c.status || 'NEW'; // null/empty = NEW (same as Recent Workers logic)
        if (statusCounts[status] !== undefined) {
            statusCounts[status]++;
        }
    });
    const totalEmployers = employers?.length || 0;

    // ─── Quick Stats ───
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const workerAuthUsers = allAuthUsers.filter((u: any) => u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin');
    const totalWorkers = workerAuthUsers.length || allCandidates?.length || 0;
    const registrationsThisWeek = workerAuthUsers.filter((u: any) => new Date(u.created_at) >= weekAgo).length;
    const registrationsThisMonth = workerAuthUsers.filter((u: any) => new Date(u.created_at) >= monthStart).length;
    const employerRegistrationsThisMonth = (employers || []).filter((e: any) => new Date(e.created_at) >= monthStart).length;

    const approvedCount = (allCandidates || []).filter((c: any) => c.admin_approved).length;
    const pendingApproval = (allCandidates || []).filter((c: any) => c.status === 'PENDING_APPROVAL' && !c.admin_approved).length;

    // Profile completion average
    let totalCompletion = 0;
    let completionCount = 0;
    let fullyComplete = 0;
    for (const c of (allCandidates || [])) {
        const p = profileMap.get(c.profile_id);
        const docs = (allDocs?.filter((d: any) => d.user_id === c.profile_id) || []) as { document_type: string }[];
        const result = getWorkerCompletion({ profile: p || null, candidate: c || null, documents: docs });
        totalCompletion += result.completion;
        completionCount++;
        if (result.completion === 100) fullyComplete++;
    }
    const avgCompletion = completionCount > 0 ? Math.round(totalCompletion / completionCount) : 0;

    // Payment stats
    const successfulPayments = (payments || []).filter((p: any) => p.status === 'completed' || p.status === 'paid');
    const totalRevenue = successfulPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const revenueThisMonth = successfulPayments
        .filter((p: any) => new Date(p.created_at) >= monthStart)
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

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
            <div className="space-y-8">
                {/* ─── Header ─── */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E3A5F] to-[#2563EB] p-8 text-white shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
                            <p className="text-blue-100 opacity-90">Overview of the entire hiring pipeline and platform activity.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 text-center min-w-[100px]">
                                <p className="text-2xl font-bold">{totalWorkers}</p>
                                <p className="text-xs text-blue-200 uppercase tracking-wide">Workers</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 text-center min-w-[100px]">
                                <p className="text-2xl font-bold">{totalEmployers}</p>
                                <p className="text-xs text-blue-200 uppercase tracking-wide">Employers</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Quick Stats Grid ─── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard icon={<TrendingUp size={18} />} label="This Week" value={registrationsThisWeek} subtitle="new workers" color="blue" />
                    <StatCard icon={<Users size={18} />} label="This Month" value={registrationsThisMonth} subtitle={`+ ${employerRegistrationsThisMonth} employers`} color="indigo" />
                    <StatCard icon={<BarChart3 size={18} />} label="Avg Completion" value={`${avgCompletion}%`} subtitle={`${fullyComplete} at 100%`} color="cyan" />
                    <StatCard icon={<ShieldCheck size={18} />} label="Approved" value={approvedCount} subtitle="by admin" color="emerald" />
                    <StatCard icon={<UserCheck size={18} />} label="Pending" value={pendingApproval} subtitle="need approval" color={pendingApproval > 0 ? "amber" : "slate"} />
                    <StatCard icon={<DollarSign size={18} />} label="Revenue" value={`$${totalRevenue}`} subtitle={revenueThisMonth > 0 ? `$${revenueThisMonth} this month` : "no payments yet"} color="green" />
                </div>

                {/* ─── Pipeline Overview ─── */}
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)]">
                    <div className="mb-6 border-b border-slate-100 pb-4 flex items-center justify-between">
                        <h2 className="font-bold text-slate-900 text-xl">Worker Pipeline</h2>
                    </div>

                    {/* Main flow - Modified Design */}
                    <div className="flex flex-wrap items-center gap-3 mb-6">
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
                    <div className="flex gap-3 pt-4 border-t border-slate-50">
                        <PipelineBadge label="Rejected" count={statusCounts['REJECTED']} color="red" href="/admin/workers?filter=REJECTED" />
                        <PipelineBadge label="Refund" count={statusCounts['REFUND_FLAGGED']} color="rose" href="/admin/workers?filter=REFUND_FLAGGED" />
                    </div>
                </div>

                {/* ─── 90-Day Countdown ─── */}
                {queueWorkers.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-100 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900 text-lg">90-Day Queue Countdown</h2>
                                <p className="text-slate-500 text-sm">Workers approaching the refund deadline</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {queueWorkers.map((w: any) => (
                                <Link key={w.id} href={`/admin/workers/${w.id}`}
                                    className="block bg-white p-4 rounded-xl border border-amber-100 hover:shadow-md hover:border-amber-200 transition-all duration-300 group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{w.name}</p>
                                        <span className={`text-lg font-black ${w.daysRemaining <= 14 ? 'text-red-500' : w.daysRemaining <= 30 ? 'text-amber-500' : 'text-slate-400'}`}>
                                            {w.daysRemaining}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <p className="text-xs text-slate-500">{w.email}</p>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Days Left</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Recent Activity ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Workers */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col">
                        <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 bg-opacity-95 backdrop-blur-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Users size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Recent Workers</h3>
                                    <p className="text-xs text-slate-500">Last 5 registrations</p>
                                </div>
                            </div>
                            <Link href="/admin/workers" className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                                View All <ChevronRight size={12} />
                            </Link>
                        </div>
                        <div className="divide-y divide-slate-50 flex-grow">
                            {recentWorkers.length > 0 ? recentWorkers.map((w: any) => (
                                <Link key={w.id} href={`/admin/workers/${w.id}`}
                                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-200 group-hover:scale-105 transition-transform">
                                        {w.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{w.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{w.email}</p>
                                    </div>
                                    <div className="text-right">
                                        <StatusBadge status={w.status} />
                                        <p className="text-[10px] text-slate-400 mt-1">{new Date(w.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </Link>
                            )) : (
                                <div className="px-6 py-10 text-center text-slate-400 text-sm">No recent workers found</div>
                            )}
                        </div>
                    </div>

                    {/* Recent Employers */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col">
                        <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 bg-opacity-95 backdrop-blur-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                                    <Building2 size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Recent Employers</h3>
                                    <p className="text-xs text-slate-500">Last 5 registrations</p>
                                </div>
                            </div>
                            <Link href="/admin/employers" className="text-xs font-bold text-violet-600 hover:text-violet-700 bg-violet-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                                View All <ChevronRight size={12} />
                            </Link>
                        </div>
                        <div className="divide-y divide-slate-50 flex-grow">
                            {recentEmployers.length > 0 ? recentEmployers.map((e: any) => (
                                <div key={e.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-200 group-hover:scale-105 transition-transform">
                                        <Building2 size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900 group-hover:text-violet-600 transition-colors">{e.companyName}</p>
                                        <p className="text-xs text-slate-500 truncate">{e.email}</p>
                                    </div>
                                    <StatusBadge status={e.status} />
                                </div>
                            )) : (
                                <div className="px-6 py-10 text-center text-slate-400 text-sm">No recent employers found</div>
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
    const colorMap: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
        slate: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", dot: "bg-slate-500" },
        blue: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-100", dot: "bg-blue-500" },
        indigo: { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-100", dot: "bg-indigo-500" },
        amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-100", dot: "bg-amber-500" },
        orange: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-100", dot: "bg-orange-500" },
        emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100", dot: "bg-emerald-500" },
        green: { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-100", dot: "bg-green-500" },
        red: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-100", dot: "bg-red-500" },
        rose: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-100", dot: "bg-rose-500" },
    };
    const c = colorMap[color] || colorMap.slate;

    return (
        <Link href={href}
            className={`group inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${c.ring} ${c.bg} hover:shadow-md hover:-translate-y-0.5 transition-all duration-300`}
        >
            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
            <div className="flex flex-col">
                <span className={`text-[10px] font-bold uppercase tracking-wider opacity-70 leading-none mb-0.5 ${c.text}`}>{label}</span>
                <span className={`text-lg font-black leading-none ${c.text}`}>{count}</span>
            </div>
        </Link>
    );
}

function PipelineArrow() {
    return <ChevronRight size={16} className="text-slate-300 opacity-50 shrink-0 hidden md:inline" />;
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        NEW: "bg-slate-100 text-slate-600 border-slate-200",
        PROFILE_COMPLETE: "bg-blue-50 text-blue-700 border-blue-100",
        PENDING_APPROVAL: "bg-indigo-50 text-indigo-700 border-indigo-100",
        VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-100",
        APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-100",
        IN_QUEUE: "bg-amber-50 text-amber-700 border-amber-100",
        OFFER_PENDING: "bg-orange-50 text-orange-700 border-orange-100",
        OFFER_ACCEPTED: "bg-orange-50 text-orange-700 border-orange-100",
        VISA_PROCESS_STARTED: "bg-green-50 text-green-700 border-green-200",
        VISA_APPROVED: "bg-green-50 text-green-700 border-green-200",
        PLACED: "bg-green-100 text-green-800 border-green-200",
        REJECTED: "bg-red-50 text-red-700 border-red-100",
        REFUND_FLAGGED: "bg-rose-50 text-rose-700 border-rose-100",
        PENDING: "bg-amber-50 text-amber-700 border-amber-100",
        ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
    };
    return (
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase shrink-0 border ${styles[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {status?.replace(/_/g, ' ') || 'UNKNOWN'}
        </span>
    );
}

function StatCard({ icon, label, value, subtitle, color }: {
    icon: React.ReactNode; label: string; value: string | number; subtitle: string; color: string;
}) {
    const colorMap: Record<string, { bg: string; iconBg: string; text: string }> = {
        blue: { bg: "bg-blue-50 border-blue-100", iconBg: "bg-blue-500", text: "text-blue-700" },
        indigo: { bg: "bg-indigo-50 border-indigo-100", iconBg: "bg-indigo-500", text: "text-indigo-700" },
        cyan: { bg: "bg-cyan-50 border-cyan-100", iconBg: "bg-cyan-500", text: "text-cyan-700" },
        emerald: { bg: "bg-emerald-50 border-emerald-100", iconBg: "bg-emerald-500", text: "text-emerald-700" },
        amber: { bg: "bg-amber-50 border-amber-100", iconBg: "bg-amber-500", text: "text-amber-700" },
        green: { bg: "bg-green-50 border-green-100", iconBg: "bg-green-500", text: "text-green-700" },
        slate: { bg: "bg-slate-50 border-slate-200", iconBg: "bg-slate-400", text: "text-slate-600" },
    };
    const c = colorMap[color] || colorMap.slate;
    return (
        <div className={`rounded-2xl border p-4 ${c.bg} hover:shadow-md hover:-translate-y-0.5 transition-all duration-300`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg ${c.iconBg} flex items-center justify-center text-white`}>{icon}</div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-2xl font-black ${c.text}`}>{value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
    );
}
