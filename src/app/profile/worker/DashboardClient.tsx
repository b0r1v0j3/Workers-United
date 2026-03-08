"use client";

import Link from "next/link";
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import {
    Briefcase,
    Calendar,
    FileText,
    Globe,
    MapPin,
    MessageSquareMore,
    Phone,
    Shield,
    User,
    Users,
} from "lucide-react";
import { PayToJoinButton } from "./queue/QueueClientEffects";

interface WorkerProfile {
    full_name?: string | null;
    email?: string | null;
}

interface WorkerRecord {
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
    worker: WorkerRecord | null;
    documents: WorkerDocument[];
    pendingOffers: PendingOffer[];
    profileCompletion: number;
    isReady: boolean;
    inQueue: boolean;
    hasPaidEntryFee: boolean;
    readOnlyPreview?: boolean;
}

const surfaceClass = "rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.18)]";

export default function DashboardClient({
    user,
    profile,
    worker,
    documents = [],
    pendingOffers = [],
    profileCompletion,
    isReady,
    inQueue,
    hasPaidEntryFee,
    readOnlyPreview = false,
}: DashboardClientProps) {
    const searchParams = useSearchParams();

    const displayName = profile?.full_name || worker?.profiles?.full_name || user.user_metadata?.full_name || "Worker";
    const activeOfferCount = pendingOffers.length;
    const verifiedDocuments = documents.filter((document) => document.status === "verified").length;
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
            <section className="relative overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_30px_70px_-52px_rgba(15,23,42,0.18)]">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                            <User size={14} />
                            Worker Workspace
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">{displayName}</h1>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#52525b]">
                            {workspaceSummary}
                        </p>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#9ca3af]">
                            {[worker?.nationality, worker?.current_country, worker?.preferred_job].filter(Boolean).join(" · ") || "Worker profile"}
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

            <section className="space-y-6">
                    <div className={surfaceClass}>
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
                                <p className="mt-2 max-w-md text-sm leading-relaxed text-[#52525b]">
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
                                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                                    Read-only admin preview
                                </div>
                            ) : inQueue || paymentPendingActivation || activeOfferCount > 0 ? (
                                <Link
                                    href="/profile/worker/queue"
                                    className="inline-flex items-center justify-center rounded-xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-semibold text-[#18181b] shadow-sm transition hover:bg-[#fafafa]"
                                >
                                    Open Queue
                                </Link>
                            ) : (
                                        <PayToJoinButton
                                            displayName={displayName}
                                            source="worker_overview"
                                        />
                            )}
                        </div>

                        {canStartPayment && (
                            <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-[#e5e7eb] px-1 pt-4 text-center text-[11px] font-medium text-[#71717a] sm:text-xs">
                                <Shield size={14} className="shrink-0 text-[#9ca3af]" />
                                <span className="truncate sm:whitespace-nowrap">100% money-back guarantee if no job offer is found in 90 days</span>
                            </div>
                        )}

                        {!readOnlyPreview && (
                            <div className="mt-5 grid gap-3 border-t border-[#e5e7eb] pt-4 md:grid-cols-3">
                                <LinkCard
                                    href="/profile/worker/edit"
                                    title="Profile"
                                    copy="Update your personal details and passport data."
                                />
                                <LinkCard
                                    href="/profile/worker/documents"
                                    title="Documents"
                                    copy="Upload or review passport, biometric photo, and diploma."
                                />
                                <LinkCard
                                    href="/profile/worker/queue"
                                    title="Queue"
                                    copy="Track payment, queue status, and any active offer."
                                />
                            </div>
                        )}
                    </div>

                    <div className={`${surfaceClass} flex flex-col gap-4 md:flex-row md:items-start md:justify-between`}>
                        <div className="max-w-2xl">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
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
                            <p className="mt-2 text-sm leading-relaxed text-[#52525b]">
                                {readOnlyPreview
                                    ? "Support stays disabled in admin preview so the admin account never behaves like a real worker account."
                                    : supportUnlocked
                                        ? "Message Workers United directly inside the platform for support, case updates, and document questions."
                                        : "After the $9 Job Finder payment is confirmed, workers can message Workers United support from inside the platform."}
                            </p>
                        </div>
                        {readOnlyPreview ? (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                                Preview only
                            </div>
                        ) : supportUnlocked ? (
                            <Link
                                href="/profile/worker/inbox"
                                className="inline-flex items-center justify-center rounded-xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27272a]"
                            >
                                Open Support Inbox
                            </Link>
                        ) : (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                Unlocks after $9 payment
                            </div>
                        )}
                    </div>

                    <div className={surfaceClass}>
                        <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold text-[#18181b]">
                            <User className="text-[#111111]" /> Personal Information
                        </h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <InfoRow icon={<User size={18} />} label="Full Name" value={profile?.full_name || worker?.profiles?.full_name} />
                            <InfoRow icon={<User size={18} />} label="Gender" value={worker?.gender} />
                            <InfoRow icon={<Globe size={18} />} label="Nationality" value={worker?.nationality} />
                            <InfoRow icon={<Users size={18} />} label="Marital Status" value={worker?.marital_status} />
                            <InfoRow icon={<Calendar size={18} />} label="Date of Birth" value={worker?.date_of_birth ? new Date(worker.date_of_birth).toLocaleDateString("en-GB") : null} />
                            <InfoRow icon={<MapPin size={18} />} label="Birth Place" value={worker?.birth_city && worker?.birth_country ? `${worker.birth_city}, ${worker.birth_country}` : worker?.birth_country} />
                            <InfoRow icon={<Globe size={18} />} label="Citizenship" value={worker?.citizenship} />
                            <InfoRow icon={<Phone size={18} />} label="Phone" value={worker?.phone} />
                            <InfoRow icon={<MapPin size={18} />} label="Current Location" value={worker?.current_country} />
                            <InfoRow icon={<Briefcase size={18} />} label="Preferred Job" value={worker?.preferred_job} />
                        </div>
                    </div>

                    {worker?.passport_number && (
                        <div className={surfaceClass}>
                            <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold text-[#18181b]">
                                <Shield className="text-[#111111]" /> Passport & Travel
                            </h3>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <InfoRow icon={<FileText size={18} />} label="Passport Number" value={`***${worker.passport_number.slice(-4)}`} />
                                <InfoRow icon={<Globe size={18} />} label="Issued By" value={worker.passport_issued_by} />
                                <InfoRow icon={<Calendar size={18} />} label="Issue Date" value={worker.passport_issue_date ? new Date(worker.passport_issue_date).toLocaleDateString("en-GB") : null} />
                                <InfoRow icon={<Calendar size={18} />} label="Expiry Date" value={worker.passport_expiry_date ? new Date(worker.passport_expiry_date).toLocaleDateString("en-GB") : null} />
                            </div>
                        </div>
                    )}
            </section>
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 shadow-[0_18px_35px_-32px_rgba(15,23,42,0.18)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">{label}</div>
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
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                <div className="text-sm font-semibold text-[#18181b]">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-[#52525b]">{copy}</p>
            </div>
        );
    }

    return (
        <Link href={href} className="block rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 transition hover:border-[#d4d4d8] hover:bg-white">
            <div className="text-sm font-semibold text-[#18181b]">{title}</div>
            <p className="mt-1 text-sm leading-relaxed text-[#52525b]">{copy}</p>
        </Link>
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
                <span className="text-[#9ca3af] transition-colors group-hover:text-[#52525b]">{icon}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">{label}</span>
            </div>
            <div className="border-b border-transparent pb-1 pl-7 text-sm font-medium text-[#18181b] transition-colors group-hover:border-[#e5e7eb]">
                {value || <span className="font-normal italic text-[#9ca3af]">Not provided</span>}
            </div>
        </div>
    );
}
