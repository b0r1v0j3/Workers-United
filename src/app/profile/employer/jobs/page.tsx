import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { Briefcase, MapPin, Users, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

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

    if (!employer) redirect("/profile/employer");

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
        <AppShell user={user} variant="dashboard">
            <div className="space-y-6">
                {/* Header Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Job Requests</h1>
                        <p className="text-slate-500">Manage your hiring pipeline and view applications.</p>
                    </div>
                    <Link
                        href="/profile/employer/jobs/new"
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 active:scale-95 flex items-center gap-2"
                    >
                        <Briefcase size={18} />
                        New Job Request
                    </Link>
                </div>

                {/* Content Area */}
                {!jobs || jobs.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Briefcase size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">No Job Requests Yet</h2>
                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                            Create your first job request to start matching with candidates from our verified pool.
                        </p>
                        <Link href="/profile/employer/jobs/new" className="text-blue-600 font-semibold hover:underline">
                            Create Job Request →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {jobs.map((job) => (
                            <JobCard key={job.id} job={job} />
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-blue-200 transition-colors group">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        <Link href={`/profile/employer/jobs/${job.id}`}>{job.title}</Link>
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><Briefcase size={14} /> {job.industry}</span>
                        <span className="flex items-center gap-1"><MapPin size={14} /> {job.destination_country}</span>
                        <span className="flex items-center gap-1"><Clock size={14} /> {new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                </div>
                <StatusBadge status={job.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <StatBox label="Positions Filled" value={`${job.positions_filled} / ${job.positions_count}`} icon={<Users size={16} />} />
                <StatBox label="Pending Offers" value={pendingOffers} icon={<AlertCircle size={16} />} color="text-amber-600" />
                <StatBox label="Accepted" value={acceptedOffers} icon={<CheckCircle2 size={16} />} color="text-green-600" />
                <StatBox label="Salary" value={job.salary_rsd ? `${job.salary_rsd.toLocaleString()} RSD` : "-"} icon={<span className="font-bold text-xs">RSD</span>} />
            </div>

            <div className="mt-4 flex justify-end">
                <Link
                    href={`/profile/employer/jobs/${job.id}`}
                    className="text-sm font-semibold text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
                >
                    View Details <span className="text-lg">→</span>
                </Link>
            </div>
        </div>
    );
}

function StatBox({ label, value, icon, color = "text-slate-900" }: any) {
    return (
        <div>
            <div className={`text-xl font-bold ${color} flex items-center gap-2`}>
                {value}
            </div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mt-1">
                {icon} {label}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-emerald-100 text-emerald-700 border-emerald-200",
        matching: "bg-blue-100 text-blue-700 border-blue-200",
        filled: "bg-indigo-100 text-indigo-700 border-indigo-200",
        closed: "bg-slate-100 text-slate-700 border-slate-200",
        cancelled: "bg-red-100 text-red-700 border-red-200",
    };

    const labels: Record<string, string> = {
        open: "Open",
        matching: "Matching",
        filled: "Filled",
        closed: "Closed",
        cancelled: "Cancelled",
    };

    return (
        <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-full border ${styles[status] || styles.closed}`}>
            {labels[status] || status}
        </span>
    );
}
