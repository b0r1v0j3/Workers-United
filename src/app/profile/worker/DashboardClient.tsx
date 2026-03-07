"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import {
    Briefcase,
    Calendar,
    FileCheck2,
    FileText,
    Gem,
    Globe,
    ListChecks,
    Loader2,
    MapPin,
    MessageSquareMore,
    Phone,
    Shield,
    User,
    Users,
} from "lucide-react";

interface WorkerProfile {
    full_name?: string | null;
    email?: string | null;
}

interface WorkerCandidate {
    profiles?: { full_name?: string | null } | null;
    full_name?: string | null;
    gender?: string | null;
    nationality?: string | null;
    marital_status?: string | null;
    date_of_birth?: string | null;
    birth_city?: string | null;
    birth_country?: string | null;
    citizenship?: string | null;
    phone?: string | null;
    current_country?: string | null;
    preferred_job?: string | null;
    passport_number?: string | null;
    passport_issued_by?: string | null;
    passport_issue_date?: string | null;
    passport_expiry_date?: string | null;
}

interface WorkerDocument {
    document_type: string;
    status: string | null;
    reject_reason?: string | null;
}

interface PendingOffer {
    id: string;
}

interface DashboardClientProps {
    user: {
        user_metadata?: {
            full_name?: string | null;
        } | null;
    };
    profile: WorkerProfile | null;
    candidate: WorkerCandidate | null;
    documents: WorkerDocument[];
    pendingOffers: PendingOffer[];
    profileCompletion: number;
    isReady: boolean;
    inQueue: boolean;
    hasPaidEntryFee: boolean;
    readOnlyPreview?: boolean;
}

type DocumentStatusTone = "emerald" | "amber" | "red" | "slate";

type DocumentSignal = {
    label: string;
    value: string;
    tone: DocumentStatusTone;
};

const surfaceClass = "rounded-[26px] border border-[#e6e6e1] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)]";

export default function DashboardClient({
    user,
    profile,
    candidate,
    documents = [],
    pendingOffers = [],
    profileCompletion,
    isReady,
    inQueue,
    hasPaidEntryFee,
    readOnlyPreview = false,
}: DashboardClientProps) {
    const [payLoading, setPayLoading] = useState(false);
    const searchParams = useSearchParams();

    const displayName = profile?.full_name || candidate?.profiles?.full_name || user.user_metadata?.full_name || "Worker";
    const activeOfferCount = pendingOffers.length;
    const verifiedDocuments = documents.filter((document) => document.status === "verified").length;
    const rejectedDocuments = documents.filter((document) => document.status === "rejected").length;
    const pendingDocuments = documents.filter((document) => document.status === "uploaded" || document.status === "verifying").length;
    const missingDocuments = Math.max(0, 3 - documents.length);
    const canStartPayment = !readOnlyPreview && !hasPaidEntryFee && !inQueue;
    const paymentPendingActivation = hasPaidEntryFee && !inQueue;
    const supportUnlocked = hasPaidEntryFee || inQueue;
    const workspaceStatus = readOnlyPreview
        ? "Preview"
        : activeOfferCount > 0
            ? "Offer Ready"
            : inQueue
                ? "In Queue"
                : hasPaidEntryFee
                    ? "Paid"
                    : isReady
                        ? "Ready"
                        : "Incomplete";
    const workspaceSummary = readOnlyPreview
        ? "Review the worker workspace structure without changing your admin role."
        : "Keep your profile complete, verify documents, activate Job Finder, and follow your queue status in one workspace.";
    const nextAction = getNextAction({
        readOnlyPreview,
        profileCompletion,
        verifiedDocuments,
        hasPaidEntryFee,
        inQueue,
        activeOfferCount,
    });
    const documentSignals: DocumentSignal[] = [
        { label: "Verified", value: `${verifiedDocuments}/3`, tone: "emerald" },
        { label: "Pending", value: pendingDocuments > 0 ? String(pendingDocuments) : "0", tone: pendingDocuments > 0 ? "amber" : "slate" },
        { label: "Rejected", value: rejectedDocuments > 0 ? String(rejectedDocuments) : "0", tone: rejectedDocuments > 0 ? "red" : "slate" },
        { label: "Missing", value: String(missingDocuments), tone: missingDocuments > 0 ? "amber" : "emerald" },
    ];

    async function handlePay() {
        if (readOnlyPreview) {
            toast.info("Admin preview is read-only.");
            return;
        }

        setPayLoading(true);

        fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "payment_click", category: "funnel", details: { type: "entry_fee" } }),
        }).catch(() => undefined);

        try {
            const response = await fetch("/api/stripe/create-checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "entry_fee" }),
            });
            const data = await response.json();

            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
                return;
            }

            if (typeof data.error === "string" && data.error.toLowerCase().includes("already paid")) {
                toast.success("Payment already confirmed. Opening queue status.");
                window.location.href = "/profile/worker/queue";
                return;
            }

            fetch("/api/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "payment_error", category: "funnel", details: { error: data.error } }),
            }).catch(() => undefined);

            toast.error(data.error || "Payment failed. Please try again.");
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setPayLoading(false);
        }
    }

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (profileCompletion === 100 && !sessionStorage.getItem("celebrated_profile")) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
            });
            toast.success("Profile 100% Complete!");
            sessionStorage.setItem("celebrated_profile", "true");
        }
    }, [profileCompletion]);

    useEffect(() => {
        const claimState = searchParams.get("claim");
        if (!claimState) return;

        const messageMap: Record<string, { kind: "success" | "warning"; text: string }> = {
            linked: { kind: "success", text: "Your agency-submitted profile is now linked to this worker account." },
            already_linked: { kind: "success", text: "This worker account is already linked to your agency-submitted profile." },
            already_claimed: { kind: "warning", text: "This agency-submitted profile has already been claimed." },
            missing_email: { kind: "warning", text: "This agency profile cannot be claimed yet because the invited email is missing." },
            email_mismatch: { kind: "warning", text: "Use the same email address that the agency entered for you." },
            not_found: { kind: "warning", text: "The agency-submitted profile could not be found." },
        };

        const payload = messageMap[claimState];
        if (payload) {
            if (payload.kind === "success") {
                toast.success(payload.text);
            } else {
                toast.warning(payload.text);
            }
        }

        window.history.replaceState({}, "", "/profile/worker");
    }, [searchParams]);

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#fcfbf7_0%,#f1eee5_50%,#f7f5ef_100%)] p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.35)]">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#dfdbd0] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                            <User size={14} />
                            Worker Workspace
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">{displayName}</h1>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#57534e]">
                            {workspaceSummary}
                        </p>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#8a8479]">
                            {[candidate?.nationality, candidate?.current_country, candidate?.preferred_job].filter(Boolean).join(" · ") || "Worker profile"}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <MetricCard label="Completion" value={`${profileCompletion}%`} />
                        <MetricCard label="Documents" value={`${verifiedDocuments}/3`} />
                        <MetricCard label="Offers" value={activeOfferCount} />
                        <MetricCard label="Status" value={workspaceStatus} />
                    </div>
                </div>
                <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[#111111]/5 blur-3xl" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
                <div className="space-y-4">
                    <div className={`${surfaceClass} sticky top-24`}>
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                <ListChecks size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[#18181b]">
                                    {readOnlyPreview ? "Read-only admin preview" : "Next action"}
                                </h2>
                                <p className="text-xs uppercase tracking-[0.16em] text-[#8a8479]">
                                    {readOnlyPreview ? "Structure only" : nextAction.badge}
                                </p>
                            </div>
                        </div>
                        <h3 className="text-lg font-semibold text-[#18181b]">{nextAction.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#57534e]">{nextAction.copy}</p>
                        <div className="mt-5 grid gap-3">
                            <LinkCard href="/profile/worker/edit" title="Profile editor" copy="Update personal details, preferences, and passport data." disabled={readOnlyPreview} />
                            <LinkCard href="/profile/worker/documents" title="Documents" copy="Upload or review passport, biometric photo, and diploma." />
                            <LinkCard href="/profile/worker/queue" title="Queue & Status" copy="Track payment, queue state, and any active offer." />
                        </div>
                    </div>

                    <div className="rounded-[26px] border border-[#ece7df] bg-[#faf8f3] p-5 text-sm text-[#57534e] shadow-[0_20px_50px_-40px_rgba(15,23,42,0.25)]">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                <FileCheck2 size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[#18181b]">Document summary</h2>
                                <p className="text-xs uppercase tracking-[0.16em] text-[#8a8479]">Readiness</p>
                            </div>
                        </div>

                        <div className="grid gap-3">
                            {documentSignals.map((signal) => (
                                <SignalPill key={signal.label} label={signal.label} value={signal.value} tone={signal.tone} />
                            ))}
                        </div>

                        <p className="mt-4 text-xs leading-relaxed text-[#78716c]">
                            Workers need a complete profile plus three verified documents before Job Finder can move into active matching.
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-[26px] border border-[#e6e6e1] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.3)]">
                        <div className="relative">
                            <div className="flex flex-col items-center justify-center gap-6 text-center">
                                <div className="flex flex-col items-center">
                                    <h3 className="text-xl font-semibold tracking-tight text-[#18181b]">
                                        {activeOfferCount > 0
                                            ? "You have an active offer"
                                            : inQueue
                                                ? "You're in the queue"
                                                : paymentPendingActivation
                                                    ? "Payment received"
                                                    : "Activate Job Finder"}
                                    </h3>
                                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#57534e]">
                                        {activeOfferCount > 0
                                            ? "Review your pending offer from the queue page and decide whether to move forward."
                                            : inQueue
                                                ? "We are actively looking for the best employer match for your profile."
                                                : paymentPendingActivation
                                                    ? "Your payment is confirmed. We are activating your queue status now."
                                                    : "Pay a one-time $9 fee to join our active worker queue. We then search for the best job match for you."}
                                    </p>
                                </div>

                                {readOnlyPreview ? (
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                                        Read-only admin preview
                                    </div>
                                ) : inQueue || paymentPendingActivation || activeOfferCount > 0 ? (
                                    <Link
                                        href="/profile/worker/queue"
                                        className="inline-flex items-center justify-center rounded-xl border border-[#dedad2] bg-white px-5 py-2.5 text-sm font-semibold text-[#18181b] shadow-sm transition hover:bg-[#faf8f3]"
                                    >
                                        Open Queue & Status
                                    </Link>
                                ) : (
                                    <PayButton displayName={displayName} payLoading={payLoading} onPay={handlePay} />
                                )}
                            </div>

                            {canStartPayment && (
                                <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-[#f0ede6] pt-4 px-1 text-center text-[11px] font-medium text-[#78716c] sm:text-xs">
                                    <Shield size={14} className="shrink-0 text-[#a8a29e]" />
                                    <span className="truncate sm:whitespace-nowrap">100% money-back guarantee if no job offer is found in 90 days</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`${surfaceClass} flex flex-col gap-4 md:flex-row md:items-start md:justify-between`}>
                        <div className="max-w-2xl">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e4e4df] bg-[#fafaf8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                                <MessageSquareMore size={14} />
                                Support Inbox
                            </div>
                            <h3 className="text-lg font-semibold text-[#18181b]">
                                {readOnlyPreview
                                    ? "Support inbox is hidden in admin preview"
                                    : supportUnlocked
                                        ? "Support is unlocked"
                                        : "Support unlocks after Job Finder payment"}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-[#57534e]">
                                {readOnlyPreview
                                    ? "Support stays disabled in admin preview so the admin account never behaves like a real worker account."
                                    : supportUnlocked
                                        ? "Message Workers United directly inside the platform for support, case updates, and document questions."
                                        : "After the $9 Job Finder payment is confirmed, workers can message Workers United support from inside the platform."}
                            </p>
                        </div>
                        {readOnlyPreview ? (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                                Preview only
                            </div>
                        ) : supportUnlocked ? (
                            <Link
                                href="/profile/worker/inbox"
                                className="inline-flex items-center justify-center rounded-xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2b2b2b]"
                            >
                                Open Support Inbox
                            </Link>
                        ) : (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                Unlocks after $9 payment
                            </div>
                        )}
                    </div>

                    <div className={surfaceClass}>
                        <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold text-[#18181b]">
                            <User className="text-[#111111]" /> Personal Information
                        </h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <InfoRow icon={<User size={18} />} label="Full Name" value={profile?.full_name || candidate?.profiles?.full_name} />
                            <InfoRow icon={<User size={18} />} label="Gender" value={candidate?.gender} />
                            <InfoRow icon={<Globe size={18} />} label="Nationality" value={candidate?.nationality} />
                            <InfoRow icon={<Users size={18} />} label="Marital Status" value={candidate?.marital_status} />
                            <InfoRow icon={<Calendar size={18} />} label="Date of Birth" value={candidate?.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString("en-GB") : null} />
                            <InfoRow icon={<MapPin size={18} />} label="Birth Place" value={candidate?.birth_city && candidate?.birth_country ? `${candidate.birth_city}, ${candidate.birth_country}` : candidate?.birth_country} />
                            <InfoRow icon={<Globe size={18} />} label="Citizenship" value={candidate?.citizenship} />
                            <InfoRow icon={<Phone size={18} />} label="Phone" value={candidate?.phone} />
                            <InfoRow icon={<MapPin size={18} />} label="Current Location" value={candidate?.current_country} />
                            <InfoRow icon={<Briefcase size={18} />} label="Preferred Job" value={candidate?.preferred_job} />
                        </div>
                    </div>

                    {candidate?.passport_number && (
                        <div className={surfaceClass}>
                            <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold text-[#18181b]">
                                <Shield className="text-[#111111]" /> Passport & Travel
                            </h3>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <InfoRow icon={<FileText size={18} />} label="Passport Number" value={`***${candidate.passport_number.slice(-4)}`} />
                                <InfoRow icon={<Globe size={18} />} label="Issued By" value={candidate.passport_issued_by} />
                                <InfoRow icon={<Calendar size={18} />} label="Issue Date" value={candidate.passport_issue_date ? new Date(candidate.passport_issue_date).toLocaleDateString("en-GB") : null} />
                                <InfoRow icon={<Calendar size={18} />} label="Expiry Date" value={candidate.passport_expiry_date ? new Date(candidate.passport_expiry_date).toLocaleDateString("en-GB") : null} />
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function getNextAction({
    readOnlyPreview,
    profileCompletion,
    verifiedDocuments,
    hasPaidEntryFee,
    inQueue,
    activeOfferCount,
}: {
    readOnlyPreview: boolean;
    profileCompletion: number;
    verifiedDocuments: number;
    hasPaidEntryFee: boolean;
    inQueue: boolean;
    activeOfferCount: number;
}) {
    if (readOnlyPreview) {
        return {
            badge: "Preview",
            title: "Inspect the worker journey safely",
            copy: "This preview shows the same profile, document, support, and queue structure a real worker sees, but without any payment or edit actions.",
        };
    }

    if (activeOfferCount > 0) {
        return {
            badge: "Offer",
            title: "Review the active offer",
            copy: "Go to Queue & Status to read the pending offer details and decide whether to move forward.",
        };
    }

    if (!hasPaidEntryFee) {
        if (profileCompletion < 100 || verifiedDocuments < 3) {
            return {
                badge: "Setup",
                title: "Finish readiness before payment",
                copy: "Complete the worker profile and make sure all three documents are verified so Job Finder can move into active matching.",
            };
        }

        return {
            badge: "Payment",
            title: "Activate Job Finder",
            copy: "Your profile is ready. The next step is the $9 Job Finder payment, which unlocks active matching and support access.",
        };
    }

    if (inQueue) {
        return {
            badge: "Queue",
            title: "Stay ready while we match you",
            copy: "Your profile is already in the queue. Keep documents valid and watch Queue & Status for new activity.",
        };
    }

    return {
        badge: "Processing",
        title: "Payment is confirmed",
        copy: "We are syncing your worker status. Queue & Status will show the live matching state as soon as activation completes.",
    };
}

function PayButton({
    displayName,
    payLoading,
    onPay,
}: {
    displayName: string;
    payLoading: boolean;
    onPay: () => Promise<void>;
}) {
    return (
        <button
            onClick={onPay}
            disabled={payLoading}
            className="group relative h-[160px] w-full shrink-0 overflow-hidden rounded-2xl border border-[#333333] bg-gradient-to-tr from-[#111111] to-[#2a2a2a] p-5 text-left text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:scale-100 sm:w-[280px]"
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50" />

            <div className="relative z-10 flex items-start justify-between">
                <div className="flex h-7 w-10 items-center justify-center rounded bg-gradient-to-br from-amber-200 to-yellow-500 opacity-90 shadow-inner">
                    <div className="absolute h-[1px] w-full bg-black/20" />
                    <div className="absolute h-full w-[1px] bg-black/20" />
                    <Gem size={12} className="relative z-10 text-yellow-900/40" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Priority</span>
            </div>

            <div className="relative z-10 mt-2 space-y-1">
                {payLoading ? (
                    <div className="flex items-center gap-2 text-white">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">Processing...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-xl font-semibold tracking-tight">Pay $9.00</span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white/90 transition-colors group-hover:bg-white/20">Start Search</span>
                    </div>
                )}
            </div>

            <div className="relative z-10 flex items-end justify-between border-t border-white/10 pt-2">
                <div className="flex flex-col">
                    <span className="mb-0.5 text-[8px] uppercase tracking-wider text-white/40">Cardholder Name</span>
                    <span className="max-w-[180px] truncate text-xs font-medium uppercase tracking-wide text-white/80">
                        {displayName.substring(0, 22)}
                    </span>
                </div>
                <div className="flex -space-x-1.5 opacity-80">
                    <div className="h-5 w-5 rounded-full bg-red-400 mix-blend-multiply" />
                    <div className="h-5 w-5 rounded-full bg-yellow-400 mix-blend-multiply" />
                </div>
            </div>

            <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/5 blur-2xl transition-colors duration-500 group-hover:bg-white/10" />
        </button>
    );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_35px_-32px_rgba(15,23,42,0.45)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8479]">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-[#18181b]">{value}</div>
        </div>
    );
}

function LinkCard({
    href,
    title,
    copy,
    disabled = false,
}: {
    href: string;
    title: string;
    copy: string;
    disabled?: boolean;
}) {
    if (disabled) {
        return (
            <div className="rounded-2xl border border-[#ebe7df] bg-[#faf8f3] px-4 py-3">
                <div className="text-sm font-semibold text-[#18181b]">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-[#57534e]">{copy}</p>
            </div>
        );
    }

    return (
        <Link href={href} className="block rounded-2xl border border-[#ebe7df] bg-[#faf8f3] px-4 py-3 transition hover:border-[#d7d0c6] hover:bg-white">
            <div className="text-sm font-semibold text-[#18181b]">{title}</div>
            <p className="mt-1 text-sm leading-relaxed text-[#57534e]">{copy}</p>
        </Link>
    );
}

function SignalPill({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone: DocumentStatusTone;
}) {
    const toneClass: Record<DocumentStatusTone, string> = {
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        red: "border-red-200 bg-red-50 text-red-800",
        slate: "border-[#ebe7df] bg-white text-[#18181b]",
    };

    return (
        <div className={`rounded-2xl border px-4 py-3 ${toneClass[tone]}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">{label}</div>
            <div className="mt-1 text-sm font-semibold">{value}</div>
        </div>
    );
}

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | null | undefined;
}) {
    return (
        <div className="group">
            <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[#a8a29e] transition-colors group-hover:text-[#78716c]">{icon}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8a29e]">{label}</span>
            </div>
            <div className="border-b border-transparent pb-1 pl-7 text-sm font-medium text-[#18181b] transition-colors group-hover:border-[#f0ede6]">
                {value || <span className="font-normal italic text-[#a8a29e]">Not provided</span>}
            </div>
        </div>
    );
}
