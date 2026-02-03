import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, ADMIN_ROLE_COOKIE } from "@/lib/admin";

export default async function EmployerDashboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Check if admin in employer mode
    const cookieStore = await cookies();
    const adminRole = cookieStore.get(ADMIN_ROLE_COOKIE)?.value;
    const isAdminUser = isAdmin(user.email);
    const isAdminEmployerMode = isAdminUser && adminRole === "employer";

    // Get employer profile (optional for admin)
    const { data: employer } = await supabase
        .from("employers")
        .select("*, profiles(*)")
        .eq("profile_id", user.id)
        .single();

    // Non-admin without employer record -> redirect
    if (!employer && !isAdminEmployerMode) {
        redirect("/dashboard");
    }

    // For admin mode, create mock employer data
    const displayEmployer = employer || {
        company_name: "Admin Test Company",
        status: "active",
        pib: "123456789",
        accommodation_address: "Test Address",
    };

    const isProfileComplete = displayEmployer.pib && displayEmployer.accommodation_address && displayEmployer.company_name;

    // Get job stats (will be empty for admin mode)
    const { data: jobs } = employer ? await supabase
        .from("job_requests")
        .select("*")
        .eq("employer_id", employer.id) : { data: [] };

    const openJobs = jobs?.filter(j => j.status === "open" || j.status === "matching").length || 0;
    const totalPositionsFilled = jobs?.reduce((sum, j) => sum + (j.positions_filled || 0), 0) || 0;

    // Get verified candidates from queue (for display)
    const { data: verifiedCandidates } = await supabase
        .from("candidate_queue")
        .select(`
            *,
            candidate:candidates(
                id,
                status,
                profile:profiles(full_name, email)
            )
        `)
        .eq("status", "waiting")
        .order("position", { ascending: true })
        .limit(10);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-6">
                            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
                                <img src="/logo.png" alt="Workers United" width={28} height={28} style={{ borderRadius: '4px' }} />
                                Workers United
                            </Link>
                            <span className="text-sm text-teal-600 font-medium bg-teal-50 px-2 py-1 rounded">
                                Employer Portal
                            </span>
                            {isAdminEmployerMode && (
                                <span className="text-sm text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded">
                                    🔮 God Mode
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            {isAdminUser && (
                                <Link
                                    href="/select-role"
                                    className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                                >
                                    Switch Role
                                </Link>
                            )}
                            <span className="text-sm text-gray-600">
                                {displayEmployer.company_name || user.email}
                            </span>
                            <form action="/auth/signout" method="post">
                                <button type="submit" className="text-sm text-gray-600 hover:text-gray-900">
                                    Sign out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Admin Mode Banner */}
                {isAdminEmployerMode && !employer && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">🔮</span>
                            <div>
                                <h3 className="font-semibold text-purple-900">God Mode Active</h3>
                                <p className="text-purple-800 text-sm mt-1">
                                    You're viewing the Employer Portal as an admin. This is a test view showing verified candidates.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Welcome Banner */}
                <div
                    className="rounded-2xl p-8 mb-8 text-white"
                    style={{ background: 'linear-gradient(135deg, #14B8A6 0%, #10B981 100%)' }}
                >
                    <h1 className="text-2xl font-bold mb-2">
                        Welcome, {displayEmployer.company_name || "Employer"}! 👋
                    </h1>
                    <p className="opacity-90">
                        Find pre-verified international workers for your business.
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <StatCard title="Verified Candidates" value={verifiedCandidates?.length || 0} icon="👥" color="teal" />
                    <StatCard title="Active Jobs" value={openJobs} icon="📋" color="blue" />
                    <StatCard title="Filled Positions" value={totalPositionsFilled} icon="✅" color="green" />
                    <StatCard title="Status" value={displayEmployer.status || "Active"} icon="🏢" color="amber" isText />
                </div>

                {/* Verified Candidates Section */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Verified Candidates Ready for Placement</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        These candidates have paid the $9 verification fee and are ready for job matching.
                    </p>

                    {verifiedCandidates && verifiedCandidates.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {verifiedCandidates.map((item) => (
                                <div key={item.id} className="card">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-lg">
                                            👤
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {item.candidate?.profile?.full_name || "Anonymous"}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Queue Position: #{item.position}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                            ✓ Verified
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {new Date(item.joined_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card text-center py-12">
                            <div className="text-4xl mb-4">📭</div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Verified Candidates Yet</h3>
                            <p className="text-gray-600 text-sm">
                                Candidates who pay the $9 verification fee will appear here.
                            </p>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Post a New Job</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            Create a job request and automatically match with qualified candidates from our queue.
                        </p>
                        <Link
                            href="/employer/jobs/new"
                            className={`btn ${isProfileComplete || isAdminEmployerMode ? 'btn-primary' : 'bg-gray-300 cursor-not-allowed'}`}
                            style={isProfileComplete || isAdminEmployerMode ? {} : { pointerEvents: 'none' }}
                        >
                            Create Job Request
                        </Link>
                    </div>

                    <div className="card">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">View Your Jobs</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            Manage existing job requests, view matched candidates, and track hiring progress.
                        </p>
                        <Link href="/employer/jobs" className="btn btn-secondary">
                            View All Jobs
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    color,
    isText = false
}: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    isText?: boolean;
}) {
    const bgColors: Record<string, string> = {
        teal: "bg-teal-50",
        green: "bg-green-50",
        blue: "bg-blue-50",
        amber: "bg-amber-50",
    };

    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{title}</p>
                    <p className={`${isText ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>{value}</p>
                </div>
                <div className={`w-12 h-12 ${bgColors[color]} rounded-xl flex items-center justify-center text-2xl`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}
