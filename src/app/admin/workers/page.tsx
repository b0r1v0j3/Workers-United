import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import { BadgeCheck, Hourglass, ListOrdered, Users } from "lucide-react";
import { getWorkerCompletion } from "@/lib/profile-completion";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import WorkersTableClient, { WorkerTableRow } from "./WorkersTableClient";
import { pickCanonicalWorkerRecord } from "@/lib/workers";

export default async function WorkersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
    const params = await searchParams;
    const filter = params?.filter || 'all';
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const isOwner = isGodModeUser(user.email);

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== 'admin' && !isOwner) {
        redirect("/profile");
    }

    // Use admin client (service role) — same pattern as admin dashboard
    const adminClient = createAdminClient();

    // Fetch ALL auth users (paginated — listUsers() defaults to 50 per page)
    const allAuthUsers = await getAllAuthUsers(adminClient);

    // Fetch all worker rows from the legacy storage table
    const { data: workerRows } = await adminClient
        .from("worker_onboarding")
        .select("*");

    // Fetch all profiles
    const { data: profiles } = await adminClient
        .from("profiles")
        .select("*");

    // Fetch all documents
    const { data: allDocs } = await adminClient
        .from("worker_documents")
        .select("*");

    // Create lookup maps
    const workerGroups = new Map<string, any[]>();
    for (const workerRow of workerRows || []) {
        if (!workerRow?.profile_id) continue;
        const current = workerGroups.get(workerRow.profile_id) || [];
        current.push(workerRow);
        workerGroups.set(workerRow.profile_id, current);
    }
    const workerMap = new Map(
        Array.from(workerGroups.entries())
            .map(([profileId, rows]) => [profileId, pickCanonicalWorkerRecord(rows)])
            .filter((entry): entry is [string, any] => !!entry[1])
    );
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Also fetch employer profile IDs directly from employers table
    const { data: employerRows } = await adminClient
        .from("employers")
        .select("profile_id");

    // Build set of employer/admin profile IDs to exclude (use ALL sources)
    const employerProfileIds = new Set<string>();

    // From profiles.user_type
    (profiles || [])
        .filter(p => p.user_type === "employer" || p.user_type === "admin")
        .forEach(p => employerProfileIds.add(p.id));

    // From employers table
    (employerRows || []).forEach((e: any) => {
        if (e.profile_id) employerProfileIds.add(e.profile_id);
    });

    // From auth user_metadata
    allAuthUsers
        .filter((u: any) => u.user_metadata?.user_type === 'employer' || u.user_metadata?.user_type === 'admin')
        .forEach((u: any) => employerProfileIds.add(u.id));

    // Calculate user progress — uses shared getWorkerCompletion() as single source of truth
    const getUserStats = (userId: string, authUser?: any) => {
        const workerRecord = workerMap.get(userId);
        const p = profileMap.get(userId);
        const userDocs = (allDocs?.filter(d => d.user_id === userId) || []) as { document_type: string }[];
        const verifiedDocs = userDocs.filter((d: any) => d.status === 'verified').length;

        const result = getWorkerCompletion({
            profile: p || null,
            worker: workerRecord || null,
            documents: userDocs,
        }, {
            fullNameFallback: authUser?.user_metadata?.full_name || null,
        });

        return { workerRecord, userDocs, verifiedDocs, profileCompletion: result.completion };
    };

    // Filter: only show workers (exclude employers and admins)
    const activeAuthUsers = allAuthUsers.filter((u: any) => !employerProfileIds.has(u.id));

    // Apply filter
    let filteredUsers = activeAuthUsers;
    const statusFilters = ['NEW', 'PROFILE_COMPLETE', 'PENDING_APPROVAL', 'VERIFIED', 'APPROVED', 'IN_QUEUE', 'OFFER_PENDING', 'OFFER_ACCEPTED', 'VISA_PROCESS_STARTED', 'VISA_APPROVED', 'PLACED', 'REJECTED', 'REFUND_FLAGGED'];

    if (filter === 'pending') {
        filteredUsers = activeAuthUsers.filter((u: any) => {
            const userDocs = allDocs?.filter(d => d.user_id === u.id) || [];
            return userDocs.some(d => d.status === 'verifying');
        });
    } else if (filter === 'verified') {
        filteredUsers = activeAuthUsers.filter((u: any) => {
            const userDocs = allDocs?.filter(d => d.user_id === u.id) || [];
            const verifiedCount = userDocs.filter(d => d.status === 'verified').length;
            return verifiedCount >= 3;
        });
    } else if (filter === 'needs_approval') {
        filteredUsers = activeAuthUsers.filter((u: any) => {
            const workerRecord = workerMap.get(u.id);
            const { profileCompletion } = getUserStats(u.id, u);
            return workerRecord && profileCompletion === 100 && !workerRecord.admin_approved;
        });
    } else if (statusFilters.includes(filter)) {
        // Status-based filter from pipeline badges
        filteredUsers = activeAuthUsers.filter((u: any) => {
            const workerRecord = workerMap.get(u.id);
            return workerRecord?.status === filter;
        });
    }

    const filterLabels: Record<string, string> = {
        all: 'All', pending: 'Pending Docs', verified: 'Verified Docs', needs_approval: 'Needs Approval',
        NEW: 'New', PROFILE_COMPLETE: 'Profile Complete', PENDING_APPROVAL: 'Pending Approval',
        VERIFIED: 'Verified', APPROVED: 'Approved', IN_QUEUE: 'In Queue', OFFER_PENDING: 'Offer Pending',
        OFFER_ACCEPTED: 'Offer Accepted', VISA_PROCESS_STARTED: 'Visa Started',
        VISA_APPROVED: 'Visa Approved', PLACED: 'Placed', REJECTED: 'Rejected', REFUND_FLAGGED: 'Refund',
    };
    const filterLabel = filterLabels[filter] || 'All';
    const nowMs = new Date().getTime();
    const readyWorkersCount = activeAuthUsers.filter((authUser: any) => {
        const { verifiedDocs, profileCompletion } = getUserStats(authUser.id, authUser);
        return profileCompletion === 100 && verifiedDocs >= 3;
    }).length;
    const needsApprovalCount = activeAuthUsers.filter((authUser: any) => {
        const workerRecord = workerMap.get(authUser.id);
        const { profileCompletion } = getUserStats(authUser.id, authUser);
        return !!workerRecord && profileCompletion === 100 && !workerRecord.admin_approved;
    }).length;
    const queueCount = activeAuthUsers.filter((authUser: any) => workerMap.get(authUser.id)?.status === "IN_QUEUE").length;
    const paidWorkersCount = activeAuthUsers.filter((authUser: any) => !!workerMap.get(authUser.id)?.entry_fee_paid).length;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Admin workers"
                    title="Worker Operations"
                    description="Use this list for two different jobs: inspect the real worker workspace, or open the admin case view for approvals, payments, documents, and queue handling."
                    metrics={[
                        { label: "Workers", value: activeAuthUsers.length, meta: `${filterLabel} view: ${filteredUsers.length}` },
                        { label: "Ready", value: readyWorkersCount, meta: "100% profile + 3 docs" },
                        { label: "Approval", value: needsApprovalCount, meta: "Waiting for admin" },
                        { label: "In Queue", value: queueCount, meta: "Active Job Finder workers" },
                        { label: "Paid", value: paidWorkersCount, meta: "Entry fee confirmed" },
                    ]}
                />

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                <Users size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[#18181b]">Inspect workspace</h2>
                                <p className="text-sm text-[#71717a]">Read-only worker workspace with the exact user data.</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-[#57534e]">
                            Use the <span className="font-semibold text-[#18181b]">Inspect workspace</span> action when you want to see what the worker sees.
                        </p>
                    </div>
                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                                <BadgeCheck size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[#18181b]">Case view</h2>
                                <p className="text-sm text-[#71717a]">Admin-only detail view for approvals, documents, and payments.</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-[#57534e]">
                            Use <span className="font-semibold text-[#18181b]">Open case</span> when you need admin actions, review tools, or payment history.
                        </p>
                    </div>
                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
                                <ListOrdered size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[#18181b]">Current focus</h2>
                                <p className="text-sm text-[#71717a]">The filter pills below drive the list and table count.</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-[#57534e]">
                            {filter === "all"
                                ? "You are looking at the full worker registry."
                                : `You are focused on ${filterLabel.toLowerCase()} workers right now.`}
                        </p>
                    </div>
                </section>

                <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-[#18181b]">Worker filters</h2>
                            <p className="text-sm text-[#71717a]">
                                {filter !== 'all' ? `${filterLabel} (${filteredUsers.length})` : `${activeAuthUsers.length} registered workers`}
                            </p>
                        </div>
                        <div className="rounded-full border border-[#ebe7df] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                            Filters update the table below
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        <FilterTab href="/admin/workers" label="All" active={filter === 'all'} color="slate" />
                        <FilterTab href="/admin/workers?filter=NEW" label="New" active={filter === 'NEW'} color="slate" />
                        <FilterTab href="/admin/workers?filter=VERIFIED" label="Verified" active={filter === 'VERIFIED'} color="emerald" />
                        <FilterTab href="/admin/workers?filter=APPROVED" label="Approved" active={filter === 'APPROVED'} color="indigo" />
                        <FilterTab href="/admin/workers?filter=IN_QUEUE" label="In Queue" active={filter === 'IN_QUEUE'} color="amber" />
                        <FilterTab href="/admin/workers?filter=OFFER_PENDING" label="Offer" active={filter === 'OFFER_PENDING' || filter === 'OFFER_ACCEPTED'} color="orange" />
                        <FilterTab href="/admin/workers?filter=VISA_PROCESS_STARTED" label="Visa" active={filter === 'VISA_PROCESS_STARTED' || filter === 'VISA_APPROVED'} color="green" />
                        <FilterTab href="/admin/workers?filter=PLACED" label="Placed" active={filter === 'PLACED'} color="green" />
                        <FilterTab href="/admin/workers?filter=REJECTED" label="Rejected" active={filter === 'REJECTED'} color="red" />
                        <FilterTab href="/admin/workers?filter=REFUND_FLAGGED" label="Refund" active={filter === 'REFUND_FLAGGED'} color="rose" />
                        <FilterTab href="/admin/workers?filter=needs_approval" label="Needs Approval" icon={<Hourglass size={12} />} active={filter === 'needs_approval'} color="purple" />
                    </div>
                </div>

                <WorkersTableClient
                    data={filteredUsers.map((authUser: any) => {
                        const profile = profileMap.get(authUser.id);
                        const { workerRecord, userDocs, verifiedDocs, profileCompletion } = getUserStats(authUser.id, authUser);

                        return {
                            id: authUser.id,
                            profile_id: authUser.id,
                            name: profile?.full_name || authUser.user_metadata?.full_name || "No Name",
                            email: authUser.email,
                            avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${(profile?.full_name || "User").replace(' ', '+')}&background=random`,
                            created_at: authUser.created_at,
                            status: workerRecord?.status || "NEW",
                            phone: workerRecord?.phone || "",
                            nationality: workerRecord?.nationality || "",
                            job: workerRecord?.preferred_job || "",
                            completion: profileCompletion,
                            docsCount: userDocs.length,
                            verifiedDocs: verifiedDocs,
                            adminApproved: !!workerRecord?.admin_approved,
                            isCurrentUser: authUser.id === user.id,
                            entryFeePaid: !!workerRecord?.entry_fee_paid,
                            daysUntilDeletion: profileCompletion < 100
                                ? Math.max(0, 30 - Math.floor((nowMs - new Date(authUser.created_at).getTime()) / (1000 * 60 * 60 * 24)))
                                : null,
                            authProvider: authUser.app_metadata?.provider || 'email',
                            paymentState: workerRecord?.entry_fee_paid ? "Paid" : workerRecord?.status === "IN_QUEUE" ? "In Queue" : "Unpaid",
                        } satisfies WorkerTableRow;
                    })}
                    currentFilter={filter}
                />
            </div>
        </AppShell>
    );
}

// ─── Components ──────────────────────────────────────────────

function FilterTab({ href, label, active, color, icon }: {
    href: string; label: string; active: boolean; color: string; icon?: React.ReactNode;
}) {
    const colorMap: Record<string, { activeBg: string; activeText: string }> = {
        slate: { activeBg: "bg-slate-100", activeText: "text-slate-800" },
        emerald: { activeBg: "bg-emerald-100", activeText: "text-emerald-700" },
        amber: { activeBg: "bg-amber-100", activeText: "text-amber-700" },
        orange: { activeBg: "bg-orange-100", activeText: "text-orange-700" },
        green: { activeBg: "bg-green-100", activeText: "text-green-700" },
        red: { activeBg: "bg-red-100", activeText: "text-red-700" },
        rose: { activeBg: "bg-rose-100", activeText: "text-rose-700" },
        purple: { activeBg: "bg-purple-100", activeText: "text-purple-700" },
    };
    const c = colorMap[color] || colorMap.slate;

    return (
        <Link href={href}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active ? `${c.activeBg} ${c.activeText}` : 'text-slate-500 hover:bg-slate-50'
                }`}
        >
            {icon && <span className="mr-1 inline-block align-text-bottom">{icon}</span>}
            {label}
        </Link>
    );
}
