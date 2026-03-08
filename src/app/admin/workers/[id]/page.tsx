import type { ReactNode } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isGodModeUser } from "@/lib/godmode";
import { queueEmail } from "@/lib/email-templates";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { buildContractDataForMatch } from "@/lib/contract-data";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import ManualMatchButton from "@/components/admin/ManualMatchButton";
import ReVerifyButton from "@/components/admin/ReVerifyButton";
import SingleWorkerDownload from "@/components/admin/SingleWorkerDownload";
import DocumentPreview from "@/components/admin/DocumentPreview";
import DocumentViewerModal from "./DocumentViewerModal";
import { AlertTriangle, ArrowLeft, Brain, Check, Clock, ExternalLink, ListOrdered, Mail, Paperclip, StickyNote, Trash2, X } from "lucide-react";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import { getWorkerDocumentPublicUrl, WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function WorkerDetailPage({ params }: PageProps) {
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

    // Fetch worker profile (may not exist if user never completed signup)
    const { data: workerProfile } = await adminClient
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

    const { data: workerRecord } = await loadCanonicalWorkerRecord<any>(adminClient, id, "*");

    // Fetch contract data to allow manual editing for PDF generation
    let contractData = null;
    const { data: matches } = await adminClient.from("matches").select("id").eq("worker_id", workerRecord?.id).limit(1);
    if (matches && matches.length > 0) {
        try {
            const contractBuild = await buildContractDataForMatch(adminClient, matches[0].id);
            contractData = contractBuild.contractData;
        } catch (error) {
            console.warn("Failed to build contract data preview:", error);
        }
    }

    // Fetch documents
    const { data: documents } = await adminClient
        .from("worker_documents")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

    // Fetch payments
    const { data: rawPayments } = await adminClient
        .from("payments")
        .select("*")
        .eq("user_id", id);
    const payments = [...(rawPayments || [])].sort((a: any, b: any) => {
        const aTime = a?.paid_at ? new Date(a.paid_at).getTime() : 0;
        const bTime = b?.paid_at ? new Date(b.paid_at).getTime() : 0;
        return bTime - aTime;
    });

    // Fetch signatures
    const { data: signatures } = await adminClient
        .from("signatures")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

    // Profile completion
    const { completion: profileCompletion } = getWorkerCompletion({
        profile: workerProfile,
        worker: workerRecord,
        documents: (documents || []).map((d: any) => ({ document_type: d.document_type })),
    });
    const verifiedDocumentsCount = (documents || []).filter((doc: any) => doc.status === "verified").length;
    const pendingDocumentsCount = (documents || []).filter((doc: any) => ["pending", "uploaded", "verifying", "manual_review"].includes(doc.status || "")).length;
    const rejectedDocumentsCount = (documents || []).filter((doc: any) => doc.status === "rejected").length;
    const completedPaymentsCount = (payments || []).filter((payment: any) => ["completed", "paid"].includes(payment.status || "")).length;
    const pendingPaymentsCount = (payments || []).filter((payment: any) => payment.status === "pending").length;
    const latestSignature = signatures?.[0] || null;
    const displayName = workerProfile?.full_name || authUser.user_metadata?.full_name || authUser.email || "Worker";
    const workerStatus = workerRecord?.status || "NEW";
    const approvalState = workerRecord?.admin_approved ? "Approved" : "Pending";
    const workspaceInspectHref = `/profile/worker?inspect=${id}`;
    const documentsInspectHref = `/profile/worker/documents?inspect=${id}`;
    const queueInspectHref = `/profile/worker/queue?inspect=${id}`;

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
            .from("worker_documents")
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
                .from(WORKER_DOCUMENTS_BUCKET)
                .remove([storagePath]);
        }

        // Delete from database
        await adminClient
            .from("worker_documents")
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
                .from(WORKER_DOCUMENTS_BUCKET)
                .remove([storagePath]);
        }

        // Delete from database  
        await adminClient
            .from("worker_documents")
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
                .from("worker_onboarding")
                .update({
                    admin_approved: true,
                    admin_approved_at: new Date().toISOString(),
                    admin_approved_by: user.id,
                    // APPROVED is explicit "ready to pay" state after admin approval
                    status: 'APPROVED',
                    updated_at: new Date().toISOString()
                })
                .eq("profile_id", id);
        } else {
            await adminClient
                .from("worker_onboarding")
                .update({
                    admin_approved: false,
                    admin_approved_at: null,
                    admin_approved_by: null,
                    status: 'PENDING_APPROVAL',
                    updated_at: new Date().toISOString()
                })
                .eq("profile_id", id);
        }

        revalidatePath(`/admin/workers/${id}`);
    }

    async function updateWorkerStatus(formData: FormData) {
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
            .from("worker_onboarding")
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
        const normalized = (status || "").toUpperCase();
        switch (normalized) {
            case 'VERIFIED':
            case 'APPROVED':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'REJECTED':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'VERIFYING':
            case 'PENDING_APPROVAL':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'IN_QUEUE':
                return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'OFFER_PENDING':
            case 'OFFER_ACCEPTED':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'VISA_PROCESS_STARTED':
            case 'VISA_APPROVED':
            case 'PLACED':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default:
                return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto px-5 py-10">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <Link
                        href="/admin/workers"
                        className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:bg-[#faf8f3]"
                    >
                        <ArrowLeft size={16} />
                        Back to workers
                    </Link>
                    <Link
                        href={workspaceInspectHref}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                        <ExternalLink size={16} />
                        Inspect workspace
                    </Link>
                    <Link
                        href={documentsInspectHref}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                        <ExternalLink size={16} />
                        Inspect documents
                    </Link>
                    <Link
                        href={queueInspectHref}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                        <ListOrdered size={16} />
                        Inspect queue
                    </Link>
                </div>

                <AdminSectionHero
                    eyebrow="Worker case view"
                    title={displayName}
                    description="Admin case view for approvals, documents, payments, and matching. Use the inspect links above when you want the real worker workspace instead of the admin control surface."
                    metrics={[
                        { label: "Status", value: toDisplayLabel(workerStatus), meta: approvalState },
                        { label: "Completion", value: `${profileCompletion}%`, meta: workerProfile?.email || authUser.email || "No email" },
                        { label: "Docs", value: `${verifiedDocumentsCount}/3`, meta: pendingDocumentsCount > 0 ? `${pendingDocumentsCount} pending` : "No pending review" },
                        { label: "Paid", value: completedPaymentsCount, meta: pendingPaymentsCount > 0 ? `${pendingPaymentsCount} pending` : "No pending payments" },
                    ]}
                />

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <CaseHintCard
                        title="Inspect workspace"
                        copy="Read-only worker workspace with the exact user-facing layout. No admin actions live there."
                        tone="dark"
                    />
                    <CaseHintCard
                        title="Admin case view"
                        copy="Use the cards below for approvals, document actions, payment history, matching, and downloads."
                        tone="blue"
                    />
                    <CaseHintCard
                        title="Current case signal"
                        copy={workerRecord?.admin_approved
                            ? "This worker is already admin-approved. Keep focus on queue, offers, payments, and document validity."
                            : "This worker still needs admin approval before the downstream flow becomes fully operational."}
                        tone="amber"
                    />
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)]">
                    <div className="space-y-6">
                        {!workerProfile ? (
                            <OpsNotice copy="This user has not completed the worker profile yet. Only auth metadata and any existing document or payment records are available." />
                        ) : null}

                        <OpsPanelCard
                            eyebrow="Worker snapshot"
                            title="Profile and readiness"
                            description="Core identity, passport, and family data used for verification and downstream visa paperwork."
                        >
                            <div className="rounded-[24px] border border-[#ece8dd] bg-[#fcfbf8] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-[#18181b]">Completion signal</div>
                                        <div className="mt-1 text-sm text-[#71717a]">
                                            Worker profile is currently {profileCompletion}% complete.
                                        </div>
                                    </div>
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${profileCompletion === 100
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : profileCompletion >= 50
                                            ? "border-blue-200 bg-blue-50 text-blue-700"
                                            : "border-amber-200 bg-amber-50 text-amber-700"
                                        }`}>
                                        {profileCompletion === 100 ? "Ready" : "Needs completion"}
                                    </span>
                                </div>
                                <div className="mt-4 h-2 rounded-full bg-[#ece7dc]">
                                    <div
                                        className={`h-2 rounded-full transition-all ${profileCompletion === 100
                                            ? "bg-emerald-500"
                                            : profileCompletion >= 50
                                                ? "bg-blue-500"
                                                : "bg-amber-500"
                                            }`}
                                        style={{ width: `${profileCompletion}%` }}
                                    />
                                </div>
                            </div>

                            <div className="mt-5 space-y-4">
                                <FieldGroup title="Basic info" description="Identity and contact data used across notifications and case handling.">
                                    <InfoRow label="Full Name" value={workerProfile?.full_name || authUser.user_metadata?.full_name} />
                                    <InfoRow label="Email" value={workerProfile?.email || authUser.email} />
                                    <InfoRow label="Phone" value={workerRecord?.phone} />
                                    <InfoRow label="Gender" value={workerRecord?.gender} />
                                </FieldGroup>

                                <FieldGroup title="Personal details" description="Birth, citizenship, and mobility history.">
                                    <InfoRow label="Date of Birth" value={formatDate(workerRecord?.date_of_birth)} />
                                    <InfoRow label="Nationality" value={workerRecord?.nationality} />
                                    <InfoRow label="Citizenship" value={workerRecord?.citizenship} />
                                    <InfoRow label="Current Country" value={workerRecord?.current_country} />
                                    <InfoRow label="Birth Country" value={workerRecord?.birth_country} />
                                    <InfoRow label="Birth City" value={workerRecord?.birth_city} />
                                    <InfoRow label="Marital Status" value={workerRecord?.marital_status} />
                                    <InfoRow label="Lives Abroad" value={formatBoolean(workerRecord?.lives_abroad)} />
                                    <InfoRow label="Previous Visas" value={formatBoolean(workerRecord?.previous_visas)} />
                                </FieldGroup>

                                <FieldGroup title="Passport" description="Primary identity document values used in generated forms.">
                                    <InfoRow label="Passport Number" value={workerRecord?.passport_number} />
                                    <InfoRow label="Issued By" value={workerRecord?.passport_issued_by} />
                                    <InfoRow label="Issue Date" value={formatDate(workerRecord?.passport_issue_date)} />
                                    <InfoRow label="Expiry Date" value={formatDate(workerRecord?.passport_expiry_date)} />
                                </FieldGroup>

                                <FieldGroup title="Preferences" description="Current worker job target and matching intent." columnsClass="grid-cols-1">
                                    <InfoRow label="Preferred Job" value={workerRecord?.preferred_job} />
                                </FieldGroup>

                                {workerRecord?.marital_status?.toLowerCase() === "married" ? (
                                    <FieldGroup
                                        title="Family data"
                                        description="Required for married workers and later contract or visa preparation."
                                    >
                                        {workerRecord?.family_data?.spouse ? (
                                            <>
                                                <InfoRow label="Spouse First Name" value={workerRecord.family_data.spouse.first_name} />
                                                <InfoRow label="Spouse Last Name" value={workerRecord.family_data.spouse.last_name} />
                                                <InfoRow label="Spouse DOB" value={formatDate(workerRecord.family_data.spouse.dob)} />
                                                <InfoRow label="Spouse Birth Country" value={workerRecord.family_data.spouse.birth_country} />
                                                <InfoRow label="Spouse Birth City" value={workerRecord.family_data.spouse.birth_city} />
                                            </>
                                        ) : (
                                            <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                                No spouse data entered yet.
                                            </div>
                                        )}

                                        {workerRecord?.family_data?.children?.length > 0 ? (
                                            <div className="sm:col-span-2 rounded-2xl border border-[#ece8dd] bg-white px-4 py-4">
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">
                                                    Children ({workerRecord.family_data.children.length})
                                                </div>
                                                <div className="mt-3 space-y-3">
                                                    {workerRecord.family_data.children.map((child: any, index: number) => (
                                                        <div
                                                            key={index}
                                                            className="grid gap-3 border-l-2 border-[#ece8dd] pl-4 sm:grid-cols-3"
                                                        >
                                                            <InfoRow
                                                                label={`Child ${index + 1} Name`}
                                                                value={`${child.first_name || ""} ${child.last_name || ""}`.trim()}
                                                            />
                                                            <InfoRow label="DOB" value={formatDate(child.dob)} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </FieldGroup>
                                ) : null}
                            </div>
                        </OpsPanelCard>

                        <OpsPanelCard
                            eyebrow="Case controls"
                            title="Approval and status"
                            description="Admin approval, payment readiness, and worker state transitions all live here."
                        >
                            {workerRecord ? (
                                <div className="space-y-4">
                                    <div className={`rounded-[24px] border p-5 ${workerRecord.admin_approved ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-[#18181b]">Approval state</div>
                                                <div className="mt-1 text-sm text-[#57534e]">
                                                    {workerRecord.admin_approved
                                                        ? "Worker is unlocked for payment and downstream queue operations."
                                                        : "Worker still needs an explicit admin approval decision before payment readiness is fully clear."}
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${workerRecord.admin_approved
                                                ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                                : "border-amber-300 bg-amber-100 text-amber-700"
                                                }`}>
                                                {workerRecord.admin_approved ? <Check size={14} /> : <Clock size={14} />}
                                                {workerRecord.admin_approved ? "Approved" : "Pending approval"}
                                            </span>
                                        </div>
                                        {workerRecord.admin_approved_at ? (
                                            <p className="mt-4 text-xs font-medium text-[#57534e]">
                                                Approved on {formatDateTime(workerRecord.admin_approved_at)}
                                            </p>
                                        ) : null}
                                        <form action={approveWorker} className="mt-4">
                                            <input type="hidden" name="action" value={workerRecord.admin_approved ? "revoke" : "approve"} />
                                            <button
                                                type="submit"
                                                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${workerRecord.admin_approved
                                                    ? "bg-red-500 hover:bg-red-600"
                                                    : "bg-emerald-600 hover:bg-emerald-700"
                                                    }`}
                                            >
                                                {workerRecord.admin_approved ? "Revoke approval" : "Approve for payment"}
                                            </button>
                                        </form>
                                    </div>

                                    <div className="rounded-[24px] border border-[#ece8dd] bg-[#fcfbf8] p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-[#18181b]">Worker status</div>
                                                <div className="mt-1 text-sm text-[#57534e]">
                                                    Use controlled status changes when the case actually moves to the next operational phase.
                                                </div>
                                            </div>
                                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getStatusColor(workerRecord.status || "NEW")}`}>
                                                {toDisplayLabel(workerRecord.status || "NEW")}
                                            </span>
                                        </div>

                                        <form action={updateWorkerStatus} className="mt-4 space-y-4">
                                            <input type="hidden" name="user_email" value={workerProfile?.email || authUser.email || ""} />
                                            <div>
                                                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">
                                                    Update status
                                                </label>
                                                <select
                                                    name="status"
                                                    defaultValue={workerRecord.status || "NEW"}
                                                    className="w-full rounded-xl border border-[#ddd8cb] bg-white px-3 py-3 text-sm text-[#18181b] outline-none transition focus:border-[#a8a29e] focus:ring-2 focus:ring-[#efece3]"
                                                >
                                                    <option value="NEW">New</option>
                                                    <option value="PROFILE_COMPLETE">Profile Complete</option>
                                                    <option value="PENDING_APPROVAL">Pending Approval</option>
                                                    <option value="VERIFIED">Verified</option>
                                                    <option value="APPROVED">Approved</option>
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
                                            <button
                                                type="submit"
                                                className="w-full rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
                                            >
                                                Save worker status
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            ) : (
                                <EmptyAdminState copy="There is no worker record yet, so approval and status controls are unavailable until signup completion creates the worker row." />
                            )}
                        </OpsPanelCard>

                        <OpsPanelCard
                            eyebrow="Financials"
                            title="Payments and contract data"
                            description="Track completed payments, pending sessions, and the current contract payload used for generated PDFs."
                        >
                            <div className="space-y-4">
                                {contractData ? (
                                    <div className="rounded-[24px] border border-[#ece8dd] bg-[#fcfbf8] p-5">
                                        <div className="mb-4">
                                            <div className="text-sm font-semibold text-[#18181b]">Contract payload snapshot</div>
                                            <p className="mt-1 text-sm text-[#71717a]">
                                                Values currently merged into worker contract and visa documents.
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <InfoRow label="Employer Company Name" value={contractData.employer_company_name} />
                                            <InfoRow label="Employer City" value={contractData.employer_city} />
                                            <InfoRow label="APR Number" value={contractData.employer_apr_number} />
                                            <InfoRow label="Founding Date" value={contractData.employer_founding_date} />
                                            <InfoRow label="Signing City" value={contractData.signing_city} />
                                            <InfoRow label="PIB" value={contractData.employer_pib} />
                                            <InfoRow label="MB" value={contractData.employer_mb} />
                                        </div>
                                        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900">
                                            <strong>Editing note:</strong> use <code className="font-mono">/api/admin/edit-data</code> or the DB UI
                                            until this case surface gets a dedicated contract editor.
                                        </div>
                                    </div>
                                ) : (
                                    <EmptyAdminState copy="No contract payload is available yet. It appears once the worker has a match with enough employer and job data to build the document set." />
                                )}

                                <div className="rounded-[24px] border border-[#ece8dd] bg-white p-5">
                                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-[#18181b]">Payment history</div>
                                            <p className="mt-1 text-sm text-[#71717a]">
                                                Entry fee, pending checkout attempts, and refund outcomes.
                                            </p>
                                        </div>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-[#ece8dd] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                                            {completedPaymentsCount} completed
                                        </div>
                                    </div>

                                    {payments && payments.length > 0 ? (
                                        <div className="space-y-3">
                                            {payments.map((payment: any) => (
                                                <div
                                                    key={payment.id}
                                                    className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#ece8dd] bg-[#fcfbf8] px-4 py-4"
                                                >
                                                    <div>
                                                        <div className="text-base font-semibold text-[#18181b]">{formatPaymentAmount(payment)}</div>
                                                        <div className="mt-1 text-sm text-[#71717a]">
                                                            {formatDate(payment.paid_at || payment.created_at) || "No date"}
                                                        </div>
                                                        <div className="mt-1 text-xs text-[#8a8479]">
                                                            {payment.type ? toDisplayLabel(payment.type) : "Payment"}
                                                        </div>
                                                    </div>
                                                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${payment.refund_status === "completed"
                                                        ? "bg-orange-100 text-orange-700"
                                                        : payment.status === "completed"
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "bg-slate-100 text-slate-600"
                                                        }`}>
                                                        {payment.refund_status === "completed" ? "Refunded" : toDisplayLabel(payment.status || "pending")}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyAdminState copy="No payments recorded for this worker yet." />
                                    )}
                                </div>
                            </div>
                        </OpsPanelCard>

                        <DocumentPreview profileId={id} />

                        <OpsPanelCard
                            eyebrow="Signature"
                            title="Digital signature"
                            description="Latest signature capture available for generated document flows."
                        >
                            {latestSignature ? (
                                <div className="space-y-4">
                                    <div className="rounded-[24px] border border-[#ece8dd] bg-[#fcfbf8] p-4">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={latestSignature.signature_data}
                                            alt="Worker signature"
                                            className="max-h-[120px] w-full rounded-xl border border-[#e7e5e4] bg-white object-contain"
                                        />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <InfoRow label="Document" value={latestSignature.document_type} />
                                        <InfoRow label="Signed" value={formatDateTime(latestSignature.created_at)} />
                                        <InfoRow label="IP" value={latestSignature.ip_address || "N/A"} />
                                    </div>
                                </div>
                            ) : (
                                <EmptyAdminState copy="No signature is stored for this worker yet." />
                            )}
                        </OpsPanelCard>

                        {workerRecord ? <ManualMatchButton workerRecordId={workerRecord.id} /> : null}

                        <SingleWorkerDownload
                            profileId={id}
                            workerName={workerProfile?.full_name || authUser.user_metadata?.full_name || "Worker"}
                        />
                    </div>

                    <div className="space-y-6">
                        <OpsPanelCard
                            eyebrow="Document operations"
                            title="Verification queue"
                            description="Review uploaded passport, biometric photo, and diploma, then move each document through AI or manual verification."
                        >
                            <div className="grid gap-3 sm:grid-cols-3">
                                <MiniMetric label="Verified" value={`${verifiedDocumentsCount}/3`} meta="Ready to use" tone="emerald" />
                                <MiniMetric label="Pending" value={pendingDocumentsCount} meta="Needs review" tone="amber" />
                                <MiniMetric label="Rejected" value={rejectedDocumentsCount} meta="Needs re-upload" tone="rose" />
                            </div>

                            {documents && documents.length > 0 ? (
                                <div className="mt-5 space-y-4">
                                    {documents.map((doc: any) => (
                                        <article
                                            key={doc.id}
                                            className="rounded-[24px] border border-[#ece8dd] bg-[#fcfbf8] p-5"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="inline-flex items-center gap-2 rounded-full border border-[#ded8ca] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                                                        <Paperclip size={14} />
                                                        {toDisplayLabel(doc.document_type)}
                                                    </div>
                                                    <p className="mt-3 text-sm text-[#71717a]">
                                                        Uploaded {formatDateTime(doc.created_at) || "Unknown time"}
                                                    </p>
                                                </div>
                                                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getStatusColor(doc.status)}`}>
                                                    {toDisplayLabel(doc.status)}
                                                </span>
                                            </div>

                                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                                <InlineFact label="Storage" value={doc.storage_path ? "File attached" : "No file"} />
                                                <InlineFact label="Admin Notes" value={doc.admin_notes ? "Present" : "None"} />
                                                <InlineFact label="AI Result" value={doc.verification_result ? "Available" : "None"} />
                                            </div>

                                            {doc.storage_path ? (
                                                <DocumentViewerModal
                                                    url={getWorkerDocumentPublicUrl(doc.storage_path) || ""}
                                                    documentType={doc.document_type}
                                                    status={doc.status}
                                                >
                                                    {doc.verification_result ? (
                                                        <ModalDetailCard title="AI verification result" icon={<Brain size={14} />} tone="blue">
                                                            <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-[#0f172a]">
                                                                {typeof doc.verification_result === "object"
                                                                    ? JSON.stringify(doc.verification_result, null, 2)
                                                                    : doc.verification_result}
                                                            </pre>
                                                        </ModalDetailCard>
                                                    ) : null}

                                                    {doc.admin_notes ? (
                                                        <ModalDetailCard title="Admin notes" icon={<StickyNote size={14} />} tone="amber">
                                                            <p className="text-sm text-[#78350f]">{doc.admin_notes}</p>
                                                        </ModalDetailCard>
                                                    ) : null}

                                                    <form action={updateDocumentStatus} className="rounded-[22px] border border-[#e6e6e1] bg-[#faf8f3] p-4">
                                                        <input type="hidden" name="doc_id" value={doc.id} />
                                                        <input type="hidden" name="doc_type" value={doc.document_type} />
                                                        <input type="hidden" name="user_email" value={workerProfile?.email || authUser.email || ""} />
                                                        <div className="mb-4">
                                                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">
                                                                Set status
                                                            </label>
                                                            <select
                                                                name="status"
                                                                defaultValue={doc.status}
                                                                className="w-full rounded-xl border border-[#ddd8cb] bg-white px-3 py-3 text-sm text-[#18181b] outline-none transition focus:border-[#a8a29e] focus:ring-2 focus:ring-[#efece3]"
                                                            >
                                                                <option value="pending">Pending</option>
                                                                <option value="verifying">Verifying</option>
                                                                <option value="verified">Verified</option>
                                                                <option value="rejected">Rejected</option>
                                                            </select>
                                                        </div>
                                                        <div className="mb-4">
                                                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">
                                                                Admin notes
                                                            </label>
                                                            <input
                                                                type="text"
                                                                name="admin_notes"
                                                                defaultValue={doc.admin_notes || ""}
                                                                placeholder="Add internal notes..."
                                                                className="w-full rounded-xl border border-[#ddd8cb] bg-white px-3 py-3 text-sm text-[#18181b] outline-none transition focus:border-[#a8a29e] focus:ring-2 focus:ring-[#efece3]"
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            className="w-full rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
                                                        >
                                                            Save status changes
                                                        </button>
                                                    </form>

                                                    <div className="space-y-3">
                                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">
                                                            Additional actions
                                                        </div>

                                                        <ReVerifyButton documentId={doc.id} />

                                                        <details className="group rounded-[22px] border border-orange-200 bg-orange-50 p-0">
                                                            <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-[22px] px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100">
                                                                <Mail size={16} />
                                                                Request new document
                                                            </summary>
                                                            <form action={requestNewDocument} className="space-y-3 border-t border-orange-200 px-4 py-4">
                                                                <input type="hidden" name="doc_id" value={doc.id} />
                                                                <input type="hidden" name="storage_path" value={doc.storage_path || ""} />
                                                                <input type="hidden" name="doc_type" value={doc.document_type} />
                                                                <input type="hidden" name="user_email" value={workerProfile?.email || authUser.email || ""} />
                                                                <p className="text-xs leading-relaxed text-orange-900">
                                                                    This deletes the current file and emails the worker with a request to upload a new version.
                                                                </p>
                                                                <textarea
                                                                    name="reason"
                                                                    required
                                                                    placeholder="Explain what needs to change in the re-upload."
                                                                    className="min-h-[110px] w-full rounded-xl border border-orange-300 bg-white px-3 py-3 text-sm text-[#18181b] outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                                                                />
                                                                <button
                                                                    type="submit"
                                                                    className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
                                                                >
                                                                    Delete current file and notify worker
                                                                </button>
                                                            </form>
                                                        </details>

                                                        <details className="group rounded-[22px] border border-red-200 bg-red-50 p-0">
                                                            <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-[22px] px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                                                                <Trash2 size={16} />
                                                                Delete silently
                                                            </summary>
                                                            <form action={deleteDocument} className="space-y-3 border-t border-red-200 px-4 py-4">
                                                                <input type="hidden" name="doc_id" value={doc.id} />
                                                                <input type="hidden" name="storage_path" value={doc.storage_path || ""} />
                                                                <p className="text-xs leading-relaxed text-red-900">
                                                                    This removes the document without notifying the worker.
                                                                </p>
                                                                <button
                                                                    type="submit"
                                                                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                                                                >
                                                                    Confirm silent delete
                                                                </button>
                                                            </form>
                                                        </details>
                                                    </div>
                                                </DocumentViewerModal>
                                            ) : (
                                                <div className="mt-4 rounded-[20px] border border-dashed border-[#d6d3d1] bg-white px-4 py-4 text-sm text-[#78716c]">
                                                    No storage file is linked to this document row.
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-5 rounded-[24px] border border-dashed border-[#d6d3d1] bg-[#fcfbf8] px-5 py-10 text-center text-sm text-[#78716c]">
                                    No documents uploaded yet.
                                </div>
                            )}
                        </OpsPanelCard>
                    </div>
                </div>
            </div>
    );
}

// ─── Helper Components ───────────────────────────────────────

function OpsPanelCard({
    eyebrow,
    title,
    description,
    children,
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className="mb-5">
                <div className="inline-flex rounded-full border border-[#e3ded2] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                    {eyebrow}
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#18181b]">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#57534e]">{description}</p>
            </div>
            {children}
        </section>
    );
}

function FieldGroup({
    title,
    description,
    children,
    columnsClass = "sm:grid-cols-2",
}: {
    title: string;
    description: string;
    children: ReactNode;
    columnsClass?: string;
}) {
    return (
        <div className="rounded-[24px] border border-[#ece8dd] bg-[#fcfbf8] p-5">
            <div>
                <div className="text-sm font-semibold text-[#18181b]">{title}</div>
                <p className="mt-1 text-sm text-[#71717a]">{description}</p>
            </div>
            <div className={`mt-4 grid gap-3 ${columnsClass}`}>{children}</div>
        </div>
    );
}

function MiniMetric({
    label,
    value,
    meta,
    tone,
}: {
    label: string;
    value: string | number;
    meta: string;
    tone: "emerald" | "amber" | "rose";
}) {
    const toneClass = tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "amber"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-rose-200 bg-rose-50 text-rose-700";

    return (
        <div className="rounded-[20px] border border-[#ece8dd] bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">{label}</div>
            <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-2xl font-semibold tracking-tight text-[#18181b]">{value}</div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
                    {meta}
                </span>
            </div>
        </div>
    );
}

function InlineFact({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-[18px] border border-[#ece8dd] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">{label}</div>
            <div className="mt-2 text-sm font-medium text-[#18181b]">{value}</div>
        </div>
    );
}

function ModalDetailCard({
    title,
    icon,
    tone,
    children,
}: {
    title: string;
    icon: ReactNode;
    tone: "blue" | "amber";
    children: ReactNode;
}) {
    const toneClass = tone === "blue"
        ? "border-blue-200 bg-blue-50"
        : "border-amber-200 bg-amber-50";
    const textClass = tone === "blue" ? "text-blue-900" : "text-amber-900";

    return (
        <div className={`rounded-[22px] border p-4 ${toneClass}`}>
            <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${textClass}`}>
                {icon}
                {title}
            </div>
            {children}
        </div>
    );
}

function OpsNotice({ copy }: { copy: string }) {
    return (
        <div className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p className="leading-relaxed">{copy}</p>
        </div>
    );
}

function EmptyAdminState({ copy }: { copy: string }) {
    return (
        <div className="rounded-[22px] border border-dashed border-[#d6d3d1] bg-[#faf8f3] px-4 py-4 text-sm leading-relaxed text-[#78716c]">
            {copy}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: any }) {
    const isEmpty = value === null || value === undefined || value === '';
    return (
        <div className="rounded-[18px] border border-[#ece8dd] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">{label}</div>
            <div className={`mt-2 text-sm font-medium ${isEmpty ? 'text-[#d97706]' : 'text-[#18181b]'}`}>
                {isEmpty ? '—' : String(value)}
            </div>
        </div>
    );
}

function CaseHintCard({
    title,
    copy,
    tone,
}: {
    title: string;
    copy: string;
    tone: "dark" | "blue" | "amber";
}) {
    const toneClass = tone === "blue"
        ? "bg-blue-600 text-white"
        : tone === "amber"
            ? "bg-amber-500 text-white"
            : "bg-[#111111] text-white";

    return (
        <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className={`mb-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
                {title}
            </div>
            <p className="text-sm leading-relaxed text-[#57534e]">{copy}</p>
        </div>
    );
}

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleDateString("en-GB") : null;
}

function formatDateTime(value?: string | null) {
    return value ? new Date(value).toLocaleString("en-GB") : null;
}

function formatBoolean(value?: boolean | null) {
    if (value === null || value === undefined) return null;
    return value ? "Yes" : "No";
}

function toDisplayLabel(value?: string | null) {
    if (!value) return "—";
    return value
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatPaymentAmount(payment: any) {
    const amount = Number(payment?.amount ?? (Number(payment?.amount_cents || 0) / 100));
    return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "—";
}
