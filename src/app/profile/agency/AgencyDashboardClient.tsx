"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
    BadgeCheck,
    Building2,
    CheckCircle2,
    Clock3,
    CreditCard,
    FileCheck2,
    Loader2,
    Pencil,
    Plus,
    Search,
    Trash2,
    UserPlus,
    Users,
} from "lucide-react";
import { toast } from "sonner";
import AgencyWorkerCreateModal from "./AgencyWorkerCreateModal";

const surfaceClass = "rounded-[14px] border border-[#e7e7e5] bg-white shadow-[0_24px_70px_-54px_rgba(15,23,42,0.28)]";

type PaymentState = "not_paid" | "pending" | "paid";

export interface AgencyDashboardProps {
    agency: {
        displayName: string;
        contactEmail: string;
    };
    stats: {
        totalWorkers: number;
        claimedWorkers: number;
        readyWorkers: number;
        paidWorkers: number;
        draftWorkers: number;
    };
    workers: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        nationality: string | null;
        currentCountry: string | null;
        preferredJob: string | null;
        status: string;
        completion: number;
        claimed: boolean;
        accessLabel: string;
        verifiedDocuments: number;
        documentsLabel: string;
        paymentLabel: string;
        paymentState: PaymentState;
        createdAt: string | null;
        updatedAt: string | null;
    }>;
    readOnlyPreview?: boolean;
    inspectProfileId?: string | null;
}

type DashboardWorker = AgencyDashboardProps["workers"][number];

type DeleteDialogState = {
    workerIds: string[];
    workerNames: string[];
    includesClaimedAccount: boolean;
} | null;

type WorkerPhaseTone = "slate" | "blue" | "amber" | "orange" | "emerald" | "red";

type WorkerPhase = {
    label: string;
    detail: string;
    tone: WorkerPhaseTone;
};

const WORKER_PHASE_TONE_STYLES: Record<WorkerPhaseTone, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
};

function formatDate(value: string | null) {
    if (!value) {
        return "Unknown";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "Unknown";
    }

    return parsed.toLocaleDateString("en-GB");
}

function resolveWorkerPhase(worker: DashboardWorker): WorkerPhase {
    const normalizedStatus = (worker.status || "").toUpperCase();

    switch (normalizedStatus) {
        case "PLACED":
            return { label: "Placed", detail: "Worker has been successfully placed.", tone: "emerald" };
        case "VISA_APPROVED":
            return { label: "Visa approved", detail: "Visa approval is complete.", tone: "emerald" };
        case "VISA_PROCESS_STARTED":
            return { label: "Visa in process", detail: "Visa case is currently being handled.", tone: "emerald" };
        case "OFFER_ACCEPTED":
            return { label: "Offer accepted", detail: "Offer is accepted and moving to visa steps.", tone: "orange" };
        case "OFFER_PENDING":
            return { label: "Offer pending", detail: "Waiting for the worker to review the offer.", tone: "orange" };
        case "IN_QUEUE":
            return { label: "In queue", detail: "Job Finder is actively searching for a match.", tone: "amber" };
        case "REFUND_FLAGGED":
            return { label: "Refund review", detail: "The entry fee refund is being reviewed.", tone: "red" };
        case "REJECTED":
            return { label: "Needs update", detail: "Profile or documents need corrections.", tone: "red" };
        case "PENDING_APPROVAL":
            return { label: "Under review", detail: "Workers United is reviewing this worker.", tone: "blue" };
        case "PROFILE_COMPLETE":
        case "VERIFIED":
        case "APPROVED":
            return { label: "Ready to pay", detail: "Everything is ready for the $9 Job Finder fee.", tone: "blue" };
        default:
            break;
    }

    if (worker.paymentState === "pending") {
        return { label: "Payment pending", detail: "Waiting for Stripe to confirm the payment.", tone: "amber" };
    }

    if (worker.paymentState === "paid") {
        return { label: "Paid", detail: "Entry fee is paid and waiting for the next worker step.", tone: "emerald" };
    }

    if (worker.completion === 100 && worker.verifiedDocuments >= 3) {
        return { label: "Ready to pay", detail: "Profile and documents are complete.", tone: "blue" };
    }

    if (worker.verifiedDocuments > 0) {
        return {
            label: "Profile incomplete",
            detail: `${worker.verifiedDocuments}/3 documents verified so far.`,
            tone: "blue",
        };
    }

    if (worker.completion > 0) {
        return { label: "Profile incomplete", detail: `${worker.completion}% complete so far.`, tone: "slate" };
    }

    return { label: "Draft", detail: "Agency has started this worker profile.", tone: "slate" };
}

export default function AgencyDashboardClient({
    agency,
    stats,
    workers,
    readOnlyPreview = false,
    inspectProfileId = null,
}: AgencyDashboardProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<{ id: string; name: string } | null>(null);
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [payingWorkerId, setPayingWorkerId] = useState<string | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredWorkers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) {
            return workers;
        }

        return workers.filter((worker) => {
            const phase = resolveWorkerPhase(worker);
            return [
                worker.name,
                worker.nationality || "",
                worker.currentCountry || "",
                worker.preferredJob || "",
                worker.status,
                phase.label,
                phase.detail,
                worker.accessLabel,
                worker.paymentLabel,
                formatDate(worker.createdAt),
            ].some((value) => value.toLowerCase().includes(query));
        });
    }, [search, workers]);

    const visibleWorkerIds = useMemo(() => filteredWorkers.map((worker) => worker.id), [filteredWorkers]);
    const selectedWorkers = useMemo(
        () => workers.filter((worker) => selectedWorkerIds.includes(worker.id)),
        [selectedWorkerIds, workers]
    );
    const allVisibleSelected = visibleWorkerIds.length > 0 && visibleWorkerIds.every((workerId) => selectedWorkerIds.includes(workerId));
    const columnCount = readOnlyPreview ? 8 : 9;

    useEffect(() => {
        setSelectedWorkerIds((current) => current.filter((workerId) => workers.some((worker) => worker.id === workerId)));
    }, [workers]);

    function openNewWorkerModal() {
        setSelectedWorker(null);
        setIsWorkerModalOpen(true);
    }

    function openEditWorkerModal(worker: DashboardWorker) {
        setSelectedWorker({ id: worker.id, name: worker.name });
        setIsWorkerModalOpen(true);
    }

    function closeWorkerModal() {
        setSelectedWorker(null);
        setIsWorkerModalOpen(false);
    }

    function handleLiveSave() {
        closeWorkerModal();
        router.refresh();
    }

    function toggleWorkerSelection(workerId: string, checked: boolean) {
        setSelectedWorkerIds((current) =>
            checked
                ? current.includes(workerId)
                    ? current
                    : [...current, workerId]
                : current.filter((id) => id !== workerId)
        );
    }

    function toggleVisibleWorkers(checked: boolean) {
        setSelectedWorkerIds((current) => {
            if (checked) {
                return Array.from(new Set([...current, ...visibleWorkerIds]));
            }
            return current.filter((workerId) => !visibleWorkerIds.includes(workerId));
        });
    }

    function openDeleteDialog(targetWorkers: DashboardWorker[]) {
        if (readOnlyPreview || targetWorkers.length === 0) {
            return;
        }

        setDeleteDialog({
            workerIds: targetWorkers.map((worker) => worker.id),
            workerNames: targetWorkers.map((worker) => worker.name),
            includesClaimedAccount: targetWorkers.some((worker) => worker.claimed),
        });
    }

    async function handlePay(worker: DashboardWorker) {
        if (readOnlyPreview) {
            toast.error("Preview mode does not open payments.");
            return;
        }

        if (worker.paymentState !== "not_paid") {
            return;
        }

        setPayingWorkerId(worker.id);
        try {
            const response = await fetch("/api/stripe/create-checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "entry_fee",
                    targetWorkerId: worker.id,
                    successPath: "/profile/agency",
                    cancelPath: "/profile/agency",
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Could not open checkout.");
            }

            if (!data.checkoutUrl) {
                throw new Error("Checkout link is missing.");
            }

            window.location.href = data.checkoutUrl;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not open checkout.");
        } finally {
            setPayingWorkerId(null);
        }
    }

    async function confirmDelete() {
        if (!deleteDialog) {
            return;
        }

        setIsDeleting(true);
        const failedNames: string[] = [];

        try {
            for (let index = 0; index < deleteDialog.workerIds.length; index += 1) {
                const workerId = deleteDialog.workerIds[index];
                const workerName = deleteDialog.workerNames[index] || "Worker";

                const response = await fetch(`/api/agency/workers/${workerId}`, {
                    method: "DELETE",
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    failedNames.push(data?.error ? `${workerName} (${data.error})` : workerName);
                }
            }

            if (failedNames.length === deleteDialog.workerIds.length) {
                toast.error("Could not delete the selected workers.");
                return;
            }

            if (failedNames.length > 0) {
                toast.error(`Deleted some workers, but ${failedNames.length} failed.`);
            } else {
                toast.success(
                    deleteDialog.workerIds.length === 1
                        ? "Worker deleted."
                        : `${deleteDialog.workerIds.length} workers deleted.`
                );
            }

            setSelectedWorkerIds((current) => current.filter((workerId) => !deleteDialog.workerIds.includes(workerId)));
            setDeleteDialog(null);
            router.refresh();
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <>
            <div className="space-y-6">
                <section className={`${surfaceClass} px-4 py-4 sm:px-6 sm:py-6`}>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                                <Building2 size={14} />
                                Agency Workspace
                            </div>
                            <h1 className="text-[2rem] font-semibold tracking-tight text-[#111827] sm:text-3xl">{agency.displayName}</h1>
                            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                                One place for every worker profile. Create and edit the full worker form from here without leaving the agency workspace.
                            </p>
                            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#9ca3af]">
                                {agency.contactEmail}
                            </p>
                        </div>

                        <div className="grid grid-flow-col auto-cols-[minmax(96px,1fr)] gap-3 overflow-x-auto pb-1 sm:grid-cols-5 sm:grid-flow-row sm:auto-cols-auto sm:overflow-visible sm:pb-0">
                            <StatCard label="Total" value={stats.totalWorkers} icon={<Users size={18} />} />
                            <StatCard label="Accounts" value={stats.claimedWorkers} icon={<BadgeCheck size={18} />} />
                            <StatCard label="Ready" value={stats.readyWorkers} icon={<FileCheck2 size={18} />} />
                            <StatCard label="Paid" value={stats.paidWorkers} icon={<CreditCard size={18} />} />
                            <StatCard label="Drafts" value={stats.draftWorkers} icon={<UserPlus size={18} />} />
                        </div>
                    </div>
                </section>

                <section className={`${surfaceClass} overflow-hidden px-4 py-4 sm:px-6 sm:py-6`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">Workers</h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                                Manage every worker from one table. Job Finder payment stays one worker at a time so Stripe never charges the wrong total by mistake.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <label className="relative block w-full sm:w-[260px]">
                                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                                <input
                                    className="w-full rounded-[14px] border border-[#e5e7eb] bg-[#fafafa] py-3 pl-11 pr-4 text-sm text-[#111827] outline-none transition focus:border-[#111111]"
                                    placeholder="Search workers"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </label>

                            <button
                                type="button"
                                onClick={openNewWorkerModal}
                                className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d2d2d]"
                            >
                                <Plus size={16} />
                                Add worker
                            </button>
                        </div>
                    </div>

                    {!readOnlyPreview && workers.length > 0 ? (
                        <div className="mt-4 flex flex-col gap-3 rounded-[14px] border border-[#ececec] bg-[#fafafa] px-4 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-[#111827]">
                                        {selectedWorkers.length > 0
                                            ? `${selectedWorkers.length} worker${selectedWorkers.length === 1 ? "" : "s"} selected`
                                            : "Select workers to delete them in one action."}
                                    </p>
                                    <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                                        Bulk payment is intentionally locked. Each Job Finder checkout still belongs to one worker only.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => openDeleteDialog(selectedWorkers)}
                                    disabled={selectedWorkers.length === 0 || isDeleting}
                                    className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#f3d7d7] bg-white px-4 py-3 text-sm font-semibold text-[#9f1239] transition hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    Delete selected
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-5 overflow-hidden rounded-[14px] border border-[#ececec]">
                        <div className="overflow-x-auto">
                            <table className="min-w-[1180px] w-full table-fixed border-collapse">
                                <colgroup>
                                    {!readOnlyPreview ? <col className="w-14" /> : null}
                                    <col className="w-16" />
                                    <col className="w-[260px]" />
                                    <col className="w-[120px]" />
                                    <col className="w-[120px]" />
                                    <col className="w-[150px]" />
                                    <col className="w-[230px]" />
                                    <col className="w-[150px]" />
                                    <col className="w-[170px]" />
                                </colgroup>
                                <thead className="bg-[#fafafa]">
                                    <tr className="border-b border-[#ececec] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">
                                        {!readOnlyPreview ? (
                                            <th className="w-14 px-5 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={allVisibleSelected}
                                                    onChange={(event) => toggleVisibleWorkers(event.target.checked)}
                                                    className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                                    aria-label="Select visible workers"
                                                />
                                            </th>
                                        ) : null}
                                        <th className="w-16 px-5 py-4">#</th>
                                        <th className="px-5 py-4">Worker</th>
                                        <th className="px-5 py-4">Added</th>
                                        <th className="px-5 py-4">Completion</th>
                                        <th className="px-5 py-4">Documents</th>
                                        <th className="border-l border-[#ececec] px-6 py-4">Status</th>
                                        <th className="px-5 py-4">Payment</th>
                                        <th className="border-l border-[#ececec] px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {filteredWorkers.length === 0 ? (
                                        <tr>
                                            <td colSpan={columnCount} className="px-6 py-14">
                                                <div className="flex flex-col items-center justify-center text-center">
                                                    <div className="flex h-16 w-16 items-center justify-center rounded-[16px] border border-[#ececec] bg-[#fafafa] text-[#111111]">
                                                        <UserPlus size={28} />
                                                    </div>
                                                    <h3 className="mt-4 text-lg font-semibold text-[#111827]">No workers yet</h3>
                                                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#6b7280]">
                                                        Use the Add worker button above to open the full worker form without leaving this workspace.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredWorkers.map((worker, index) => (
                                            <WorkerTableRow
                                                key={worker.id}
                                                worker={worker}
                                                index={index + 1}
                                                isDeleting={isDeleting}
                                                isPaying={payingWorkerId === worker.id}
                                                isSelected={selectedWorkerIds.includes(worker.id)}
                                                readOnlyPreview={readOnlyPreview}
                                                onEdit={openEditWorkerModal}
                                                onPay={handlePay}
                                                onDelete={() => openDeleteDialog([worker])}
                                                onToggleSelected={toggleWorkerSelection}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>

            <AgencyWorkerCreateModal
                open={isWorkerModalOpen}
                workerId={selectedWorker?.id || null}
                workerLabel={selectedWorker?.name || null}
                readOnlyPreview={readOnlyPreview}
                inspectProfileId={inspectProfileId}
                onClose={closeWorkerModal}
                onLiveSave={handleLiveSave}
            />

            {deleteDialog && typeof document !== "undefined"
                ? createPortal(
                    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(15,23,42,0.18)] p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-[14px] border border-[#e5e7eb] bg-white p-6 shadow-[0_34px_100px_-54px_rgba(15,23,42,0.38)]">
                            <h3 className="text-xl font-semibold text-[#111827]">
                                {deleteDialog.workerIds.length === 1 ? "Delete worker?" : `Delete ${deleteDialog.workerIds.length} workers?`}
                            </h3>
                            <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                                {deleteDialog.includesClaimedAccount
                                    ? "This selection includes workers who already have their own accounts. Deleting them also removes the worker account, profile, documents, and payment history."
                                    : "This deletes the selected draft workers from the agency workspace."}
                            </p>
                            <div className="mt-4 rounded-[14px] border border-[#ececec] bg-[#fafafa] px-4 py-3 text-sm text-[#111827]">
                                {deleteDialog.workerNames.slice(0, 3).join(", ")}
                                {deleteDialog.workerNames.length > 3 ? ` and ${deleteDialog.workerNames.length - 3} more` : ""}
                            </div>
                            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setDeleteDialog(null)}
                                    disabled={isDeleting}
                                    className="rounded-[14px] border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void confirmDelete()}
                                    disabled={isDeleting}
                                    className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#b91c1c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    {deleteDialog.workerIds.length === 1 ? "Delete worker" : "Delete workers"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
                : null}
        </>
    );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
    return (
        <div className="min-w-[96px] rounded-[14px] border border-[#ececec] bg-[#fafafa] px-4 py-3 sm:min-w-0">
            <div className="mb-2 flex items-center justify-between text-[#9ca3af]">
                {icon}
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight text-[#111827]">{value}</div>
        </div>
    );
}

function WorkerTableRow({
    worker,
    index,
    isDeleting,
    isPaying,
    isSelected,
    readOnlyPreview,
    onEdit,
    onPay,
    onDelete,
    onToggleSelected,
}: {
    worker: DashboardWorker;
    index: number;
    isDeleting: boolean;
    isPaying: boolean;
    isSelected: boolean;
    readOnlyPreview: boolean;
    onEdit: (worker: DashboardWorker) => void;
    onPay: (worker: DashboardWorker) => void;
    onDelete: () => void;
    onToggleSelected: (workerId: string, checked: boolean) => void;
}) {
    const phase = resolveWorkerPhase(worker);
    const showPayButton = !readOnlyPreview && worker.paymentState === "not_paid";

    return (
        <tr className="border-b border-[#f1f1ef] transition hover:bg-[#fcfcfc]">
            {!readOnlyPreview ? (
                <td className="px-5 py-4 align-top">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => onToggleSelected(worker.id, event.target.checked)}
                        className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                        aria-label={`Select ${worker.name}`}
                    />
                </td>
            ) : null}
            <td className="px-5 py-4 align-top text-sm font-semibold text-[#111827]">{index}</td>
            <td className="px-5 py-4 align-top">
                <div className="font-semibold text-[#111827]">{worker.name}</div>
                <div className="mt-1 text-sm text-[#6b7280]">{worker.preferredJob || "No preferred job yet"}</div>
            </td>
            <td className="px-5 py-4 align-top text-sm text-[#111827]">{formatDate(worker.createdAt)}</td>
            <td className="px-5 py-4 align-top text-sm font-semibold text-[#111827]">{worker.completion}%</td>
            <td className="px-5 py-4 align-top text-sm text-[#111827]">{worker.documentsLabel}</td>
            <td className="border-l border-[#f3f4f6] px-6 py-4 align-top">
                <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${WORKER_PHASE_TONE_STYLES[phase.tone]}`}>
                    {phase.label}
                </div>
                <div className="mt-2 max-w-[200px] text-xs leading-relaxed text-[#6b7280]">{phase.detail}</div>
            </td>
            <td className="px-5 py-4 align-top">
                {showPayButton ? (
                    <button
                        type="button"
                        onClick={() => void onPay(worker)}
                        disabled={isPaying}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#111111] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:bg-[#e5e7eb] disabled:text-[#6b7280]"
                    >
                        {isPaying ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                        Pay $9
                    </button>
                ) : worker.paymentState === "paid" ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 size={14} />
                        Paid
                    </div>
                ) : (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                        <Clock3 size={14} />
                        Pending
                    </div>
                )}
            </td>
            <td className="border-l border-[#f3f4f6] px-6 py-4 align-top">
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onEdit(worker)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa]"
                    >
                        <Pencil size={14} />
                        Edit
                    </button>

                    {!readOnlyPreview ? (
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#f3d7d7] bg-white px-3 py-2 text-sm font-semibold text-[#9f1239] transition hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Trash2 size={14} />
                            Delete
                        </button>
                    ) : null}

                </div>
            </td>
        </tr>
    );
}
