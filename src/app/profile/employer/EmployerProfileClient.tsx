"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EMPLOYER_INDUSTRIES, COMPANY_SIZES, EUROPEAN_COUNTRIES } from "@/lib/constants";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import {
    Building2, MapPin, Globe, Phone, Calendar, FileText, Hash, Users,
    Pencil, Briefcase, CheckCircle2, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp, Banknote,
    LayoutDashboard
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
    postal_code: string | null;
    business_registry_number: string | null;
    founding_date: string | null;
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
    postal_code: string;
    website: string;
    industry: string;
    company_size: string;
    founded_year: string;
    description: string;
    business_registry_number: string;
    founding_date: string;
}

// ─── Shared styles ──────────────────────────────────────────────
const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:ring-2 focus:ring-[#1877f2]/20 focus:border-[#1877f2] bg-gray-50 hover:bg-white focus:bg-white transition-all duration-200 outline-none";
const labelClass = "block text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2";

// ─── Helper: Calculate Completion ───────────────────────────────
function calculateCompletion(form: CompanyForm) {
    // Must match getEmployerCompletion() in profile-completion.ts
    // Base fields required for all employers
    const baseRequired: (keyof CompanyForm)[] = [
        "company_name", "contact_phone", "country", "industry"
    ];
    // Serbia: additional fields required for contracts
    const serbiaExtra: (keyof CompanyForm)[] = [
        "company_registration_number", "company_address",
        "city", "postal_code", "description",
        "business_registry_number", "founding_date"
    ];

    const isSerbia = form.country.toLowerCase() === 'serbia';
    const required = isSerbia ? [...baseRequired, ...serbiaExtra] : baseRequired;

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
        company_address: "", contact_phone: "", country: "", city: "", postal_code: "",
        website: "", industry: "", company_size: "", founded_year: "", description: "",
        business_registry_number: "", founding_date: "",
    });

    // ─ Job posting state
    const [postingJob, setPostingJob] = useState(false);
    const [jobAlert, setJobAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const emptyJob = {
        title: "", description: "", industry: "",
        positions_count: "1", salary_rsd: "70000",
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
        if (profile?.user_type !== "employer" && profile?.user_type !== "admin") { router.replace("/profile/worker"); return; }

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
                postal_code: emp.postal_code || "",
                website: emp.website || "",
                industry: emp.industry || "",
                company_size: emp.company_size || "",
                founded_year: emp.founded_year || "",
                description: emp.description || "",
                business_registry_number: emp.business_registry_number || "",
                founding_date: emp.founding_date || "",
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
            if (!companyForm.country.trim()) throw new Error("Country is required");

            const isSerbia = companyForm.country.toLowerCase() === 'serbia';

            // Serbia-specific validation
            if (isSerbia) {
                if (companyForm.company_registration_number && !/^\d{8}$/.test(companyForm.company_registration_number))
                    throw new Error("Registration Number must be exactly 8 digits");
            }

            if (companyForm.contact_phone) {
                const clean = companyForm.contact_phone.replace(/[\s\-()]/g, '');
                if (!/^\+\d{7,15}$/.test(clean)) throw new Error("Phone must start with + and country code");
            }

            const data = {
                company_name: companyForm.company_name,
                contact_phone: companyForm.contact_phone ? companyForm.contact_phone.replace(/[\s\-()]/g, '') : null,
                country: companyForm.country || null,
                website: companyForm.website || null,
                industry: companyForm.industry || null,

                // Serbia-specific fields (set to null if not Serbia)
                tax_id: isSerbia ? (companyForm.tax_id || null) : null,
                company_registration_number: isSerbia ? (companyForm.company_registration_number || null) : null,
                company_address: isSerbia ? (companyForm.company_address || null) : null,
                city: isSerbia ? (companyForm.city || null) : null,
                postal_code: isSerbia ? (companyForm.postal_code || null) : null,
                company_size: isSerbia ? (companyForm.company_size || null) : null,
                founded_year: isSerbia ? (companyForm.founded_year || null) : null,
                business_registry_number: isSerbia ? (companyForm.business_registry_number || null) : null,
                founding_date: isSerbia ? (companyForm.founding_date || null) : null,

                description: companyForm.description || null,
            };

            if (employer) {
                const { error } = await supabase.from("employers").update(data).eq("id", employer.id);
                if (error) throw error;
            } else {
                const { error: profileErr } = await supabase.from("profiles").upsert({
                    id: user.id,
                    email: user.email || "",
                    full_name: user.user_metadata?.full_name || "",
                    user_type: "employer",
                }, { onConflict: "id" });
                if (profileErr) throw profileErr;

                const { error } = await supabase.from("employers")
                    .insert({ ...data, profile_id: user.id, status: "PENDING" });
                if (error) throw error;
            }

            const { data: emp } = await supabase.from("employers").select("*").eq("profile_id", user.id).single();
            if (emp) setEmployer(emp);

            setCompanyAlert({ type: "success", msg: "Company info saved!" });
            setEditing(false);
            setTimeout(() => setCompanyAlert(null), 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
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
                postal_code: employer.postal_code || "",
                website: employer.website || "",
                industry: employer.industry || "",
                company_size: employer.company_size || "",
                founded_year: employer.founded_year || "",
                description: employer.description || "",
                business_registry_number: employer.business_registry_number || "",
                founding_date: employer.founding_date || "",
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
                salary_rsd: parseFloat(jobForm.salary_rsd) || 70000,
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
            const message = err instanceof Error ? err.message : String(err);
            setJobAlert({ type: "error", msg: message });
        } finally { setPostingJob(false); }
    };

    const startEditJob = (job: JobRequest) => {
        setEditingJobId(job.id);
        setEditJobForm({
            title: job.title, description: job.description || "",
            industry: job.industry,
            positions_count: String(job.positions_count), salary_rsd: String(job.salary_rsd || "70000"),
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
                salary_rsd: parseFloat(editJobForm.salary_rsd) || 70000,
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
        <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    // Country gate: full features only available for Serbia
    const isSerbia = companyForm.country.toLowerCase() === 'serbia';
    const hasCountry = companyForm.country.trim().length > 0;

    return (
        <div className="min-h-screen bg-[#F0F4F8]">
            {/* NAVBAR */}
            <UnifiedNavbar variant="dashboard" user={user} profileName={companyForm.company_name || ""} />

            {/* MAIN CONTENT */}
            <div className="max-w-6xl mx-auto px-4 py-8">

                {/* Hero Section */}
                <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1E3A5F] via-[#2f6fed] to-[#2563EB] p-8 text-white shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <Building2 className="text-white" />
                                </div>
                                <h1 className="text-3xl font-bold">{companyForm.company_name || "Company Profile"}</h1>
                            </div>
                            <p className="text-blue-100 opacity-90 max-w-lg">
                                Manage your company information and job postings.
                            </p>
                        </div>
                        {completion < 100 && (
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[200px]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Completion</span>
                                    <span className="font-bold">{completion}%</span>
                                </div>
                                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${completion}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar Tabs */}
                    <div className="md:w-64 flex-shrink-0 space-y-2">
                        <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 sticky top-24">
                            <TabButton label="Company Info" icon={<LayoutDashboard size={18} />} active={activeTab === 'company'} onClick={() => setActiveTab('company')} />
                            {employer && isSerbia && <TabButton label="Post a Job" icon={<Plus size={18} />} active={activeTab === 'post-job'} onClick={() => setActiveTab('post-job')} />}
                            {employer && isSerbia && <TabButton label={`Active Jobs (${jobs.length})`} icon={<Briefcase size={18} />} active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />}

                            {employer && !editing && activeTab === 'company' && (
                                <>
                                    <div className="my-2 border-t border-slate-100"></div>
                                    <button
                                        onClick={() => setEditing(true)}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        <Pencil size={18} /> Edit Profile
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 min-w-0">
                        {/* Coming soon banner for non-Serbian employers */}
                        {employer && hasCountry && !isSerbia && !editing && (
                            <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Globe className="text-amber-600" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-amber-900 text-lg mb-1">We&apos;re expanding to {companyForm.country} soon!</h3>
                                        <p className="text-amber-800 text-sm leading-relaxed">
                                            Workers United is currently available for employers registered in <strong>Serbia</strong>.
                                            We&apos;re actively working on expanding to other countries. Your registration helps us
                                            prioritize — we&apos;ll notify you as soon as we&apos;re ready in {companyForm.country}.
                                        </p>
                                        <p className="text-amber-700 text-xs mt-3 font-medium">
                                            💡 In the meantime, you can complete your company profile so everything is ready when we launch.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ====================== COMPANY INFO TAB ====================== */}
                        {activeTab === 'company' && (
                            <div className="space-y-6">
                                {/* Alert */}
                                {companyAlert && (
                                    <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${companyAlert.type === "success"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-red-50 text-red-700 border border-red-200"}`}>
                                        {companyAlert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                        {companyAlert.msg}
                                    </div>
                                )}

                                {editing ? (
                                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                                        <h3 className="font-bold text-slate-900 text-xl mb-6 flex items-center gap-2">
                                            <Pencil size={20} className="text-blue-500" /> Edit Company Details
                                        </h3>

                                        <div className="space-y-6">
                                            <div>
                                                <label className={labelClass}>Company Name <span className="text-red-500">*</span></label>
                                                <input type="text" name="company_name" required value={companyForm.company_name} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., ABC Construction d.o.o." />
                                            </div>

                                            <div>
                                                <label className={labelClass}>Industry <span className="text-red-500">*</span></label>
                                                <select name="industry" value={companyForm.industry} onChange={handleCompanyChange} className={inputClass}>
                                                    <option value="">Select industry...</option>
                                                    {EMPLOYER_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {isSerbia && (
                                                    <div>
                                                        <label className={labelClass}>Tax ID (PIB)</label>
                                                        <input type="text" name="tax_id" value={companyForm.tax_id} onChange={handleCompanyChange} className={inputClass} placeholder="123456789" maxLength={9} />
                                                    </div>
                                                )}
                                                {isSerbia && (
                                                    <div>
                                                        <label className={labelClass}>Registration Number <span className="text-red-500">*</span></label>
                                                        <input type="text" name="company_registration_number" value={companyForm.company_registration_number} onChange={handleCompanyChange} className={inputClass} placeholder="12345678" maxLength={8} />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <label className={labelClass}>Country <span className="text-red-500">*</span></label>
                                                    <select name="country" value={companyForm.country} onChange={handleCompanyChange} className={inputClass}>
                                                        <option value="">Select country...</option>
                                                        {EUROPEAN_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                                    </select>
                                                </div>
                                                {isSerbia && (
                                                    <div>
                                                        <label className={labelClass}>City <span className="text-red-500">*</span></label>
                                                        <input type="text" name="city" value={companyForm.city} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., Belgrade" />
                                                    </div>
                                                )}
                                                {isSerbia && (
                                                    <div>
                                                        <label className={labelClass}>Postal Code <span className="text-red-500">*</span></label>
                                                        <input type="text" name="postal_code" value={companyForm.postal_code} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., 11000" maxLength={10} />
                                                    </div>
                                                )}
                                                {isSerbia && (
                                                    <div>
                                                        <label className={labelClass}>Company Size</label>
                                                        <select name="company_size" value={companyForm.company_size} onChange={handleCompanyChange} className={inputClass}>
                                                            <option value="">Select size...</option>
                                                            {COMPANY_SIZES.map(s => (<option key={s} value={s}>{s}</option>))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <label className={labelClass}>Contact Phone <span className="text-red-500">*</span></label>
                                                    <input type="tel" name="contact_phone" value={companyForm.contact_phone}
                                                        onChange={(e) => {
                                                            let val = e.target.value;
                                                            if (val.length === 1 && val !== '+') val = '+' + val;
                                                            setCompanyForm(prev => ({ ...prev, contact_phone: val }));
                                                        }}
                                                        className={inputClass} placeholder="+381111234567" />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Website (Optional)</label>
                                                    <input type="url" name="website" value={companyForm.website} onChange={handleCompanyChange} className={inputClass} placeholder="https://yourcompany.com" />
                                                </div>
                                                {isSerbia && (
                                                    <div>
                                                        <label className={labelClass}>Founded Year</label>
                                                        <input type="text" name="founded_year" value={companyForm.founded_year} onChange={handleCompanyChange} className={inputClass} placeholder="2010" maxLength={4} />
                                                    </div>
                                                )}
                                            </div>

                                            {isSerbia && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className={labelClass}>Business Registry Number <span className="text-red-500">*</span></label>
                                                        <input type="text" name="business_registry_number" value={companyForm.business_registry_number} onChange={handleCompanyChange} className={inputClass} placeholder="BD 12345/2020" />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Company Founding Date <span className="text-red-500">*</span></label>
                                                        <input type="text" name="founding_date" value={companyForm.founding_date} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., 15.01.2010" />
                                                    </div>
                                                </div>
                                            )}

                                            {isSerbia && (
                                                <div>
                                                    <label className={labelClass}>Company Address <span className="text-red-500">*</span></label>
                                                    <textarea name="company_address" value={companyForm.company_address} onChange={handleCompanyChange} rows={2} className={`${inputClass} resize-none`} placeholder="Full registered business address..." />
                                                </div>
                                            )}

                                            {isSerbia && (
                                                <div>
                                                    <label className={labelClass}>Company Description <span className="text-red-500">*</span></label>
                                                    <textarea name="description" value={companyForm.description} onChange={handleCompanyChange} rows={3} className={`${inputClass} resize-none`} placeholder="Brief description of your company and activities..." />
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                                {employer && (
                                                    <button type="button" onClick={cancelEdit} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors">
                                                        Cancel
                                                    </button>
                                                )}
                                                <button type="button" onClick={saveCompany} disabled={saving}
                                                    className="px-8 py-3 bg-[#1877f2] text-white rounded-xl hover:bg-[#166fe5] font-bold shadow-lg shadow-blue-500/30 disabled:opacity-50 flex items-center gap-2 transition-all">
                                                    {saving ? "Saving..." : "Save Changes"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                                        <h3 className="font-bold text-slate-900 text-xl mb-6 flex items-center gap-2">
                                            <Building2 className="text-blue-500" /> Company Information
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <InfoRow icon={<Building2 size={18} />} label="Company Name" value={companyForm.company_name} />
                                            <InfoRow icon={<Briefcase size={18} />} label="Industry" value={companyForm.industry} />
                                            {isSerbia && <InfoRow icon={<Hash size={18} />} label="Tax ID" value={companyForm.tax_id} />}
                                            {isSerbia && <InfoRow icon={<FileText size={18} />} label="Registration No." value={companyForm.company_registration_number} />}
                                            <InfoRow icon={<Globe size={18} />} label="Country" value={companyForm.country} />
                                            {isSerbia && <InfoRow icon={<MapPin size={18} />} label="City" value={companyForm.city} />}
                                            {isSerbia && <InfoRow icon={<Users size={18} />} label="Company Size" value={companyForm.company_size} />}
                                            <InfoRow icon={<Phone size={18} />} label="Phone" value={companyForm.contact_phone} />
                                            <InfoRow icon={<Globe size={18} />} label="Website" value={companyForm.website} />
                                            {isSerbia && <InfoRow icon={<Calendar size={18} />} label="Founded" value={companyForm.founded_year} />}
                                            {isSerbia && <InfoRow icon={<MapPin size={18} />} label="Postal Code" value={companyForm.postal_code} />}
                                            {isSerbia && <InfoRow icon={<FileText size={18} />} label="Business Registry No." value={companyForm.business_registry_number} />}
                                            {isSerbia && <InfoRow icon={<Calendar size={18} />} label="Founding Date" value={companyForm.founding_date} />}
                                            {isSerbia && <InfoRow icon={<MapPin size={18} />} label="Address" value={companyForm.company_address} />}
                                            {isSerbia && companyForm.description && <InfoRow icon={<FileText size={18} />} label="Description" value={companyForm.description} />}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ====================== POST A JOB TAB ====================== */}
                        {activeTab === 'post-job' && employer && (
                            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                                <h3 className="font-bold text-slate-900 text-xl mb-6 flex items-center gap-2">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Plus size={20} /></div>
                                    Post a New Job
                                </h3>

                                {jobAlert && (
                                    <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${jobAlert.type === "success"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-red-50 text-red-700 border border-red-200"}`}>
                                        {jobAlert.msg}
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className={labelClass}>Job Title <span className="text-red-500">*</span></label>
                                            <input type="text" name="title" value={jobForm.title} onChange={handleJobChange} className={inputClass} placeholder="e.g., Construction Worker, Welder" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Industry <span className="text-red-500">*</span></label>
                                            <select value={jobForm.industry} onChange={(e) => setJobForm(prev => ({ ...prev, industry: e.target.value }))} className={inputClass}>
                                                <option value="">Select Industry</option>
                                                {EMPLOYER_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                            </select>
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
                                            <input type="number" name="salary_rsd" min={70000} step={1000} value={jobForm.salary_rsd} onChange={handleJobChange} className={inputClass} />
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
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-slate-100">
                                        <button type="button" onClick={submitJob} disabled={postingJob}
                                            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 font-bold shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center gap-2 transition-all">
                                            {postingJob ? (
                                                <><div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> Posting...</>
                                            ) : <><Plus className="w-5 h-5" /> Post Job Request</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ====================== POSTED JOBS TAB ====================== */}
                        {activeTab === 'jobs' && employer && (
                            <div className="space-y-6">
                                {jobs.length === 0 ? (
                                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center">
                                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Briefcase size={32} className="text-slate-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">No jobs posted yet</h3>
                                        <p className="text-slate-500 mb-6">Create your first job request to start matching with workers.</p>
                                        <button onClick={() => setActiveTab('post-job')} className="px-6 py-3 bg-[#1877f2] text-white rounded-xl font-bold hover:bg-blue-600 transition-colors">
                                            Post a Job
                                        </button>
                                    </div>
                                ) : (
                                    jobs.map(job => (
                                        <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
                                            <div className="p-6">
                                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h3 className="font-bold text-xl text-slate-900">{job.title}</h3>
                                                            <JobStatusBadge status={job.status} />
                                                        </div>
                                                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                                                            <span className="flex items-center gap-1"><Briefcase size={14} /> {job.industry}</span>
                                                            <span className="flex items-center gap-1"><MapPin size={14} /> {job.work_city}</span>
                                                            <span className="flex items-center gap-1"><Banknote size={14} /> {job.salary_rsd?.toLocaleString()} RSD</span>
                                                            <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {editingJobId === job.id ? (
                                                            <>
                                                                <button onClick={() => setEditingJobId(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
                                                                <button onClick={saveEditJob} disabled={savingJob} className="px-4 py-2 text-sm font-bold bg-[#1877f2] text-white rounded-lg hover:bg-blue-600">Save</button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => startEditJob(job)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                                    <Pencil size={18} />
                                                                </button>
                                                                {confirmDeleteJobId === job.id ? (
                                                                    <div className="flex items-center gap-2 bg-red-50 p-1 rounded-lg">
                                                                        <button onClick={() => deleteJob(job.id)} className="text-xs font-bold text-red-600 px-2 py-1 hover:bg-red-100 rounded">Delete?</button>
                                                                        <button onClick={() => setConfirmDeleteJobId(null)} className="text-xs font-bold text-slate-500 px-2 py-1 hover:bg-slate-200 rounded">No</button>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => setConfirmDeleteJobId(job.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Editing Form */}
                                                {editingJobId === job.id && (
                                                    <div className="mt-6 pt-6 border-t border-slate-100 bg-slate-50/50 -mx-6 -mb-6 p-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                            <div>
                                                                <label className={labelClass}>Job Title</label>
                                                                <input type="text" value={editJobForm.title} onChange={(e) => setEditJobForm(p => ({ ...p, title: e.target.value }))} className={inputClass} />
                                                            </div>
                                                            <div>
                                                                <label className={labelClass}>Industry</label>
                                                                <select value={editJobForm.industry} onChange={(e) => setEditJobForm(p => ({ ...p, industry: e.target.value }))} className={inputClass}>
                                                                    {EMPLOYER_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        {/* More edit fields can go here similar to post job form */}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Helper Components ──────────────────────────────────────────

function TabButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${active
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
                }`}
        >
            <span className={active ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>
            {label}
        </button>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | null | undefined }) {
    return (
        <div className="group">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-slate-400 group-hover:text-blue-500 transition-colors">{icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
            </div>
            <div className="pl-7 font-medium text-slate-900 text-base border-b border-transparent group-hover:border-slate-100 pb-1 transition-colors">
                {value || <span className="text-slate-300 italic">Not provided</span>}
            </div>
        </div>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-emerald-100 text-emerald-700 border-emerald-200",
        closed: "bg-slate-100 text-slate-600 border-slate-200",
        filled: "bg-blue-100 text-blue-700 border-blue-200",
        draft: "bg-amber-100 text-amber-700 border-amber-200",
    };
    return (
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${styles[status] || styles.closed}`}>
            {status}
        </span>
    );
}

const IndustrySelect = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Select Industry</option>
        {EMPLOYER_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
    </select>
);
