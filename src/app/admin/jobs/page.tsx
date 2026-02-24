import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import JobsMatchClient from "./JobsMatchClient";

export default async function AdminJobsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== 'admin' && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const adminClient = createAdminClient();

    // Get all job requests
    const { data: jobRequests } = await adminClient
        .from("job_requests")
        .select(`
            *,
            employers(company_name, profile_id, profiles(email))
        `)
        .order("created_at", { ascending: false })
        .limit(50);

    // Get all IN_QUEUE candidates for matching
    const { data: queueCandidates } = await adminClient
        .from("candidates")
        .select(`
            id, profile_id, status, preferred_job, nationality, phone, queue_joined_at,
            profiles(full_name, email, avatar_url)
        `)
        .eq("status", "IN_QUEUE");

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-200 p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Smart Match Hub</h1>
                        <p className="text-slate-500 text-sm mt-1">Select an open job request to find perfectly matched candidates from the queue.</p>
                    </div>
                    <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                        {queueCandidates?.length || 0} Workers waitlisted
                    </div>
                </div>

                <JobsMatchClient jobs={jobRequests || []} queue={queueCandidates || []} />
            </div>
        </AppShell>
    );
}

