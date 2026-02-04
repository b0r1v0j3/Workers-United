import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";

export default async function EmployersPage() {
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

    // Fetch employers with their profile info
    const { data: employers } = await supabase
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
        <div className="min-h-screen bg-[#f1f5f9] font-montserrat">
            {/* Header */}
            <nav className="bg-[#183b56] px-5 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="/logo.png" alt="Workers United" width={64} height={64} className="brightness-0 invert rounded" />
                        <span className="font-bold text-white text-lg">Admin Portal</span>
                    </Link>
                    <span className="text-gray-400">/</span>
                    <span className="text-white font-medium">Employers</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[#2f6fed] text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                        God Mode
                    </div>
                    <form action="/auth/signout" method="post">
                        <button type="submit" className="text-gray-300 text-sm font-semibold hover:text-white transition-colors">
                            Logout
                        </button>
                    </form>
                </div>
            </nav>

            <div className="max-w-[1400px] mx-auto px-5 py-10">
                <div className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-[#1e293b]">All Employers</h1>
                        <p className="text-[#64748b] mt-1 font-medium">View and manage employer accounts.</p>
                    </div>
                    <Link href="/admin" className="text-[#2f6fed] font-semibold hover:underline">
                        ← Back to Dashboard
                    </Link>
                </div>

                {/* Employers Table */}
                <div className="bg-white rounded-[16px] overflow-hidden shadow-sm border border-[#dde3ec]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f8fafc] border-b border-[#dde3ec]">
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">#</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Company</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Contact</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Workers Needed</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-4 text-[12px] font-bold text-[#183b56] uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f5f9]">
                                {employers?.map((employer: any, index: number) => (
                                    <tr key={employer.id} className="hover:bg-[#fbfcfe] transition-colors">
                                        <td className="px-6 py-5 text-[#64748b] font-medium">{index + 1}</td>
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-[#1e293b]">{employer.company_name || "N/A"}</div>
                                            <div className="text-[13px] text-[#64748b]">PIB: {employer.pib || "N/A"}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="font-medium text-[#1e293b]">{employer.profiles?.full_name || "N/A"}</div>
                                            <div className="text-[13px] text-[#64748b]">{employer.profiles?.email}</div>
                                            <div className="text-[12px] text-[#94a3b8]">{employer.contact_phone}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-[#2f6fed] font-bold text-lg">{employer.workers_needed || 0}</div>
                                            <div className="text-[12px] text-[#64748b] max-w-[200px] truncate">{employer.job_description || "-"}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-[#1e293b] font-medium">{employer.work_location || "N/A"}</div>
                                            <div className="text-[12px] text-[#64748b]">{employer.salary_range || "-"}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase ${employer.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' :
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
                                        <td colSpan={6} className="px-6 py-10 text-center text-[#64748b] italic">
                                            No employers found.
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
