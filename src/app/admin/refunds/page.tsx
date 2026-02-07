import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminRefundsPage() {
    const supabase = createAdminClient();

    // Get flagged refunds
    const { data: flaggedPayments } = await supabase
        .from("payments")
        .select(`
      *,
      profiles(email, full_name)
    `)
        .eq("status", "flagged_for_refund")
        .order("created_at", { ascending: false })
        .limit(50);

    // Get candidates marked for refund
    const { data: refundCandidates } = await supabase
        .from("candidates")
        .select(`
      *,
      profiles(email, full_name)
    `)
        .eq("status", "REFUND_FLAGGED")
        .order("queue_joined_at", { ascending: true });

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Refund Management</h1>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-amber-800 text-sm">
                    <strong>90-Day Policy:</strong> Candidates who have been in the queue for 90 days
                    without receiving a match are automatically flagged for a $9 refund.
                </p>
            </div>

            {/* Flagged Refunds Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined Queue</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Waited</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {refundCandidates?.map((candidate) => {
                            const joinedAt = new Date(candidate.queue_joined_at);
                            const daysWaited = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

                            return (
                                <tr key={candidate.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {candidate.profiles?.full_name || "No name"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {candidate.profiles?.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {joinedAt.toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {daysWaited} days
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
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
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No refunds pending
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}

function ProcessRefundButton({ candidateId, paymentId }: { candidateId: string; paymentId?: string }) {
    async function processRefund() {
        "use server";

        // TODO: Integrate with Stripe Refunds API
        // For now, just mark as refunded
        // For now, just mark as refunded
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
