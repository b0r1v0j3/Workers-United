import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import AppShell from "@/components/AppShell";
import { Phone, FileText, CheckCircle2, Clock } from "lucide-react";

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
    const params = await searchParams;
    const filter = params?.filter || 'all';
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const isOwner = isGodModeUser(user.email);

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== 'admin' && !isOwner) {
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
        .select("profile_id, status, phone, nationality, preferred_job, signature_url, onboarding_completed, current_country");

    // Fetch all profiles
    const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name, first_name, last_name, avatar_url");

    // Fetch all documents
    const { data: allDocs } = await adminClient
        .from("candidate_documents")
        .select("user_id, document_type, status");

    // Create lookup maps
    const candidateMap = new Map(candidates?.map(c => [c.profile_id, c]) || []);
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Calculate user progress
    const getUserStats = (userId: string) => {
        const candidate = candidateMap.get(userId);
        const userDocs = allDocs?.filter(d => d.user_id === userId) || [];
        const verifiedDocs = userDocs.filter(d => d.status === 'verified').length;
        return { candidate, userDocs, verifiedDocs };
    };

    // Show ALL auth users so admin can manage/delete any account
    const activeAuthUsers = allAuthUsers;

    // Apply filter
    let filteredUsers = activeAuthUsers;
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
    }

    const filterLabel = filter === 'pending' ? 'Pending Docs' : filter === 'verified' ? 'Verified Docs' : 'All';

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Workers</h1>
                            <p className="text-slate-500">
                                {filter !== 'all' ? `${filterLabel} (${filteredUsers.length})` : `Manage registered workers (${activeAuthUsers.length})`}
                            </p>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mt-4">
                        <Link href="/admin/workers" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>All</Link>
                        <Link href="/admin/workers?filter=pending" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-amber-100 text-amber-700' : 'text-slate-600 hover:bg-slate-100'}`}>Pending Docs</Link>
                        <Link href="/admin/workers?filter=verified" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>Verified</Link>
                    </div>
                </div>

                {/* Users Grid */}
                <div className="grid grid-cols-1 gap-4">
                    {filteredUsers.map((authUser: any) => {
                        const profile = profileMap.get(authUser.id);
                        const { candidate, userDocs, verifiedDocs } = getUserStats(authUser.id);
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
