import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markRefunded } from "@/app/actions/admin";
import { isGodModeUser } from "@/lib/godmode";

export default async function CandidatesPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const isOwner = isGodModeUser(user.email);

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== 'admin' && !isOwner) {
        redirect("/dashboard");
    }

    // Use admin client (service role) that bypasses RLS for data queries
    let adminClient;
    let usingServiceRole = false;
    let clientError = "";
    try {
        adminClient = createAdminClient();
        usingServiceRole = true;
    } catch (err: any) {
        // Fallback to regular client if service role key not configured
        clientError = err?.message || "Unknown error";
        console.warn("Service role key not configured, using regular client:", err);
        adminClient = supabase;
    }

    // Fetch all candidates using admin client
    const { data: candidates, error: candidatesError } = await adminClient
        .from("candidates")
        .select(`
            id,
            profile_id,
            status,
            nationality,
            current_country,
            preferred_job,
            phone,
            entry_fee_paid,
            queue_position,
            queue_joined_at
        `)
        .order("id", { ascending: false });

    console.log("Candidates query result:", { candidatesCount: candidates?.length, candidatesError });

    // Fetch all profiles for candidate lookup
    const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name");

    // Create profile lookup map
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Fetch payments to check paid status
    const { data: payments } = await adminClient
        .from("payments")
        .select("user_id, status, created_at")
        .eq("status", "completed");

    // Fetch all document statuses to show per-doc details
    const { data: allDocs } = await adminClient
        .from("candidate_documents")
        .select("user_id, document_type, status");

    const getDocStatus = (candidateId: string, type: string) => {
        const doc = allDocs?.find(d => d.user_id === candidateId && d.document_type === type);
        return doc?.status || "missing";
    };

    return (
        <div className="min-h-screen bg-[#f1f5f9] font-montserrat">
            {/* Header */}
            <nav className="bg-[#183b56] px-5 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="/logo.png" alt="Workers United" width={64} height={64} className="brightness-0 invert rounded" />
                        <span className="font-bold text-white text-lg">Admin Portal</span>
                    </Link>
                    <span className="text-gray-400">/</span>
                    <span className="text-white font-medium">Candidates</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[#2f6fed] text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                        God Mode
                    </div>
                    <a href="/auth/signout" className="text-gray-300 text-sm font-semibold hover:text-white transition-colors">
                        Logout
                    </a>
                </div>
            </nav>

            {/* Debug Banner - Remove after debugging */}
            <div className="bg-yellow-100 border-b border-yellow-300 px-5 py-3 text-sm">
                <strong>DEBUG:</strong>{" "}
                Service Role: <span className={usingServiceRole ? "text-green-700" : "text-red-700"}>{usingServiceRole ? "YES ✓" : "NO ✗"}</span>{" "}
                | Candidates found: <strong>{candidates?.length ?? 0}</strong>{" "}
                | Profiles found: <strong>{profiles?.length ?? 0}</strong>{" "}
                {candidatesError && <span className="text-red-600">| Error: {candidatesError.message}</span>}
                {clientError && <span className="text-red-600">| Client Error: {clientError}</span>}
            </div>

            <div className="max-w-[1400px] mx-auto px-5 py-10">
                <div className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-[#1e293b]">All Candidates</h1>
                        <p className="text-[#64748b] mt-1 font-medium">Manage verification, payments, and refunds.</p>
                    </div>
                    <Link href="/admin" className="text-[#2f6fed] font-semibold hover:underline">
                        ← Back to Dashboard
                    </Link>
                </div>

                {/* Candidate Table */}
                <div className="bg-white rounded-[16px] overflow-hidden shadow-sm border border-[#dde3ec]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f8fafc] border-b border-[#dde3ec]">
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">#</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Candidate</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Documents</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Payment</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Guarantee</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f5f9]">
                                {candidates?.map((candidate: any, index: number) => {
                                    const profile = profileMap.get(candidate.profile_id);
                                    const payment = payments?.find((p: any) => p.user_id === candidate.profile_id);
                                    const verifiedDocsCount = allDocs?.filter(d => d.user_id === candidate.profile_id && d.status === 'verified').length || 0;

                                    return (
                                        <tr key={candidate.id} className="hover:bg-[#fbfcfe] transition-colors">
                                            <td className="px-6 py-5 text-[#64748b] font-medium">{index + 1}</td>
                                            <td className="px-6 py-5">
                                                <Link href={`/admin/candidates/${candidate.profile_id}`} className="hover:text-[#2f6fed]">
                                                    <div className="font-bold text-[#1e293b]">{profile?.full_name || "Unknown"}</div>
                                                    <div className="text-[13px] text-[#64748b]">{profile?.email}</div>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex gap-2 mb-2">
                                                    {['passport', 'photo', 'diploma'].map(type => (
                                                        <span key={type} className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ${getDocStatus(candidate.profile_id, type) === 'verified' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                            getDocStatus(candidate.profile_id, type) === 'verifying' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                                'bg-gray-100 text-gray-500 border border-gray-200'
                                                            }`}>
                                                            {type.charAt(0)}: {getDocStatus(candidate.profile_id, type)}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="text-[12px] font-medium text-[#64748b]">
                                                    {verifiedDocsCount}/3 Verified
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {candidate.entry_fee_paid ? (
                                                    <div>
                                                        <div className="text-[#10b981] font-bold text-[14px]">Paid $9.00</div>
                                                        <div className="text-[12px] text-[#64748b]">
                                                            {payment?.created_at ? new Date(payment.created_at).toLocaleDateString() : '-'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[#94a3b8] italic text-[14px]">Unpaid</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
                                                {candidate.queue_joined_at ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 min-w-[80px]">
                                                            <div className="text-[12px] font-bold text-[#1e293b]">
                                                                In Queue #{candidate.queue_position || '-'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[#94a3b8]">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex gap-2">
                                                    <Link
                                                        href={`/admin/candidates/${candidate.profile_id}`}
                                                        className="bg-[#2f6fed] text-white px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-[#1e5cd6] transition-colors"
                                                    >
                                                        View
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!candidates || candidates.length === 0) && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-[#64748b] italic">
                                            No candidates found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RefundButton({ paymentId }: { paymentId: string }) {
    return (
        <form action={async () => {
            "use server";
            const notes = "Manual refund processed via admin dashboard.";
            await markRefunded(paymentId, notes);
        }}>
            <button className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-red-50 transition-colors">
                Refund
            </button>
        </form>
    );
}
