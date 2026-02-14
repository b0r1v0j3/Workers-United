import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import { Users, Building2 } from "lucide-react";
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

    // Use admin client for stats (bypasses RLS)
    const adminClient = createAdminClient();

    // Fetch ALL auth users for accurate count
    const { data: authData } = await adminClient.auth.admin.listUsers();
    const allAuthUsers = authData?.users || [];
    const candidatesCount = allAuthUsers.filter((u: any) =>
        u.user_metadata?.user_type !== 'employer' && u.user_metadata?.user_type !== 'admin'
    ).length;

    const { count: employersCount } = await adminClient
        .from("employers")
        .select("*", { count: "exact", head: true });



    // Get profiles for recent display
    const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name, email");

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

    // Recent candidates from auth users (excluding employers)
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

    // Fetch recent employers
    const { data: recentEmployers } = await adminClient
        .from("employers")
        .select("id, company_name, profile_id")
        .order("created_at", { ascending: false })
        .limit(5);

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                {/* Dashboard Header */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                        <p className="text-slate-500">Platform Overview & Management</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <StatCard href="/admin/workers" icon={<Users size={24} />} label="Total Workers" value={candidatesCount || 0} color="blue" />
                    <StatCard href="/admin/employers" icon={<Building2 size={24} />} label="Total Employers" value={employersCount || 0} color="purple" />
                </div>

                {/* Funnel Overview */}
                <FunnelChart />

                {/* Bulk Document Actions */}
                <BulkDocumentActions />

                {/* Activity Feed / Recent Lists */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Candidates */}
                    <Card title="New Workers" linkHref="/admin/workers" linkText="View All">
                        {recentCandidates && recentCandidates.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {recentCandidates.map((c: any) => (
                                    <div key={c.user_id} className="py-3 flex justify-between items-center hover:bg-slate-50 px-2 -mx-2 rounded-lg transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                                                {c.full_name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm">{c.full_name}</p>
                                                <p className="text-xs text-slate-500">{c.email}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString('en-GB')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-400 text-center py-6">No recent candidates</p>
                        )}
                    </Card>

                    {/* Recent Employers */}
                    <Card title="New Employers" linkHref="/admin/employers" linkText="View All">
                        {recentEmployers && recentEmployers.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {recentEmployers.map((e: any) => (
                                    <div key={e.id} className="py-3 flex justify-between items-center hover:bg-slate-50 px-2 -mx-2 rounded-lg transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                <Building2 size={20} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm">{e.company_name || "No Name"}</p>
                                                <p className="text-xs text-slate-500">{profileMap.get(e.profile_id)?.email || ""}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-400 text-center py-6">No recent employers</p>
                        )}
                    </Card>
                </div>
            </div>
        </AppShell>
    );
}

// ----------------------------------------------------------------------
// COMPONENTS
// ----------------------------------------------------------------------

function StatCard({ href, icon, label, value, color }: { href: string; icon: React.ReactNode; label: string; value: number; color: string }) {
    const colors: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600 ring-blue-100",
        purple: "bg-purple-50 text-purple-600 ring-purple-100",
        amber: "bg-amber-50 text-amber-600 ring-amber-100",
        green: "bg-green-50 text-green-600 ring-green-100"
    };
    return (
        <Link href={href} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]} ring-1`}>
                    {icon}
                </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
            <p className="text-sm font-medium text-slate-500">{label}</p>
        </Link>
    );
}

function Card({ title, linkHref, linkText, children }: { title: string; linkHref: string; linkText: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
                <Link href={linkHref} className="text-blue-600 text-sm font-semibold hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                    {linkText}
                </Link>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}
