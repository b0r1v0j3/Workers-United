import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isGodModeUser } from "@/lib/godmode";
import { queueEmail } from "@/lib/email-templates";
import { getWorkerCompletion } from "@/lib/profile-completion";
import ManualMatchButton from "@/components/admin/ManualMatchButton";
import ReVerifyButton from "@/components/admin/ReVerifyButton";
import SingleWorkerDownload from "@/components/admin/SingleWorkerDownload";
import DocumentPreview from "@/components/admin/DocumentPreview";
import { AlertTriangle, Check, Clock, Trash2, Mail, Paperclip, Brain, StickyNote, X } from "lucide-react";

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

    // Profile completion
    const { completion: profileCompletion } = getWorkerCompletion({
        profile: candidateProfile,
        candidate: candidateData,
        documents: (documents || []).map((d: any) => ({ document_type: d.document_type })),
    });

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
                            <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4 text-amber-800 text-sm font-medium flex items-center gap-2">
                                <AlertTriangle size={16} /> This user has not completed their profile yet. Only basic auth data is available.
                            </div>
                        )}

                        {/* Profile Card — All Fields */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-slate-900 text-lg">Profile Info</h2>
                                <span className="text-xs font-bold text-slate-500">{profileCompletion}% complete</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-slate-100 rounded-full h-2 mb-5">
                                <div className={`h-2 rounded-full transition-all ${profileCompletion === 100 ? 'bg-emerald-500' : profileCompletion >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                    style={{ width: `${profileCompletion}%` }} />
                            </div>

                            {/* Basic Info */}
                            <div className="mb-4">
                                <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Basic Info</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <InfoRow label="Full Name" value={candidateProfile?.full_name || authUser.user_metadata?.full_name} />
                                    <InfoRow label="Email" value={candidateProfile?.email || authUser.email} />
                                    <InfoRow label="Phone" value={candidateData?.phone} />
                                    <InfoRow label="Gender" value={candidateData?.gender} />
                                </div>
                            </div>

                            {/* Personal Details */}
                            <div className="mb-4">
                                <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Personal Details</h3>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                    <InfoRow label="Date of Birth" value={candidateData?.date_of_birth ? new Date(candidateData.date_of_birth).toLocaleDateString('en-GB') : null} />
                                    <InfoRow label="Nationality" value={candidateData?.nationality} />
                                    <InfoRow label="Citizenship" value={candidateData?.citizenship} />
                                    <InfoRow label="Current Country" value={candidateData?.current_country} />
                                    <InfoRow label="Birth Country" value={candidateData?.birth_country} />
                                    <InfoRow label="Birth City" value={candidateData?.birth_city} />
                                    <InfoRow label="Marital Status" value={candidateData?.marital_status} />
                                    <InfoRow label="Lives Abroad" value={candidateData?.lives_abroad != null ? (candidateData.lives_abroad ? 'Yes' : 'No') : null} />
                                    <InfoRow label="Previous Visas" value={candidateData?.previous_visas != null ? (candidateData.previous_visas ? 'Yes' : 'No') : null} />
                                </div>
                            </div>

                            {/* Passport Details */}
                            <div className="mb-4">
                                <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Passport</h3>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                    <InfoRow label="Passport Number" value={candidateData?.passport_number} />
                                    <InfoRow label="Issued By" value={candidateData?.passport_issued_by} />
                                    <InfoRow label="Issue Date" value={candidateData?.passport_issue_date ? new Date(candidateData.passport_issue_date).toLocaleDateString('en-GB') : null} />
                                    <InfoRow label="Expiry Date" value={candidateData?.passport_expiry_date ? new Date(candidateData.passport_expiry_date).toLocaleDateString('en-GB') : null} />
                                </div>
                            </div>

                            {/* Preferences */}
                            <div className="mb-4">
                                <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Preferences</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <InfoRow label="Preferred Job" value={candidateData?.preferred_job} />
                                </div>
                            </div>

                            {/* Family Data — only when married */}
                            {candidateData?.marital_status?.toLowerCase() === 'married' && (
                                <div>
                                    <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                                        Family <span className="text-amber-500 normal-case">(required for married)</span>
                                    </h3>
                                    {candidateData?.family_data?.spouse ? (
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
                                            <InfoRow label="Spouse First Name" value={candidateData.family_data.spouse.first_name} />
                                            <InfoRow label="Spouse Last Name" value={candidateData.family_data.spouse.last_name} />
                                            <InfoRow label="Spouse DOB" value={candidateData.family_data.spouse.dob ? new Date(candidateData.family_data.spouse.dob).toLocaleDateString('en-GB') : null} />
                                            <InfoRow label="Spouse Birth Country" value={candidateData.family_data.spouse.birth_country} />
                                            <InfoRow label="Spouse Birth City" value={candidateData.family_data.spouse.birth_city} />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-red-400 font-medium mb-3 flex items-center gap-1"><AlertTriangle size={14} /> No spouse data entered</div>
                                    )}
                                    {candidateData?.family_data?.children?.length > 0 && (
                                        <div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1">Children ({candidateData.family_data.children.length})</div>
                                            {candidateData.family_data.children.map((child: any, i: number) => (
                                                <div key={i} className="grid grid-cols-3 gap-x-2 gap-y-1 mb-2 pl-2 border-l-2 border-slate-100">
                                                    <InfoRow label={`Child ${i + 1} Name`} value={`${child.first_name || ''} ${child.last_name || ''}`} />
                                                    <InfoRow label="DOB" value={child.dob ? new Date(child.dob).toLocaleDateString('en-GB') : null} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Admin Approval */}
                        <div className={`rounded-[16px] shadow-sm border p-6 ${candidateData?.admin_approved ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <h2 className="font-bold text-[#1e293b] text-xl mb-3">Admin Approval</h2>
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full border ${candidateData?.admin_approved
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                    : 'bg-amber-100 text-amber-700 border-amber-300'
                                    }`}>
                                    {candidateData?.admin_approved ? <span className="flex items-center gap-1"><Check size={14} /> Approved</span> : <span className="flex items-center gap-1"><Clock size={14} /> Pending Approval</span>}
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
                                            <span className="flex items-center justify-center gap-2"><Check size={16} /> Approve for Payment</span>
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
                                        <option value="VERIFIED">Verified</option>
                                        <option value="IN_QUEUE">In Queue</option>
                                        <option value="OFFER_PENDING">Offer Pending</option>
                                        <option value="OFFER_ACCEPTED">Offer Accepted</option>
                                        <option value="VISA_PROCESS_STARTED">Visa Process Started</option>
                                        <option value="VISA_APPROVED">Visa Approved</option>
                                        <option value="PLACED">Placed</option>
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
                                                        <span className="flex items-center gap-1"><Paperclip size={14} /> View Document</span>
                                                    </a>
                                                </div>
                                            )}

                                            {/* AI Verification Result */}
                                            {doc.verification_result && (
                                                <div className="mb-4 bg-[#f0f9ff] rounded-lg p-4 border border-[#bae6fd]">
                                                    <h4 className="font-bold text-[#0369a1] text-sm mb-2 flex items-center gap-2"><Brain size={14} /> AI Verification Result</h4>
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
                                                    <h4 className="font-bold text-[#92400e] text-sm mb-1 flex items-center gap-2"><StickyNote size={14} /> Admin Notes</h4>
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
                                                            <option value="verified">Verified</option>
                                                            <option value="rejected">Rejected</option>
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
                                                        <span className="flex items-center gap-1"><Trash2 size={12} /> Delete Document</span>
                                                    </button>
                                                </form>

                                                {/* Request New Document */}
                                                <details className="group">
                                                    <summary className="bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-orange-600 transition-colors cursor-pointer list-none">
                                                        <span className="flex items-center gap-1"><Mail size={12} /> Request New Document</span>
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

// ─── Helper Component ────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: any }) {
    const isEmpty = value === null || value === undefined || value === '';
    return (
        <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{label}</div>
            <div className={`text-sm font-medium ${isEmpty ? 'text-red-400' : 'text-slate-800'}`}>
                {isEmpty ? '—' : String(value)}
            </div>
        </div>
    );
}
