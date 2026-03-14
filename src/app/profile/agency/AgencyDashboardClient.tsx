"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Building2,
    CreditCard,
    FileCheck2,
    Loader2,
    Pencil,
    Plus,
    Search,
    Shield,
    Trash2,
    UserPlus,
    Users,
} from "lucide-react";
import { toast } from "sonner";
import AgencyWorkerCreateModal from "./AgencyWorkerCreateModal";

const surfaceClass = "relative rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-[14px] sm:border sm:border-[#e7e7e5] sm:bg-white sm:shadow-[0_24px_70px_-54px_rgba(15,23,42,0.28)] sm:before:hidden";

type PaymentState = "not_paid" | "pending" | "paid";

export interface AgencyDashboardProps {
    agency: {
        displayName: string;
        contactEmail: string;
    };
    stats: {
        totalWorkers: number;
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
        paymentPendingUntil: string | null;
        queueJoinedAt: string | null;
        entryFeePaidAt: string | null;
        refundStatus: string | null;
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

function getElapsedDays(value: string | null) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatWaitingLabel(days: number | null) {
    if (days === null) {
        return "Waiting to enter queue";
    }
    if (days === 0) {
        return "Waiting <1 day";
    }
    return `Waiting ${days} day${days === 1 ? "" : "s"}`;
}

function splitWorkerName(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
        return { primary: name.trim(), secondary: null as string | null };
    }

    return {
        primary: parts.slice(0, -1).join(" "),
        secondary: parts[parts.length - 1],
    };
}

function resolveWorkerPhase(worker: DashboardWorker): WorkerPhase {
    const normalizedStatus = (worker.status || "").toUpperCase();
    const normalizedRefundStatus = (worker.refundStatus || "").toLowerCase();
    const activeQueueDate = worker.queueJoinedAt || worker.entryFeePaidAt || null;
    const elapsedDays = getElapsedDays(activeQueueDate);

    if (normalizedRefundStatus === "completed") {
        return { label: "Refunded", detail: "The $9 Job Finder fee has already been refunded.", tone: "red" };
    }

    if (
        normalizedStatus === "REFUND_FLAGGED"
        || normalizedRefundStatus === "requested"
        || normalizedRefundStatus === "pending"
        || normalizedRefundStatus === "review"
    ) {
        return { label: "Refund requested", detail: "Refund is currently being reviewed.", tone: "red" };
    }

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
            return { label: "Job offered", detail: "A job offer is waiting for the worker decision.", tone: "orange" };
        case "IN_QUEUE":
            return {
                label: formatWaitingLabel(elapsedDays),
                detail: activeQueueDate
                    ? `Job Finder has been active since ${formatDate(activeQueueDate)}.`
                    : "Job Finder is actively searching for a match.",
                tone: "amber",
            };
        case "REJECTED":
            return { label: "Needs update", detail: "Profile or documents need corrections.", tone: "red" };
        default:
            break;
    }

    if (worker.paymentState === "paid") {
        if (normalizedStatus === "IN_QUEUE") {
            return {
                label: formatWaitingLabel(elapsedDays),
                detail: activeQueueDate
                    ? `Job Finder has been active since ${formatDate(activeQueueDate)}.`
                    : "Job Finder payment is confirmed and the worker is waiting for a match.",
                tone: "emerald",
            };
        }

        return {
            label: "Paid",
            detail: worker.entryFeePaidAt
                ? `Job Finder was paid on ${formatDate(worker.entryFeePaidAt)}.`
                : "Job Finder payment is confirmed.",
            tone: "emerald",
        };
    }

    return {
        label: "Not paid yet",
        detail: "Agency can start Job Finder by paying the $9 entry fee.",
        tone: "slate",
    };
}

export default function AgencyDashboardClient({
    agency,
    stats,
    workers,
    readOnlyPreview = false,
    inspectProfileId = null,
}: AgencyDashboardProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState("");
    const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
    const [useFullPageWorkerFlow, setUseFullPageWorkerFlow] = useState(false);
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
                formatDate(worker.paymentPendingUntil),
            ].some((value) => value.toLowerCase().includes(query));
        });
    }, [search, workers]);

    const visibleWorkerIds = useMemo(() => filteredWorkers.map((worker) => worker.id), [filteredWorkers]);
    const selectedWorkers = useMemo(
        () => workers.filter((worker) => selectedWorkerIds.includes(worker.id)),
        [selectedWorkerIds, workers]
    );
    const allVisibleSelected = visibleWorkerIds.length > 0 && visibleWorkerIds.every((workerId) => selectedWorkerIds.includes(workerId));

    useEffect(() => {
        setSelectedWorkerIds((current) => current.filter((workerId) => workers.some((worker) => worker.id === workerId)));
    }, [workers]);

    useEffect(() => {
        const payment = searchParams.get("payment");
        if (payment !== "sandbox_success") {
            return;
        }

        toast.success("Sandbox payment completed. Worker is now marked as paid.");
        router.replace("/profile/agency", { scroll: false });
        router.refresh();
    }, [router, searchParams]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const syncViewportMode = () => setUseFullPageWorkerFlow(mediaQuery.matches);

        syncViewportMode();

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", syncViewportMode);
            return () => mediaQuery.removeEventListener("change", syncViewportMode);
        }

        mediaQuery.addListener(syncViewportMode);

        return () => mediaQuery.removeListener(syncViewportMode);
    }, []);

    function buildAgencyWorkerHref(path: string) {
        const params = new URLSearchParams();
        if (inspectProfileId) {
            params.set("inspect", inspectProfileId);
        }

        const query = params.toString();
        return query ? `${path}?${query}` : path;
    }

    function openNewWorkerModal() {
        if (useFullPageWorkerFlow) {
            router.push(buildAgencyWorkerHref("/profile/agency/workers/new"));
            return;
        }

        setSelectedWorker(null);
        setIsWorkerModalOpen(true);
    }

    function openEditWorkerModal(worker: DashboardWorker) {
        if (useFullPageWorkerFlow) {
            router.push(buildAgencyWorkerHref(`/profile/agency/workers/${worker.id}`));
            return;
        }

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
                                One place for every worker profile. Create and edit the full worker form here, then use agency support anytime without leaving the workspace.
                            </p>
                            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#9ca3af]">
                                {agency.contactEmail}
                            </p>
                        </div>

                        <div className="grid grid-flow-col auto-cols-[minmax(96px,1fr)] gap-3 overflow-x-auto pb-1 sm:grid-cols-4 sm:grid-flow-row sm:auto-cols-auto sm:overflow-visible sm:pb-0">
                            <StatCard label="Total" value={stats.totalWorkers} icon={<Users size={18} />} />
                            <StatCard label="Ready" value={stats.readyWorkers} icon={<FileCheck2 size={18} />} />
                            <StatCard label="Paid" value={stats.paidWorkers} icon={<CreditCard size={18} />} />
                            <StatCard label="Drafts" value={stats.draftWorkers} icon={<UserPlus size={18} />} />
                        </div>
                    </div>
                </section>

                <section className={`${surfaceClass} flex flex-col gap-3 px-4 py-4 sm:px-6`}>
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-emerald-200 bg-emerald-50 text-emerald-700">
                            <Shield size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[#111827]">90-day refund guarantee</p>
                            <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">
                                If we do not find a job for a worker within 90 days, the $9 Job Finder fee is refunded in full.
                            </p>
                        </div>
                    </div>
                </section>

                <section className={`${surfaceClass} overflow-hidden px-4 py-4 sm:px-6 sm:py-6`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">Workers</h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                                Manage every worker from one board. Agency support stays unlocked the whole time, and Job Finder payment stays one worker at a time so Stripe never charges the wrong total by mistake.
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
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={(event) => toggleVisibleWorkers(event.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                        aria-label="Select visible workers"
                                    />

                                    <div>
                                        <p className="text-sm font-semibold text-[#111827]">
                                            {selectedWorkers.length > 0
                                                ? `${selectedWorkers.length} worker${selectedWorkers.length === 1 ? "" : "s"} selected`
                                                : "Select visible workers to delete them in one action."}
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed text-[#6b7280]">
                                            Bulk payment stays locked. Each Job Finder checkout still belongs to one worker only.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#9ca3af]">
                                        {allVisibleSelected ? "All visible selected" : `${visibleWorkerIds.length} visible`}
                                    </span>
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

                    <div className="mt-5 overflow-x-auto rounded-[14px] border border-[#ececec] bg-white">
                        {filteredWorkers.length === 0 ? (
                            <div className="px-6 py-14">
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-[16px] border border-[#ececec] bg-[#fafafa] text-[#111111]">
                                        <UserPlus size={28} />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-[#111827]">No workers yet</h3>
                                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#6b7280]">
                                        Use the Add worker button above to open the full worker form.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <table className="min-w-[980px] w-full border-collapse lg:min-w-0 lg:table-fixed">
                                <thead className="bg-[#fafafa]">
                                    <tr className="border-b border-[#ececec]">
                                        {!readOnlyPreview ? (
                                            <th className="w-12 border-r border-[#f1f1ef] px-4 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={allVisibleSelected}
                                                    onChange={(event) => toggleVisibleWorkers(event.target.checked)}
                                                    className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                                    aria-label="Select visible workers"
                                                />
                                            </th>
                                        ) : null}
                                        <th className="w-12 border-r border-[#f1f1ef] px-3 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">#</th>
                                        <th className="min-w-[160px] border-r border-[#f1f1ef] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af] lg:w-[18%] lg:min-w-0">Worker</th>
                                        <th className="min-w-[96px] border-r border-[#f1f1ef] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af] lg:w-[10%] lg:min-w-0">Added</th>
                                        <th className="min-w-[150px] border-r border-[#f1f1ef] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af] lg:w-[14%] lg:min-w-0">Completion</th>
                                        <th className="min-w-[128px] border-r border-[#f1f1ef] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af] lg:w-[13%] lg:min-w-0">Documents</th>
                                        <th className="min-w-[180px] border-r border-[#f1f1ef] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af] lg:w-[19%] lg:min-w-0">Status</th>
                                        <th className="min-w-[132px] border-r border-[#f1f1ef] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af] lg:w-[13%] lg:min-w-0">Payment</th>
                                        <th className="min-w-[132px] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af] lg:w-[11%] lg:min-w-0">Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredWorkers.map((worker, index) => {
                                        const phase = resolveWorkerPhase(worker);
                                        const showPayButton = !readOnlyPreview && worker.paymentState !== "paid";
                                        const workerName = splitWorkerName(worker.name);

                                        return (
                                            <tr key={worker.id} className="border-b border-[#ececec] last:border-b-0">
                                                {!readOnlyPreview ? (
                                                    <td className="border-r border-[#f7f7f6] px-4 py-5 align-top">
                                                        <div className="flex justify-center pt-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedWorkerIds.includes(worker.id)}
                                                                onChange={(event) => toggleWorkerSelection(worker.id, event.target.checked)}
                                                                className="h-4 w-4 rounded border-[#d1d5db] text-[#111111] focus:ring-0"
                                                                aria-label={`Select ${worker.name}`}
                                                            />
                                                        </div>
                                                    </td>
                                                ) : null}

                                                <td className="border-r border-[#f7f7f6] px-3 py-5 align-top">
                                                    <div className="pt-1 text-sm font-semibold text-[#111827]">{index + 1}</div>
                                                </td>

                                                <td className="border-r border-[#f7f7f6] px-4 py-5 align-top">
                                                    <div className="text-[1.02rem] font-semibold leading-tight text-[#111827]">
                                                        <div className="break-words">{workerName.primary}</div>
                                                        {workerName.secondary ? <div className="break-words">{workerName.secondary}</div> : null}
                                                    </div>
                                                    {worker.preferredJob ? (
                                                        <div className="mt-2 text-sm text-[#6b7280]">{worker.preferredJob}</div>
                                                    ) : null}
                                                </td>

                                                <td className="border-r border-[#f7f7f6] px-4 py-5 align-top">
                                                    <div className="pt-1 text-sm font-semibold text-[#111827]">{formatDate(worker.createdAt)}</div>
                                                </td>

                                                <td className="border-r border-[#f7f7f6] px-4 py-5 align-top">
                                                    <CompletionMeter value={worker.completion} compact />
                                                </td>

                                                <td className="border-r border-[#f7f7f6] px-4 py-5 align-top">
                                                    <div className="pt-1 text-sm font-semibold text-[#111827]">{worker.documentsLabel}</div>
                                                    <div className="mt-2 text-xs leading-relaxed text-[#6b7280]">
                                                        {worker.verifiedDocuments > 0
                                                            ? `${worker.verifiedDocuments} verified`
                                                            : "No verified documents yet"}
                                                    </div>
                                                </td>

                                                <td className="border-r border-[#f7f7f6] px-4 py-5 align-top">
                                                    <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${WORKER_PHASE_TONE_STYLES[phase.tone]}`}>
                                                        {phase.label}
                                                    </div>
                                                    <div className="mt-3 text-xs leading-relaxed text-[#6b7280]">{phase.detail}</div>
                                                </td>

                                                <td className="border-r border-[#f7f7f6] px-4 py-5 align-top">
                                                    {showPayButton ? (
                                                        <AgencyPaymentCard
                                                            state="not_paid"
                                                            loading={payingWorkerId === worker.id}
                                                            onClick={() => void handlePay(worker)}
                                                        />
                                                    ) : worker.paymentState === "paid" ? (
                                                        <AgencyPaymentCard
                                                            state="paid"
                                                            paidAt={worker.entryFeePaidAt}
                                                        />
                                                    ) : null}
                                                </td>

                                                <td className="px-4 py-5 align-top">
                                                    <div className="flex flex-col gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditWorkerModal(worker)}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa]"
                                                        >
                                                            <Pencil size={14} />
                                                            Edit
                                                        </button>

                                                        {!readOnlyPreview ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openDeleteDialog([worker])}
                                                                disabled={isDeleting}
                                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#f3d7d7] bg-white px-3 py-2 text-sm font-semibold text-[#9f1239] transition hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-45"
                                                            >
                                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fff1f2] text-[#be123c]">
                                                                    <Trash2 size={13} strokeWidth={2.3} />
                                                                </span>
                                                                Delete
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </div>

            {!useFullPageWorkerFlow ? (
                <AgencyWorkerCreateModal
                    open={isWorkerModalOpen}
                    workerId={selectedWorker?.id || null}
                    workerLabel={selectedWorker?.name || null}
                    readOnlyPreview={readOnlyPreview}
                    inspectProfileId={inspectProfileId}
                    onClose={closeWorkerModal}
                    onLiveSave={handleLiveSave}
                />
            ) : null}

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

function CompletionMeter({ value, compact = false }: { value: number; compact?: boolean }) {
    const safeValue = Math.max(0, Math.min(100, value));

    return (
        <div>
            <div className="flex items-end justify-between gap-3">
                <div className={compact ? "text-xl font-semibold tracking-tight text-[#111827]" : "text-2xl font-semibold tracking-tight text-[#111827]"}>
                    {safeValue}%
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                    {safeValue === 100 ? "Ready" : "In progress"}
                </div>
            </div>

            <div className={compact ? "mt-2 h-2 overflow-hidden rounded-full bg-[#e9ecef]" : "mt-3 h-2.5 overflow-hidden rounded-full bg-[#e9ecef]"}>
                <div
                    className={`h-full rounded-full transition-all ${
                        safeValue === 100
                            ? "bg-emerald-500"
                            : safeValue >= 60
                                ? "bg-[#111111]"
                                : safeValue >= 30
                                    ? "bg-amber-500"
                                    : "bg-[#9ca3af]"
                    }`}
                    style={{ width: `${safeValue}%` }}
                />
            </div>

            {!compact ? <div className="mt-2 text-xs text-[#6b7280]">Profile completion</div> : null}
        </div>
    );
}

function AgencyPaymentCard({
    state,
    loading = false,
    onClick,
    paidAt,
}: {
    state: "not_paid" | "paid";
    loading?: boolean;
    onClick?: () => void;
    paidAt?: string | null;
}) {
    if (state === "paid") {
        return (
            <div className="inline-flex min-w-[112px] flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-emerald-800 shadow-[0_12px_30px_-24px_rgba(16,185,129,0.4)]">
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <CreditCard size={14} />
                    Paid
                </div>
                <div className="mt-1 text-[11px] font-medium text-emerald-700">
                    {paidAt ? formatDate(paidAt) : "Confirmed"}
                </div>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className="inline-flex min-w-[112px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_-26px_rgba(15,23,42,0.48)] transition hover:bg-[#232323] disabled:cursor-not-allowed disabled:opacity-70"
        >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            {loading ? "Opening..." : "Pay $9"}
        </button>
    );
}
