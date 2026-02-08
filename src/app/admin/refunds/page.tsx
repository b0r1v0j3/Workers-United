import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";

export default async function AdminRefundsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const adminClient = createAdminClient();

    // Get flagged refunds
    const { data: flaggedPayments } = await adminClient
        .from("payments")
        .select(`
            *,
            profiles(email, full_name)
        `)
        .eq("status", "flagged_for_refund")
        .order("created_at", { ascending: false })
        .limit(50);

    // Get candidates marked for refund
    const { data: refundCandidates } = await adminClient
        .from("candidates")
        .select(`
            *,
            profiles(email, full_name)
        `)
        .eq("status", "REFUND_FLAGGED")
        .order("queue_joined_at", { ascending: true });

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Refund Management</h1>
                    <p className="text-slate-500">Process refunds for candidates past the 90-day window.</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-amber-800 text-sm">
                        <strong>90-Day Policy:</strong> Workers who have been in the queue for 90 days
                        without receiving a match are automatically flagged for a $9 refund.
                    </p>
                </div>

                {/* Flagged Refunds Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Candidate</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Email</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Joined Queue</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Days Waited</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Amount</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {refundCandidates?.map((candidate: any) => {
                                const joinedAt = new Date(candidate.queue_joined_at);
                                const daysWaited = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

                                return (
                                    <tr key={candidate.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-slate-900">
                                                {candidate.profiles?.full_name || "No name"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {candidate.profiles?.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {joinedAt.toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {daysWaited} days
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                            $9.00
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex gap-3">
                                                <ProcessRefundButton candidateId={candidate.id} paymentId={candidate.entry_payment_id} />
                                                <DenyRefundButton candidateId={candidate.id} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {(!refundCandidates || refundCandidates.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                        No refunds pending
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

function ProcessRefundButton({ candidateId, paymentId }: { candidateId: string; paymentId?: string }) {
    async function processRefund() {
        "use server";

        const supabase = createAdminClient();

        if (paymentId) {
            await supabase
                .from("payments")
                .update({ status: "refunded" })
                .eq("id", paymentId);
        }

        await supabase
            .from("candidates")
            .update({ status: "REJECTED" })
            .eq("id", candidateId);

        redirect("/admin/refunds");
    }

    return (
        <form action={processRefund}>
            <button
                type="submit"
                className="text-green-600 hover:underline font-medium"
            >
                ✓ Process
            </button>
        </form>
    );
}

function DenyRefundButton({ candidateId }: { candidateId: string }) {
    async function denyRefund() {
        "use server";

        const supabase = createAdminClient();

        // Return to queue
        await supabase
            .from("candidates")
            .update({ status: "IN_QUEUE" })
            .eq("id", candidateId);

        redirect("/admin/refunds");
    }

    return (
        <form action={denyRefund}>
            <button
                type="submit"
                className="text-red-600 hover:underline font-medium"
            >
                ✗ Deny
            </button>
        </form>
    );
}
