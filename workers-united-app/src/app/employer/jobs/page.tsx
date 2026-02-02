import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EmployerJobsPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Get employer
    const { data: employer } = await supabase
        .from("employers")
        .select("*")
        .eq("profile_id", user.id)
        .single();

    if (!employer) redirect("/dashboard");

    // Get all jobs for this employer
    const { data: jobs } = await supabase
        .from("job_requests")
        .select(`
      *,
      offers(id, status, candidates(profiles(full_name)))
    `)
        .eq("employer_id", employer.id)
        .order("created_at", { ascending: false });

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <Link href="/employer/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </Link>
                        <Link href="/employer/jobs/new" className="btn btn-primary">
                            + New Job Request
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Job Requests</h1>

                {!jobs || jobs.length === 0 ? (
                    <div className="card text-center py-12">
                        <div className="text-4xl mb-4">📋</div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">No Job Requests Yet</h2>
                        <p className="text-gray-600 mb-4">
                            Create your first job request to start matching with candidates.
                        </p>
                        <Link href="/employer/jobs/new" className="btn btn-primary">
                            Create Job Request
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {jobs.map((job) => (
                            <JobCard key={job.id} job={job} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

interface JobCardProps {
    job: {
        id: string;
        title: string;
        industry: string;
        destination_country: string;
        positions_count: number;
        positions_filled: number;
        salary_rsd: number | null;
        status: string;
        created_at: string;
        offers?: Array<{
            id: string;
            status: string;
            candidates?: { profiles?: { full_name: string } };
        }>;
    };
}

function JobCard({ job }: JobCardProps) {
    const pendingOffers = job.offers?.filter(o => o.status === "pending").length || 0;
    const acceptedOffers = job.offers?.filter(o => o.status === "accepted").length || 0;

    return (
        <div className="card">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-gray-500 text-sm">
                        {job.industry} • {job.destination_country}
                    </p>
                </div>
                <StatusBadge status={job.status} />
            </div>

            <div className="grid grid-cols-4 gap-4 mt-4">
                <div>
                    <p className="text-2xl font-bold text-gray-900">
                        {job.positions_filled} / {job.positions_count}
                    </p>
                    <p className="text-xs text-gray-500">Positions Filled</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-amber-600">{pendingOffers}</p>
                    <p className="text-xs text-gray-500">Pending Offers</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-green-600">{acceptedOffers}</p>
                    <p className="text-xs text-gray-500">Accepted</p>
                </div>
                <div>
                    <p className="text-lg font-semibold text-gray-900">
                        {job.salary_rsd ? `${job.salary_rsd.toLocaleString()} RSD` : "-"}
                    </p>
                    <p className="text-xs text-gray-500">Monthly Salary</p>
                </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                    Created {new Date(job.created_at).toLocaleDateString()}
                </p>
                <Link
                    href={`/employer/jobs/${job.id}`}
                    className="text-sm text-blue-600 hover:underline"
                >
                    View Details →
                </Link>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-green-100 text-green-800",
        matching: "bg-blue-100 text-blue-800",
        filled: "bg-teal-100 text-teal-800",
        closed: "bg-gray-100 text-gray-800",
        cancelled: "bg-red-100 text-red-800",
    };

    const labels: Record<string, string> = {
        open: "✓ Open",
        matching: "⚡ Matching",
        filled: "✅ Filled",
        closed: "Closed",
        cancelled: "Cancelled",
    };

    return (
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status] || styles.closed}`}>
            {labels[status] || status}
        </span>
    );
}
