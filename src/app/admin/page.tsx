import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import { Users, Building2, Clock, FileCheck, Briefcase, TrendingUp, ChevronRight, Activity } from "lucide-react";
import FunnelChart from "./FunnelChart";
import BulkDocumentActions from "@/components/admin/BulkDocumentActions";

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

    // Parallel data fetching for performance
    const [
        { data: authData },
        { count: employersCount },
        { count: inQueueCount },
        { count: pendingOffersCount },
        { count: openJobsCount },
        { data: profiles },
        { data: recentEmployers },
    ] = await Promise.all([
        adminClient.auth.admin.listUsers(),
        adminClient.from("employers").select("*", { count: "exact", head: true }),
        adminClient.from("candidates").select("*", { count: "exact", head: true }).eq("status", "IN_QUEUE"),
        adminClient.from("offers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        adminClient.from("job_requests").select("*", { count: "exact", head: true }).eq("status", "open"),
        adminClient.from("profiles").select("id, full_name, email"),
        adminClient.from("employers").select("id, company_name, profile_id, status").order("created_at", { ascending: false }).limit(5),
    ]);

    const allAuthUsers = authData?.users || [];
    const candidatesCount = allAuthUsers.filter((u: any) =>
        u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin'
    ).length;

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

    const recentCandidates = allAuthUsers
        .filter((u: any) => u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((u: any) => ({
            user_id: u.id,
            full_name: profileMap.get(u.id)?.full_name || u.user_metadata?.full_name || "Unknown",
            email: u.email,
            created_at: u.created_at
        }));

    const today = new Date();
    const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";
    const firstName = user.user_metadata?.full_name?.split(" ")[0] || "Admin";

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                {/* Hero Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 sm:p-8">
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }} />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">System Online</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{greeting}, {firstName}</h1>
                        <p className="text-slate-400 text-sm">Workers United Admin Dashboard</p>
                    </div>
                </div>

                {/* Stats Grid — 3 on mobile, 6 total */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard
                        href="/admin/workers"
                        icon={<Users size={20} />}
                        label="Workers"
                        value={candidatesCount || 0}
                        color="blue"
                    />
                    <StatCard
                        href="/admin/employers"
                        icon={<Building2 size={20} />}
                        label="Employers"
                        value={employersCount || 0}
                        color="violet"
                    />
                    <StatCard
                        href="/admin/queue"
                        icon={<Clock size={20} />}
                        label="In Queue"
                        value={inQueueCount || 0}
                        color="amber"
                    />
                    <StatCard
                        href="/admin/queue"
                        icon={<FileCheck size={20} />}
                        label="Pending Offers"
                        value={pendingOffersCount || 0}
                        color="orange"
                    />
                    <StatCard
                        href="/admin/jobs"
                        icon={<Briefcase size={20} />}
                        label="Open Jobs"
                        value={openJobsCount || 0}
                        color="emerald"
                    />
                    <StatCard
                        href="/admin/analytics"
                        icon={<TrendingUp size={20} />}
                        label="Total Users"
                        value={allAuthUsers.length}
                        color="slate"
                    />
                </div>

                {/* Pipeline Overview */}
                <FunnelChart />

                {/* Bulk Document Actions */}
                <BulkDocumentActions />

                {/* Activity Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Recent Workers */}
                    <ActivityCard
                        title="Recent Workers"
                        linkHref="/admin/workers"
                        icon={<Users size={18} className="text-blue-500" />}
                        emptyText="No workers registered yet"
                    >
                        {recentCandidates && recentCandidates.length > 0 ? (
                            <div className="divide-y divide-slate-100/80">
                                {recentCandidates.map((c: any) => (
                                    <Link
                                        key={c.user_id}
                                        href={`/admin/workers/${c.user_id}`}
                                        className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                            {c.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-slate-900 text-sm truncate">{c.full_name}</p>
                                            <p className="text-xs text-slate-400 truncate">{c.email}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[11px] text-slate-400">{timeAgo(c.created_at)}</span>
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : null}
                    </ActivityCard>

                    {/* Recent Employers */}
                    <ActivityCard
                        title="Recent Employers"
                        linkHref="/admin/employers"
                        icon={<Building2 size={18} className="text-violet-500" />}
                        emptyText="No employers registered yet"
                    >
                        {recentEmployers && recentEmployers.length > 0 ? (
                            <div className="divide-y divide-slate-100/80">
                                {recentEmployers.map((e: any) => (
                                    <div key={e.id} className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                                            <Building2 size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-slate-900 text-sm truncate">{e.company_name || "Unnamed Company"}</p>
                                            <p className="text-xs text-slate-400 truncate">{profileMap.get(e.profile_id)?.email || ""}</p>
                                        </div>
                                        <StatusBadge status={e.status} />
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </ActivityCard>
                </div>
            </div>
        </AppShell>
    );
}

// ─── COMPONENTS ──────────────────────────────────────────────

function StatCard({ href, icon, label, value, color }: {
    href: string;
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
}) {
    const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
        blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200/50" },
        violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-200/50" },
        amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200/50" },
        orange: { bg: "bg-orange-50", text: "text-orange-600", ring: "ring-orange-200/50" },
        emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200/50" },
        slate: { bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-200/50" },
    };
    const c = colorMap[color] || colorMap.slate;

    return (
        <Link
            href={href}
            className="bg-white rounded-xl border border-slate-200/80 p-4 hover:shadow-md hover:border-slate-300 transition-all group"
        >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.bg} ${c.text} ring-1 ${c.ring} mb-3 group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">{value.toLocaleString()}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
        </Link>
    );
}

function ActivityCard({ title, linkHref, icon, emptyText, children }: {
    title: string;
    linkHref: string;
    icon: React.ReactNode;
    emptyText: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                        {icon}
                    </div>
                    <h2 className="font-bold text-slate-800">{title}</h2>
                </div>
                <Link
                    href={linkHref}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                    View All <ChevronRight size={12} />
                </Link>
            </div>
            <div className="p-4">
                {children || (
                    <div className="text-center py-8">
                        <Activity size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400">{emptyText}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200/50",
        VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-200/50",
        PENDING: "bg-amber-50 text-amber-700 ring-amber-200/50",
        REJECTED: "bg-red-50 text-red-700 ring-red-200/50",
        SUSPENDED: "bg-slate-100 text-slate-600 ring-slate-200/50",
    };
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ring-1 ${styles[status] || styles.PENDING}`}>
            {status}
        </span>
    );
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;

    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
