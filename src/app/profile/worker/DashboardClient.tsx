"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import {
    Briefcase,
    Calendar,
    CheckCircle2,
    FileText,
    Globe,
    MapPin,
    Pencil,
    Phone,
    Shield,
    User,
    Users,
} from "lucide-react";
import { getEntryFeeUnlockState } from "@/lib/payment-eligibility";
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
    queue_joined_at?: string | null;
    entry_fee_paid?: boolean | null;
    admin_approved?: boolean | null;
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
    user: any;
    profile: WorkerProfile | null;
    worker: WorkerRecord | null;
    documents: WorkerDocument[];
    pendingOffers: PendingOffer[];
    profileCompletion: number;
    missingFields: string[];
    isReady: boolean;
    inQueue: boolean;
    hasPaidEntryFee: boolean;
    readOnlyPreview?: boolean;
}

const surfaceClass = "relative rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-2xl sm:border sm:border-[#e5e7eb] sm:bg-white sm:p-6 sm:shadow-[0_20px_45px_-36px_rgba(15,23,42,0.18)] sm:before:hidden";

export default function DashboardClient({
    user,
    profile,
    worker,
    documents = [],
    pendingOffers = [],
    profileCompletion,
    missingFields = [],
    isReady,
    inQueue,
    hasPaidEntryFee,
    readOnlyPreview = false,
}: DashboardClientProps) {
    const searchParams = useSearchParams();

    const displayName = profile?.full_name || worker?.profiles?.full_name || user.user_metadata?.full_name || "Worker";
    const activeOfferCount = pendingOffers.length;
    const verifiedDocuments = documents.filter((document) => document.status === "verified").length;
    const entryFeeUnlockState = getEntryFeeUnlockState({
        entry_fee_paid: worker?.entry_fee_paid,
        profile_completion: profileCompletion,
        admin_approved: !!worker?.admin_approved,
    });
    const canStartPayment = !readOnlyPreview && !hasPaidEntryFee && !inQueue && entryFeeUnlockState.allowed;
    const profileIncomplete = !readOnlyPreview && !hasPaidEntryFee && !inQueue && profileCompletion < 100;
    const approvalPending = !readOnlyPreview && !hasPaidEntryFee && !inQueue && entryFeeUnlockState.reason === "pending_admin_review";
    const paymentPendingActivation = hasPaidEntryFee && !inQueue;
    const workspaceStatus = readOnlyPreview
        ? "Preview"
        : activeOfferCount > 0
            ? "Offer Ready"
            : inQueue
                ? "In Queue"
                : hasPaidEntryFee
                    ? "Paid"
                    : approvalPending
                        ? "Pending review"
                        : profileCompletion === 100
                            ? "Ready"
                        : "Incomplete";
    const workspaceSummary = readOnlyPreview
        ? "Review the worker workspace structure without changing your admin role."
        : "Keep your profile complete, verify documents, activate Job Finder, and follow your queue status in one workspace.";

    // 90-day refund countdown (for paid workers)
    const queueJoinedDate = worker?.queue_joined_at ? new Date(worker.queue_joined_at) : null;
    const [nowMs] = useState(() => Date.now());
    const rawDaysElapsed = queueJoinedDate
        ? Math.floor((nowMs - queueJoinedDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const daysElapsed = Math.min(90, Math.max(0, rawDaysElapsed));
    const daysRemaining = Math.max(0, 90 - daysElapsed);
    const refundProgressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / 90) * 100)));

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (profileCompletion === 100 && !sessionStorage.getItem("celebrated_profile")) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
            });
            toast.success("Profile 100% Complete! You can now activate Job Finder.");
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
            <section className="relative overflow-visible rounded-none border-0 bg-transparent px-1 py-0 shadow-none sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#e5e7eb] sm:bg-white sm:p-6 sm:shadow-[0_30px_70px_-52px_rgba(15,23,42,0.18)]">
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
                <div className="pointer-events-none absolute -right-16 top-0 hidden h-40 w-40 rounded-full bg-[#111111]/5 blur-3xl sm:block" />
            </section>

            <section className="space-y-6">
                    <div className={surfaceClass}>
                        {/* ─── Profile Incomplete: Show Progress Ring ─── */}
                        {profileIncomplete && (
                            <div className="flex flex-col items-center justify-center gap-6 text-center py-4">
                                <ProfileProgressRing percent={profileCompletion} />
                                <div className="flex flex-col items-center">
                                    <h3 className="text-xl font-semibold tracking-tight text-[#18181b]">
                                        Complete Your Profile
                                    </h3>
                                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#52525b]">
                                        Fill in all required fields to unlock Job Finder. Once your profile reaches 100%, you can activate the service and start receiving job matches.
                                    </p>
                                </div>

                                {missingFields.length > 0 && (
                                    <div className="w-full max-w-sm">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9ca3af] mb-3">Missing fields</p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {missingFields.slice(0, 8).map((field) => (
                                                <span
                                                    key={field}
                                                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
                                                >
                                                    {field}
                                                </span>
                                            ))}
                                            {missingFields.length > 8 && (
                                                <span className="inline-flex items-center rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-xs font-medium text-[#6b7280]">
                                                    +{missingFields.length - 8} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <Link
                                    href="/profile/worker/edit"
                                    className="inline-flex min-h-[56px] w-full max-w-[320px] items-center justify-center gap-2 rounded-2xl bg-[#111111] px-6 py-3 text-base font-semibold text-white shadow-[0_22px_45px_-30px_rgba(15,23,42,0.45)] transition hover:bg-[#27272a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
                                >
                                    <Pencil size={18} />
                                    Complete Profile
                                </Link>
                            </div>
                        )}

                        {/* ─── Profile 100%: Show Payment Card ─── */}
                        {canStartPayment && (
                            <div className="flex flex-col items-center justify-center gap-6 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={32} className="text-emerald-600" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <h3 className="text-xl font-semibold tracking-tight text-[#18181b]">
                                        Activate Job Finder
                                    </h3>
                                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#52525b]">
                                        Your profile is complete. Pay a one-time $9 fee to activate personalized European job matching with visa guidance, interview prep, and a 90-day money-back guarantee.
                                    </p>
                                </div>

                                {readOnlyPreview ? (
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                                        Read-only admin preview
                                    </div>
                                ) : (
                                    <PayToJoinButton
                                        displayName={displayName}
                                        source="worker_overview"
                                    />
                                )}

                                <div className="flex items-center justify-center gap-1.5 px-1 text-center text-[11px] font-medium text-[#71717a] sm:text-xs">
                                    <Shield size={14} className="shrink-0 text-[#9ca3af]" />
                                    <span className="truncate sm:whitespace-nowrap">100% money-back guarantee if no job offer is found in 90 days</span>
                                </div>
                            </div>
                        )}

                        {/* ─── Has Offer ─── */}
                        {activeOfferCount > 0 && (
                            <div className="flex flex-col items-center justify-center gap-6 text-center">
                                <div className="flex flex-col items-center">
                                    <h3 className="text-xl font-semibold tracking-tight text-[#18181b]">
                                        You have an active offer
                                    </h3>
                                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#52525b]">
                                        Review your pending offer from the queue page and decide whether to move forward.
                                    </p>
                                </div>
                                <Link
                                    href="/profile/worker/queue"
                                    className="inline-flex items-center justify-center rounded-xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-semibold text-[#18181b] shadow-sm transition hover:bg-[#fafafa]"
                                >
                                    Open Queue
                                </Link>
                            </div>
                        )}

                        {/* ─── In Queue or Payment Pending: Show Refund Countdown ─── */}
                        {(inQueue || paymentPendingActivation) && activeOfferCount === 0 && (
                            <div className="py-2">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-semibold tracking-tight text-[#18181b] mb-2">
                                        {paymentPendingActivation ? "Payment Received" : "You're in the Queue"}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-[#52525b] max-w-2xl mx-auto">
                                        {paymentPendingActivation
                                            ? "Your payment is confirmed. We are activating your queue status now."
                                            : "We are actively matching your profile with employers. You will receive an offer within 90 days, or your payment is refunded in full."}
                                    </p>
                                </div>

                                {inQueue && queueJoinedDate && (
                                    <>
                                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                                                <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Day</p>
                                                <p className="text-2xl font-bold text-emerald-800">{daysElapsed}</p>
                                                <p className="text-xs text-emerald-700">of 90</p>
                                            </div>
                                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                                                <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">Remaining</p>
                                                <p className="text-2xl font-bold text-blue-800">{daysRemaining}</p>
                                                <p className="text-xs text-blue-700">days to guarantee deadline</p>
                                            </div>
                                            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-center">
                                                <p className="text-xs uppercase tracking-wide text-violet-700 font-semibold">Progress</p>
                                                <p className="text-2xl font-bold text-violet-800">{refundProgressPercent}%</p>
                                                <p className="text-xs text-violet-700">of matching window</p>
                                            </div>
                                        </div>

                                        <div className="mt-5">
                                            <div className="flex items-center justify-between text-xs font-semibold text-[#65676b] mb-2">
                                                <span>90-day matching window</span>
                                                <span>{refundProgressPercent}% elapsed</span>
                                            </div>
                                            <div className="w-full h-3 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-violet-500 transition-all duration-700"
                                                    style={{ width: `${refundProgressPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="mt-4 flex justify-center">
                                    <Link
                                        href="/profile/worker/queue"
                                        className="inline-flex items-center justify-center rounded-xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-semibold text-[#18181b] shadow-sm transition hover:bg-[#fafafa]"
                                    >
                                        Open Queue
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* ─── Admin Preview ─── */}
                        {readOnlyPreview && !canStartPayment && (
                            <div className="flex flex-col items-center justify-center gap-4 text-center">
                                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                                    Read-only admin preview
                                </div>
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

                        {approvalPending && (
                            <div className="flex flex-col items-center justify-center gap-5 text-center py-4">
                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                    <Shield size={30} className="text-amber-700" />
                                </div>
                                <div className="flex flex-col items-center">
                                    <h3 className="text-xl font-semibold tracking-tight text-[#18181b]">
                                        Waiting for admin review
                                    </h3>
                                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#52525b]">
                                        Your profile is 100% complete. We&apos;ll unlock Job Finder as soon as an admin approves your case.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                    No payment is needed yet. The next step is the approval decision.
                                </div>
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

/* ─── Profile Progress Ring ─── */
function ProfileProgressRing({ percent }: { percent: number }) {
    const size = 140;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    const getColor = () => {
        if (percent >= 80) return "#10B981";
        if (percent >= 50) return "#3B82F6";
        if (percent >= 25) return "#F59E0B";
        return "#EF4444";
    };

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f3f4f6"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={getColor()}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-[#18181b]">{percent}%</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Complete</span>
            </div>
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
