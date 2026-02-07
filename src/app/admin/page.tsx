import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";

export default async function AdminDashboard() {
    // Use admin client for stats (bypasses RLS)
    const adminClient = createAdminClient();

    // Fetch ALL auth users for accurate count
    const { data: authData } = await adminClient.auth.admin.listUsers();
    const allAuthUsers = authData?.users || [];
    const candidatesCount = allAuthUsers.filter((u: any) =>
        u.user_metadata?.user_type !== 'employer'
    ).length;

    const { count: employersCount } = await adminClient
        .from("employers")
        .select("*", { count: "exact", head: true });

    const { count: pendingDocsCount } = await adminClient
        .from("candidate_documents")
        .select("*", { count: "exact", head: true })
        .eq("status", "verifying");

    const { count: verifiedDocsCount } = await adminClient
        .from("candidate_documents")
        .select("*", { count: "exact", head: true })
        .eq("status", "verified");

    // Get profiles for recent display
    const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name, email");

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

    // Recent candidates from auth users (excluding employers)
    const recentCandidates = allAuthUsers
        .filter((u: any) => u.user_metadata?.user_type !== 'employer')
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
        .select("id, company_name, workers_needed, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

    return (
        <div className="max-w-[1100px] mx-auto px-4 py-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-500 mt-1">Overview of your platform</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard href="/admin/candidates" icon="👤" label="Total Candidates" value={candidatesCount || 0} color="blue" />
                <StatCard href="/admin/employers" icon="🏢" label="Total Employers" value={employersCount || 0} color="purple" />
                <StatCard href="/admin/candidates" icon="⏳" label="Pending Docs" value={pendingDocsCount || 0} color="amber" />
                <StatCard href="/admin/candidates" icon="✅" label="Verified Docs" value={verifiedDocsCount || 0} color="green" />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <ActionCard href="/admin/candidates" title="Manage Candidates" desc="View all candidates, verify documents" gradient="from-teal-500 to-emerald-500" />
                <ActionCard href="/admin/employers" title="Manage Employers" desc="View employers, job requirements" gradient="from-blue-500 to-indigo-500" />
                <ActionCard href="/admin/jobs" title="Job Queue" desc="Background jobs & email queues" gradient="from-purple-500 to-pink-500" />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Candidates */}
                <Card title="Recent Candidates" linkHref="/admin/candidates" linkText="View All">
                    {recentCandidates && recentCandidates.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {recentCandidates.map((c: any) => (
                                <div key={c.user_id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-gray-900 text-[15px]">{c.full_name || "Unknown"}</p>
                                        <p className="text-[13px] text-gray-500">{c.email}</p>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === "verified" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                        }`}>
                                        {c.status || "pending"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-6">No recent candidates</p>
                    )}
                </Card>

                {/* Recent Employers */}
                <Card title="Recent Employers" linkHref="/admin/employers" linkText="View All">
                    {recentEmployers && recentEmployers.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {recentEmployers.map((e: any) => (
                                <div key={e.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-gray-900 text-[15px]">{e.company_name || "Unknown"}</p>
                                        <p className="text-[13px] text-gray-500">
                                            {new Date(e.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-teal-600 font-bold">{e.workers_needed || 0}</span>
                                        <span className="text-gray-500 text-sm ml-1">needed</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-6">No recent employers</p>
                    )}
                </Card>
            </div>
        </div>
    );
}

function StatCard({ href, icon, label, value, color }: { href: string; icon: string; label: string; value: number; color: string }) {
    const colors: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600",
        purple: "bg-purple-50 text-purple-600",
        amber: "bg-amber-50 text-amber-600",
        green: "bg-green-50 text-green-600"
    };
    return (
        <Link href={href} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${colors[color]}`}>{icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-[13px] text-gray-500">{label}</p>
        </Link>
    );
}

function ActionCard({ href, title, desc, gradient }: { href: string; title: string; desc: string; gradient: string }) {
    return (
        <Link href={href} className={`bg-gradient-to-br ${gradient} text-white rounded-lg p-4 hover:opacity-90 transition-opacity`}>
            <h3 className="font-bold text-lg mb-1">{title}</h3>
            <p className="text-white/80 text-sm">{desc}</p>
        </Link>
    );
}

function Card({ title, linkHref, linkText, children }: { title: string; linkHref: string; linkText: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h2 className="font-semibold text-gray-900 text-[15px]">{title}</h2>
                <Link href={linkHref} className="text-teal-600 text-sm font-medium hover:underline">{linkText} →</Link>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}
