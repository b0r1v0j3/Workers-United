import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminQueuePage() {
    const supabase = createAdminClient();

    // Get queue stats
    const { count: queueCount } = await supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("status", "IN_QUEUE")
        .eq("entry_fee_paid", true);

    const { count: pendingOffersCount } = await supabase
        .from("offers")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

    const { count: refundFlaggedCount } = await supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("status", "REFUND_FLAGGED");

    // Get candidates in queue (ordered by position)
    const { data: queuedCandidates } = await supabase
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Queue Management</h1>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="In Queue" value={queueCount || 0} color="blue" />
                <StatCard label="Pending Offers" value={pendingOffersCount || 0} color="amber" />
                <StatCard label="Refunds Flagged" value={refundFlaggedCount || 0} color="red" />
                <div className="bg-white rounded-lg p-4 shadow-sm">
                    <Link
                        href="/admin/queue/trigger-cron"
                        className="text-blue-600 text-sm hover:underline"
                    >
                        ⚡ Trigger Expiry Check
                    </Link>
                </div>
            </div>

            {/* Queue Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days in Queue</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {queuedCandidates?.map((candidate) => {
                            const joinedAt = new Date(candidate.queue_joined_at);
                            const daysInQueue = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

                            return (
                                <tr key={candidate.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {candidate.queue_position}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {candidate.profiles?.full_name || "No name"}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {candidate.profiles?.email}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <StatusBadge status={candidate.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {joinedAt.toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {daysInQueue} days
                                        {daysInQueue >= 80 && (
                                            <span className="ml-2 text-amber-600">⚠️</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <Link
                                            href={`/admin/candidates/${candidate.id}`}
                                            className="text-blue-600 hover:underline"
                                        >
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}

                        {(!queuedCandidates || queuedCandidates.length === 0) && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No candidates in queue
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colors: Record<string, string> = {
        blue: "bg-blue-100 text-blue-800",
        amber: "bg-amber-100 text-amber-800",
        red: "bg-red-100 text-red-800",
        green: "bg-green-100 text-green-800",
    };

    return (
        <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-500">{label}</div>
            <div className={`text-3xl font-bold ${colors[color]?.split(" ")[1] || "text-gray-900"}`}>
                {value}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        IN_QUEUE: "bg-blue-100 text-blue-800",
        OFFER_PENDING: "bg-amber-100 text-amber-800",
        VISA_PROCESS_STARTED: "bg-green-100 text-green-800",
        REFUND_FLAGGED: "bg-red-100 text-red-800",
    };

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || "bg-gray-100 text-gray-800"}`}>
            {status.replace(/_/g, " ")}
        </span>
    );
}
