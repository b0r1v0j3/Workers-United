import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";

export default async function AdminDashboard() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Check if god mode user (owner) - bypasses admin role requirement
    const isOwner = isGodModeUser(user.email);

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    // Only allow admin role or owner
    if (profile?.role !== 'admin' && !isOwner) {
        redirect("/dashboard");
    }

    // Fetch stats
    const { count: candidatesCount } = await supabase
        .from("candidates")
        .select("*", { count: "exact", head: true });

    const { count: employersCount } = await supabase
        .from("employers")
        .select("*", { count: "exact", head: true });

    const { count: pendingDocsCount } = await supabase
        .from("candidate_documents")
        .select("*", { count: "exact", head: true })
        .eq("status", "verifying");

    const { count: verifiedDocsCount } = await supabase
        .from("candidate_documents")
        .select("*", { count: "exact", head: true })
        .eq("status", "verified");

    // Fetch recent candidates for activity feed
    const { data: recentCandidates } = await supabase
        .from("admin_candidate_full_overview")
        .select("user_id, full_name, email, created_at, paid_at")
        .order("created_at", { ascending: false })
        .limit(5);

    // Fetch recent employers
    const { data: recentEmployers } = await supabase
        .from("employers")
        .select("id, company_name, workers_needed, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

    const stats = [
        {
            label: "Total Candidates",
            value: candidatesCount || 0,
            icon: "👤",
            color: "bg-blue-500",
            href: "/admin/candidates"
        },
        {
            label: "Total Employers",
            value: employersCount || 0,
            icon: "🏢",
            color: "bg-purple-500",
            href: "/admin/employers"
        },
        {
            label: "Pending Verifications",
            value: pendingDocsCount || 0,
            icon: "⏳",
            color: "bg-yellow-500",
            href: "/admin/candidates"
        },
        {
            label: "Verified Documents",
            value: verifiedDocsCount || 0,
            icon: "✅",
            color: "bg-green-500",
            href: "/admin/candidates"
        }
    ];

    return (
        <div className="min-h-screen bg-[#f1f5f9] font-montserrat">
            {/* Header */}
            <nav className="bg-[#183b56] px-5 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Workers United" width={48} height={48} className="brightness-0 invert rounded" />
                    <span className="font-bold text-white text-lg">Admin Dashboard</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[#2f6fed] text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                        God Mode
                    </div>
                    <form action="/auth/signout" method="post">
                        <button type="submit" className="text-gray-300 text-sm font-semibold hover:text-white transition-colors">
                            Logout
                        </button>
                    </form>
                </div>
            </nav>

            <div className="max-w-[1200px] mx-auto px-5 py-10">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#1e293b]">Welcome, Admin</h1>
                    <p className="text-[#64748b] mt-1 font-medium">Here&apos;s an overview of your platform.</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    {stats.map((stat) => (
                        <Link
                            key={stat.label}
                            href={stat.href}
                            className="bg-white rounded-[16px] p-6 shadow-sm border border-[#dde3ec] hover:shadow-md hover:border-[#2f6fed] transition-all group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <span className={`${stat.color} text-white text-2xl w-12 h-12 rounded-xl flex items-center justify-center`}>
                                    {stat.icon}
                                </span>
                                <span className="text-[#94a3b8] group-hover:text-[#2f6fed] transition-colors">→</span>
                            </div>
                            <div className="text-4xl font-bold text-[#1e293b] mb-1">{stat.value}</div>
                            <div className="text-[#64748b] font-medium text-sm">{stat.label}</div>
                        </Link>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <Link
                        href="/admin/candidates"
                        className="bg-gradient-to-br from-[#2f6fed] to-[#1e5cd6] text-white rounded-[16px] p-6 shadow-lg hover:shadow-xl transition-shadow"
                    >
                        <h3 className="font-bold text-xl mb-2">Manage Candidates</h3>
                        <p className="text-blue-100 text-sm">View all candidates, verify documents, process refunds</p>
                    </Link>
                    <Link
                        href="/admin/employers"
                        className="bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white rounded-[16px] p-6 shadow-lg hover:shadow-xl transition-shadow"
                    >
                        <h3 className="font-bold text-xl mb-2">Manage Employers</h3>
                        <p className="text-purple-100 text-sm">View employer accounts, job requirements, match workers</p>
                    </Link>
                    <Link
                        href="/admin/jobs"
                        className="bg-gradient-to-br from-[#10b981] to-[#059669] text-white rounded-[16px] p-6 shadow-lg hover:shadow-xl transition-shadow"
                    >
                        <h3 className="font-bold text-xl mb-2">Job Queue</h3>
                        <p className="text-green-100 text-sm">View background jobs & email queues</p>
                    </Link>
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Candidates */}
                    <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#dde3ec] flex justify-between items-center">
                            <h2 className="font-bold text-[#1e293b]">Recent Candidates</h2>
                            <Link href="/admin/candidates" className="text-[#2f6fed] text-sm font-semibold hover:underline">View All →</Link>
                        </div>
                        <div className="divide-y divide-[#f1f5f9]">
                            {recentCandidates?.map((c: any) => (
                                <div key={c.user_id} className="px-6 py-4 flex justify-between items-center hover:bg-[#fbfcfe]">
                                    <div>
                                        <div className="font-semibold text-[#1e293b]">{c.full_name || "Unknown"}</div>
                                        <div className="text-[13px] text-[#64748b]">{c.email}</div>
                                    </div>
                                    <div className="text-right">
                                        {c.paid_at ? (
                                            <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Paid</span>
                                        ) : (
                                            <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">Unpaid</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {(!recentCandidates || recentCandidates.length === 0) && (
                                <div className="px-6 py-8 text-center text-[#94a3b8]">No recent candidates</div>
                            )}
                        </div>
                    </div>

                    {/* Recent Employers */}
                    <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#dde3ec] flex justify-between items-center">
                            <h2 className="font-bold text-[#1e293b]">Recent Employers</h2>
                            <Link href="/admin/employers" className="text-[#2f6fed] text-sm font-semibold hover:underline">View All →</Link>
                        </div>
                        <div className="divide-y divide-[#f1f5f9]">
                            {recentEmployers?.map((e: any) => (
                                <div key={e.id} className="px-6 py-4 flex justify-between items-center hover:bg-[#fbfcfe]">
                                    <div>
                                        <div className="font-semibold text-[#1e293b]">{e.company_name || "Unknown Company"}</div>
                                        <div className="text-[13px] text-[#64748b]">
                                            {new Date(e.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[#2f6fed] font-bold">{e.workers_needed || 0}</span>
                                        <span className="text-[#64748b] text-sm ml-1">workers needed</span>
                                    </div>
                                </div>
                            ))}
                            {(!recentEmployers || recentEmployers.length === 0) && (
                                <div className="px-6 py-8 text-center text-[#94a3b8]">No recent employers</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
