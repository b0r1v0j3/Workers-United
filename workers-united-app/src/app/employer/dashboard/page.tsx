import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EmployerDashboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Get employer profile
    const { data: employer } = await supabase
        .from("employers")
        .select("*, profiles(*)")
        .eq("profile_id", user.id)
        .single();

    if (!employer) {
        // Not an employer, redirect
        redirect("/dashboard");
    }

    // Check if profile is complete
    const isProfileComplete = employer.pib && employer.accommodation_address && employer.company_name;

    // Get job stats
    const { data: jobs } = await supabase
        .from("job_requests")
        .select("*")
        .eq("employer_id", employer.id);

    const openJobs = jobs?.filter(j => j.status === "open" || j.status === "matching").length || 0;
    const filledJobs = jobs?.filter(j => j.status === "filled").length || 0;
    const totalPositionsFilled = jobs?.reduce((sum, j) => sum + (j.positions_filled || 0), 0) || 0;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-6">
                            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M2 12h20" />
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                </svg>
                                Workers United
                            </Link>
                            <span className="text-sm text-teal-600 font-medium bg-teal-50 px-2 py-1 rounded">
                                Employer Portal
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">
                                {employer.company_name || employer.profiles?.email}
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
                {/* Profile Incomplete Warning */}
                {!isProfileComplete && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <h3 className="font-semibold text-amber-900">Complete Your Company Profile</h3>
                                <p className="text-amber-800 text-sm mt-1">
                                    You need to add your PIB (Tax ID), company address, and accommodation details before posting jobs.
                                </p>
                                <Link
                                    href="/employer/profile"
                                    className="inline-block mt-2 text-sm font-medium text-amber-900 underline"
                                >
                                    Complete Profile →
                                </Link>
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
                        Welcome, {employer.company_name || "Employer"}! 👋
                    </h1>
                    <p className="opacity-90">
                        Find pre-verified international workers for your business.
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <StatCard title="Active Jobs" value={openJobs} icon="📋" color="teal" />
                    <StatCard title="Filled Positions" value={totalPositionsFilled} icon="✅" color="green" />
                    <StatCard title="Total Jobs Posted" value={jobs?.length || 0} icon="📊" color="blue" />
                    <StatCard title="Status" value={employer.status || "Pending"} icon="🏢" color="amber" isText />
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
                            className={`btn ${isProfileComplete ? 'btn-primary' : 'bg-gray-300 cursor-not-allowed'}`}
                            style={isProfileComplete ? {} : { pointerEvents: 'none' }}
                        >
                            Create Job Request
                        </Link>
                        {!isProfileComplete && (
                            <p className="text-xs text-amber-600 mt-2">Complete your profile first</p>
                        )}
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

                {/* Recent Jobs */}
                {jobs && jobs.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Job Requests</h2>
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Positions</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {jobs.slice(0, 5).map((job) => (
                                        <tr key={job.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {job.title}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {job.positions_filled} / {job.positions_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {job.salary_rsd ? `${job.salary_rsd.toLocaleString()} RSD` : "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <StatusBadge status={job.status} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
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

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-green-100 text-green-800",
        matching: "bg-amber-100 text-amber-800",
        filled: "bg-blue-100 text-blue-800",
        closed: "bg-gray-100 text-gray-800",
    };

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || "bg-gray-100 text-gray-800"}`}>
            {status.toUpperCase()}
        </span>
    );
}
