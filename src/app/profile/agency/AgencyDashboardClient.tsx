"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Users,
    UserPlus,
    BadgeCheck,
    CreditCard,
    FileCheck2,
    Search,
    Building2,
    Link2,
    Plus,
    Pencil,
} from "lucide-react";
import { toast } from "sonner";
import AgencyWorkerCreateModal from "./AgencyWorkerCreateModal";

const surfaceClass = "rounded-[28px] border border-[#e7e7e5] bg-white shadow-[0_24px_70px_-54px_rgba(15,23,42,0.28)]";

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
        claimLabel: string;
        claimPath: string | null;
        verifiedDocuments: number;
        documentsLabel: string;
        paymentLabel: string;
        updatedAt: string | null;
    }>;
    readOnlyPreview?: boolean;
    inspectProfileId?: string | null;
}

type DashboardWorker = AgencyDashboardProps["workers"][number];

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

    const filteredWorkers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) {
            return workers;
        }

        return workers.filter((worker) =>
            [
                worker.name,
                worker.email || "",
                worker.phone || "",
                worker.nationality || "",
                worker.currentCountry || "",
                worker.preferredJob || "",
                worker.status,
                worker.claimLabel,
            ].some((value) => value.toLowerCase().includes(query))
        );
    }, [search, workers]);

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

    return (
        <>
            <div className="space-y-6">
                <section className={`${surfaceClass} px-6 py-6`}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                                <Building2 size={14} />
                                Agency Workspace
                            </div>
                            <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">{agency.displayName}</h1>
                            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                                One place for every worker profile. Create and edit the full worker form from here without leaving the agency workspace.
                            </p>
                            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#9ca3af]">
                                {agency.contactEmail}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                            <StatCard label="Total" value={stats.totalWorkers} icon={<Users size={18} />} />
                            <StatCard label="Claimed" value={stats.claimedWorkers} icon={<BadgeCheck size={18} />} />
                            <StatCard label="Ready" value={stats.readyWorkers} icon={<FileCheck2 size={18} />} />
                            <StatCard label="Paid" value={stats.paidWorkers} icon={<CreditCard size={18} />} />
                            <StatCard label="Drafts" value={stats.draftWorkers} icon={<UserPlus size={18} />} />
                        </div>
                    </div>
                </section>

                <section className={`${surfaceClass} overflow-hidden px-6 py-6`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">Workers</h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
                                Email and phone are optional. Add them only if the worker should receive notifications or a claim link.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <label className="relative block w-full sm:w-[260px]">
                                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                                <input
                                    className="w-full rounded-2xl border border-[#e5e7eb] bg-[#fafafa] py-3 pl-11 pr-4 text-sm text-[#111827] outline-none transition focus:border-[#111111]"
                                    placeholder="Search workers"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </label>

                            <button
                                type="button"
                                onClick={openNewWorkerModal}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d2d2d]"
                            >
                                <Plus size={16} />
                                Add worker
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 overflow-hidden rounded-[24px] border border-[#ececec]">
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse">
                                <thead className="bg-[#fafafa]">
                                    <tr className="border-b border-[#ececec] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">
                                        <th className="px-5 py-4">Worker</th>
                                        <th className="px-5 py-4">Contact</th>
                                        <th className="px-5 py-4">Completion</th>
                                        <th className="px-5 py-4">Documents</th>
                                        <th className="px-5 py-4">Payment</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {filteredWorkers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-14">
                                                <div className="flex flex-col items-center justify-center text-center">
                                                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-[#ececec] bg-[#fafafa] text-[#111111]">
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
                                        filteredWorkers.map((worker) => (
                                            <WorkerTableRow
                                                key={worker.id}
                                                worker={worker}
                                                inspectProfileId={inspectProfileId}
                                                readOnlyPreview={readOnlyPreview}
                                                onEdit={openEditWorkerModal}
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
        </>
    );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-[#ececec] bg-[#fafafa] px-4 py-3">
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
    inspectProfileId,
    readOnlyPreview,
    onEdit,
}: {
    worker: DashboardWorker;
    inspectProfileId: string | null;
    readOnlyPreview: boolean;
    onEdit: (worker: DashboardWorker) => void;
}) {
    const statusClass = worker.claimed
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

    async function handleCopyClaimLink() {
        if (!worker.claimPath) {
            toast.error("Add the worker email before sharing a claim link.");
            return;
        }

        try {
            const absoluteUrl = `${window.location.origin}${worker.claimPath}`;
            await navigator.clipboard.writeText(absoluteUrl);
            toast.success("Claim link copied.");
        } catch {
            toast.error("Could not copy claim link.");
        }
    }

    return (
        <tr className="border-b border-[#f1f1ef] transition hover:bg-[#fcfcfc]">
            <td className="px-5 py-4 align-top">
                <div className="font-semibold text-[#111827]">{worker.name}</div>
                <div className="mt-1 text-sm text-[#6b7280]">{worker.preferredJob || "No preferred job yet"}</div>
            </td>
            <td className="px-5 py-4 align-top text-sm text-[#6b7280]">
                <div>{worker.email || "No email yet"}</div>
                <div className="mt-1">{worker.phone || "No phone yet"}</div>
            </td>
            <td className="px-5 py-4 align-top text-sm font-semibold text-[#111827]">{worker.completion}%</td>
            <td className="px-5 py-4 align-top text-sm text-[#111827]">{worker.documentsLabel}</td>
            <td className="px-5 py-4 align-top text-sm text-[#111827]">{worker.paymentLabel}</td>
            <td className="px-5 py-4 align-top">
                <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClass}`}>
                    {worker.claimed ? "Claimed" : "Draft"}
                </div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">{worker.claimLabel}</div>
            </td>
            <td className="px-5 py-4 align-top">
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onEdit(worker)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa]"
                    >
                        <Pencil size={14} />
                        Edit
                    </button>

                    {!worker.claimed && (!readOnlyPreview || Boolean(inspectProfileId)) && (
                        <button
                            type="button"
                            onClick={handleCopyClaimLink}
                            disabled={!worker.claimPath}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Link2 size={14} />
                            Claim link
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}
