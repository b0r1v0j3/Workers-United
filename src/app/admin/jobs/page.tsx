import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";

export default async function AdminJobsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const adminClient = createAdminClient();

    // Get all job requests
    const { data: jobRequests } = await adminClient
        .from("job_requests")
        .select(`
            *,
            employers(company_name, profiles(email))
        `)
        .order("created_at", { ascending: false })
        .limit(50);

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Job Requests</h1>
                    <p className="text-slate-500">Manage employer job requests and trigger matching.</p>
                </div>

                {/* Jobs Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Title</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Employer</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Country</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Positions</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {jobRequests?.map((job: any) => (
                                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-900">{job.title}</div>
                                        <div className="text-xs text-slate-500">{job.industry}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-slate-900">{job.employers?.company_name}</div>
                                        <div className="text-xs text-slate-500">{job.employers?.profiles?.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {job.destination_country}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
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
                                            <span className="text-slate-500">Matching in progress</span>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {(!jobRequests || jobRequests.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                        No job requests yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppShell>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-green-100 text-green-800 border border-green-200",
        matching: "bg-amber-100 text-amber-800 border border-amber-200",
        filled: "bg-blue-100 text-blue-800 border border-blue-200",
        closed: "bg-gray-100 text-gray-800 border border-gray-200",
        cancelled: "bg-red-100 text-red-800 border border-red-200",
    };

    return (
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase ${styles[status] || "bg-gray-100 text-gray-800"}`}>
            {status.toUpperCase()}
        </span>
    );
}

function TriggerMatchButton({ jobRequestId }: { jobRequestId: string }) {
    async function triggerMatch() {
        "use server";
        const { revalidatePath } = await import("next/cache");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/queue/auto-match`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobRequestId }),
            });
            if (!res.ok) {
                console.error("Trigger match failed:", res.status, await res.text());
            }
        } catch (err) {
            console.error("Trigger match error:", err);
        }

        revalidatePath("/admin/jobs");
    }

    return (
        <form action={triggerMatch}>
            <button
                type="submit"
                className="text-blue-600 hover:underline font-medium text-sm"
            >
                ⚡ Trigger Match
            </button>
        </form>
    );
}
