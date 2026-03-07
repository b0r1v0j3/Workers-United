"use client";

import Link from "next/link";
import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
    Users,
    UserPlus,
    BadgeCheck,
    CreditCard,
    FileCheck2,
    Search,
    ArrowRight,
    Loader2,
    Building2,
    Link2,
} from "lucide-react";
import { toast } from "sonner";

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

type AgencyWorkerDraftFormState = {
    fullName: string;
    email: string;
    phone: string;
    nationality: string;
    currentCountry: string;
    preferredJob: string;
};

const inputClass = "w-full rounded-2xl border border-[#e4e4df] bg-white px-4 py-3 text-sm text-[#18181b] outline-none transition focus:border-[#111111] focus:ring-0";

export default function AgencyDashboardClient({ agency, stats, workers, readOnlyPreview = false, inspectProfileId = null }: AgencyDashboardProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState<AgencyWorkerDraftFormState>({
        fullName: "",
        email: "",
        phone: "",
        nationality: "",
        currentCountry: "",
        preferredJob: "",
    });

    const filteredWorkers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return workers;

        return workers.filter((worker) =>
            [
                worker.name,
                worker.email || "",
                worker.phone || "",
                worker.nationality || "",
                worker.currentCountry || "",
                worker.preferredJob || "",
                worker.status,
            ].some((value) => value.toLowerCase().includes(query))
        );
    }, [search, workers]);

    async function handleCreateWorker(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!form.fullName.trim()) {
            toast.error("Worker full name is required.");
            return;
        }

        setIsCreating(true);
        try {
            const response = await fetch("/api/agency/workers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || "Failed to create worker draft.");
                return;
            }

            toast.success("Worker draft created.");
            setForm({
                fullName: "",
                email: "",
                phone: "",
                nationality: "",
                currentCountry: "",
                preferredJob: "",
            });
            router.push(`/profile/agency/workers/${data.workerId}`);
            router.refresh();
        } catch {
            toast.error("Failed to create worker draft.");
        } finally {
            setIsCreating(false);
        }
    }

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#fcfbf7_0%,#f1eee5_50%,#f7f5ef_100%)] p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.35)]">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#dfdbd0] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                            <Building2 size={14} />
                            Agency Workspace
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">{agency.displayName}</h1>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#57534e]">
                            Track agency-submitted workers, monitor readiness, and keep every profile moving toward verification and payment.
                        </p>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#8a8479]">
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
                <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[#111111]/5 blur-3xl" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_1.85fr]">
                <div className="rounded-[26px] border border-[#e6e6e1] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)]">
                    {readOnlyPreview ? (
                        <>
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                    <UserPlus size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-[#18181b]">How agencies add a worker</h2>
                                    <p className="text-sm text-[#71717a]">Admin preview is read-only, but the real agency flow starts with this intake and continues in the full worker workspace.</p>
                                </div>
                            </div>

                            <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-5 text-sm text-blue-950">
                                <p className="font-medium">
                                    Real agencies start with a draft here, then continue inside the same worker workspace used for the full worker profile.
                                </p>
                                <div className="space-y-2 text-blue-900/80">
                                    <p>Email and phone stay optional. Add them only if the worker should receive notifications or a claim link.</p>
                                    <p>Preview mode shows the exact intake structure, but creation stays disabled and always returns to the admin panel.</p>
                                </div>
                            </div>

                            <AgencyFlowSteps />

                            <div className="mt-5">
                                <AgencyWorkerDraftForm
                                    form={form}
                                    setForm={setForm}
                                    onSubmit={handleCreateWorker}
                                    isCreating={false}
                                    disabled
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-5 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                    <UserPlus size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-[#18181b]">Start the worker intake here</h2>
                                    <p className="text-sm text-[#71717a]">Create the draft first, then continue inside the full worker workspace with all remaining worker fields.</p>
                                </div>
                            </div>

                            <AgencyFlowSteps />

                            <AgencyWorkerDraftForm
                                form={form}
                                setForm={setForm}
                                onSubmit={handleCreateWorker}
                                isCreating={isCreating}
                                disabled={false}
                            />
                        </>
                    )}
                </div>

                <div className="rounded-[26px] border border-[#e6e6e1] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)]">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-[#18181b]">Agency Workers</h2>
                            <p className="text-sm text-[#71717a]">Every worker your agency submitted, with readiness and payment signals in one place.</p>
                        </div>
                        <label className="relative block w-full max-w-xs">
                            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                            <input
                                className="w-full rounded-2xl border border-[#e4e4df] bg-[#fafaf8] py-3 pl-11 pr-4 text-sm text-[#18181b] outline-none transition focus:border-[#111111]"
                                placeholder="Search workers"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </label>
                    </div>

                    {filteredWorkers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[#ddd6c8] bg-[#faf8f3] px-6 py-12 text-center">
                            <p className="text-base font-semibold text-[#292524]">No workers found</p>
                            <p className="mt-2 text-sm text-[#78716c]">
                                {readOnlyPreview
                                    ? "Real agency-submitted workers appear here after drafts are created."
                                    : "Create the first worker draft in the left card. The system will immediately open the full worker workspace after creation."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredWorkers.map((worker) => (
                                <WorkerRow key={worker.id} worker={worker} readOnlyPreview={readOnlyPreview} inspectProfileId={inspectProfileId} />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function AgencyWorkerDraftForm({
    form,
    setForm,
    onSubmit,
    isCreating,
    disabled,
}: {
    form: AgencyWorkerDraftFormState;
    setForm: Dispatch<SetStateAction<AgencyWorkerDraftFormState>>;
    onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
    isCreating: boolean;
    disabled: boolean;
}) {
    return (
        <form className="space-y-3" onSubmit={onSubmit}>
            <input
                className={inputClass}
                placeholder="Worker full name"
                value={form.fullName}
                disabled={disabled}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            />
            <input
                className={inputClass}
                placeholder="Email (optional)"
                type="email"
                value={form.email}
                disabled={disabled}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
            <p className="-mt-1 text-xs leading-relaxed text-[#78716c]">
                Optional. Add the worker email if you want them to receive email notifications and a claim link.
            </p>
            <input
                className={inputClass}
                placeholder="Phone with country code (optional)"
                value={form.phone}
                disabled={disabled}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <p className="-mt-1 text-xs leading-relaxed text-[#78716c]">
                Optional. Add the worker phone if you want them to receive WhatsApp or phone-based notifications.
            </p>
            <input
                className={inputClass}
                placeholder="Nationality"
                value={form.nationality}
                disabled={disabled}
                onChange={(event) => setForm((current) => ({ ...current, nationality: event.target.value }))}
            />
            <input
                className={inputClass}
                placeholder="Current country"
                value={form.currentCountry}
                disabled={disabled}
                onChange={(event) => setForm((current) => ({ ...current, currentCountry: event.target.value }))}
            />
            <input
                className={inputClass}
                placeholder="Preferred job"
                value={form.preferredJob}
                disabled={disabled}
                onChange={(event) => setForm((current) => ({ ...current, preferredJob: event.target.value }))}
            />

            <button
                type="submit"
                disabled={disabled || isCreating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-70"
            >
                {isCreating ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {disabled ? "Preview: Creation Disabled" : "Create Draft and Open Worker Workspace"}
            </button>
        </form>
    );
}

function AgencyFlowSteps() {
    const steps = [
        {
            title: "Create draft",
            copy: "Add the worker name first. Email and phone stay optional unless you want the worker to receive notifications.",
        },
        {
            title: "Continue in worker workspace",
            copy: "After the draft is created, the agency continues in the same full worker workspace used for the complete worker profile.",
        },
        {
            title: "Handle docs and payment",
            copy: "After the worker claims the profile, the agency can manage documents, verification, and Job Finder payment.",
        },
    ];

    return (
        <div className="mt-5 grid gap-3">
            {steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-[#ebe7df] bg-[#faf8f3] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Step {index + 1}</div>
                    <div className="mt-1 text-sm font-semibold text-[#18181b]">{step.title}</div>
                    <p className="mt-1 text-sm leading-relaxed text-[#57534e]">{step.copy}</p>
                </div>
            ))}
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_35px_-32px_rgba(15,23,42,0.45)]">
            <div className="mb-2 flex items-center justify-between text-[#6b7280]">
                {icon}
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight text-[#18181b]">{value}</div>
        </div>
    );
}

function WorkerRow({
    worker,
    readOnlyPreview,
    inspectProfileId,
}: {
    worker: AgencyDashboardProps["workers"][number];
    readOnlyPreview: boolean;
    inspectProfileId: string | null;
}) {
    const statusClass = worker.claimed
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
    const workerHref = inspectProfileId
        ? `/profile/agency/workers/${worker.id}?inspect=${inspectProfileId}`
        : `/profile/agency/workers/${worker.id}`;

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
        <div className="rounded-2xl border border-[#ece7df] bg-[#fcfcfb] p-4 transition hover:border-[#d7d0c6] hover:bg-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#18181b]">{worker.name}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClass}`}>
                            {worker.claimed ? "Claimed" : "Draft"}
                        </span>
                        <span className="rounded-full border border-[#e7e5e4] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#57534e]">
                            {worker.status}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#6b7280]">
                        <span>{worker.email || "No email yet"}</span>
                        <span>{worker.phone || "No phone yet"}</span>
                        <span>{worker.preferredJob || "No job preference yet"}</span>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                    <SignalChip label="Completion" value={`${worker.completion}%`} />
                    <SignalChip label="Documents" value={worker.documentsLabel} />
                    <SignalChip label="Payment" value={worker.paymentLabel} />
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#f0ede6] pt-4 text-sm text-[#78716c]">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <span>
                        {worker.updatedAt ? `Updated ${new Date(worker.updatedAt).toLocaleDateString("en-GB")}` : "Not updated yet"}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a8479]">
                        {worker.claimLabel}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {!worker.claimed && !readOnlyPreview && (
                        <button
                            type="button"
                            onClick={handleCopyClaimLink}
                            disabled={!worker.claimPath}
                            className="inline-flex items-center gap-2 font-semibold text-[#57534e] transition hover:text-[#18181b] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Link2 size={15} />
                            Copy claim link
                        </button>
                    )}
                    <Link
                        href={workerHref}
                        className="inline-flex items-center gap-2 font-semibold text-[#18181b] transition hover:text-[#4f46e5]"
                    >
                        {worker.claimed ? "Open worker workspace" : "Open draft workspace"}
                        <ArrowRight size={15} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function SignalChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-[#ece7df] bg-white px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8a29e]">{label}</div>
            <div className="mt-1 text-sm font-semibold text-[#18181b]">{value}</div>
        </div>
    );
}
