import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { DeleteUserButton } from "@/components/DeleteUserButton";

export default async function CandidatesPage() {
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
        redirect("/dashboard");
    }

    // Use admin client (service role)
    let adminClient;
    let usingServiceRole = false;
    try {
        adminClient = createAdminClient();
        usingServiceRole = true;
    } catch (err: any) {
        console.warn("Service role key not configured:", err);
        adminClient = supabase;
    }

    // Fetch ALL auth users
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers();
    const allAuthUsers = authData?.users || [];

    // Fetch all candidates
    const { data: candidates } = await adminClient
        .from("candidates")
        .select("profile_id, status, phone, nationality, preferred_job, signature_url, onboarding_completed");

    // Fetch all profiles
    const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name, first_name, last_name");

    // Fetch all documents
    const { data: allDocs } = await adminClient
        .from("candidate_documents")
        .select("user_id, document_type, status");

    // Create lookup maps
    const candidateMap = new Map(candidates?.map(c => [c.profile_id, c]) || []);
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Calculate user progress
    const getUserProgress = (userId: string) => {
        const hasProfile = profileMap.has(userId);
        const candidate = candidateMap.get(userId);
        const hasCandidate = !!candidate;
        const userDocs = allDocs?.filter(d => d.user_id === userId) || [];
        const verifiedDocs = userDocs.filter(d => d.status === 'verified').length;
        const hasSignature = !!candidate?.signature_url;
        const onboardingComplete = !!candidate?.onboarding_completed;

        let progress = 'Registered';
        let progressColor = 'bg-gray-100 text-gray-600';
        let progressPercent = 20;

        if (hasProfile && hasCandidate) {
            progress = 'Profile Created';
            progressColor = 'bg-blue-100 text-blue-700';
            progressPercent = 40;
        }
        if (userDocs.length > 0) {
            progress = `${userDocs.length} Doc(s) Uploaded`;
            progressColor = 'bg-yellow-100 text-yellow-700';
            progressPercent = 60;
        }
        if (verifiedDocs >= 3) {
            progress = 'Docs Verified ✓';
            progressColor = 'bg-green-100 text-green-700';
            progressPercent = 80;
        }
        if (verifiedDocs >= 3 && hasSignature) {
            progress = 'Ready ✓✓';
            progressColor = 'bg-emerald-100 text-emerald-700';
            progressPercent = 100;
        }

        return { progress, progressColor, progressPercent, verifiedDocs, hasCandidate, hasProfile };
    };

    return (
        <div className="min-h-screen bg-[#f1f5f9] font-montserrat">
            {/* Header */}
            <nav className="bg-[#183b56] px-5 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="/logo.png" alt="Workers United" width={64} height={64} className="" />
                        <span className="font-bold text-white text-lg">Admin Portal</span>
                    </Link>
                    <span className="text-gray-400">/</span>
                    <span className="text-white font-medium">All Users</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[#2f6fed] text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                        God Mode
                    </div>
                    <a href="/auth/signout" className="text-sm font-semibold hover:opacity-80 transition-colors" style={{ color: 'white' }}>
                        Logout
                    </a>
                </div>
            </nav>

            {/* Debug Banner */}
            <div className="bg-yellow-100 border-b border-yellow-300 px-5 py-3 text-sm">
                <strong>DEBUG:</strong>{" "}
                Service Role: <span className={usingServiceRole ? "text-green-700" : "text-red-700"}>{usingServiceRole ? "YES ✓" : "NO ✗"}</span>{" "}
                | Auth Users: <strong>{allAuthUsers.length}</strong>{" "}
                | Candidates: <strong>{candidates?.length ?? 0}</strong>{" "}
                | Profiles: <strong>{profiles?.length ?? 0}</strong>{" "}
                {authError && <span className="text-red-600">| Auth Error: {authError.message}</span>}
            </div>

            <div className="max-w-[1400px] mx-auto px-5 py-10">
                <div className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-[#1e293b]">All Users</h1>
                        <p className="text-[#64748b] mt-1 font-medium">View all registered users and their progress</p>
                    </div>
                    <Link href="/admin" className="text-[#2f6fed] font-semibold hover:underline">
                        ← Back to Dashboard
                    </Link>
                </div>

                {/* User Table */}
                <div className="bg-white rounded-[16px] overflow-hidden shadow-sm border border-[#dde3ec]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f8fafc] border-b border-[#dde3ec]">
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">#</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Progress</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Documents</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f5f9]">
                                {allAuthUsers.map((authUser: any, index: number) => {
                                    const profile = profileMap.get(authUser.id);
                                    const candidate = candidateMap.get(authUser.id);
                                    const { progress, progressColor, verifiedDocs, hasCandidate } = getUserProgress(authUser.id);
                                    const isCurrentUser = authUser.id === user.id;

                                    return (
                                        <tr key={authUser.id} className="hover:bg-[#fbfcfe] transition-colors">
                                            <td className="px-6 py-5 text-[#64748b] font-medium">{index + 1}</td>
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-[#1e293b]">
                                                    {profile?.full_name || authUser.user_metadata?.full_name || "No Name"}
                                                    {isCurrentUser && <span className="ml-2 text-xs text-blue-500">(You)</span>}
                                                </div>
                                                <div className="text-[13px] text-[#64748b]">{authUser.email}</div>
                                                <div className="text-[11px] text-[#94a3b8] font-mono">{authUser.id.substring(0, 8)}...</div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`text-[11px] px-3 py-1 rounded-full font-bold ${progressColor}`}>
                                                    {progress}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                {hasCandidate ? (
                                                    <div className="text-[13px] font-medium">
                                                        <span className={verifiedDocs >= 3 ? "text-green-600" : "text-gray-500"}>
                                                            {verifiedDocs}/3 Verified
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[#94a3b8] text-[13px] italic">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-[13px] text-[#64748b]">
                                                    {candidate?.phone || "-"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex gap-2">
                                                    <Link
                                                        href={`/admin/candidates/${authUser.id}`}
                                                        className="bg-[#2f6fed] px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-[#1e5cd6] transition-colors"
                                                        style={{ color: 'white' }}
                                                    >
                                                        View
                                                    </Link>
                                                    <DeleteUserButton userId={authUser.id} userName={profile?.full_name || authUser.email} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {allAuthUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-[#64748b] italic">
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
