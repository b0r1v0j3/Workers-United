import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import AppShell from "@/components/AppShell";
import { Phone, FileText, CheckCircle2, Clock } from "lucide-react";
import { getWorkerCompletion } from "@/lib/profile-completion";

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

    // Fetch ALL auth users
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers();
    if (authError) {
        console.error("Failed to fetch auth users:", authError);
    }
    const allAuthUsers = authData?.users || [];

    // Fetch all candidates
    const { data: candidates } = await adminClient
        .from("candidates")
        .select("profile_id, status, phone, nationality, preferred_job, signature_url, onboarding_completed, current_country, gender, date_of_birth, birth_country, birth_city, citizenship, marital_status, passport_number, passport_issued_by, passport_issue_date, passport_expiry_date, lives_abroad, previous_visas, admin_approved, admin_approved_at");

    // Fetch all profiles (include user_type to filter)
    const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name, first_name, last_name, avatar_url, user_type");

    // Fetch all documents
    const { data: allDocs } = await adminClient
        .from("candidate_documents")
        .select("user_id, document_type, status");

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

        // DEBUG: Trace Suresh's data
        if (p?.email?.includes('suresh')) {
            console.log('[DEBUG-SURESH] userId:', userId);
            console.log('[DEBUG-SURESH] profile:', JSON.stringify(p));
            console.log('[DEBUG-SURESH] candidate keys:', candidate ? Object.keys(candidate).filter(k => (candidate as any)[k] != null) : 'NO CANDIDATE');
            console.log('[DEBUG-SURESH] candidate data:', JSON.stringify(candidate));
            console.log('[DEBUG-SURESH] docs:', JSON.stringify(userDocs));
            console.log('[DEBUG-SURESH] result:', JSON.stringify(result));
        }

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
                        <FilterTab href="/admin/workers?filter=needs_approval" label="⏳ Needs Approval" active={filter === 'needs_approval'} color="purple" />
                    </div>
                </div>

                {/* Users Grid */}
                <div className="grid grid-cols-1 gap-4">
                    {filteredUsers.map((authUser: any) => {
                        const profile = profileMap.get(authUser.id);
                        const { candidate, userDocs, verifiedDocs, profileCompletion } = getUserStats(authUser.id);
                        const isCurrentUser = authUser.id === user.id;

                        // Progression badges
                        const hasProfile = !!profile;
                        const hasCandidate = !!candidate;
                        const hasDocs = userDocs.length > 0;
                        const isVerified = verifiedDocs >= 3;

                        return (
                            <div key={authUser.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all group">
                                <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                        <img
                                            src={profile?.avatar_url || authUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${(profile?.full_name || "User").replace(' ', '+')}&background=random`}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Main Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-slate-900 truncate">
                                                    {profile?.full_name || authUser.user_metadata?.full_name || "No Name"}
                                                    {isCurrentUser && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">You</span>}
                                                </h3>
                                                <div className="text-sm text-slate-500 truncate">{authUser.email}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/admin/workers/${authUser.id}`}
                                                    className="text-sm font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    View
                                                </Link>
                                                {!isCurrentUser && (
                                                    <DeleteUserButton userId={authUser.id} userName={profile?.full_name || authUser.email} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Status Row */}
                                        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs md:text-sm">
                                            {hasCandidate && candidate.nationality && (
                                                <span className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                                    🌍 {candidate.nationality}
                                                </span>
                                            )}
                                            {hasCandidate && candidate.phone && (
                                                <span className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                                    <Phone size={12} /> {candidate.phone}
                                                </span>
                                            )}

                                            {/* Candidate Status Badge */}
                                            {hasCandidate && candidate.status && (
                                                <StatusBadge status={candidate.status} />
                                            )}

                                            {/* Admin Approval Badge */}
                                            {hasCandidate && profileCompletion === 100 && !candidate.admin_approved && (
                                                <span className="flex items-center gap-1 px-2 py-1 rounded font-medium bg-purple-50 text-purple-700">
                                                    ⏳ Needs Approval
                                                </span>
                                            )}

                                            {/* Doc Status Badge */}
                                            {hasDocs ? (
                                                <span className={`flex items-center gap-1 px-2 py-1 rounded font-medium ${isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                    {isVerified ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                    {verifiedDocs}/3 Docs
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                    <FileText size={12} /> No Docs
                                                </span>
                                            )}
                                        </div>

                                        {/* Profile Completion Bar */}
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden max-w-[200px]">
                                                <div
                                                    className={`h-full rounded-full transition-all ${profileCompletion === 100 ? 'bg-emerald-500' :
                                                        profileCompletion >= 50 ? 'bg-blue-500' :
                                                            profileCompletion > 0 ? 'bg-amber-500' : 'bg-slate-300'
                                                        }`}
                                                    style={{ width: `${profileCompletion}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-semibold ${profileCompletion === 100 ? 'text-emerald-600' :
                                                profileCompletion >= 50 ? 'text-blue-600' :
                                                    profileCompletion > 0 ? 'text-amber-600' : 'text-slate-400'
                                                }`}>
                                                {profileCompletion}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {activeAuthUsers.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            No users found.
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

// ─── Components ──────────────────────────────────────────────

function FilterTab({ href, label, active, color }: {
    href: string; label: string; active: boolean; color: string;
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
