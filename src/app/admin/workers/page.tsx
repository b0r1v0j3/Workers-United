import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import AppShell from "@/components/AppShell";
import { Hourglass } from "lucide-react";
import { getWorkerCompletion } from "@/lib/profile-completion";
import WorkersTableClient, { WorkerTableRow } from "./WorkersTableClient";

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
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

    // Fetch all candidates
    const { data: candidates } = await adminClient
        .from("candidates")
        .select("*");

    // Fetch all profiles
    const { data: profiles } = await adminClient
        .from("profiles")
        .select("*");

    // Fetch all documents
    const { data: allDocs } = await adminClient
        .from("candidate_documents")
        .select("*");

    // Create lookup maps
    const candidateMap = new Map(candidates?.map(c => [c.profile_id, c]) || []);
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
    const getUserStats = (userId: string) => {
        const candidate = candidateMap.get(userId);
        const p = profileMap.get(userId);
        const userDocs = (allDocs?.filter(d => d.user_id === userId) || []) as { document_type: string }[];
        const verifiedDocs = userDocs.filter((d: any) => d.status === 'verified').length;

        const result = getWorkerCompletion({
            profile: p || null,
            candidate: candidate || null,
            documents: userDocs,
        });

        return { candidate, userDocs, verifiedDocs, profileCompletion: result.completion };
    };

    // Filter: only show workers (exclude employers and admins)
    const activeAuthUsers = allAuthUsers.filter((u: any) => !employerProfileIds.has(u.id));

    // Apply filter
    let filteredUsers = activeAuthUsers;
    const statusFilters = ['NEW', 'PROFILE_COMPLETE', 'PENDING_APPROVAL', 'VERIFIED', 'IN_QUEUE', 'OFFER_PENDING', 'OFFER_ACCEPTED', 'VISA_PROCESS_STARTED', 'VISA_APPROVED', 'PLACED', 'REJECTED', 'REFUND_FLAGGED'];

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
            const candidate = candidateMap.get(u.id);
            const { profileCompletion } = getUserStats(u.id);
            return candidate && profileCompletion === 100 && !candidate.admin_approved;
        });
    } else if (statusFilters.includes(filter)) {
        // Status-based filter from pipeline badges
        filteredUsers = activeAuthUsers.filter((u: any) => {
            const candidate = candidateMap.get(u.id);
            return candidate?.status === filter;
        });
    }

    const filterLabels: Record<string, string> = {
        all: 'All', pending: 'Pending Docs', verified: 'Verified Docs', needs_approval: 'Needs Approval',
        NEW: 'New', PROFILE_COMPLETE: 'Profile Complete', PENDING_APPROVAL: 'Pending Approval',
        VERIFIED: 'Verified', IN_QUEUE: 'In Queue', OFFER_PENDING: 'Offer Pending',
        OFFER_ACCEPTED: 'Offer Accepted', VISA_PROCESS_STARTED: 'Visa Started',
        VISA_APPROVED: 'Visa Approved', PLACED: 'Placed', REJECTED: 'Rejected', REFUND_FLAGGED: 'Refund',
    };
    const filterLabel = filterLabels[filter] || 'All';

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Workers</h1>
                            <p className="text-sm text-slate-500">
                                {filter !== 'all' ? `${filterLabel} (${filteredUsers.length})` : `${activeAuthUsers.length} registered`}
                            </p>
                        </div>
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex flex-wrap gap-1.5">
                        <FilterTab href="/admin/workers" label="All" active={filter === 'all'} color="slate" />
                        <FilterTab href="/admin/workers?filter=NEW" label="New" active={filter === 'NEW'} color="slate" />
                        <FilterTab href="/admin/workers?filter=VERIFIED" label="Verified" active={filter === 'VERIFIED'} color="emerald" />
                        <FilterTab href="/admin/workers?filter=IN_QUEUE" label="In Queue" active={filter === 'IN_QUEUE'} color="amber" />
                        <FilterTab href="/admin/workers?filter=OFFER_PENDING" label="Offer" active={filter === 'OFFER_PENDING' || filter === 'OFFER_ACCEPTED'} color="orange" />
                        <FilterTab href="/admin/workers?filter=VISA_PROCESS_STARTED" label="Visa" active={filter === 'VISA_PROCESS_STARTED' || filter === 'VISA_APPROVED'} color="green" />
                        <FilterTab href="/admin/workers?filter=PLACED" label="Placed" active={filter === 'PLACED'} color="green" />
                        <FilterTab href="/admin/workers?filter=REJECTED" label="Rejected" active={filter === 'REJECTED'} color="red" />
                        <FilterTab href="/admin/workers?filter=REFUND_FLAGGED" label="Refund" active={filter === 'REFUND_FLAGGED'} color="rose" />
                        <FilterTab href="/admin/workers?filter=needs_approval" label="Needs Approval" icon={<Hourglass size={12} />} active={filter === 'needs_approval'} color="purple" />
                    </div>
                </div>

                {/* Users Table */}
                <WorkersTableClient
                    data={filteredUsers.map((authUser: any) => {
                        const profile = profileMap.get(authUser.id);
                        const { candidate, userDocs, verifiedDocs, profileCompletion } = getUserStats(authUser.id);

                        return {
                            id: authUser.id,
                            profile_id: authUser.id,
                            name: profile?.full_name || authUser.user_metadata?.full_name || "No Name",
                            email: authUser.email,
                            avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${(profile?.full_name || "User").replace(' ', '+')}&background=random`,
                            created_at: authUser.created_at,
                            status: candidate?.status || "NEW",
                            phone: candidate?.phone || "",
                            nationality: candidate?.nationality || "",
                            job: candidate?.preferred_job || "",
                            completion: profileCompletion,
                            docsCount: userDocs.length,
                            verifiedDocs: verifiedDocs,
                            adminApproved: !!candidate?.admin_approved,
                            isCurrentUser: authUser.id === user.id
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
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${active ? `${c.activeBg} ${c.activeText}` : 'text-slate-500 hover:bg-slate-50'
                }`}
        >
            {icon && <span className="mr-1 inline-block align-text-bottom">{icon}</span>}
            {label}
        </Link>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        NEW: "bg-slate-100 text-slate-600",
        PROFILE_COMPLETE: "bg-blue-100 text-blue-700",
        PENDING_APPROVAL: "bg-indigo-100 text-indigo-700",
        VERIFIED: "bg-emerald-100 text-emerald-700",
        IN_QUEUE: "bg-amber-100 text-amber-700",
        OFFER_PENDING: "bg-orange-100 text-orange-700",
        OFFER_ACCEPTED: "bg-orange-100 text-orange-700",
        VISA_PROCESS_STARTED: "bg-green-100 text-green-700",
        VISA_APPROVED: "bg-green-100 text-green-700",
        PLACED: "bg-green-100 text-green-800",
        REJECTED: "bg-red-100 text-red-700",
        REFUND_FLAGGED: "bg-rose-100 text-rose-700",
    };
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
            {status?.replace(/_/g, ' ') || 'UNKNOWN'}
        </span>
    );
}
