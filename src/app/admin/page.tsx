import Link from "next/link";
import { redirect } from "next/navigation";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import {
    AlertTriangle, Building2, CheckCircle2, Clock,
    MessageSquareMore,
    ShieldCheck, TrendingUp, Users, Wallet
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { isGodModeUser } from "@/lib/godmode";
import { normalizeUserType } from "@/lib/domain";
import { pickCanonicalEmployerRecord, shouldHideEmployerFromBusinessViews, type EmployerRecordSnapshot } from "@/lib/employers";
import { isReportablePaymentProfile } from "@/lib/reporting";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pickCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";

interface AdminDashboardWorkerRow extends WorkerRecordSnapshot {
    profile_id: string | null;
    status?: string | null;
    queue_joined_at?: string | null;
    admin_approved?: boolean | null;
    created_at?: string | null;
    entry_fee_paid?: boolean | null;
    agency_id?: string | null;
}

interface AdminDashboardProfileRow {
    id: string;
    full_name: string | null;
    email: string | null;
    user_type: string | null;
}

interface AdminDashboardEmployerRow extends EmployerRecordSnapshot {
    profile_id: string | null;
    company_name?: string | null;
    status?: string | null;
    created_at?: string | null;
}

interface AdminDashboardAgencyRow {
    id: string;
    profile_id?: string | null;
    display_name?: string | null;
    legal_name?: string | null;
    status?: string | null;
    created_at?: string | null;
}

interface AdminDashboardDocumentRow {
    user_id: string | null;
    document_type: string;
    status: string | null;
}

interface AdminDashboardPaymentRow {
    id: string;
    amount?: number | string | null;
    amount_cents?: number | string | null;
    status?: string | null;
    payment_type?: string | null;
    paid_at?: string | null;
    profile_id?: string | null;
    created_at?: string | null;
}

interface AdminDashboardConversationRow {
    id: string;
    status?: string | null;
    type?: string | null;
    last_message_at?: string | null;
    created_at?: string | null;
}

interface AdminQueueRiskRow extends AdminDashboardWorkerRow {
    profile_id: string;
    queue_joined_at: string;
    daysRemaining: number;
}

function resolvePaymentAmount(payment: AdminDashboardPaymentRow) {
    const amount = payment.amount != null
        ? Number(payment.amount)
        : Number(payment.amount_cents || 0) / 100;
    return Number.isFinite(amount) ? amount : 0;
}

export default async function AdminDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);
    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const admin = createAdminClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        { data: workersRaw },
        allAuthUsers,
        { data: profiles },
        { data: employers },
        { data: agencies },
        { data: documents },
        { data: payments },
        { data: supportConversations },
    ] = await Promise.all([
        admin.from("worker_onboarding").select("id, profile_id, status, queue_joined_at, admin_approved, created_at, entry_fee_paid, agency_id"),
        getAllAuthUsers(admin),
        admin.from("profiles").select("id, full_name, email, user_type"),
        admin.from("employers").select("id, profile_id, company_name, status, created_at"),
        admin.from("agencies").select("id, profile_id, display_name, legal_name, status, created_at"),
        admin.from("worker_documents").select("user_id, document_type, status"),
        admin.from("payments").select("id, amount, amount_cents, status, payment_type, paid_at, profile_id, created_at"),
        admin.from("conversations").select("id, status, type, last_message_at, created_at").eq("type", "support"),
    ]);
    const workerRows = Array.isArray(workersRaw) ? (workersRaw as AdminDashboardWorkerRow[]) : [];
    const profileRows = Array.isArray(profiles) ? (profiles as AdminDashboardProfileRow[]) : [];
    const employerRows = Array.isArray(employers) ? (employers as AdminDashboardEmployerRow[]) : [];
    const agencyRows = Array.isArray(agencies) ? (agencies as AdminDashboardAgencyRow[]) : [];
    const documentRows = Array.isArray(documents) ? (documents as AdminDashboardDocumentRow[]) : [];
    const paymentRows = Array.isArray(payments) ? (payments as AdminDashboardPaymentRow[]) : [];
    const supportRows = Array.isArray(supportConversations) ? (supportConversations as AdminDashboardConversationRow[]) : [];

    // Worker grouping
    const workerGroups = new Map<string, AdminDashboardWorkerRow[]>();
    for (const workerRow of workerRows) {
        if (!workerRow?.profile_id) continue;
        const current = workerGroups.get(workerRow.profile_id) || [];
        current.push(workerRow);
        workerGroups.set(workerRow.profile_id, current);
    }
    const workers = Array.from(workerGroups.values())
        .map((rows) => pickCanonicalWorkerRecord(rows))
        .filter((worker): worker is AdminDashboardWorkerRow => !!worker);
    const profileMap = new Map(profileRows.map((entry) => [entry.id, entry] as const));
    const employerGroups = new Map<string, AdminDashboardEmployerRow[]>();
    for (const employer of employerRows) {
        if (!employer?.profile_id) continue;
        const current = employerGroups.get(employer.profile_id) || [];
        current.push(employer);
        employerGroups.set(employer.profile_id, current);
    }
    const canonicalEmployers = Array.from(employerGroups.entries())
        .map(([profileId, rows]) => {
            const employer = pickCanonicalEmployerRecord(rows);
            if (!employer) {
                return null;
            }

            const profile = profileMap.get(profileId) || null;
            const businessProfile = profile
                ? {
                    id: profile.id,
                    email: profile.email || "",
                    full_name: profile.full_name || null,
                    user_type: profile.user_type || null,
                }
                : null;
            if (shouldHideEmployerFromBusinessViews({ employer, profile: businessProfile })) {
                return null;
            }

            return employer;
        })
        .filter((employer): employer is AdminDashboardEmployerRow => !!employer);
    const docsByUser = new Map<string, AdminDashboardDocumentRow[]>();
    for (const doc of documentRows) {
        if (!doc.user_id) continue;
        const current = docsByUser.get(doc.user_id) || [];
        current.push(doc);
        docsByUser.set(doc.user_id, current);
    }

    // Totals
    const workerAuthUsers = allAuthUsers.filter((entry: SupabaseAuthUser) => !["employer", "admin", "agency"].includes(String(entry.user_metadata?.user_type || "")));
    const totalWorkers = workerAuthUsers.length || workers.length;
    const totalEmployers = canonicalEmployers.length;
    const totalAgencies = agencyRows.length;

    // Today activity
    const newWorkersToday = workerAuthUsers.filter((entry) => new Date(entry.created_at) >= todayStart).length;
    const newWorkersThisWeek = workerAuthUsers.filter((entry) => new Date(entry.created_at) >= weekAgo).length;
    const newEmployersThisWeek = canonicalEmployers.filter((entry) => entry.created_at && new Date(entry.created_at) >= weekAgo).length;
    const newAgenciesThisWeek = agencyRows.filter((entry) => entry.created_at && new Date(entry.created_at) >= weekAgo).length;

    // Payments
    const reportablePayments = paymentRows.filter((payment) =>
        isReportablePaymentProfile(payment.profile_id ? profileMap.get(payment.profile_id) || null : null)
    );
    const successfulPayments = reportablePayments.filter((payment) => ["completed", "paid"].includes(payment.status || ""));
    const totalRevenue = successfulPayments.reduce((sum, payment) => sum + resolvePaymentAmount(payment), 0);
    const revenueThisMonth = successfulPayments
        .filter((payment) => payment.paid_at && new Date(payment.paid_at) >= monthStart)
        .reduce((sum, payment) => sum + resolvePaymentAmount(payment), 0);
    const revenueToday = successfulPayments
        .filter((payment) => payment.paid_at && new Date(payment.paid_at) >= todayStart)
        .reduce((sum, payment) => sum + resolvePaymentAmount(payment), 0);

    // Agency workers added this week
    const agencyWorkerIdsThisWeek = workerRows.filter((workerRow) =>
        workerRow.agency_id && workerRow.created_at && new Date(workerRow.created_at) >= weekAgo
    ).length;

    // Action items (things that need attention)
    const workersReadyForApproval = workers.filter((worker) =>
        (worker.status === "PROFILE_COMPLETE" || worker.status === "PENDING_APPROVAL") && !worker.admin_approved
    ).length;
    const pendingEmployers = canonicalEmployers.filter((employer) => employer.status === "PENDING").length;
    const manualReviewDocs = documentRows.filter((document) => document.status === "manual_review").length;
    const waitingOnSupportThreads = supportRows.filter((conversation) => conversation.status === "waiting_on_support").length;

    // Queue risk
    const urgentQueueWorkers: AdminQueueRiskRow[] = workers
        .filter((worker): worker is AdminDashboardWorkerRow & { profile_id: string; queue_joined_at: string } =>
            worker.status === "IN_QUEUE"
            && typeof worker.profile_id === "string"
            && typeof worker.queue_joined_at === "string"
        )
        .map((worker) => {
            const daysInQueue = Math.floor((now.getTime() - new Date(worker.queue_joined_at).getTime()) / (1000 * 60 * 60 * 24));
            return { ...worker, daysRemaining: 90 - daysInQueue };
        })
        .filter((w) => w.daysRemaining <= 30)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Recent payments (last 5)
    const recentPayments = successfulPayments
        .filter((payment) => payment.paid_at)
        .sort((left, right) => new Date(right.paid_at || "").getTime() - new Date(left.paid_at || "").getTime())
        .slice(0, 5)
        .map((payment) => ({
            name: (payment.profile_id ? profileMap.get(payment.profile_id)?.full_name : null) || "Unknown",
            amount: resolvePaymentAmount(payment),
            date: new Date(payment.paid_at || "").toLocaleDateString("en-GB"),
        }));

    // Recent registrations (last 5)
    const recentRegistrations = [...workerAuthUsers]
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 5)
        .map((entry) => ({
            id: entry.id,
            name: profileMap.get(entry.id)?.full_name || entry.user_metadata?.full_name || "Unknown",
            date: new Date(entry.created_at).toLocaleDateString("en-GB"),
            isToday: new Date(entry.created_at) >= todayStart,
        }));

    const totalActionItems = workersReadyForApproval + pendingEmployers + manualReviewDocs + waitingOnSupportThreads + urgentQueueWorkers.length;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#dfdbd0] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                            <ShieldCheck size={13} />
                            Admin
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-[#18181b]">Operations</h1>
                    </div>
                    <div className="text-right text-sm text-[#78716c]">
                        <div className="font-semibold text-[#18181b]">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
                        <div className="text-xs">{newWorkersToday > 0 ? `${newWorkersToday} new worker${newWorkersToday > 1 ? "s" : ""} today` : "No new workers today"}</div>
                    </div>
                </div>

                {/* Top stats — 4 numbers you always want to know */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Link href="/admin/workers" className="rounded-2xl border border-[#e6e6e1] bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)] transition hover:border-[#d7d0c6]">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Workers</div>
                            <Users size={15} className="text-[#a8a29e]" />
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-[#18181b]">{totalWorkers}</div>
                        <div className="mt-1 text-xs text-emerald-600 font-medium">+{newWorkersThisWeek} this week</div>
                    </Link>
                    <Link href="/admin/employers" className="rounded-2xl border border-[#e6e6e1] bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)] transition hover:border-[#d7d0c6]">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Employers</div>
                            <Building2 size={15} className="text-[#a8a29e]" />
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-[#18181b]">{totalEmployers}</div>
                        <div className="mt-1 text-xs text-[#78716c]">+{newEmployersThisWeek} this week</div>
                    </Link>
                    <Link href="/admin/agencies" className="rounded-2xl border border-[#e6e6e1] bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)] transition hover:border-[#d7d0c6]">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Agencies</div>
                            <Users size={15} className="text-[#a8a29e]" />
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-[#18181b]">{totalAgencies}</div>
                        <div className="mt-1 text-xs text-[#78716c]">+{newAgenciesThisWeek} this week{agencyWorkerIdsThisWeek > 0 ? ` · ${agencyWorkerIdsThisWeek} workers added` : ""}</div>
                    </Link>
                    <Link href="/admin/analytics" className="rounded-2xl border border-[#e6e6e1] bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)] transition hover:border-[#d7d0c6]">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Revenue</div>
                            <Wallet size={15} className="text-[#a8a29e]" />
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-[#18181b]">{totalRevenue > 0 ? `$${totalRevenue}` : "—"}</div>
                        <div className="mt-1 text-xs text-[#78716c]">{revenueThisMonth > 0 ? `$${revenueThisMonth} this month` : "No payments this month"}{revenueToday > 0 ? ` · $${revenueToday} today` : ""}</div>
                    </Link>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[24px] border border-[#d9dced] bg-[#f7f9ff] p-5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white shadow-sm">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Case navigation</div>
                                    <h2 className="mt-1 text-lg font-semibold text-[#18181b]">Open worker cases with direct ops links</h2>
                                    <p className="mt-1 max-w-2xl text-sm text-[#57534e]">
                                        Use worker case pages for canonical jumps to queue, offers, payments, documents, and linked employer or agency workspaces.
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/admin/workers"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#27272a]"
                            >
                                <ShieldCheck size={16} />
                                Open Worker Cases
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-[#d8ece0] bg-[#f5fbf7] p-5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                                    <MessageSquareMore size={18} />
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">WhatsApp Console</div>
                                    <h2 className="mt-1 text-lg font-semibold text-[#18181b]">Open all WhatsApp conversations</h2>
                                    <p className="mt-1 max-w-2xl text-sm text-[#57534e]">
                                        Pregledaj sirove thread-ove, failed poruke i phone-linked razgovore bez kopanja po ops logovima ili pojedinačnim worker case-ovima.
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/admin/whatsapp"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                            >
                                <MessageSquareMore size={16} />
                                Open WhatsApp
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Action items — things that need your attention */}
                {totalActionItems > 0 && (
                    <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-600" />
                            <h2 className="text-sm font-semibold text-amber-900">{totalActionItems} item{totalActionItems > 1 ? "s" : ""} need your attention</h2>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {workersReadyForApproval > 0 && (
                                <ActionItem href="/admin/workers?filter=PENDING_APPROVAL" label="Workers waiting for approval" count={workersReadyForApproval} tone="red" />
                            )}
                            {pendingEmployers > 0 && (
                                <ActionItem href="/admin/employers" label="Pending employer accounts" count={pendingEmployers} tone="amber" />
                            )}
                            {manualReviewDocs > 0 && (
                                <ActionItem href="/admin/review" label="Documents for manual review" count={manualReviewDocs} tone="amber" />
                            )}
                            {waitingOnSupportThreads > 0 && (
                                <ActionItem href="/admin/inbox" label="Support threads waiting on you" count={waitingOnSupportThreads} tone="amber" />
                            )}
                            {urgentQueueWorkers.length > 0 && (
                                <ActionItem href="/admin/queue" label={`Queue workers inside 30-day window`} count={urgentQueueWorkers.length} tone="red" />
                            )}
                        </div>
                    </div>
                )}

                {totalActionItems === 0 && (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <span className="text-sm font-medium text-emerald-800">All clear — no pending approvals, reviews, or support threads.</span>
                    </div>
                )}

                {/* Two columns: recent registrations + recent payments */}
                <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-[#8a8479]" />
                                <h2 className="text-sm font-semibold text-[#18181b]">Recent Registrations</h2>
                            </div>
                            <Link href="/admin/workers" className="text-xs font-semibold text-[#57534e] hover:text-[#18181b]">View all</Link>
                        </div>
                        {recentRegistrations.length === 0 ? (
                            <div className="py-6 text-center text-sm text-[#a8a29e]">No registrations yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {recentRegistrations.map((entry) => (
                                    <Link key={entry.id} href={`/admin/workers/${entry.id}`} className="flex items-center justify-between rounded-xl border border-[#f0ede6] bg-[#faf8f3] px-4 py-3 transition hover:border-[#e0dbd2] hover:bg-white">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] text-[11px] font-bold text-white">
                                                {entry.name?.charAt(0)?.toUpperCase() || "?"}
                                            </div>
                                            <span className="text-sm font-medium text-[#18181b]">{entry.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {entry.isToday && (
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Today</span>
                                            )}
                                            <span className="text-xs text-[#a8a29e]">{entry.date}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wallet size={16} className="text-[#8a8479]" />
                                <h2 className="text-sm font-semibold text-[#18181b]">Recent Payments</h2>
                            </div>
                            <Link href="/admin/analytics" className="text-xs font-semibold text-[#57534e] hover:text-[#18181b]">View all</Link>
                        </div>
                        {recentPayments.length === 0 ? (
                            <div className="py-6 text-center text-sm text-[#a8a29e]">No payments yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {recentPayments.map((payment, i) => (
                                    <div key={i} className="flex items-center justify-between rounded-xl border border-[#f0ede6] bg-[#faf8f3] px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                                                {payment.name?.charAt(0)?.toUpperCase() || "?"}
                                            </div>
                                            <span className="text-sm font-medium text-[#18181b]">{payment.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold text-emerald-700">${payment.amount}</span>
                                            <span className="text-xs text-[#a8a29e]">{payment.date}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Queue risk — only shown when there are workers at risk */}
                {urgentQueueWorkers.length > 0 && (
                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-amber-600" />
                                <h2 className="text-sm font-semibold text-[#18181b]">Queue Risk — approaching 90-day refund deadline</h2>
                            </div>
                            <Link href="/admin/queue" className="text-xs font-semibold text-[#57534e] hover:text-[#18181b]">View all</Link>
                        </div>
                        <div className="space-y-2">
                            {urgentQueueWorkers.slice(0, 5).map((worker) => (
                                <Link key={worker.profile_id} href={`/admin/workers/${worker.profile_id}`} className="flex items-center justify-between rounded-xl border border-[#f0ede6] bg-[#faf8f3] px-4 py-3 transition hover:border-[#e0dbd2] hover:bg-white">
                                    <span className="text-sm font-medium text-[#18181b]">{profileMap.get(worker.profile_id)?.full_name || "Unknown"}</span>
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${worker.daysRemaining <= 14 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                                        {worker.daysRemaining} days left
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick nav — compact links to all admin areas */}
                <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.2)]">
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Quick Navigation</h2>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { href: "/admin/workers", label: "Workers" },
                            { href: "/admin/employers", label: "Employers" },
                            { href: "/admin/agencies", label: "Agencies" },
                            { href: "/admin/queue", label: "Queue" },
                            { href: "/admin/review", label: "Review" },
                            { href: "/admin/jobs", label: "Jobs" },
                            { href: "/admin/inbox", label: "Inbox" },
                            { href: "/admin/analytics", label: "Analytics" },
                            { href: "/admin/whatsapp", label: "WhatsApp" },
                            { href: "/admin/settings", label: "Settings" },
                        ].map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="rounded-lg border border-[#e6e6e1] bg-[#faf8f3] px-3 py-1.5 text-sm font-medium text-[#57534e] transition hover:border-[#d7d0c6] hover:bg-white hover:text-[#18181b]"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>

            </div>
        </AppShell>
    );
}

function ActionItem({ href, label, count, tone }: { href: string; label: string; count: number; tone: "red" | "amber" }) {
    return (
        <Link
            href={href}
            className={`flex items-center justify-between rounded-xl px-4 py-3 transition hover:opacity-90 ${
                tone === "red" ? "bg-rose-100 border border-rose-200" : "bg-amber-100 border border-amber-200"
            }`}
        >
            <span className={`text-sm font-medium ${ tone === "red" ? "text-rose-800" : "text-amber-800" }`}>{label}</span>
            <span className={`ml-3 rounded-full px-2.5 py-0.5 text-xs font-bold ${ tone === "red" ? "bg-rose-600 text-white" : "bg-amber-600 text-white" }`}>{count}</span>
        </Link>
    );
}
