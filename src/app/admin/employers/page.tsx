import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import { Building2, MapPin, Phone, Users, Globe } from "lucide-react";

export default async function EmployersPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const adminClient = createAdminClient();

    // Fetch employers and profiles separately (no FK dependency)
    const { data: rawEmployers, error: empError } = await adminClient
        .from("employers")
        .select("*");
    if (empError) console.error("Employers fetch error:", empError);

    const { data: allProfiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name");

    const profileLookup = new Map(allProfiles?.map((p: any) => [p.id, p]) || []);
    const employers = (rawEmployers || []).map((e: any) => ({
        ...e,
        profiles: profileLookup.get(e.profile_id) || { email: "Unknown", full_name: "Unknown" }
    }));

    // Count jobs per employer
    const { data: jobCounts } = await adminClient
        .from("job_requests")
        .select("employer_id");

    const jobCountMap = new Map<string, number>();
    jobCounts?.forEach((j: any) => {
        jobCountMap.set(j.employer_id, (jobCountMap.get(j.employer_id) || 0) + 1);
    });

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Employers</h1>
                    <p className="text-slate-500">View registered employers ({employers?.length || 0}). Job approvals are managed in the Jobs section.</p>
                </div>

                {/* Employers List */}
                <div className="grid grid-cols-1 gap-4">
                    {employers?.map((employer: any) => (
                        <div key={employer.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-blue-200 transition-all">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Company Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                                            {(employer.company_name || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-base">{employer.company_name || "No Name"}</h3>
                                            <div className="text-sm text-slate-500">{employer.profiles?.full_name} • {employer.profiles?.email}</div>
                                        </div>
                                    </div>

                                    {/* Details Row */}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-600">
                                        {employer.company_registration_number && (
                                            <span className="flex items-center gap-1"><Building2 size={14} /> Reg: {employer.company_registration_number}</span>
                                        )}
                                        {employer.country && (
                                            <span className="flex items-center gap-1"><MapPin size={14} /> {employer.city ? `${employer.city}, ` : ""}{employer.country}</span>
                                        )}
                                        {employer.contact_phone && (
                                            <span className="flex items-center gap-1"><Phone size={14} /> {employer.contact_phone}</span>
                                        )}
                                        {employer.company_size && (
                                            <span className="flex items-center gap-1"><Users size={14} /> {employer.company_size}</span>
                                        )}
                                        {employer.website && (
                                            <span className="flex items-center gap-1"><Globe size={14} /> {employer.website}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Job Count */}
                                <div className="shrink-0 text-center">
                                    <div className="text-2xl font-bold text-blue-600">{jobCountMap.get(employer.id) || 0}</div>
                                    <div className="text-xs text-slate-500">Jobs Posted</div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {(!employers || employers.length === 0) && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400 italic">
                            No employers registered yet.
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
