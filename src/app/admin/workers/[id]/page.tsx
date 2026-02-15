import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isGodModeUser } from "@/lib/godmode";
import { queueEmail } from "@/lib/email-templates";
import ManualMatchButton from "@/components/admin/ManualMatchButton";
import ReVerifyButton from "@/components/admin/ReVerifyButton";
import SingleWorkerDownload from "@/components/admin/SingleWorkerDownload";
import DocumentPreview from "@/components/admin/DocumentPreview";

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
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== 'admin' && !isOwner) {
        redirect("/profile");
    }

    // Use admin client (service role) to bypass RLS for reading other users' data
    let adminClient;
    try {
        adminClient = createAdminClient();
    } catch (err: any) {
        console.warn("Service role key not configured, falling back to user client:", err);
        adminClient = supabase;
    }

    // Fetch auth user first (always exists if the user was created)
    const { data: { user: authUser }, error: authUserError } = await adminClient.auth.admin.getUserById(id);
    if (!authUser || authUserError) {
        notFound();
    }

    // Fetch candidate profile (may not exist if user never completed signup)
    const { data: candidateProfile } = await adminClient
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

    const { data: candidateData } = await adminClient
        .from("candidates")
        .select("*")
        .eq("profile_id", id)
        .single();

    // Fetch documents
    const { data: documents } = await adminClient
        .from("candidate_documents")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

    // Fetch payments
    const { data: payments } = await adminClient
        .from("payments")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

    // Fetch signatures
    const { data: signatures } = await adminClient
        .from("signatures")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

    async function updateDocumentStatus(formData: FormData) {
        "use server";
        const docId = formData.get("doc_id") as string;
        const newStatus = formData.get("status") as string;
        const adminNotes = formData.get("admin_notes") as string;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== 'admin') {
            throw new Error("Forbidden: Admin access only");
        }

        const adminClient = createAdminClient();

        await adminClient
            .from("candidate_documents")
            .update({
                status: newStatus,
                admin_notes: adminNotes,
                updated_at: new Date().toISOString()
            })
            .eq("id", docId);

        // Send email notification
        if (newStatus !== "pending" && newStatus !== "verifying") {
            const userEmail = formData.get("user_email") as string;
            const docType = formData.get("doc_type") as string;

            if (userEmail) {
                const title = newStatus === 'verified' ? 'Document Verified' : 'Document Rejected';
                const message = newStatus === 'verified'
                    ? `Your ${docType} has been successfully verified.`
                    : `Your ${docType} has been rejected. ${adminNotes ? `Reason: ${adminNotes}` : 'Please upload a valid document.'}`;

                await queueEmail(
                    adminClient,
                    id,
                    "admin_update",
                    userEmail,
                    "User", // We could fetch name, but generic "User" or just "Hello" works with the template logic
                    { title, message, subject: `Document Update: ${docType} ${newStatus}` }
                );
            }
        }

        revalidatePath(`/admin/workers/${id}`);
    }

    async function deleteDocument(formData: FormData) {
        "use server";
        const docId = formData.get("doc_id") as string;
        const storagePath = formData.get("storage_path") as string;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== 'admin') {
            throw new Error("Forbidden: Admin access only");
        }

        const adminClient = createAdminClient();

        // Delete from storage
        if (storagePath) {
            await adminClient.storage
                .from("candidate-docs")
                .remove([storagePath]);
        }

        // Delete from database
        await adminClient
            .from("candidate_documents")
            .delete()
            .eq("id", docId);

        revalidatePath(`/admin/workers/${id}`);
    }

    async function requestNewDocument(formData: FormData) {
        "use server";
        const docId = formData.get("doc_id") as string;
        const storagePath = formData.get("storage_path") as string;
        const docType = formData.get("doc_type") as string;
        const reason = formData.get("reason") as string;
        const userEmail = formData.get("user_email") as string;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== 'admin') {
            throw new Error("Forbidden: Admin access only");
        }

        const adminClient = createAdminClient();

        // Delete from storage
        if (storagePath) {
            await adminClient.storage
                .from("candidate-docs")
                .remove([storagePath]);
        }

        // Delete from database  
        await adminClient
            .from("candidate_documents")
            .delete()
            .eq("id", docId);

        // Send email notification to user
        if (userEmail) {
            await queueEmail(
                adminClient,
                id,
                "admin_update",
                userEmail,
                "User",
                {
                    title: "Action Required: New Document Needed",
                    message: `We need you to upload a new ${docType}. Reason: ${reason}`,
                    subject: "Action Required: New Document Needed"
                }
            );
        }

        // Admin requested new document

        revalidatePath(`/admin/workers/${id}`);
    }

    async function approveWorker(formData: FormData) {
        "use server";
        const action = formData.get("action") as string; // "approve" or "revoke"

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== 'admin' && !isGodModeUser(user.email)) {
            throw new Error("Forbidden: Admin access only");
        }

        const adminClient = createAdminClient();

        if (action === "approve") {
            await adminClient
                .from("candidates")
                .update({
                    admin_approved: true,
                    admin_approved_at: new Date().toISOString(),
                    admin_approved_by: user.id,
                    status: 'PENDING_APPROVAL', // Mark as ready to pay
                    updated_at: new Date().toISOString()
                })
                .eq("profile_id", id);
        } else {
            await adminClient
                .from("candidates")
                .update({
                    admin_approved: false,
                    admin_approved_at: null,
                    admin_approved_by: null,
                    updated_at: new Date().toISOString()
                })
                .eq("profile_id", id);
        }

        revalidatePath(`/admin/workers/${id}`);
    }

    async function updateCandidateStatus(formData: FormData) {
        "use server";
        const newStatus = formData.get("status") as string;
        const userEmail = formData.get("user_email") as string;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== 'admin') {
            throw new Error("Forbidden: Admin access only");
        }

        const adminClient = createAdminClient();

        await adminClient
            .from("candidates")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq("profile_id", id);

        // Send email notification
        if (userEmail) {
            await queueEmail(
                adminClient,
                id,
                "admin_update",
                userEmail,
                "User",
                {
                    title: "Status Update",
                    message: `Your application status has been updated to: ${newStatus.toUpperCase()}.`,
                    subject: `Application Status Updated: ${newStatus}`
                }
            );
        }

        revalidatePath(`/admin/workers/${id}`);
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
        <>

            <div className="max-w-[1200px] mx-auto px-5 py-10">
                {/* Back Link */}
                <Link href="/admin/workers" className="text-[#2f6fed] font-semibold hover:underline mb-6 inline-block">
                    ← Back to Workers
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Candidate Info */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* No Profile Notice */}
                        {!candidateProfile && (
                            <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4 text-amber-800 text-sm font-medium">
                                ⚠️ This user has not completed their profile yet. Only basic auth data is available.
                            </div>
                        )}

                        {/* Profile Card */}
                        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
                            <h2 className="font-bold text-[#1e293b] text-xl mb-4">Profile Info</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold">Full Name</label>
                                    <div className="text-[#1e293b] font-medium">{candidateProfile?.full_name || authUser.user_metadata?.full_name || "—"}</div>
                                </div>
                                <div>
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold">Email</label>
                                    <div className="text-[#1e293b] font-medium">{candidateProfile?.email || authUser.email || "—"}</div>
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

                        {/* Admin Approval */}
                        <div className={`rounded-[16px] shadow-sm border p-6 ${candidateData?.admin_approved ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <h2 className="font-bold text-[#1e293b] text-xl mb-3">Admin Approval</h2>
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full border ${candidateData?.admin_approved
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                        : 'bg-amber-100 text-amber-700 border-amber-300'
                                    }`}>
                                    {candidateData?.admin_approved ? '✓ Approved' : '⏳ Pending Approval'}
                                </span>
                            </div>
                            {candidateData?.admin_approved && candidateData?.admin_approved_at && (
                                <p className="text-xs text-emerald-600 mb-3">
                                    Approved {new Date(candidateData.admin_approved_at).toLocaleDateString('en-GB')} at {new Date(candidateData.admin_approved_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                            <form action={approveWorker}>
                                {candidateData?.admin_approved ? (
                                    <>
                                        <input type="hidden" name="action" value="revoke" />
                                        <button type="submit" className="w-full bg-red-500 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-red-600 transition-colors">
                                            Revoke Approval
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <input type="hidden" name="action" value="approve" />
                                        <button type="submit" className="w-full bg-emerald-500 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-emerald-600 transition-colors">
                                            ✓ Approve for Payment
                                        </button>
                                    </>
                                )}
                            </form>
                        </div>

                        {/* Status Control */}
                        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
                            <h2 className="font-bold text-[#1e293b] text-xl mb-4">Candidate Status</h2>
                            <form action={updateCandidateStatus}>
                                <input type="hidden" name="user_email" value={candidateProfile?.email || authUser.email || ""} />
                                <div className="mb-4">
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold block mb-2">Current Status</label>
                                    <span className={`text-[12px] px-3 py-1.5 rounded-full font-bold uppercase border ${getStatusColor(candidateData?.status || 'pending')}`}>
                                        {candidateData?.status || 'pending'}
                                    </span>
                                </div>
                                <div className="mb-4">
                                    <label className="text-[12px] text-[#64748b] uppercase font-bold block mb-2">Update Status</label>
                                    <select name="status" className="w-full border border-[#dde3ec] rounded-lg px-3 py-2 text-sm">
                                        <option value="NEW">New</option>
                                        <option value="PROFILE_COMPLETE">Profile Complete</option>
                                        <option value="PENDING_APPROVAL">Pending Approval</option>
                                        <option value="IN_QUEUE">In Queue</option>
                                        <option value="OFFER_PENDING">Offer Pending</option>
                                        <option value="OFFER_ACCEPTED">Offer Accepted</option>
                                        <option value="VISA_PROCESS_STARTED">Visa Process Started</option>
                                        <option value="REJECTED">Rejected</option>
                                        <option value="REFUND_FLAGGED">Refund Flagged</option>
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
                                                        {new Date(payment.created_at).toLocaleDateString('en-GB')}
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

                        {/* Document Preview */}
                        <DocumentPreview profileId={id} />

                        {/* Signature Card */}
                        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
                            <h2 className="font-bold text-[#1e293b] text-xl mb-4">Digital Signature</h2>
                            {signatures && signatures.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="border border-[#f1f5f9] rounded-lg p-4 bg-[#f8fafc]">
                                        <img
                                            src={signatures[0].signature_data}
                                            alt="User Signature"
                                            className="max-w-full h-auto bg-white rounded border"
                                            style={{ maxHeight: '100px' }}
                                        />
                                    </div>
                                    <div className="text-[12px] text-[#64748b] space-y-1">
                                        <div><strong>Document:</strong> {signatures[0].document_type}</div>
                                        <div><strong>Signed:</strong> {new Date(signatures[0].created_at).toLocaleString('en-GB')}</div>
                                        <div><strong>IP:</strong> {signatures[0].ip_address || 'N/A'}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-[#94a3b8] italic">No signature on file</div>
                            )}
                        </div>

                        {/* Manual Match */}
                        {candidateData && (
                            <ManualMatchButton candidateId={candidateData.id} />
                        )}

                        {/* Download Documents */}
                        <SingleWorkerDownload
                            profileId={id}
                            workerName={candidateProfile?.full_name || authUser.user_metadata?.full_name || "Worker"}
                        />
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
                                                        Uploaded: {new Date(doc.created_at).toLocaleString('en-GB')}
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
                                                        href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/candidate-docs/${doc.storage_path}`}
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
                                            <form action={updateDocumentStatus} className="bg-[#f8fafc] rounded-lg p-4 border border-[#dde3ec] mb-3">
                                                <input type="hidden" name="doc_id" value={doc.id} />
                                                <input type="hidden" name="doc_type" value={doc.document_type} />
                                                <input type="hidden" name="user_email" value={candidateProfile?.email || authUser.email || ""} />
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
                                                <button
                                                    type="submit"
                                                    className="bg-[#2f6fed] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#1e5cd6] transition-colors"
                                                >
                                                    Save Changes
                                                </button>
                                            </form>

                                            {/* Admin Actions */}
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {/* Re-Verify Document */}
                                                <ReVerifyButton documentId={doc.id} />

                                                {/* Delete Document */}
                                                <form action={deleteDocument}>
                                                    <input type="hidden" name="doc_id" value={doc.id} />
                                                    <input type="hidden" name="storage_path" value={doc.storage_path || ""} />
                                                    <button
                                                        type="submit"
                                                        className="bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-red-600 transition-colors"
                                                    >
                                                        🗑️ Delete Document
                                                    </button>
                                                </form>

                                                {/* Request New Document */}
                                                <details className="group">
                                                    <summary className="bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-orange-600 transition-colors cursor-pointer list-none">
                                                        📨 Request New Document
                                                    </summary>
                                                    <form action={requestNewDocument} className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                                        <input type="hidden" name="doc_id" value={doc.id} />
                                                        <input type="hidden" name="storage_path" value={doc.storage_path || ""} />
                                                        <input type="hidden" name="doc_type" value={doc.document_type} />
                                                        <input type="hidden" name="user_email" value={candidateProfile?.email || authUser.email || ""} />
                                                        <label className="text-[11px] text-orange-700 uppercase font-bold block mb-1">
                                                            Reason for requesting new document:
                                                        </label>
                                                        <textarea
                                                            name="reason"
                                                            required
                                                            placeholder="e.g., Image is too blurry, document is cropped, wrong document type..."
                                                            className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm mb-2"
                                                            rows={2}
                                                        />
                                                        <button
                                                            type="submit"
                                                            className="bg-orange-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-orange-700 transition-colors"
                                                        >
                                                            Delete & Request New
                                                        </button>
                                                    </form>
                                                </details>
                                            </div>
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
        </>
    );
}
