import Link from "next/link";
import { redirect } from "next/navigation";
import {
    BadgeCheck,
    Briefcase,
    Clock3,
    CreditCard,
    ExternalLink,
    FileSearch,
    Hourglass,
    ListOrdered,
    MailX,
    MessageSquareMore,
    ShieldCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import { getAdminExceptionSnapshot } from "@/lib/admin-exceptions";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import { createClient } from "@/lib/supabase/server";

function formatDate(value?: string | null) {
    if (!value) {
        return "—";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "—";
    }

    return parsed.toLocaleString("en-GB");
}

export default async function AdminExceptionsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (normalizeUserType(profile?.user_type) !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const snapshot = await getAdminExceptionSnapshot();

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Internal ops"
                    title="Operational Exceptions"
                    description="Internal incident screen for email hygiene, checkout drift, payment quality, document review, approval backlog, queue/payment mismatches, and open job requests with no worker pipeline yet."
                    metrics={[
                        { label: "Signals", value: snapshot.totalSignals, meta: "Open issues that need action" },
                        { label: "Checkout", value: snapshot.openedCheckoutButUnpaid.length, meta: "Opened, not paid" },
                        { label: "Docs", value: snapshot.manualReviewProfiles.length, meta: "Manual review workers" },
                        { label: "Approval", value: snapshot.pendingAdminApproval.length, meta: "Ready, waiting on admin" },
                        { label: "Email", value: snapshot.invalidEmailProfiles.length, meta: "Invalid or bounced" },
                        { label: "Queue Drift", value: snapshot.paidButNotInQueue.length, meta: "Paid but not advanced" },
                    ]}
                />

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <ActionCard
                        href="/internal/email-health"
                        title="Invalid Emails"
                        value={snapshot.invalidEmailProfiles.length}
                        meta="Typo domains and recent undeliverable sends"
                        tone={snapshot.invalidEmailProfiles.length > 0 ? "warning" : "neutral"}
                        icon={<MailX size={18} />}
                    />
                    <ActionCard
                        href="/admin/analytics"
                        title="Opened Checkout"
                        value={snapshot.openedCheckoutButUnpaid.length}
                        meta="Workers who opened $9 checkout and stopped"
                        tone={snapshot.openedCheckoutButUnpaid.length > 0 ? "warning" : "neutral"}
                        icon={<Clock3 size={18} />}
                    />
                    <ActionCard
                        href="/internal/ops#payment-quality"
                        title="Payment Quality"
                        value={snapshot.paymentQuality.recentIssues.length}
                        meta="Bank declines, Stripe blocks, and expired checkout sessions"
                        tone={snapshot.paymentQuality.recentIssues.length > 0 ? "warning" : "neutral"}
                        icon={<CreditCard size={18} />}
                    />
                    <ActionCard
                        href="/admin/review"
                        title="Manual Review"
                        value={snapshot.manualReviewProfiles.length}
                        meta="Workers blocked on manual document review"
                        tone={snapshot.manualReviewProfiles.length > 0 ? "warning" : "neutral"}
                        icon={<FileSearch size={18} />}
                    />
                    <ActionCard
                        href="/admin/workers?filter=needs_approval"
                        title="Needs Approval"
                        value={snapshot.pendingAdminApproval.length}
                        meta="Fully ready worker cases still blocked on admin approval"
                        tone={snapshot.pendingAdminApproval.length > 0 ? "warning" : "neutral"}
                        icon={<Hourglass size={18} />}
                    />
                    <ActionCard
                        href="/admin/workers?filter=VERIFIED"
                        title="Verified, Unpaid"
                        value={snapshot.verifiedButUnpaid.length}
                        meta="Ready workers still missing Job Finder payment"
                        tone={snapshot.verifiedButUnpaid.length > 0 ? "warning" : "neutral"}
                        icon={<BadgeCheck size={18} />}
                    />
                    <ActionCard
                        href="/admin/queue"
                        title="Paid, Not In Queue"
                        value={snapshot.paidButNotInQueue.length}
                        meta="Completed entry fee without queue progression"
                        tone={snapshot.paidButNotInQueue.length > 0 ? "danger" : "neutral"}
                        icon={<ListOrdered size={18} />}
                    />
                    <ActionCard
                        href="/admin/jobs"
                        title="Open Jobs, No Offers"
                        value={snapshot.openJobRequestsWithoutOffers.length}
                        meta="Employer requests with no worker pipeline yet"
                        tone={snapshot.openJobRequestsWithoutOffers.length > 0 ? "warning" : "neutral"}
                        icon={<Briefcase size={18} />}
                    />
                    <ActionCard
                        href="/admin/inbox"
                        title="WhatsApp Quality"
                        value={
                            snapshot.whatsappQuality.guardedReplies
                            + snapshot.whatsappQuality.languageFallbacks
                            + snapshot.whatsappQuality.autoHandoffs
                            + snapshot.whatsappQuality.openAIFailures
                        }
                        meta="24h guardrails, language rescues, handoffs, and AI failures"
                        tone={
                            snapshot.whatsappQuality.languageFallbacks > 0
                            || snapshot.whatsappQuality.openAIFailures > 0
                            || snapshot.whatsappQuality.autoHandoffs > 0
                                ? "warning"
                                : "neutral"
                        }
                        icon={<MessageSquareMore size={18} />}
                    />
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                    <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <SectionHeader
                            title="Checkout Recovery"
                            description="Workers who opened checkout but still did not pay, plus stale pending rows that no longer reflect reality."
                            href="/admin/analytics"
                            label="Open analytics"
                        />
                        <div className="space-y-4">
                            <SubSectionLabel label="Opened checkout, unpaid" />
                            {snapshot.openedCheckoutButUnpaid.length === 0 ? (
                                <EmptyState copy="No live abandoned checkout cases right now." />
                            ) : (
                                snapshot.openedCheckoutButUnpaid.slice(0, 6).map((entry) => (
                                    <WorkerIssueRow
                                        key={entry.paymentId}
                                        title={entry.fullName}
                                        subtitle={`${entry.email} • ${entry.hoursSinceCheckout}h since checkout`}
                                        chips={[entry.workerStatus.replace(/_/g, " "), entry.nextStepLabel]}
                                        details={`Started ${formatDate(entry.checkoutStartedAt)}${entry.deadlineAt ? ` • deadline ${formatDate(entry.deadlineAt)}` : ""}`}
                                        primaryHref={entry.workspaceHref}
                                        primaryLabel="Inspect worker"
                                        secondaryHref={entry.caseHref}
                                        secondaryLabel="Open case"
                                    />
                                ))
                            )}

                            <SubSectionLabel label="Stale pending rows" />
                            {snapshot.stalePendingPayments.length === 0 ? (
                                <EmptyState copy="No stale pending payment rows detected." />
                            ) : (
                                snapshot.stalePendingPayments.slice(0, 4).map((entry) => (
                                    <WorkerIssueRow
                                        key={`stale-${entry.paymentId}`}
                                        title={entry.fullName}
                                        subtitle={`${entry.email} • ${entry.hoursSinceCheckout}h old pending row`}
                                        chips={[entry.workerStatus.replace(/_/g, " "), "Needs cleanup"]}
                                        details="Payment state progressed, but a pending entry-fee row still remains."
                                        primaryHref={entry.caseHref}
                                        primaryLabel="Open case"
                                        secondaryHref={entry.workspaceHref}
                                        secondaryLabel="Inspect worker"
                                    />
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <SectionHeader
                            title="Worker Readiness"
                            description="Workers blocked on documents, workers waiting for admin approval, workers ready but unpaid, and workers who paid without moving into queue."
                            href="/admin/workers"
                            label="Open workers"
                        />
                        <div className="space-y-4">
                            <SubSectionLabel label="Manual review documents" />
                            {snapshot.manualReviewProfiles.length === 0 ? (
                                <EmptyState copy="No workers are waiting on manual document review." />
                            ) : (
                                snapshot.manualReviewProfiles.slice(0, 5).map((entry) => (
                                    <WorkerIssueRow
                                        key={`review-${entry.profileId}`}
                                        title={entry.fullName}
                                        subtitle={`${entry.email} • ${entry.manualReviewCount} document${entry.manualReviewCount === 1 ? "" : "s"} in manual review`}
                                        chips={[entry.workerStatus.replace(/_/g, " "), "Manual review"]}
                                        details={`Latest review activity: ${formatDate(entry.latestReviewAt)}`}
                                        primaryHref={entry.documentsHref}
                                        primaryLabel="Inspect docs"
                                        secondaryHref={entry.reviewHref}
                                        secondaryLabel="Open review"
                                    />
                                ))
                            )}

                            <SubSectionLabel label="Ready, waiting on approval" />
                            {snapshot.pendingAdminApproval.length === 0 ? (
                                <EmptyState copy="No fully ready workers are waiting on admin approval." />
                            ) : (
                                snapshot.pendingAdminApproval.slice(0, 5).map((entry) => (
                                    <WorkerIssueRow
                                        key={`approval-${entry.profileId}`}
                                        title={entry.fullName}
                                        subtitle={`${entry.email} • ${entry.completion}% complete • ${entry.verifiedDocs}/3 verified docs`}
                                        chips={[entry.workerStatus.replace(/_/g, " "), `Waiting ${entry.waitingHours}h`]}
                                        details={`Latest ready activity: ${formatDate(entry.latestReadyAt)}`}
                                        primaryHref={entry.caseHref}
                                        primaryLabel="Open case"
                                        secondaryHref={entry.workspaceHref}
                                        secondaryLabel="Inspect worker"
                                    />
                                ))
                            )}

                            <SubSectionLabel label="Verified but unpaid" />
                            {snapshot.verifiedButUnpaid.length === 0 ? (
                                <EmptyState copy="No admin-approved workers are waiting only on payment." />
                            ) : (
                                snapshot.verifiedButUnpaid.slice(0, 5).map((entry) => (
                                    <WorkerIssueRow
                                        key={`verified-${entry.profileId}`}
                                        title={entry.fullName}
                                        subtitle={`${entry.email} • ${entry.completion}% complete • ${entry.verifiedDocs}/3 verified docs`}
                                        chips={[entry.workerStatus.replace(/_/g, " "), "Ready to convert"]}
                                        details="Admin approval is done. Case is now waiting only on Job Finder activation."
                                        primaryHref={entry.workspaceHref}
                                        primaryLabel="Inspect worker"
                                        secondaryHref={entry.caseHref}
                                        secondaryLabel="Open case"
                                    />
                                ))
                            )}

                            <SubSectionLabel label="Paid but not in queue" />
                            {snapshot.paidButNotInQueue.length === 0 ? (
                                <EmptyState copy="No paid workers are stuck outside the post-payment flow." />
                            ) : (
                                snapshot.paidButNotInQueue.slice(0, 5).map((entry) => (
                                    <WorkerIssueRow
                                        key={`drift-${entry.profileId}`}
                                        title={entry.fullName}
                                        subtitle={`${entry.email} • status ${entry.workerStatus.replace(/_/g, " ")}`}
                                        chips={["Paid", "Needs queue progression"]}
                                        details={`Latest paid entry fee: ${formatDate(entry.paidAt)}`}
                                        primaryHref={entry.queueHref}
                                        primaryLabel="Inspect queue"
                                        secondaryHref={entry.caseHref}
                                        secondaryLabel="Open case"
                                    />
                                ))
                            )}
                        </div>
                    </section>
                </div>

                <section
                    id="payment-quality"
                    className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]"
                >
                    <SectionHeader
                        title="Payment Quality"
                        description="Latest entry-fee attempt per worker, split between active checkout windows, expired sessions, bank declines, and Stripe risk blocks."
                        href="/admin/analytics"
                        label="Open analytics"
                    />
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <MiniMetric label="Paid" value={snapshot.paymentQuality.completed} />
                        <MiniMetric label="Active" value={snapshot.paymentQuality.activePending} />
                        <MiniMetric label="Expired" value={snapshot.paymentQuality.expired} />
                        <MiniMetric label="Abandoned" value={snapshot.paymentQuality.abandoned} />
                        <MiniMetric label="Bank decline" value={snapshot.paymentQuality.issuerDeclined} />
                        <MiniMetric label="Stripe block" value={snapshot.paymentQuality.stripeBlocked} />
                    </div>

                    <div className="mt-5 space-y-4">
                        <SubSectionLabel label="Recent payment issues" />
                        {snapshot.paymentQuality.recentIssues.length === 0 ? (
                            <EmptyState copy="No recent issuer declines, Stripe risk blocks, or expired checkout sessions on the latest worker attempts." />
                        ) : (
                            snapshot.paymentQuality.recentIssues.slice(0, 6).map((entry) => (
                                <WorkerIssueRow
                                    key={`quality-${entry.paymentId}`}
                                    title={entry.fullName}
                                    subtitle={
                                        entry.hoursSinceCheckout
                                            ? `${entry.email} • ${entry.hoursSinceCheckout}h since checkout`
                                            : entry.email
                                    }
                                    chips={[
                                        entry.workerStatus.replace(/_/g, " "),
                                        entry.outcomeLabel,
                                    ]}
                                    details={`${entry.outcomeDetail}${entry.lastEventAt ? ` • last event ${formatDate(entry.lastEventAt)}` : ""}${entry.deadlineAt ? ` • deadline ${formatDate(entry.deadlineAt)}` : ""}`}
                                    primaryHref={entry.workspaceHref}
                                    primaryLabel="Inspect worker"
                                    secondaryHref={entry.caseHref}
                                    secondaryLabel="Open case"
                                />
                            ))
                        )}
                    </div>
                </section>

                <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <SectionHeader
                        title="WhatsApp Quality"
                        description="Last 24 hours of deterministic replies, guardrails, language rescue, media fallback, and auto-handoff behavior."
                        href="/admin/inbox"
                        label="Open inbox"
                    />
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <MiniMetric label="Deterministic" value={snapshot.whatsappQuality.deterministicReplies} />
                        <MiniMetric label="Guarded" value={snapshot.whatsappQuality.guardedReplies} />
                        <MiniMetric label="Lang rescue" value={snapshot.whatsappQuality.languageFallbacks} />
                        <MiniMetric label="Auto handoff" value={snapshot.whatsappQuality.autoHandoffs} />
                        <MiniMetric label="AI failures" value={snapshot.whatsappQuality.openAIFailures} />
                        <MiniMetric label="Media fallback" value={snapshot.whatsappQuality.mediaFallbacks} />
                    </div>

                    <div className="mt-5 space-y-4">
                        <SubSectionLabel label="Recent auto-handoffs" />
                        {snapshot.whatsappQuality.recentAutoHandoffs.length === 0 ? (
                            <EmptyState copy="No WhatsApp threads needed automatic support handoff in the last 24 hours." />
                        ) : (
                            snapshot.whatsappQuality.recentAutoHandoffs.map((entry) => (
                                <WorkerIssueRow
                                    key={`${entry.phone}-${entry.createdAt || "unknown"}`}
                                    title={entry.reason}
                                    subtitle={`${entry.phone} • ${formatDate(entry.createdAt)}`}
                                    chips={["WhatsApp", "Auto handoff"]}
                                    details={entry.preview}
                                    primaryHref="/admin/inbox"
                                    primaryLabel="Open inbox"
                                    secondaryHref={entry.profileId ? `/admin/workers/${entry.profileId}` : "/admin/inbox"}
                                    secondaryLabel={entry.profileId ? "Inspect worker" : "Open thread list"}
                                />
                            ))
                        )}
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                    <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <SectionHeader
                            title="Email Hygiene"
                            description="Profiles with obvious email risk, so reminders and follow-up do not silently fail."
                            href="/internal/email-health"
                            label="Open email health"
                        />
                        {snapshot.invalidEmailProfiles.length === 0 ? (
                            <EmptyState copy="No invalid or bounced profile emails are flagged right now." />
                        ) : (
                            <div className="space-y-4">
                                {snapshot.invalidEmailProfiles.slice(0, 6).map((entry) => (
                                    <WorkerIssueRow
                                        key={`email-${entry.profileId}`}
                                        title={entry.fullName}
                                        subtitle={`${entry.email} • ${entry.role}`}
                                        chips={[entry.reason, `${entry.bounceCount} bounce${entry.bounceCount === 1 ? "" : "s"}`]}
                                        details={entry.lastBounceAt ? `Last bounce: ${formatDate(entry.lastBounceAt)}` : "Known invalid email pattern"}
                                        primaryHref={entry.workspaceHref}
                                        primaryLabel="Open workspace"
                                        secondaryHref={entry.emailHealthHref}
                                        secondaryLabel="Email health"
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <SectionHeader
                            title="Employer Demand"
                            description="Open job requests that still have no offer pipeline, so demand does not just sit in the system."
                            href="/admin/jobs"
                            label="Open jobs"
                        />
                        {snapshot.openJobRequestsWithoutOffers.length === 0 ? (
                            <EmptyState copy="Every active job request already has at least one offer pipeline." />
                        ) : (
                            <div className="space-y-4">
                                {snapshot.openJobRequestsWithoutOffers.slice(0, 6).map((job) => (
                                    <div key={job.id} className="rounded-[24px] border border-[#e6e6e1] bg-[#fcfcfb] p-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-semibold text-[#18181b]">{job.title}</div>
                                                <div className="mt-1 text-sm text-[#57534e]">{job.companyName}</div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <Chip label={`${job.openPositions} open position${job.openPositions === 1 ? "" : "s"}`} tone="warning" />
                                                    <Chip label={job.status.replace(/_/g, " ")} tone="neutral" />
                                                </div>
                                                <div className="mt-3 text-xs text-[#71717a]">
                                                    Created {formatDate(job.createdAt)} • {job.offersCount} offers so far
                                                </div>
                                            </div>
                                            <div className="flex w-full flex-col gap-2 lg:w-[220px]">
                                                <Link
                                                    href={job.jobsHref}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:border-[#cfc9bf] hover:bg-[#fafaf9]"
                                                >
                                                    <ShieldCheck size={16} />
                                                    Smart Match
                                                </Link>
                                                {job.employerWorkspaceHref ? (
                                                    <Link
                                                        href={job.employerWorkspaceHref}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:border-[#cfc9bf] hover:bg-[#fafaf9]"
                                                    >
                                                        <ExternalLink size={16} />
                                                        Employer workspace
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </AppShell>
    );
}

function ActionCard({
    href,
    title,
    value,
    meta,
    tone,
    icon,
}: {
    href: string;
    title: string;
    value: number;
    meta: string;
    tone: "danger" | "warning" | "neutral";
    icon: React.ReactNode;
}) {
    const toneClasses = tone === "danger"
        ? "border-rose-200 bg-rose-50"
        : tone === "warning"
            ? "border-amber-200 bg-amber-50"
            : "border-[#ebe7df] bg-white";

    return (
        <Link
            href={href}
            className={`rounded-[24px] border px-5 py-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-34px_rgba(15,23,42,0.25)] ${toneClasses}`}
        >
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                    {icon}
                </div>
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">{title}</div>
                    <div className="mt-1 text-3xl font-semibold text-[#18181b]">{value}</div>
                </div>
            </div>
            <div className="mt-3 text-sm text-[#57534e]">{meta}</div>
        </Link>
    );
}

function SectionHeader({
    title,
    description,
    href,
    label,
}: {
    title: string;
    description: string;
    href: string;
    label: string;
}) {
    return (
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
                <h2 className="text-lg font-semibold text-[#18181b]">{title}</h2>
                <p className="mt-1 text-sm text-[#71717a]">{description}</p>
            </div>
            <Link
                href={href}
                className="inline-flex items-center gap-2 rounded-xl border border-[#e0ddd5] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:border-[#cfc9bf] hover:bg-[#fafaf9]"
            >
                {label}
                <ExternalLink size={14} />
            </Link>
        </div>
    );
}

function SubSectionLabel({ label }: { label: string }) {
    return (
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">
            {label}
        </div>
    );
}

function WorkerIssueRow({
    title,
    subtitle,
    chips,
    details,
    primaryHref,
    primaryLabel,
    secondaryHref,
    secondaryLabel,
}: {
    title: string;
    subtitle: string;
    chips: string[];
    details: string;
    primaryHref: string;
    primaryLabel: string;
    secondaryHref: string;
    secondaryLabel: string;
}) {
    return (
        <div className="rounded-[24px] border border-[#e6e6e1] bg-[#fcfcfb] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#18181b]">{title}</div>
                    <div className="mt-1 text-sm text-[#57534e]">{subtitle}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {chips.map((chip) => (
                            <Chip key={chip} label={chip} tone="neutral" />
                        ))}
                    </div>
                    <div className="mt-3 text-xs text-[#71717a]">{details}</div>
                </div>
                <div className="flex w-full flex-col gap-2 lg:w-[220px]">
                    <Link
                        href={primaryHref}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:border-[#cfc9bf] hover:bg-[#fafaf9]"
                    >
                        <ExternalLink size={16} />
                        {primaryLabel}
                    </Link>
                    <Link
                        href={secondaryHref}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:border-[#cfc9bf] hover:bg-[#fafaf9]"
                    >
                        <ShieldCheck size={16} />
                        {secondaryLabel}
                    </Link>
                </div>
            </div>
        </div>
    );
}

function Chip({ label, tone }: { label: string; tone: "neutral" | "warning" }) {
    const toneClasses = tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-[#e5e7eb] bg-white text-[#57534e]";

    return (
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClasses}`}>
            {label}
        </span>
    );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-[20px] border border-[#e6e6e1] bg-[#fcfcfb] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-[#18181b]">{value}</div>
        </div>
    );
}

function EmptyState({ copy }: { copy: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-[#ddd6c8] bg-[#fafaf9] p-10 text-center text-sm italic text-slate-400">
            {copy}
        </div>
    );
}
