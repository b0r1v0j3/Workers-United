import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";

export default async function EmployersPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const adminClient = createAdminClient();

    // Fetch employers with their profile info
    const { data: employers } = await adminClient
        .from("employers")
        .select(`
            id,
            profile_id,
            company_name,
            pib,
            company_address,
            accommodation_address,
            contact_phone,
            workers_needed,
            job_description,
            salary_range,
            work_location,
            status,
            created_at,
            profiles!inner(email, full_name)
        `)
        .order("created_at", { ascending: false });

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">All Employers</h1>
                    <p className="text-slate-500">View and manage employer accounts.</p>
                </div>

                {/* Employers Table */}
                <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">#</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Company</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Contact</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Workers Needed</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employers?.map((employer: any, index: number) => (
                                    <tr key={employer.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-5 text-slate-500 font-medium">{index + 1}</td>
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-slate-900">{employer.company_name || "N/A"}</div>
                                            <div className="text-xs text-slate-500">PIB: {employer.pib || "N/A"}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="font-medium text-slate-900">{employer.profiles?.full_name || "N/A"}</div>
                                            <div className="text-xs text-slate-500">{employer.profiles?.email}</div>
                                            <div className="text-xs text-slate-400">{employer.contact_phone}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-blue-600 font-bold text-lg">{employer.workers_needed || 0}</div>
                                            <div className="text-xs text-slate-500 max-w-[200px] truncate">{employer.job_description || "-"}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-slate-900 font-medium">{employer.work_location || "N/A"}</div>
                                            <div className="text-xs text-slate-500">{employer.salary_range || "-"}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${employer.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                employer.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                    'bg-gray-100 text-gray-600 border border-gray-200'
                                                }`}>
                                                {employer.status || "pending"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {(!employers || employers.length === 0) && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">
                                            No employers found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
