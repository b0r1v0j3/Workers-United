import Link from "next/link";
import { Gem, Lock, Pencil, Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { getAdminTestWorkerWorkspace } from "@/lib/admin-test-data";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import { loadCanonicalWorkerRecord } from "@/lib/workers";
import QueueClientEffects, { PayToJoinButton } from "./QueueClientEffects";

export const dynamic = "force-dynamic";
const queueSurfaceClass = "relative mb-6 rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-xl sm:border sm:border-[#dddfe2] sm:bg-white sm:p-6 sm:shadow-sm sm:before:hidden";

export default async function QueuePage({
    searchParams,
}: {
    searchParams: Promise<{ inspect?: string }>;
}) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const params = await searchParams;
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
    const user = session.user;
    if (!user) redirect("/login");

    if (session.activePersona) {
        if (session.activePersona.role !== "worker") {
            redirect(getAdminTestWorkspaceHref(session.activePersona.role));
        }

        const workspace = await getAdminTestWorkerWorkspace(admin, session.activePersona.id);
        const workerRecord = workspace.worker;
        if (!workerRecord) {
            redirect("/profile/worker");
        }
        const sandboxProfile = {
            full_name: workerRecord.full_name || session.activePersona.label,
            email: workerRecord.email || user.email || "",
        };
        const { completion: sandboxProfileCompletion, missingFields: sandboxMissingFields } = getWorkerCompletion({
            profile: sandboxProfile,
            worker: workerRecord,
            documents: workspace.documents,
        });
        const sandboxPaymentUnlocked = sandboxProfileCompletion === 100;
        const sandboxDisplayName = sandboxProfile.full_name || session.activePersona.label;

        const hasPaidEntryFee =
            !!workerRecord.entry_fee_paid ||
            !!workerRecord.job_search_active ||
            isPostEntryFeeWorkerStatus(workerRecord.status);
        const hasPendingOffer = false;
        const statusDriftWithoutOffer = workerRecord.status === "OFFER_PENDING" && !hasPendingOffer;
        const paymentAcceptedNoOffer = hasPaidEntryFee && !hasPendingOffer;
        const queueJoinedSource = workerRecord.queue_joined_at || null;
        const queueJoinedDate = queueJoinedSource ? new Date(queueJoinedSource) : null;
        const nowMs = new Date().getTime();
        const rawDaysElapsed = queueJoinedDate
            ? Math.floor((nowMs - queueJoinedDate.getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        const daysElapsed = Math.min(90, Math.max(0, rawDaysElapsed));
        const daysRemaining = Math.max(0, 90 - daysElapsed);
        const progressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / 90) * 100)));
        const refundEligibleDate = queueJoinedDate
            ? new Date(queueJoinedDate.getTime() + (90 * 24 * 60 * 60 * 1000))
            : null;

        return (
            <div className="w-full">
                <QueueClientEffects />
                <main className="w-full">
                    <div className={queueSurfaceClass}>
                        {!hasPaidEntryFee ? (
                            sandboxPaymentUnlocked ? (
                                <div className="relative z-10 flex flex-col items-center justify-center gap-6 py-8 text-center">
                                    <div className="flex flex-col items-center">
                                        <h3 className="text-xl font-semibold tracking-tight text-gray-900">
                                            Start Searching for Jobs
                                        </h3>
                                        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                                            Sandbox payment marks Job Finder as active instantly, without opening Stripe or creating live payment rows.
                                        </p>
                                    </div>
                                    <PayToJoinButton
                                        displayName={sandboxDisplayName}
                                        source="admin_test_queue"
                                        redirectPath="/profile/worker/queue"
                                        adminTestMode
                                    />
                                    <div className="mx-auto mt-2 flex max-w-xs items-start justify-center gap-1.5 px-1 text-center text-[11px] font-medium leading-relaxed text-gray-500 sm:max-w-none sm:items-center sm:text-xs">
                                        <Shield size={14} className="mt-0.5 shrink-0 text-gray-400 sm:mt-0" />
                                        <span className="min-w-0">Sandbox only: the card unlocks at 100% like a real worker, but payment still stays fake and instant here</span>
                                    </div>
                                </div>
                            ) : (
                                <LockedEntryFeeState
                                    displayName={sandboxDisplayName}
                                    profileCompletion={sandboxProfileCompletion}
                                    missingCount={sandboxMissingFields.length}
                                    helperText="Sandbox worker now follows the same locked-until-100% rule as a real worker account."
                                />
                            )
                        ) : paymentAcceptedNoOffer ? (
                            <div className="py-2">
                                <div className="text-center">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    </div>
                                    <h2 className="mb-2 text-xl font-semibold text-[#050505]">
                                        Sandbox Payment Accepted
                                    </h2>
                                    <p className="mx-auto max-w-2xl text-[#65676b]">
                                        Your worker sandbox is now marked as paid and active in the test queue so you can review the mobile UX after the payment step.
                                    </p>
                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Day</p>
                                        <p className="text-2xl font-bold text-emerald-800">{daysElapsed}</p>
                                        <p className="text-xs text-emerald-700">of 90</p>
                                    </div>
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Remaining</p>
                                        <p className="text-2xl font-bold text-blue-800">{daysRemaining}</p>
                                        <p className="text-xs text-blue-700">days to guarantee deadline</p>
                                    </div>
                                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-center">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Refund Eligibility</p>
                                        <p className="text-sm font-bold text-violet-800 sm:text-base">
                                            {refundEligibleDate ? refundEligibleDate.toLocaleDateString("en-GB") : "Calculating..."}
                                        </p>
                                        <p className="text-xs text-violet-700">sandbox guarantee window</p>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#65676b]">
                                        <span>90-day matching window</span>
                                        <span>{progressPercent}% elapsed</span>
                                    </div>
                                    <div className="h-3 w-full overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-violet-500 transition-all duration-700"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 rounded-xl border border-[#b3d4fc] bg-[#e7f3ff] p-4 text-sm text-[#1877f2]">
                                    <p>
                                        <strong>Sandbox next step:</strong> use this state to inspect the paid queue experience on mobile without generating a real checkout session.
                                    </p>
                                </div>
                                {statusDriftWithoutOffer && (
                                    <p className="mt-3 text-center text-xs text-amber-700">
                                        Sandbox status view is syncing. No active offer is currently pending.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="py-4 text-center">
                                <p className="text-[#65676b]">
                                    Status: <strong>{workerRecord.status}</strong>
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    const userType = normalizeUserType(session.liveUserType || user.user_metadata?.user_type);
    if (userType === "employer") {
        redirect("/profile/employer");
    }
    if (userType === "agency") {
        redirect("/profile/agency");
    }
    const isAdminPreview = userType === "admin";
    const inspectProfileId = isAdminPreview ? params?.inspect?.trim() || null : null;
    if (isAdminPreview && !inspectProfileId) {
        redirect("/admin");
    }
    const targetProfileId = inspectProfileId || user.id;
    const dataClient = inspectProfileId ? admin : supabase;

    const { data: profile } = await dataClient
        .from("profiles")
        .select("full_name, email")
        .eq("id", targetProfileId)
        .maybeSingle();

    // Get canonical worker record with queue info
    const { data: workerRecord } = await loadCanonicalWorkerRecord<any>(
        dataClient,
        targetProfileId,
        "*"
    );

    if (!workerRecord) {
        redirect(inspectProfileId ? "/admin/workers" : "/profile/worker");
    }

    const { data: documents } = await dataClient
        .from("worker_documents")
        .select("document_type")
        .eq("user_id", targetProfileId);

    // Check for pending offers (source of truth for "You have an offer" UI)
    const { data: pendingOffers } = await dataClient
        .from("offers")
        .select(`
      *,
      job_requests(*, employers(company_name))
    `)
        .eq("worker_id", workerRecord.id)
        .eq("status", "pending")
        .order("expires_at", { ascending: true });

    const { data: completedEntryPayment } = await dataClient
        .from("payments")
        .select("id, paid_at")
        .eq("payment_type", "entry_fee")
        .in("status", ["completed", "paid"])
        .or(`user_id.eq.${targetProfileId},profile_id.eq.${targetProfileId}`)
        .limit(1)
        .maybeSingle();

    const hasPaidEntryFee =
        !!workerRecord.entry_fee_paid ||
        !!completedEntryPayment?.id ||
        isPostEntryFeeWorkerStatus(workerRecord.status);

    const hasPendingOffer = (pendingOffers?.length || 0) > 0;
    const statusDriftWithoutOffer = workerRecord.status === "OFFER_PENDING" && !hasPendingOffer;
    const paymentAcceptedNoOffer = hasPaidEntryFee && !hasPendingOffer;
    const queueJoinedSource = workerRecord.queue_joined_at || completedEntryPayment?.paid_at || null;
    const queueJoinedDate = queueJoinedSource
        ? new Date(queueJoinedSource)
        : null;
    const nowMs = new Date().getTime();

    // 90-day countdown (refund eligibility window)
    const rawDaysElapsed = queueJoinedDate
        ? Math.floor((nowMs - queueJoinedDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const daysElapsed = Math.min(90, Math.max(0, rawDaysElapsed));
    const daysRemaining = Math.max(0, 90 - daysElapsed);
    const progressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / 90) * 100)));
    const refundEligibleDate = queueJoinedDate
        ? new Date(queueJoinedDate.getTime() + (90 * 24 * 60 * 60 * 1000))
        : null;
    const { completion: profileCompletion, missingFields } = getWorkerCompletion({
        profile,
        worker: workerRecord,
        documents: documents || [],
    });
    const entryFeeUnlocked = profileCompletion === 100;
    const displayName = profile?.full_name || user.user_metadata?.full_name || "Worker";

    return (
        <div className="w-full">
            {!isAdminPreview && <QueueClientEffects />}
            <main className="w-full">
                {/* Queue Status Card */}
                <div className={queueSurfaceClass}>
                    {hasPendingOffer ? (
                        // Has pending offer
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22,4 12,14.01 9,11.01" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-[#050505] mb-2">🎉 You Have an Offer!</h2>
                            <p className="text-[#65676b] mb-4">
                                Check below to review and confirm your job offer.
                            </p>
                        </div>
                    ) : !hasPaidEntryFee ? (
                        entryFeeUnlocked ? (
                            <div className="relative z-10 flex flex-col items-center justify-center gap-6 text-center py-8">
                                <div className="flex flex-col items-center">
                                    <h3 className="font-semibold text-gray-900 text-xl tracking-tight">
                                        Start Searching for Jobs
                                    </h3>
                                    <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-md mx-auto">
                                        Pay a one-time $9 fee to join our active worker queue. We&apos;ll find you a job in Europe.
                                    </p>
                                </div>
                                {isAdminPreview ? (
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                                        Read-only admin preview. Queue payment is disabled here.
                                    </div>
                                ) : (
                                    <>
                                        <PayToJoinButton displayName={displayName} />
                                        <div className="mx-auto mt-2 flex max-w-xs items-start justify-center gap-1.5 px-1 text-center text-[11px] font-medium leading-relaxed text-gray-500 sm:max-w-none sm:items-center sm:text-xs">
                                            <Shield size={14} className="mt-0.5 shrink-0 text-gray-400 sm:mt-0" />
                                            <span className="min-w-0">100% money-back guarantee if no job offer in 90 days</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <LockedEntryFeeState
                                displayName={displayName}
                                profileCompletion={profileCompletion}
                                missingCount={missingFields.length}
                                readOnlyPreview={isAdminPreview}
                            />
                        )
                    ) : paymentAcceptedNoOffer ? (
                        // Paid and waiting for a real offer
                        <div className="py-2">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold text-[#050505] mb-2">
                                    Payment Accepted
                                </h2>
                                <p className="text-[#65676b] max-w-2xl mx-auto">
                                    Your $9 payment is confirmed. We are now matching your profile with employers.
                                    You will receive an offer within 90 days, or your payment is refunded in full.
                                </p>
                            </div>

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
                                    <p className="text-xs uppercase tracking-wide text-violet-700 font-semibold">Refund Eligibility</p>
                                    <p className="text-sm sm:text-base font-bold text-violet-800">
                                        {refundEligibleDate
                                            ? refundEligibleDate.toLocaleDateString("en-GB")
                                            : "Calculating..."}
                                    </p>
                                    <p className="text-xs text-violet-700">if no offer is received</p>
                                </div>
                            </div>

                            <div className="mt-5">
                                <div className="flex items-center justify-between text-xs font-semibold text-[#65676b] mb-2">
                                    <span>90-day matching window</span>
                                    <span>{progressPercent}% elapsed</span>
                                </div>
                                <div className="w-full h-3 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-violet-500 transition-all duration-700"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-[#e7f3ff] rounded-xl text-sm text-[#1877f2] border border-[#b3d4fc]">
                                <p>
                                    <strong>What happens next:</strong> We keep matching your profile with active employer requests.
                                    As soon as there is a fit, you&apos;ll get a real offer here and by email.
                                </p>
                            </div>
                            {statusDriftWithoutOffer && (
                                <p className="text-center text-xs text-amber-700 mt-3">
                                    We are syncing your status view. No active offer is currently pending.
                                </p>
                            )}
                        </div>
                    ) : (
                        // Other status
                        <div className="text-center py-4">
                                <p className="text-[#65676b]">
                                Status: <strong>{workerRecord.status}</strong>
                            </p>
                        </div>
                    )}
                </div>

                {/* Pending Offers */}
                {pendingOffers && pendingOffers.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-[#050505]">Your Active Offers</h2>

                        {pendingOffers.map((offer) => (
                            <OfferCard key={offer.id} offer={offer} readOnlyPreview={isAdminPreview} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function LockedEntryFeeState({
    displayName,
    profileCompletion,
    missingCount,
    readOnlyPreview = false,
    helperText,
}: {
    displayName: string;
    profileCompletion: number;
    missingCount: number;
    readOnlyPreview?: boolean;
    helperText?: string;
}) {
    const safeMissingCount = Math.max(0, missingCount);
    const missingCopy = safeMissingCount === 1 ? "1 remaining requirement" : `${safeMissingCount} remaining requirements`;

    return (
        <div className="relative z-10 flex flex-col items-center justify-center gap-5 py-8 text-center">
            <div className="flex flex-col items-center">
                <h3 className="text-xl font-semibold tracking-tight text-gray-900">
                    Complete your profile first
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                    The Job Finder payment card stays locked until your worker profile reaches 100% completion.
                </p>
            </div>

            <div className="relative mx-auto w-full max-w-[280px]">
                <div className="pointer-events-none select-none blur-[6px] opacity-85">
                    <EntryFeeCardPreview displayName={displayName} />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white/80 px-4 text-center backdrop-blur-sm">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                        <Lock size={12} />
                        {profileCompletion}% complete
                    </div>
                    <p className="text-lg font-semibold tracking-tight text-gray-900">
                        Complete profile to unlock
                    </p>
                    <p className="max-w-[220px] text-xs leading-relaxed text-gray-600">
                        Finish your required worker details and uploaded documents before paying the $9 Job Finder fee.
                    </p>
                </div>
            </div>

            {readOnlyPreview ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                    Preview only. The card unlocks automatically once this worker reaches 100%.
                </div>
            ) : (
                <Link
                    href="/profile/worker/edit"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#27272a]"
                >
                    <Pencil size={16} />
                    Complete Profile
                </Link>
            )}

            <div className="mx-auto flex max-w-sm items-start justify-center gap-1.5 px-1 text-center text-[11px] font-medium leading-relaxed text-gray-500 sm:items-center sm:text-xs">
                <Shield size={14} className="mt-0.5 shrink-0 text-gray-400 sm:mt-0" />
                <span className="min-w-0">{helperText || `${missingCopy}. The payment card unlocks as soon as the profile hits 100%.`}</span>
            </div>
        </div>
    );
}

function EntryFeeCardPreview({ displayName }: { displayName: string }) {
    const safeName = (displayName || "Worker").substring(0, 22);

    return (
        <div className="group relative flex h-[160px] w-full shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-[#333333] bg-gradient-to-tr from-[#111111] to-[#2a2a2a] p-5 text-left text-white shadow-xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50" />

            <div className="relative z-10 flex items-start justify-between">
                <div className="relative flex h-7 w-10 items-center justify-center rounded bg-gradient-to-br from-amber-200 to-yellow-500 opacity-90 shadow-inner">
                    <div className="absolute h-[1px] w-full bg-black/20" />
                    <div className="absolute h-full w-[1px] bg-black/20" />
                    <Gem size={12} className="relative z-10 text-yellow-900/40" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Priority</span>
            </div>

            <div className="relative z-10 mt-2 space-y-1">
                <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-semibold tracking-tight">Pay $9.00</span>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white/90">Start Search</span>
                </div>
            </div>

            <div className="relative z-10 flex items-end justify-between border-t border-white/10 pt-2">
                <div className="flex flex-col">
                    <span className="mb-0.5 text-[8px] uppercase tracking-wider text-white/40">Cardholder Name</span>
                    <span className="max-w-[150px] truncate text-xs font-medium uppercase tracking-wide text-white/80">
                        {safeName}
                    </span>
                </div>
                <div className="flex -space-x-1.5 opacity-80">
                    <div className="h-5 w-5 rounded-full bg-red-400 mix-blend-multiply" />
                    <div className="h-5 w-5 rounded-full bg-yellow-400 mix-blend-multiply" />
                </div>
            </div>

            <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        </div>
    );
}

function OfferCard({ offer, readOnlyPreview = false }: {
    offer: {
        id: string;
        expires_at: string;
        job_requests: {
            title: string;
            destination_country: string;
            salary_min?: number;
            salary_max?: number;
            salary_currency?: string;
            employers?: { company_name: string };
        };
    }
    readOnlyPreview?: boolean;
}) {
    const expiresAt = new Date(offer.expires_at);
    const now = new Date();
    const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)) % 60);

    const isUrgent = hoursRemaining < 6;

    return (
        <div className={`bg-white rounded-xl shadow-sm border-2 p-5 ${isUrgent ? 'border-red-400 bg-red-50' : 'border-emerald-400'}`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h3 className="break-words text-lg font-bold text-[#050505]">
                        {offer.job_requests.title}
                    </h3>
                    <p className="text-[#65676b]">
                        {offer.job_requests.employers?.company_name || "Employer"} • {offer.job_requests.destination_country}
                    </p>
                </div>

                <div className={`shrink-0 sm:text-right ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                    <div className="text-2xl font-bold">
                        {hoursRemaining}h {minutesRemaining}m
                    </div>
                    <div className="text-sm">remaining</div>
                </div>
            </div>

            {offer.job_requests.salary_min && (
                <p className="text-[#050505] mb-4">
                    Salary: {offer.job_requests.salary_currency || 'EUR'} {offer.job_requests.salary_min}
                    {offer.job_requests.salary_max && ` - ${offer.job_requests.salary_max}`}
                </p>
            )}

            <div className={`p-3 rounded-xl mb-4 ${isUrgent ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                <strong>⏰ Action Required:</strong> Confirm this offer within {hoursRemaining} hours
                or it will be offered to the next worker in the queue.
            </div>

            {readOnlyPreview ? (
                <div className="block text-center rounded-lg border border-blue-200 bg-blue-50 px-6 py-3 text-sm font-medium text-blue-800">
                    Offer confirmation is disabled in admin preview
                </div>
            ) : (
                <Link
                    href={`/profile/worker/offers/${offer.id}`}
                    className="block text-center bg-[#1877f2] text-white font-bold py-3 px-6 rounded-lg hover:bg-[#166fe5] transition-colors shadow-sm w-full"
                >
                    Confirm Offer - Pay $190
                </Link>
            )}
        </div>
    );
}
