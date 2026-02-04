import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isGodModeUser } from "@/lib/godmode";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: PageProps) {
    const { id } = await params;
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

    // Fetch candidate info
    const { data: candidateProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

    if (!candidateProfile) {
        notFound();
    }

    const { data: candidateData } = await supabase
        .from("candidates")
        .select("*")
        .eq("profile_id", id)
        .single();

    // Fetch documents
    const { data: documents } = await supabase
        .from("candidate_documents")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

    // Fetch payments
    const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

    async function updateDocumentStatus(formData: FormData) {
        "use server";
        const docId = formData.get("doc_id") as string;
        const newStatus = formData.get("status") as string;
        const adminNotes = formData.get("admin_notes") as string;

        const supabase = await createClient();

        await supabase
            .from("candidate_documents")
            .update({
                status: newStatus,
                admin_notes: adminNotes,
                updated_at: new Date().toISOString()
            })
            .eq("id", docId);

        revalidatePath(`/admin/candidates/${id}`);
    }

    async function updateCandidateStatus(formData: FormData) {
        "use server";
        const newStatus = formData.get("status") as string;

        const supabase = await createClient();

        await supabase
            .from("candidates")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq("profile_id", id);

        revalidatePath(`/admin/candidates/${id}`);
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'verified': return 'bg-green-100 text-green-700 border-green-200';
            case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
            case 'verifying': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-[#f1f5f9] font-montserrat">
            {/* Header */}
            <nav className="bg-[#183b56] px-5 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="/logo.png" alt="Workers United" width={28} height={28} className="brightness-0 invert" />
                        <span className="font-bold text-white text-lg">Admin Portal</span>
                    </Link>
                    <span className="text-gray-400">/</span>
                    <Link href="/admin/candidates" className="text-gray-300 hover:text-white transition-colors">Candidates</Link>
                    <span className="text-gray-400">/</span>
                    <span className="text-white font-medium">{candidateProfile.full_name || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[#2f6fed] text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                        God Mode
                    </div>
                    <form action="/auth/signout" method="post">
                        <button type="submit" className="text-gray-300 text-sm font-semibold hover:text-white transition-colors">
                            Logout
                        </button>
                    </form>
                </div>
            </nav>

            <div className="max-w-[1200px] mx-auto px-5 py-10">
                {/* Back Link */}
                <Link href="/admin/candidates" className="text-[#2f6fed] font-semibold hover:underline mb-6 inline-block">
                    ← Back to Candidates
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Candidate Info */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Profile Card */}
                        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
                            <h2 className="font-bold text-[#1e293b] text-xl mb-4">Profile Info</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold">Full Name</label>
                                    <div className="text-[#1e293b] font-medium">{candidateProfile.full_name || "—"}</div>
                                </div>
                                <div>
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold">Email</label>
                                    <div className="text-[#1e293b] font-medium">{candidateProfile.email}</div>
                                </div>
                                <div>
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold">Phone</label>
                                    <div className="text-[#1e293b] font-medium">{candidateData?.phone || "—"}</div>
                                </div>
                                <div>
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold">Nationality</label>
                                    <div className="text-[#1e293b] font-medium">{candidateData?.nationality || "—"}</div>
                                </div>
                                <div>
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold">Current Country</label>
                                    <div className="text-[#1e293b] font-medium">{candidateData?.current_country || "—"}</div>
                                </div>
                                <div>
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold">Preferred Job</label>
                                    <div className="text-[#1e293b] font-medium">{candidateData?.preferred_job || "—"}</div>
                                </div>
                            </div>
                        </div>

                        {/* Status Control */}
                        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
                            <h2 className="font-bold text-[#1e293b] text-xl mb-4">Candidate Status</h2>
                            <form action={updateCandidateStatus}>
                                <div className="mb-4">
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold block mb-2">Current Status</label>
                                    <span className={`text-[12px] px-3 py-1.5 rounded-full font-bold uppercase border ${getStatusColor(candidateData?.status || 'pending')}`}>
                                        {candidateData?.status || 'pending'}
                                    </span>
                                </div>
                                <div className="mb-4">
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold block mb-2">Update Status</label>
                                    <select name="status" className="w-full border border-[#dde3ec] rounded-lg px-3 py-2 text-sm">
                                        <option value="pending">Pending</option>
                                        <option value="verified">Verified</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-[#2f6fed] text-white py-2 rounded-lg font-bold text-sm hover:bg-[#1e5cd6] transition-colors">
                                    Update Status
                                </button>
                            </form>
                        </div>

                        {/* Payment History */}
                        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
                            <h2 className="font-bold text-[#1e293b] text-xl mb-4">Payment History</h2>
                            {payments && payments.length > 0 ? (
                                <div className="space-y-3">
                                    {payments.map((payment: any) => (
                                        <div key={payment.id} className="border border-[#f1f5f9] rounded-lg p-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-[#1e293b]">${payment.amount / 100}</div>
                                                    <div className="text-[12px] text-[#64748b]">
                                                        {new Date(payment.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${payment.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    payment.refund_status === 'completed' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {payment.refund_status === 'completed' ? 'Refunded' : payment.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[#94a3b8] italic">No payments found</div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Documents */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] overflow-hidden">
                            <div className="px-6 py-4 border-b border-[#dde3ec]">
                                <h2 className="font-bold text-[#1e293b] text-xl">Documents</h2>
                                <p className="text-[#64748b] text-sm">Review and verify uploaded documents</p>
                            </div>

                            {documents && documents.length > 0 ? (
                                <div className="divide-y divide-[#f1f5f9]">
                                    {documents.map((doc: any) => (
                                        <div key={doc.id} className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-[#1e293b] capitalize text-lg">{doc.document_type}</h3>
                                                    <div className="text-[12px] text-[#64748b]">
                                                        Uploaded: {new Date(doc.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                                <span className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase border ${getStatusColor(doc.status)}`}>
                                                    {doc.status}
                                                </span>
                                            </div>

                                            {/* Document Preview */}
                                            {doc.storage_path && (
                                                <div className="mb-4 bg-[#f8fafc] rounded-lg p-4 border border-[#dde3ec]">
                                                    <a
                                                        href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${doc.storage_path}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[#2f6fed] font-semibold hover:underline"
                                                    >
                                                        📎 View Document
                                                    </a>
                                                </div>
                                            )}

                                            {/* AI Verification Result */}
                                            {doc.verification_result && (
                                                <div className="mb-4 bg-[#f0f9ff] rounded-lg p-4 border border-[#bae6fd]">
                                                    <h4 className="font-bold text-[#0369a1] text-sm mb-2">🤖 AI Verification Result</h4>
                                                    <pre className="text-[12px] text-[#0c4a6e] whitespace-pre-wrap">
                                                        {typeof doc.verification_result === 'object'
                                                            ? JSON.stringify(doc.verification_result, null, 2)
                                                            : doc.verification_result}
                                                    </pre>
                                                </div>
                                            )}

                                            {/* Admin Notes */}
                                            {doc.admin_notes && (
                                                <div className="mb-4 bg-[#fef3c7] rounded-lg p-4 border border-[#fde68a]">
                                                    <h4 className="font-bold text-[#92400e] text-sm mb-1">📝 Admin Notes</h4>
                                                    <p className="text-[#78350f] text-sm">{doc.admin_notes}</p>
                                                </div>
                                            )}

                                            {/* Verification Form */}
                                            <form action={updateDocumentStatus} className="bg-[#f8fafc] rounded-lg p-4 border border-[#dde3ec]">
                                                <input type="hidden" name="doc_id" value={doc.id} />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className="text-[12px] text-[#64748b] uppercase font-bold block mb-2">Set Status</label>
                                                        <select name="status" defaultValue={doc.status} className="w-full border border-[#dde3ec] rounded-lg px-3 py-2 text-sm bg-white">
                                                            <option value="pending">Pending</option>
                                                            <option value="verifying">Verifying</option>
                                                            <option value="verified">Verified ✓</option>
                                                            <option value="rejected">Rejected ✗</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[12px] text-[#64748b] uppercase font-bold block mb-2">Admin Notes</label>
                                                        <input
                                                            type="text"
                                                            name="admin_notes"
                                                            defaultValue={doc.admin_notes || ""}
                                                            placeholder="Add notes..."
                                                            className="w-full border border-[#dde3ec] rounded-lg px-3 py-2 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="submit"
                                                        className="bg-[#2f6fed] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#1e5cd6] transition-colors"
                                                    >
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-10 text-center text-[#94a3b8] italic">
                                    No documents uploaded yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
