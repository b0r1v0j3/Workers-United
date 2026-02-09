"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EMPLOYER_INDUSTRIES, COMPANY_SIZES, EUROPEAN_COUNTRIES } from "@/lib/constants";
import {
    Building2, MapPin, Globe, Phone, Calendar, FileText, Hash, Users,
    Pencil, Briefcase, CheckCircle2, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
interface EmployerProfile {
    id: string;
    company_name: string;
    tax_id: string | null;
    company_registration_number: string | null;
    company_address: string | null;
    contact_phone: string | null;
    status: string;
    website: string | null;
    industry: string | null;
    company_size: string | null;
    founded_year: string | null;
    description: string | null;
    country: string | null;
    city: string | null;
}

interface JobRequest {
    id: string;
    title: string;
    description: string | null;
    industry: string;
    positions_count: number;
    positions_filled: number;
    work_city: string | null;
    salary_rsd: number | null;
    accommodation_address: string | null;
    work_schedule: string | null;
    contract_duration_months: number | null;
    experience_required_years: number | null;
    destination_country: string;
    status: string;
    created_at: string;
}

// ─── Company form type ──────────────────────────────────────────
interface CompanyForm {
    company_name: string;
    tax_id: string;
    company_registration_number: string;
    company_address: string;
    contact_phone: string;
    country: string;
    city: string;
    website: string;
    industry: string;
    company_size: string;
    founded_year: string;
    description: string;
}

// ─── Shared styles ──────────────────────────────────────────────
const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors";
const labelClass = "block text-[13px] font-medium text-gray-700 mb-1.5";

// ─── Helper: Calculate Completion ───────────────────────────────
function calculateCompletion(form: CompanyForm) {
    const required: (keyof CompanyForm)[] = [
        "company_name", "tax_id", "company_registration_number", "company_address",
        "contact_phone", "country", "city", "company_size", "founded_year"
    ];
    const filled = required.filter(key => {
        const val = form[key];
        return val && val.trim().length > 0;
    }).length;
    return Math.round((filled / required.length) * 100);
}

type TabType = "company" | "post-job" | "jobs";

// ─── Main Component ─────────────────────────────────────────────
export default function EmployerProfilePage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: Record<string, string> } | null>(null);
    const [employer, setEmployer] = useState<EmployerProfile | null>(null);
    const [jobs, setJobs] = useState<JobRequest[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("company");

    // ─ Company info state
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [companyAlert, setCompanyAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [companyForm, setCompanyForm] = useState({
        company_name: "", tax_id: "", company_registration_number: "",
        company_address: "", contact_phone: "", country: "", city: "",
        website: "", industry: "", company_size: "", founded_year: "", description: "",
    });

    // ─ Job posting state
    const [postingJob, setPostingJob] = useState(false);
    const [jobAlert, setJobAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const emptyJob = {
        title: "", description: "", industry: "",
        positions_count: "1", salary_rsd: "60000",
        work_city: "", accommodation_address: "", different_accommodation: false,
        work_schedule: "Full-time (40 hours/week)",
        contract_duration_months: "12", experience_required_years: "0",
    };
    const [jobForm, setJobForm] = useState({ ...emptyJob });

    // ─ Edit job state
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [editJobForm, setEditJobForm] = useState({ ...emptyJob });
    const [savingJob, setSavingJob] = useState(false);
    const [editJobError, setEditJobError] = useState<string | null>(null);
    const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<string | null>(null);

    // ─── Fetch data ─────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) { router.replace("/login"); return; }
        setUser(u);

        const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", u.id).single();
        if (profile?.user_type !== "employer") { router.replace("/profile/worker"); return; }

        const { data: emp } = await supabase.from("employers").select("*").eq("profile_id", u.id).single();
        if (emp) {
            setEmployer(emp);
            setCompanyForm({
                company_name: emp.company_name || "",
                tax_id: emp.tax_id || "",
                company_registration_number: emp.company_registration_number || "",
                company_address: emp.company_address || "",
                contact_phone: emp.contact_phone || "",
                country: emp.country || "",
                city: emp.city || "",
                website: emp.website || "",
                industry: emp.industry || "",
                company_size: emp.company_size || "",
                founded_year: emp.founded_year || "",
                description: emp.description || "",
            });
            const { data: jobData } = await supabase.from("job_requests").select("*").eq("employer_id", emp.id).order("created_at", { ascending: false });
            setJobs(jobData || []);
        } else {
            setEditing(true);
            setCompanyForm(prev => ({
                ...prev,
                company_name: u.user_metadata?.company_name || "",
            }));
        }
        setLoading(false);
    }, [supabase, router]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Company info handlers ──────────────────────────────────
    const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCompanyForm(prev => ({ ...prev, [name]: value }));
    };

    const saveCompany = async () => {
        setSaving(true);
        setCompanyAlert(null);
        try {
            if (!user) throw new Error("Not logged in");
            if (!companyForm.company_name.trim()) throw new Error("Company name is required");
            if (companyForm.company_registration_number && !/^\d{8}$/.test(companyForm.company_registration_number))
                throw new Error("Registration Number must be exactly 8 digits");
            if (companyForm.contact_phone) {
                const clean = companyForm.contact_phone.replace(/[\s\-()]/g, '');
                if (!/^\+\d{7,15}$/.test(clean)) throw new Error("Phone must start with + and country code");
            }

            const data = {
                company_name: companyForm.company_name,
                tax_id: companyForm.tax_id || null,
                company_registration_number: companyForm.company_registration_number || null,
                company_address: companyForm.company_address || null,
                contact_phone: companyForm.contact_phone ? companyForm.contact_phone.replace(/[\s\-()]/g, '') : null,
                country: companyForm.country || null,
                city: companyForm.city || null,
                website: companyForm.website || null,
                industry: companyForm.industry || null,
                company_size: companyForm.company_size || null,
                founded_year: companyForm.founded_year || null,
                description: companyForm.description || null,
            };

            if (employer) {
                const { error } = await supabase.from("employers").update(data).eq("id", employer.id);
                if (error) throw error;
            } else {
                // Ensure profiles row exists (signup trigger may have failed)
                const { error: profileErr } = await supabase.from("profiles").upsert({
                    id: user.id,
                    email: user.email || "",
                    full_name: user.user_metadata?.full_name || "",
                    user_type: "employer",
                }, { onConflict: "id" });
                if (profileErr) throw profileErr;

                const { error } = await supabase.from("employers")
                    .insert({ ...data, profile_id: user.id, status: "pending" });
                if (error) throw error;
            }

            const { data: emp } = await supabase.from("employers").select("*").eq("profile_id", user.id).single();
            if (emp) setEmployer(emp);

            setCompanyAlert({ type: "success", msg: "Company info saved!" });
            setEditing(false);
            setTimeout(() => setCompanyAlert(null), 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message
                : (typeof err === "object" && err !== null && "message" in err)
                    ? String((err as { message: unknown }).message) : "Failed to save";
            setCompanyAlert({ type: "error", msg: message });
        } finally { setSaving(false); }
    };

    const cancelEdit = () => {
        if (employer) {
            setCompanyForm({
                company_name: employer.company_name || "",
                tax_id: employer.tax_id || "",
                company_registration_number: employer.company_registration_number || "",
                company_address: employer.company_address || "",
                contact_phone: employer.contact_phone || "",
                country: employer.country || "",
                city: employer.city || "",
                website: employer.website || "",
                industry: employer.industry || "",
                company_size: employer.company_size || "",
                founded_year: employer.founded_year || "",
                description: employer.description || "",
            });
        }
        setEditing(false);
        setCompanyAlert(null);
    };

    // ─── Job handlers ───────────────────────────────────────────
    const handleJobChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setJobForm(prev => ({ ...prev, [name]: value }));
    };

    const submitJob = async () => {
        setPostingJob(true); setJobAlert(null);
        try {
            if (!jobForm.title.trim()) throw new Error("Job title is required");
            if (!jobForm.industry.trim()) throw new Error("Industry is required");
            if (!jobForm.work_city.trim()) throw new Error("Work city is required");
            if (!jobForm.accommodation_address.trim()) throw new Error("Accommodation address is required by law");

            const { error } = await supabase.from("job_requests").insert({
                employer_id: employer!.id,
                title: jobForm.title,
                description: jobForm.description || null,
                industry: jobForm.industry,
                positions_count: parseInt(jobForm.positions_count) || 1,
                salary_rsd: parseFloat(jobForm.salary_rsd) || 60000,
                work_city: jobForm.work_city,
                accommodation_address: jobForm.accommodation_address,
                work_schedule: jobForm.work_schedule,
                contract_duration_months: parseInt(jobForm.contract_duration_months) || 12,
                experience_required_years: parseInt(jobForm.experience_required_years) || 0,
                destination_country: companyForm.country || "Serbia",
                status: "open",
            });
            if (error) throw error;
            setJobForm({ ...emptyJob });
            setJobAlert({ type: "success", msg: "Job posted!" });
            setTimeout(() => setJobAlert(null), 3000);

            const { data: jobData } = await supabase.from("job_requests").select("*").eq("employer_id", employer!.id).order("created_at", { ascending: false });
            setJobs(jobData || []);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to post";
            setJobAlert({ type: "error", msg });
        } finally { setPostingJob(false); }
    };

    const startEditJob = (job: JobRequest) => {
        setEditingJobId(job.id);
        setEditJobForm({
            title: job.title, description: job.description || "",
            industry: job.industry,
            positions_count: String(job.positions_count), salary_rsd: String(job.salary_rsd || "60000"),
            work_city: job.work_city || "",
            accommodation_address: job.accommodation_address || "",
            different_accommodation: false,
            work_schedule: job.work_schedule || "Full-time (40 hours/week)",
            contract_duration_months: String(job.contract_duration_months || "12"),
            experience_required_years: String(job.experience_required_years || "0"),
        });
        setEditJobError(null);
    };

    const saveEditJob = async () => {
        setSavingJob(true); setEditJobError(null);
        try {
            const { error } = await supabase.from("job_requests").update({
                title: editJobForm.title,
                description: editJobForm.description || null,
                industry: editJobForm.industry,
                positions_count: parseInt(editJobForm.positions_count) || 1,
                salary_rsd: parseFloat(editJobForm.salary_rsd) || 60000,
                work_city: editJobForm.work_city || null,
                accommodation_address: editJobForm.accommodation_address || null,
                work_schedule: editJobForm.work_schedule,
                contract_duration_months: parseInt(editJobForm.contract_duration_months) || 12,
                experience_required_years: parseInt(editJobForm.experience_required_years) || 0,
            }).eq("id", editingJobId!);
            if (error) throw error;
            setEditingJobId(null);
            const { data: jobData } = await supabase.from("job_requests").select("*").eq("employer_id", employer!.id).order("created_at", { ascending: false });
            setJobs(jobData || []);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to save";
            setEditJobError(msg);
        } finally { setSavingJob(false); }
    };

    const deleteJob = async (jobId: string) => {
        try {
            await supabase.from("job_requests").delete().eq("id", jobId);
            setJobs(prev => prev.filter(j => j.id !== jobId));
            setConfirmDeleteJobId(null);
        } catch { /* ignore */ }
    };

    const completion = calculateCompletion(companyForm);

    if (loading) return (
        <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-[#1877f2] border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* NAVBAR */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[1100px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                        <img src="/logo.png" alt="Workers United" className="h-[60px] w-auto object-contain" />
                        <span className="font-bold text-[#1E3A5F] text-xl hidden sm:inline tracking-tight">
                            Workers United
                        </span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[#050505] hidden sm:block">
                            {companyForm.company_name || "Employer"}
                        </span>
                        <Link
                            href="/profile/settings"
                            className="w-9 h-9 bg-[#f0f2f5] rounded-full flex items-center justify-center text-[#050505] hover:bg-[#e4e6eb] transition-colors"
                            title="Account Settings"
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
                            </svg>
                        </Link>
                        <a
                            href="/auth/signout"
                            className="w-9 h-9 bg-[#f0f2f5] rounded-full flex items-center justify-center text-[#050505] hover:bg-[#e4e6eb] transition-colors"
                            title="Logout"
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="M16 13v-2H7V8l-5 4 5 4v-3z" />
                                <path d="M20 3h-9c-1.103 0-2 .897-2 2v4h2V5h9v14h-9v-4H9v4c0 1.103.897 2 2 2h9c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2z" />
                            </svg>
                        </a>
                    </div>
                </div>
            </nav>

            {/* MAIN CONTENT */}
            <div className="max-w-[900px] mx-auto px-4 py-6">

                {/* Profile Completion — show when incomplete */}
                {completion < 100 && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5 mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-[#050505]">Profile Completion</h3>
                            <span className="text-sm font-bold text-[#1877f2]">{completion}%</span>
                        </div>
                        <div className="h-2.5 bg-[#f0f2f5] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500 bg-[#1877f2]"
                                style={{ width: `${completion}%` }}
                            />
                        </div>
                        <p className="text-xs text-[#65676b] mt-2">
                            Complete your company profile to start posting job requests.
                        </p>
                    </div>
                )}

                {/* TABS */}
                <div className="bg-white rounded-lg shadow-sm border border-[#dddfe2] mb-4">
                    <div className="flex items-center px-2">
                        <div className="flex overflow-x-auto scrollbar-hide">
                            <TabButton label="Company Info" active={activeTab === 'company'} onClick={() => setActiveTab('company')} />
                            {employer && <TabButton label="Post a Job" active={activeTab === 'post-job'} onClick={() => setActiveTab('post-job')} />}
                            {employer && <TabButton label={`Jobs (${jobs.length})`} active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />}
                        </div>
                        {employer && !editing && activeTab === 'company' && (
                            <div className="ml-auto pr-2">
                                <button
                                    onClick={() => setEditing(true)}
                                    className="bg-[#1877f2] text-white px-4 py-2 rounded-md font-semibold text-sm hover:bg-[#166fe5] transition-colors flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Pencil size={14} /> Edit Profile
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ====================== COMPANY INFO TAB ====================== */}
                {activeTab === 'company' && (
                    <div className="space-y-4">
                        {/* Alert */}
                        {companyAlert && (
                            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${companyAlert.type === "success"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"}`}>
                                {companyAlert.msg}
                            </div>
                        )}

                        {editing ? (
                            /* ── Edit Mode ── */
                            <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                                <h3 className="font-bold text-[#050505] text-lg mb-4">Edit Company Information</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Company Name <span className="text-red-500">*</span></label>
                                        <input type="text" name="company_name" required value={companyForm.company_name} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., ABC Construction d.o.o." />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Tax ID <span className="text-red-500">*</span></label>
                                            <input type="text" name="tax_id" value={companyForm.tax_id} onChange={handleCompanyChange} className={inputClass} placeholder="123456789" maxLength={9} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Company Registration Number <span className="text-red-500">*</span></label>
                                            <input type="text" name="company_registration_number" value={companyForm.company_registration_number} onChange={handleCompanyChange} className={inputClass} placeholder="12345678" maxLength={8} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelClass}>Country <span className="text-red-500">*</span></label>
                                            <select name="country" value={companyForm.country} onChange={handleCompanyChange} className={inputClass}>
                                                <option value="">Select country...</option>
                                                {EUROPEAN_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>City <span className="text-red-500">*</span></label>
                                            <input type="text" name="city" value={companyForm.city} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., Belgrade" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Company Size <span className="text-red-500">*</span></label>
                                            <select name="company_size" value={companyForm.company_size} onChange={handleCompanyChange} className={inputClass}>
                                                <option value="">Select size...</option>
                                                {COMPANY_SIZES.map(s => (<option key={s} value={s}>{s}</option>))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelClass}>Contact Phone <span className="text-red-500">*</span></label>
                                            <input type="tel" name="contact_phone" value={companyForm.contact_phone}
                                                onChange={(e) => {
                                                    let val = e.target.value;
                                                    if (val.length === 1 && val !== '+') val = '+' + val;
                                                    setCompanyForm(prev => ({ ...prev, contact_phone: val }));
                                                }}
                                                className={inputClass} placeholder="+381111234567" />
                                            <p className="text-[11px] text-gray-500 mt-1">Must include country code</p>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Website</label>
                                            <input type="url" name="website" value={companyForm.website} onChange={handleCompanyChange} className={inputClass} placeholder="https://yourcompany.com" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Founded Year <span className="text-red-500">*</span></label>
                                            <input type="text" name="founded_year" value={companyForm.founded_year} onChange={handleCompanyChange} className={inputClass} placeholder="2010" maxLength={4} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Company Address <span className="text-red-500">*</span></label>
                                        <textarea name="company_address" value={companyForm.company_address} onChange={handleCompanyChange} rows={2} className={`${inputClass} resize-none`} placeholder="Full registered business address..." />
                                    </div>

                                    <div>
                                        <label className={labelClass}>Company Description</label>
                                        <textarea name="description" value={companyForm.description} onChange={handleCompanyChange} rows={3} className={`${inputClass} resize-none`} placeholder="Brief description of your company and business activities..." />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        {employer && (
                                            <button type="button" onClick={cancelEdit} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-[14px]">
                                                Cancel
                                            </button>
                                        )}
                                        <button type="button" onClick={saveCompany} disabled={saving}
                                            className="px-5 py-2 bg-[#1877f2] text-white rounded-md hover:bg-[#166fe5] font-medium text-[14px] disabled:opacity-50 flex items-center gap-2">
                                            {saving ? (
                                                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Saving...</>
                                            ) : "Save Changes"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ── View Mode ── */
                            <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                                <div className="mb-4">
                                    <h3 className="font-bold text-[#050505] text-lg">Company Information</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <InfoRow icon={<Building2 size={18} />} label="Company Name" value={companyForm.company_name} />
                                    <InfoRow icon={<Hash size={18} />} label="Tax ID" value={companyForm.tax_id} />
                                    <InfoRow icon={<FileText size={18} />} label="Registration No." value={companyForm.company_registration_number} />
                                    <InfoRow icon={<Globe size={18} />} label="Country" value={companyForm.country} />
                                    <InfoRow icon={<MapPin size={18} />} label="City" value={companyForm.city} />
                                    <InfoRow icon={<Users size={18} />} label="Company Size" value={companyForm.company_size} />
                                    <InfoRow icon={<Phone size={18} />} label="Phone" value={companyForm.contact_phone} />
                                    <InfoRow icon={<Globe size={18} />} label="Website" value={companyForm.website} />
                                    <InfoRow icon={<Calendar size={18} />} label="Founded" value={companyForm.founded_year} />
                                    <InfoRow icon={<MapPin size={18} />} label="Address" value={companyForm.company_address} />
                                </div>
                                {companyForm.description && (
                                    <div className="mt-4 p-3 rounded-lg bg-[#f7f8fa] border border-[#f0f2f5]">
                                        <div className="text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1">Description</div>
                                        <p className="text-[#050505] text-[15px]">{companyForm.description}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ====================== POST A JOB TAB ====================== */}
                {activeTab === 'post-job' && employer && (
                    <div className="space-y-4">
                        {jobAlert && (
                            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${jobAlert.type === "success"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"}`}>
                                {jobAlert.msg}
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                            <h3 className="font-bold text-[#050505] text-lg mb-4 flex items-center gap-2">
                                <Plus size={20} /> Post a New Job
                            </h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Job Title <span className="text-red-500">*</span></label>
                                        <input type="text" name="title" value={jobForm.title} onChange={handleJobChange} className={inputClass} placeholder="e.g., Construction Worker, Welder" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Industry <span className="text-red-500">*</span></label>
                                        <IndustrySelect value={jobForm.industry} onChange={(v) => setJobForm(prev => ({ ...prev, industry: v }))} />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Job Description</label>
                                    <textarea name="description" value={jobForm.description} onChange={handleJobChange} rows={3} className={`${inputClass} resize-none`} placeholder="Describe responsibilities, requirements..." />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className={labelClass}>Positions <span className="text-red-500">*</span></label>
                                        <input type="number" name="positions_count" min={1} max={50} value={jobForm.positions_count} onChange={handleJobChange} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Salary (RSD) <span className="text-red-500">*</span></label>
                                        <input type="number" name="salary_rsd" min={60000} step={1000} value={jobForm.salary_rsd} onChange={handleJobChange} className={inputClass} />
                                        <p className="text-[11px] text-gray-500 mt-1">Min: 60,000 RSD</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Schedule</label>
                                        <select name="work_schedule" value={jobForm.work_schedule} onChange={handleJobChange} className={inputClass}>
                                            <option value="Full-time (40 hours/week)">Full-time (40h)</option>
                                            <option value="Shift work">Shift work</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Contract</label>
                                        <select name="contract_duration_months" value={jobForm.contract_duration_months} onChange={handleJobChange} className={inputClass}>
                                            <option value="6">6 months</option>
                                            <option value="12">12 months</option>
                                            <option value="24">24 months</option>
                                            <option value="36">36+ months</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Accommodation City <span className="text-red-500">*</span></label>
                                        <input type="text" name="work_city" value={jobForm.work_city} onChange={handleJobChange} className={inputClass} placeholder="City where workers will be accommodated" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Accommodation Address <span className="text-red-500">*</span></label>
                                        <input type="text" name="accommodation_address" value={jobForm.accommodation_address} onChange={handleJobChange} className={inputClass} placeholder="Full address for accommodation" />
                                        <p className="text-[11px] text-gray-500 mt-1">⚠️ Required by law for visa processing</p>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button type="button" onClick={submitJob} disabled={postingJob}
                                        className="px-6 py-2.5 bg-gradient-to-r from-[#10b981] to-[#059669] text-white rounded-md hover:from-[#059669] hover:to-[#047857] font-semibold text-[14px] disabled:opacity-50 flex items-center gap-2 shadow-sm">
                                        {postingJob ? (
                                            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Posting...</>
                                        ) : "Post Job ✓"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ====================== POSTED JOBS TAB ====================== */}
                {activeTab === 'jobs' && employer && (
                    <div className="space-y-4">
                        {editJobError && (
                            <div className="px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                                {editJobError}
                            </div>
                        )}

                        {jobs.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-8 text-center">
                                <Briefcase size={48} className="mx-auto text-[#bcc0c4] mb-3" />
                                <p className="text-lg font-semibold text-[#65676b] mb-1">No jobs posted yet</p>
                                <p className="text-sm text-[#bcc0c4]">Go to the "Post a Job" tab to create your first job listing</p>
                            </div>
                        ) : (
                            jobs.map(job => (
                                <div key={job.id} className="bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden">
                                    {/* Job summary */}
                                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-[#050505] text-[15px]">{job.title}</h3>
                                                <JobStatusBadge status={job.status} />
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-[#65676b] mt-1.5 flex-wrap">
                                                <span className="flex items-center gap-1"><Briefcase size={12} /> {job.industry}</span>
                                                <span className="flex items-center gap-1"><Users size={12} /> {job.positions_filled}/{job.positions_count} positions</span>
                                                {job.salary_rsd && <span>💰 {job.salary_rsd.toLocaleString()} RSD</span>}
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {editingJobId === job.id ? (
                                                <>
                                                    <button onClick={() => setEditingJobId(null)} className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 font-medium">Cancel</button>
                                                    <button onClick={saveEditJob} disabled={savingJob}
                                                        className="text-xs px-3 py-1.5 bg-[#1877f2] text-white rounded-md hover:bg-[#166fe5] font-medium disabled:opacity-50">
                                                        {savingJob ? "Saving..." : "Save"}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditJob(job)} className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 font-medium text-[#1877f2]">Edit</button>
                                                    {confirmDeleteJobId === job.id ? (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => deleteJob(job.id)} className="text-xs px-2 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700">Yes</button>
                                                            <button onClick={() => setConfirmDeleteJobId(null)} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300">No</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setConfirmDeleteJobId(job.id)} className="text-xs px-3 py-1.5 border border-red-200 rounded-md hover:bg-red-50 font-medium text-red-600">Delete</button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inline edit form */}
                                    {editingJobId === job.id && (
                                        <div className="border-t border-[#dddfe2] bg-[#f7f8fa] p-5 space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className={labelClass}>Job Title</label>
                                                    <input type="text" value={editJobForm.title} onChange={(e) => setEditJobForm(p => ({ ...p, title: e.target.value }))} className={inputClass} />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Industry</label>
                                                    <IndustrySelect value={editJobForm.industry} onChange={(v) => setEditJobForm(p => ({ ...p, industry: v }))} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Description</label>
                                                <textarea value={editJobForm.description} onChange={(e) => setEditJobForm(p => ({ ...p, description: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div>
                                                    <label className={labelClass}>Positions</label>
                                                    <input type="number" min={1} max={50} value={editJobForm.positions_count} onChange={(e) => setEditJobForm(p => ({ ...p, positions_count: e.target.value }))} className={inputClass} />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Salary (RSD)</label>
                                                    <input type="number" min={60000} step={1000} value={editJobForm.salary_rsd} onChange={(e) => setEditJobForm(p => ({ ...p, salary_rsd: e.target.value }))} className={inputClass} />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Schedule</label>
                                                    <select value={editJobForm.work_schedule} onChange={(e) => setEditJobForm(p => ({ ...p, work_schedule: e.target.value }))} className={inputClass}>
                                                        <option value="Full-time (40 hours/week)">Full-time</option>
                                                        <option value="Shift work">Shift work</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Contract</label>
                                                    <select value={editJobForm.contract_duration_months} onChange={(e) => setEditJobForm(p => ({ ...p, contract_duration_months: e.target.value }))} className={inputClass}>
                                                        <option value="6">6 months</option>
                                                        <option value="12">12 months</option>
                                                        <option value="24">24 months</option>
                                                        <option value="36">36+ months</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                    <label className={labelClass}>Experience (years)</label>
                                                    <input type="number" min={0} max={20} value={editJobForm.experience_required_years} onChange={(e) => setEditJobForm(p => ({ ...p, experience_required_years: e.target.value }))} className={inputClass} />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Accommodation City</label>
                                                    <input type="text" value={editJobForm.work_city} onChange={(e) => setEditJobForm(p => ({ ...p, work_city: e.target.value }))} className={inputClass} />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Accommodation Address</label>
                                                    <input type="text" value={editJobForm.accommodation_address} onChange={(e) => setEditJobForm(p => ({ ...p, accommodation_address: e.target.value }))} className={inputClass} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}

// ─── Helper Components ──────────────────────────────────────────

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-5 py-3.5 font-semibold text-[15px] whitespace-nowrap transition-colors relative ${active
                ? 'text-[#1877f2]'
                : 'text-[#65676b] hover:bg-[#f0f2f5] rounded-t-lg'
                }`}
        >
            {label}
            {active && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1877f2] rounded-t-full" />
            )}
        </button>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | null | undefined }) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[#f7f8fa] border border-[#f0f2f5]">
            <div className="text-[#65676b] mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0">
                <div className="text-xs font-semibold text-[#65676b] uppercase tracking-wide">{label}</div>
                <div className="text-[#050505] font-medium text-[15px] truncate">
                    {value || <span className="text-[#bcc0c4] italic">Not provided</span>}
                </div>
            </div>
        </div>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-emerald-100 text-emerald-700",
        matching: "bg-blue-100 text-blue-700",
        filled: "bg-indigo-100 text-indigo-700",
        closed: "bg-slate-100 text-slate-700",
        cancelled: "bg-red-100 text-red-700",
    };
    return (
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.closed}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

function IndustrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            <option value="">Select industry...</option>
            {EMPLOYER_INDUSTRIES.map(i => (<option key={i} value={i}>{i}</option>))}
        </select>
    );
}
