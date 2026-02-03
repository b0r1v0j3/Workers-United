import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminJobsPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Check admin access
    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin") {
        redirect("/dashboard");
    }

    // Get all job requests
    const { data: jobRequests } = await supabase
        .from("job_requests")
        .select(`
      *,
      employers(company_name, profiles(email))
    `)
        .order("created_at", { ascending: false })
        .limit(50);

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Admin Header */}
            <nav className="bg-gray-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-6">
                            <Link href="/admin" className="font-bold text-lg">
                                Admin Panel
                            </Link>
                            <div className="flex gap-4 text-sm">
                                <Link href="/admin/queue" className="text-gray-300 hover:text-white">Queue</Link>
                                <Link href="/admin/jobs" className="text-white font-medium">Jobs</Link>
                                <Link href="/admin/refunds" className="text-gray-300 hover:text-white">Refunds</Link>
                            </div>
                        </div>
                        <Link href="/dashboard" className="text-gray-300 text-sm hover:text-white">
                            Exit Admin
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Job Requests</h1>
                </div>

                {/* Jobs Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Positions</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {jobRequests?.map((job) => (
                                <tr key={job.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{job.title}</div>
                                        <div className="text-sm text-gray-500">{job.industry}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{job.employers?.company_name}</div>
                                        <div className="text-sm text-gray-500">{job.employers?.profiles?.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {job.destination_country}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {job.positions_filled} / {job.positions_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <JobStatusBadge status={job.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {job.status === "open" && !job.auto_match_triggered && (
                                            <TriggerMatchButton jobRequestId={job.id} />
                                        )}
                                        {job.auto_match_triggered && (
                                            <span className="text-gray-500">Matching in progress</span>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {(!jobRequests || jobRequests.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No job requests yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-green-100 text-green-800",
        matching: "bg-amber-100 text-amber-800",
        filled: "bg-blue-100 text-blue-800",
        closed: "bg-gray-100 text-gray-800",
        cancelled: "bg-red-100 text-red-800",
    };

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || "bg-gray-100 text-gray-800"}`}>
            {status.toUpperCase()}
        </span>
    );
}

function TriggerMatchButton({ jobRequestId }: { jobRequestId: string }) {
    async function triggerMatch() {
        "use server";

        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/queue/auto-match`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobRequestId }),
        });

        redirect("/admin/jobs");
    }

    return (
        <form action={triggerMatch}>
            <button
                type="submit"
                className="text-blue-600 hover:underline font-medium"
            >
                ⚡ Trigger Match
            </button>
        </form>
    );
}
