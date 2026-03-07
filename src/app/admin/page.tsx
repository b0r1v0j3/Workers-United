import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BarChart3, Building2, ChevronRight, FileSearch, ListOrdered, MessageSquareMore, ShieldCheck, User, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import { isGodModeUser } from "@/lib/godmode";
import { normalizeUserType } from "@/lib/domain";
import { getWorkerCompletion } from "@/lib/profile-completion";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
        admin.from("candidates").select("id, profile_id, status, queue_joined_at, admin_approved, created_at, entry_fee_paid, phone, nationality, current_country, preferred_job, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, lives_abroad, previous_visas, family_data"),
        getAllAuthUsers(admin),
        admin.from("profiles").select("id, full_name, email"),
        admin.from("employers").select("id, profile_id, company_name, status, created_at"),
        admin.from("agencies").select("id, profile_id, display_name, legal_name, status, contact_email, created_at"),
        admin.from("candidate_documents").select("user_id, document_type, status"),
        admin.from("payments").select("id, amount, amount_cents, status, payment_type, paid_at, profile_id"),
        admin.from("conversations").select("id, status, type, last_message_at, created_at").eq("type", "support"),
    ]);

    const workers = workersRaw || [];
    const profileMap = new Map((profiles || []).map((entry: any) => [entry.id, entry]));
    const currentProfile = profileMap.get(user.id);
    const currentWorker = workers.find((worker: any) => worker.profile_id === user.id) || null;
    const currentEmployers = (employers || [])
        .filter((entry: any) => entry.profile_id === user.id)
        .sort((left: any, right: any) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    const currentEmployer = currentEmployers[0] || null;
    const currentAgency = (agencies || []).find((entry: any) => entry.profile_id === user.id) || null;
    const docsByUser = new Map<string, Array<{ user_id: string; document_type: string; status: string | null }>>();
    for (const doc of documents || []) {
        const current = docsByUser.get(doc.user_id) || [];
        current.push(doc);
        docsByUser.set(doc.user_id, current);
    }

    const statusCounts = workers.reduce<Record<string, number>>((acc, worker: any) => {
        const status = worker.status || "NEW";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const workerAuthUsers = allAuthUsers.filter((entry: any) => !["employer", "admin", "agency"].includes(entry.user_metadata?.user_type));
    const totalWorkers = workerAuthUsers.length || workers.length;
    const totalEmployers = employers?.length || 0;
    const registrationsThisWeek = workerAuthUsers.filter((entry: any) => new Date(entry.created_at) >= weekAgo).length;
    const registrationsThisMonth = workerAuthUsers.filter((entry: any) => new Date(entry.created_at) >= monthStart).length;
    const employerRegistrationsThisMonth = (employers || []).filter((entry: any) => new Date(entry.created_at) >= monthStart).length;

    let completionTotal = 0;
    let completionCount = 0;
    let completeWorkers = 0;
    for (const worker of workers) {
        const result = getWorkerCompletion({
            profile: profileMap.get(worker.profile_id) || null,
            candidate: worker,
            documents: docsByUser.get(worker.profile_id) || [],
        });
        completionTotal += result.completion;
        completionCount += 1;
        if (result.completion === 100) {
            completeWorkers += 1;
        }
    }
    const avgCompletion = completionCount > 0 ? Math.round(completionTotal / completionCount) : 0;

    const successfulPayments = (payments || []).filter((payment: any) => ["completed", "paid"].includes(payment.status || ""));
    const pendingEntryPayments = (payments || []).filter((payment: any) => payment.payment_type === "entry_fee" && payment.status === "pending").length;
    const supportInboxThreads = supportConversations?.length || 0;
    const waitingOnSupportThreads = (supportConversations || []).filter((conversation: any) => conversation.status === "waiting_on_support").length;
    const totalRevenue = successfulPayments.reduce((sum: number, payment: any) => {
        const amount = payment.amount != null ? Number(payment.amount) : Number(payment.amount_cents || 0) / 100;
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const revenueThisMonth = successfulPayments
        .filter((payment: any) => payment.paid_at && new Date(payment.paid_at) >= monthStart)
        .reduce((sum: number, payment: any) => {
            const amount = payment.amount != null ? Number(payment.amount) : Number(payment.amount_cents || 0) / 100;
            return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

    const workersReadyForApproval = workers.filter((worker: any) => (worker.status === "PROFILE_COMPLETE" || worker.status === "PENDING_APPROVAL") && !worker.admin_approved);
    const pendingEmployers = (employers || []).filter((employer: any) => employer.status === "PENDING");
    const manualReviewDocs = (documents || []).filter((document: any) => document.status === "manual_review").length;
    const rejectedDocs = (documents || []).filter((document: any) => document.status === "rejected").length;

    const queueWorkers = workers
        .filter((worker: any) => worker.status === "IN_QUEUE" && worker.queue_joined_at)
        .map((worker: any) => {
            const joinedAt = new Date(worker.queue_joined_at);
            const daysInQueue = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
            const daysRemaining = 90 - daysInQueue;
            return {
                id: worker.profile_id,
                name: profileMap.get(worker.profile_id)?.full_name || "Unknown",
                email: profileMap.get(worker.profile_id)?.email || "",
                daysRemaining,
                joinedAt: joinedAt.toLocaleDateString("en-GB"),
            };
        })
        .sort((left, right) => left.daysRemaining - right.daysRemaining);

    const urgentQueueWorkers = queueWorkers.filter((worker) => worker.daysRemaining <= 30);

    const recentWorkers = workerAuthUsers
        .sort((left: any, right: any) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 6)
        .map((entry: any) => {
            const worker = workers.find((candidate: any) => candidate.profile_id === entry.id);
            return {
                id: entry.id,
                name: profileMap.get(entry.id)?.full_name || entry.user_metadata?.full_name || "Unknown",
                email: entry.email || "",
                status: worker?.status || "NEW",
                createdAt: new Date(entry.created_at).toLocaleDateString("en-GB"),
            };
        });

    const recentEmployers = (employers || [])
        .sort((left: any, right: any) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 6)
        .map((entry: any) => ({
            id: entry.profile_id,
            name: entry.company_name || "Unnamed employer",
            email: profileMap.get(entry.profile_id)?.email || "",
            status: entry.status || "PENDING",
            createdAt: new Date(entry.created_at).toLocaleDateString("en-GB"),
        }));

    const recentAgencies = (agencies || [])
        .sort((left: any, right: any) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 6)
        .map((entry: any) => ({
            id: entry.profile_id,
            name: entry.display_name || entry.legal_name || "Unnamed agency",
            email: entry.contact_email || profileMap.get(entry.profile_id)?.email || "",
            status: entry.status || "active",
            createdAt: new Date(entry.created_at).toLocaleDateString("en-GB"),
        }));

    const quickActions = [
        { href: "/admin/workers", label: "Workers", meta: `${totalWorkers} total`, icon: <Users size={18} /> },
        { href: "/admin/review", label: "Review Documents", meta: `${manualReviewDocs} manual review`, icon: <FileSearch size={18} /> },
        { href: "/admin/employers", label: "Employers", meta: `${totalEmployers} total`, icon: <Building2 size={18} /> },
        { href: "/admin/agencies", label: "Agencies", meta: `${agencies?.length || 0} total`, icon: <Users size={18} /> },
        { href: "/admin/queue", label: "Queue", meta: `${statusCounts.IN_QUEUE || 0} in queue`, icon: <ListOrdered size={18} /> },
        { href: "/admin/jobs", label: "Jobs", meta: `${pendingEmployers.length} pending employers`, icon: <ChevronRight size={18} /> },
        { href: "/admin/inbox", label: "Inbox", meta: `${waitingOnSupportThreads} waiting on support`, icon: <MessageSquareMore size={18} /> },
        { href: "/admin/analytics", label: "Analytics", meta: "charts and funnel", icon: <BarChart3 size={18} /> },
    ];

    const pipeline = [
        { label: "New", count: statusCounts.NEW || 0, href: "/admin/workers?filter=NEW" },
        { label: "Profile Complete", count: statusCounts.PROFILE_COMPLETE || 0, href: "/admin/workers?filter=PROFILE_COMPLETE" },
        { label: "Pending Approval", count: statusCounts.PENDING_APPROVAL || 0, href: "/admin/workers?filter=PENDING_APPROVAL" },
        { label: "Verified", count: statusCounts.VERIFIED || 0, href: "/admin/workers?filter=VERIFIED" },
        { label: "In Queue", count: statusCounts.IN_QUEUE || 0, href: "/admin/workers?filter=IN_QUEUE" },
        { label: "Offers", count: (statusCounts.OFFER_PENDING || 0) + (statusCounts.OFFER_ACCEPTED || 0), href: "/admin/workers?filter=OFFER_PENDING" },
        { label: "Visa", count: (statusCounts.VISA_PROCESS_STARTED || 0) + (statusCounts.VISA_APPROVED || 0), href: "/admin/workers?filter=VISA_PROCESS_STARTED" },
        { label: "Placed", count: statusCounts.PLACED || 0, href: "/admin/workers?filter=PLACED" },
    ];

    const previewCards = [
        {
            href: "/profile/worker",
            title: "Worker Template",
            description: currentWorker
                ? `${currentWorker.status || "NEW"}${currentWorker.entry_fee_paid ? " • entry fee paid" : ""}`
                : "No worker record linked to this admin account.",
            meta: currentWorker
                ? `${currentProfile?.full_name || "Worker"} • ${currentProfile?.email || user.email || ""}`
                : "Opens the worker workspace in read-only mode.",
            icon: <User size={18} />,
            tone: currentWorker ? "neutral" : "warning",
        },
        {
            href: "/profile/employer",
            title: "Employer Template",
            description: currentEmployer
                ? `${currentEmployer.company_name || "Employer profile"} • ${currentEmployer.status || "PENDING"}`
                : "No employer record linked to this admin account.",
            meta: currentEmployer
                ? currentEmployers.length > 1
                    ? `${currentEmployers.length} employer records found • using latest`
                    : currentProfile?.email || user.email || ""
                : "Opens the employer workspace in read-only mode.",
            icon: <Building2 size={18} />,
            tone: currentEmployer ? "neutral" : "warning",
        },
        {
            href: "/profile/agency",
            title: "Agency Template",
            description: currentAgency
                ? `${currentAgency.display_name || currentAgency.legal_name || "Agency"} • ${currentAgency.status || "active"}`
                : "No agency record linked to this admin account.",
            meta: currentAgency
                ? currentAgency.contact_email || currentProfile?.email || user.email || ""
                : "Opens the agency workspace in read-only mode without creating agency data.",
            icon: <Users size={18} />,
            tone: currentAgency ? "neutral" : "warning",
        },
    ] as const;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <section className="rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#fcfbf7_0%,#f2eee4_100%)] p-6 shadow-[0_28px_70px_-50px_rgba(15,23,42,0.35)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#dfdbd0] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                                <ShieldCheck size={14} />
                                Admin Workspace
                            </div>
                            <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">Operations Dashboard</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e]">
                                One place for blocked approvals, queue risk, payments, and the fastest paths into workers, employers, review, jobs, and analytics.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCard label="Workers" value={totalWorkers} meta={`${registrationsThisWeek} this week`} />
                            <StatCard label="Employers" value={totalEmployers} meta={`${employerRegistrationsThisMonth} this month`} />
                            <StatCard label="Avg Completion" value={`${avgCompletion}%`} meta={`${completeWorkers} at 100%`} />
                            <StatCard label="Revenue" value={totalRevenue > 0 ? `$${totalRevenue}` : "—"} meta={totalRevenue > 0 ? `$${revenueThisMonth} this month` : "No paid sessions"} />
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
                    <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-5 flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-[#18181b]">Admin Role Safety</h2>
                                <p className="mt-1 text-sm text-[#71717a]">Previewing worker, employer, or agency screens no longer changes the admin account type.</p>
                            </div>
                        </div>

                        <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-950">
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">Profile role</span>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                                    {profileType || "unknown"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">Auth metadata role</span>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                                    {metadataType || "unknown"}
                                </span>
                            </div>
                            <p className="text-blue-900/80">
                                Worker, employer, and agency views are now explicit read-only previews. Use real role accounts for editing, uploads, payments, and draft creation.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold text-[#18181b]">Workspace Templates</h2>
                            <p className="mt-1 text-sm text-[#71717a]">Shell-only UI templates for worker, employer, and agency. Use the admin lists below to inspect real accounts with real data.</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {previewCards.map((card) => (
                                <Link key={card.href} href={card.href} className="rounded-2xl border border-[#ebe7df] bg-[#fcfcfb] px-4 py-4 transition hover:border-[#d7d0c6] hover:bg-white">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                        {card.icon}
                                    </div>
                                    <div className="mt-4 text-sm font-semibold text-[#18181b]">{card.title}</div>
                                    <div className="mt-2 text-sm text-[#57534e]">{card.description}</div>
                                    <div className="mt-3 text-xs text-[#78716c]">{card.meta}</div>
                                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
                                        Open preview
                                        <ChevronRight size={14} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <ActionCard href="/admin/workers?filter=PENDING_APPROVAL" title="Workers Waiting for Approval" value={workersReadyForApproval.length} meta="Profiles blocked on admin approval" tone={workersReadyForApproval.length > 0 ? "danger" : "neutral"} />
                    <ActionCard href="/admin/employers" title="Pending Employers" value={pendingEmployers.length} meta="Employer accounts waiting for action" tone={pendingEmployers.length > 0 ? "warning" : "neutral"} />
                    <ActionCard href="/admin/review" title="Manual Document Review" value={manualReviewDocs} meta={`${rejectedDocs} rejected documents`} tone={manualReviewDocs > 0 || rejectedDocs > 0 ? "warning" : "neutral"} />
                    <ActionCard href="/admin/queue" title="Queue Risk" value={urgentQueueWorkers.length} meta="Workers inside the 30-day refund window" tone={urgentQueueWorkers.length > 0 ? "danger" : "neutral"} />
                    <ActionCard href="/admin/analytics" title="Payments Pending" value={pendingEntryPayments} meta="Entry fee sessions not completed yet" tone={pendingEntryPayments > 0 ? "warning" : "neutral"} />
                    <ActionCard href="/admin/inbox" title="Support Inbox" value={waitingOnSupportThreads} meta={`${supportInboxThreads} live support threads`} tone={waitingOnSupportThreads > 0 ? "warning" : "neutral"} />
                    <ActionCard href="/admin/workers" title="Registrations This Month" value={registrationsThisMonth} meta={`${totalWorkers} total worker accounts`} tone="neutral" />
                </section>

                <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-[#18181b]">Quick Actions</h2>
                        <p className="mt-1 text-sm text-[#71717a]">Direct entry points into the admin areas you actually use.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {quickActions.map((action) => (
                            <Link key={action.href} href={action.href} className="flex items-center justify-between rounded-2xl border border-[#ebe7df] bg-[#fcfcfb] px-4 py-4 transition hover:border-[#d7d0c6] hover:bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111111] text-white">{action.icon}</div>
                                    <div>
                                        <div className="text-sm font-semibold text-[#18181b]">{action.label}</div>
                                        <div className="text-xs text-[#78716c]">{action.meta}</div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-[#a8a29e]" />
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold text-[#18181b]">Worker Pipeline</h2>
                            <p className="mt-1 text-sm text-[#71717a]">Straight counts by stage, each card opening the relevant worker list.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {pipeline.map((step) => (
                                <Link key={step.label} href={step.href} className="rounded-2xl border border-[#ebe7df] bg-[#fcfcfb] px-4 py-4 transition hover:border-[#d7d0c6] hover:bg-white">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8a29e]">{step.label}</div>
                                    <div className="mt-2 text-2xl font-semibold text-[#18181b]">{step.count}</div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-[#18181b]">Queue Watch</h2>
                                <p className="text-sm text-[#71717a]">Workers approaching the 90-day refund deadline.</p>
                            </div>
                        </div>
                        {queueWorkers.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#ddd6c8] bg-[#faf8f3] px-6 py-10 text-center text-sm text-[#78716c]">
                                No workers are currently in queue.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {queueWorkers.slice(0, 6).map((worker) => (
                                    <Link key={worker.id} href={`/admin/workers/${worker.id}`} className="flex items-center justify-between rounded-2xl border border-[#ebe7df] bg-[#fcfcfb] px-4 py-4 transition hover:border-[#d7d0c6] hover:bg-white">
                                        <div>
                                            <div className="text-sm font-semibold text-[#18181b]">{worker.name}</div>
                                            <div className="mt-1 text-xs text-[#78716c]">{worker.email || "No email"} • Joined {worker.joinedAt}</div>
                                        </div>
                                        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${worker.daysRemaining <= 14 ? "bg-rose-100 text-rose-700" : worker.daysRemaining <= 30 ? "bg-amber-100 text-amber-700" : "bg-[#f3f4f6] text-[#57534e]"}`}>
                                            {worker.daysRemaining} days
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-3">
                    <ListCard title="Recent Workers" href="/admin/workers" emptyLabel="No recent workers found">
                        {recentWorkers.map((entry) => (
                            <ListRow key={entry.id} href={`/profile/worker?inspect=${entry.id}`} name={entry.name} meta={`${entry.email} • ${entry.createdAt}`} badge={entry.status} linkLabel="Open workspace" />
                        ))}
                    </ListCard>
                    <ListCard title="Recent Employers" href="/admin/employers" emptyLabel="No recent employers found">
                        {recentEmployers.map((entry) => (
                            <ListRow key={entry.id} href={`/profile/employer?inspect=${entry.id}`} name={entry.name} meta={`${entry.email} • ${entry.createdAt}`} badge={entry.status} linkLabel="Open workspace" />
                        ))}
                    </ListCard>
                    <ListCard title="Recent Agencies" href="/admin/agencies" emptyLabel="No recent agencies found">
                        {recentAgencies.map((entry) => (
                            <ListRow key={entry.id} href={`/profile/agency?inspect=${entry.id}`} name={entry.name} meta={`${entry.email || "No email"} • ${entry.createdAt}`} badge={entry.status} linkLabel="Open workspace" />
                        ))}
                    </ListCard>
                </section>
            </div>
        </AppShell>
    );
}

function StatCard({ label, value, meta }: { label: string; value: string | number; meta: string }) {
    return (
        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_35px_-32px_rgba(15,23,42,0.45)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8479]">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-[#18181b]">{value}</div>
            <div className="mt-1 text-xs text-[#78716c]">{meta}</div>
        </div>
    );
}

function ActionCard({ href, title, value, meta, tone }: { href: string; title: string; value: number; meta: string; tone: "danger" | "warning" | "neutral" }) {
    const toneClasses = tone === "danger"
        ? "border-rose-200 bg-rose-50"
        : tone === "warning"
            ? "border-amber-200 bg-amber-50"
            : "border-[#ebe7df] bg-white";

    return (
        <Link href={href} className={`rounded-[24px] border px-5 py-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-34px_rgba(15,23,42,0.25)] ${toneClasses}`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">{title}</div>
            <div className="mt-3 text-3xl font-semibold text-[#18181b]">{value}</div>
            <div className="mt-2 text-sm text-[#57534e]">{meta}</div>
        </Link>
    );
}

function ListCard({ title, href, emptyLabel, children }: { title: string; href: string; emptyLabel: string; children: React.ReactNode }) {
    const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
    return (
        <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-[#18181b]">{title}</h2>
                    <p className="mt-1 text-sm text-[#71717a]">Most recent registrations and their current state.</p>
                </div>
                <Link href={href} className="text-sm font-semibold text-[#18181b] transition hover:text-[#4f46e5]">Open list</Link>
            </div>
            {hasChildren ? <div className="space-y-3">{children}</div> : (
                <div className="rounded-2xl border border-dashed border-[#ddd6c8] bg-[#faf8f3] px-6 py-10 text-center text-sm text-[#78716c]">
                    {emptyLabel}
                </div>
            )}
        </div>
    );
}

function ListRow({ href, name, meta, badge, linkLabel = "Open" }: { href: string; name: string; meta: string; badge: string; linkLabel?: string }) {
    return (
        <Link href={href} className="flex items-center justify-between rounded-2xl border border-[#ebe7df] bg-[#fcfcfb] px-4 py-4 transition hover:border-[#d7d0c6] hover:bg-white">
            <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#18181b]">{name}</div>
                <div className="mt-1 truncate text-xs text-[#78716c]">{meta}</div>
            </div>
            <div className="ml-4 flex items-center gap-2">
                <div className="rounded-full bg-[#f3f4f6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#57534e]">
                    {badge.replace(/_/g, " ")}
                </div>
                <div className="text-xs font-semibold text-[#111111]">{linkLabel}</div>
            </div>
        </Link>
    );
}
