import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";

export default async function AdminQueuePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const adminClient = createAdminClient();

    // Get queue stats
    const { count: queueCount } = await adminClient
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("status", "IN_QUEUE")
        .eq("entry_fee_paid", true);

    const { count: pendingOffersCount } = await adminClient
        .from("offers")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

    const { count: refundFlaggedCount } = await adminClient
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("status", "REFUND_FLAGGED");

    // Get candidates in queue (ordered by position)
    const { data: queuedCandidates } = await adminClient
        .from("candidates")
        .select(`
            *,
            profiles(email, full_name)
        `)
        .eq("entry_fee_paid", true)
        .in("status", ["IN_QUEUE", "OFFER_PENDING"])
        .order("queue_position", { ascending: true })
        .limit(50);

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Queue Management</h1>
                    <p className="text-slate-500">Monitor candidates in queue and manage offers.</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard label="In Queue" value={queueCount || 0} color="blue" />
                    <StatCard label="Pending Offers" value={pendingOffersCount || 0} color="amber" />
                    <StatCard label="Refunds Flagged" value={refundFlaggedCount || 0} color="red" />
                </div>

                {/* Queue Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">#</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Candidate</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Joined</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Days in Queue</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {queuedCandidates?.map((candidate: any) => {
                                const joinedAt = new Date(candidate.queue_joined_at);
                                const daysInQueue = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

                                return (
                                    <tr key={candidate.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                            {candidate.queue_position}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-slate-900">
                                                {candidate.profiles?.full_name || "No name"}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {candidate.profiles?.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusBadge status={candidate.status} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {joinedAt.toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {daysInQueue} days
                                            {daysInQueue >= 80 && (
                                                <span className="ml-2 text-amber-600">⚠️</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <Link
                                                href={`/admin/candidates/${candidate.id}`}
                                                className="text-blue-600 hover:underline font-medium"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}

                            {(!queuedCandidates || queuedCandidates.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                        No candidates in queue
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colors: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600 ring-blue-100",
        amber: "bg-amber-50 text-amber-600 ring-amber-100",
        red: "bg-red-50 text-red-600 ring-red-100",
        green: "bg-green-50 text-green-600 ring-green-100",
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight mt-1">{value}</p>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        IN_QUEUE: "bg-blue-100 text-blue-800 border border-blue-200",
        OFFER_PENDING: "bg-amber-100 text-amber-800 border border-amber-200",
        VISA_PROCESS_STARTED: "bg-green-100 text-green-800 border border-green-200",
        REFUND_FLAGGED: "bg-red-100 text-red-800 border border-red-200",
    };

    return (
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase ${styles[status] || "bg-gray-100 text-gray-800"}`}>
            {status.replace(/_/g, " ")}
        </span>
    );
}
