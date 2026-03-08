import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import { isGodModeUser } from "@/lib/godmode";

export default async function AdminRefundsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const adminClient = createAdminClient();

    // Get worker records marked for refund
    const { data: refundWorkers } = await adminClient
        .from("worker_onboarding")
        .select(`
            *,
            profiles(email, full_name)
        `)
        .eq("status", "REFUND_FLAGGED")
        .order("queue_joined_at", { ascending: true });

    const nowMs = new Date().getTime();

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Refund Management</h1>
                    <p className="text-slate-500">Process refunds for workers past the 90-day window.</p>
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
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Worker</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Email</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Joined Queue</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Days Waited</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Amount</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {refundWorkers?.map((workerRecord: any) => {
                                const joinedAt = new Date(workerRecord.queue_joined_at);
                                const daysWaited = Math.floor((nowMs - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

                                return (
                                    <tr key={workerRecord.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-slate-900">
                                                {workerRecord.profiles?.full_name || "No name"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {workerRecord.profiles?.email}
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
                                                <ProcessRefundButton workerRecordId={workerRecord.id} paymentId={workerRecord.entry_payment_id} />
                                                <DenyRefundButton workerRecordId={workerRecord.id} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {(!refundWorkers || refundWorkers.length === 0) && (
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

function ProcessRefundButton({ workerRecordId, paymentId }: { workerRecordId: string; paymentId?: string }) {
    async function processRefund() {
        "use server";

        const auth = await createClient();
        const { data: { user } } = await auth.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await auth
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            throw new Error("Forbidden");
        }

        const supabase = createAdminClient();

        if (paymentId) {
            await supabase
                .from("payments")
                .update({ status: "refunded" })
                .eq("id", paymentId);
        }

        await supabase
            .from("worker_onboarding")
            .update({ status: "REJECTED" })
            .eq("id", workerRecordId);

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

function DenyRefundButton({ workerRecordId }: { workerRecordId: string }) {
    async function denyRefund() {
        "use server";

        const auth = await createClient();
        const { data: { user } } = await auth.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await auth
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            throw new Error("Forbidden");
        }

        const supabase = createAdminClient();

        // Return worker to queue
        await supabase
            .from("worker_onboarding")
            .update({ status: "IN_QUEUE" })
            .eq("id", workerRecordId);

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
