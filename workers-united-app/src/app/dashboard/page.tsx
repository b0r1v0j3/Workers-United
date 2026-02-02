import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch user profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const userType = profile?.user_type || "candidate";

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M2 12h20" />
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                </svg>
                                Workers United
                            </Link>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">
                                {profile?.full_name || user.email}
                            </span>
                            <form action="/auth/signout" method="post">
                                <button
                                    type="submit"
                                    className="text-sm text-gray-600 hover:text-gray-900"
                                >
                                    Sign out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Banner */}
                <div
                    className="rounded-2xl p-8 mb-8 text-white"
                    style={{
                        background: userType === "employer"
                            ? 'linear-gradient(135deg, #14B8A6 0%, #10B981 100%)'
                            : 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)'
                    }}
                >
                    <h1 className="text-2xl font-bold mb-2">
                        Welcome back, {profile?.full_name?.split(" ")[0] || "there"}! 👋
                    </h1>
                    <p className="opacity-90">
                        {userType === "employer"
                            ? "Manage your job requests and find pre-verified candidates."
                            : "Track your verification status and explore job opportunities."}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {userType === "employer" ? (
                        <>
                            <StatCard
                                title="Active Job Requests"
                                value="0"
                                icon="📋"
                                color="teal"
                            />
                            <StatCard
                                title="Candidates Matched"
                                value="0"
                                icon="👥"
                                color="blue"
                            />
                            <StatCard
                                title="Pending Interviews"
                                value="0"
                                icon="📅"
                                color="purple"
                            />
                        </>
                    ) : (
                        <>
                            <StatCard
                                title="Profile Status"
                                value="New"
                                icon="📄"
                                color="blue"
                            />
                            <StatCard
                                title="Documents"
                                value="0 / 3"
                                icon="📁"
                                color="amber"
                            />
                            <StatCard
                                title="Job Matches"
                                value="0"
                                icon="💼"
                                color="green"
                            />
                        </>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {userType === "employer" ? (
                        <>
                            <ActionCard
                                title="Post a Job Request"
                                description="Create a new job request to find verified candidates."
                                buttonText="Create Request"
                                href="/dashboard/jobs/new"
                                gradient="linear-gradient(135deg, #14B8A6 0%, #10B981 100%)"
                            />
                            <ActionCard
                                title="Browse Candidates"
                                description="View pre-verified candidates ready to work."
                                buttonText="View Candidates"
                                href="/dashboard/candidates"
                                gradient="linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)"
                            />
                        </>
                    ) : (
                        <>
                            <ActionCard
                                title="Complete Your Profile"
                                description="Add your details to get verified and matched with employers."
                                buttonText="Update Profile"
                                href="/dashboard/profile"
                                gradient="linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)"
                            />
                            <ActionCard
                                title="Upload Documents"
                                description="Upload your CV, passport, and other required documents."
                                buttonText="Upload Documents"
                                href="/dashboard/documents"
                                gradient="linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)"
                            />
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    color
}: {
    title: string;
    value: string;
    icon: string;
    color: string;
}) {
    const bgColors: Record<string, string> = {
        blue: "bg-blue-50",
        teal: "bg-teal-50",
        green: "bg-green-50",
        amber: "bg-amber-50",
        purple: "bg-purple-50",
    };

    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{title}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`w-12 h-12 ${bgColors[color]} rounded-xl flex items-center justify-center text-2xl`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function ActionCard({
    title,
    description,
    buttonText,
    href,
    gradient,
}: {
    title: string;
    description: string;
    buttonText: string;
    href: string;
    gradient: string;
}) {
    return (
        <div className="card overflow-hidden">
            <div
                className="h-2 -mx-8 -mt-8 mb-6"
                style={{ background: gradient }}
            />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 text-sm mb-4">{description}</p>
            <Link
                href={href}
                className="btn btn-primary inline-flex"
                style={{ padding: "0.625rem 1.25rem", fontSize: "0.875rem" }}
            >
                {buttonText}
            </Link>
        </div>
    );
}
