"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EMPLOYER_INDUSTRIES, COMPANY_SIZES, EUROPEAN_COUNTRIES } from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────────────
interface EmployerProfile {
    id: string;
    company_name: string;

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
const cardClass = "bg-white rounded-lg shadow-sm border border-gray-200";
const cardHeaderClass = "px-4 py-3 border-b border-gray-200 flex items-center justify-between";

// ─── Helper: Calculate Completion ───────────────────────────────
function calculateCompletion(form: CompanyForm) {
    const required: (keyof CompanyForm)[] = [
        "company_name", "company_registration_number", "company_address",
        "contact_phone", "country", "city"
    ];

    const filled = required.filter(key => {
        const val = form[key];
        return val && val.trim().length > 0;
    }).length;

    return Math.round((filled / required.length) * 100);
}

// ─── Component: Verification Status Card ────────────────────────
function EmployerVerificationCard({ employer, form }: { employer: EmployerProfile | null, form: CompanyForm }) {
    const completion = calculateCompletion(form);
    const isVerified = employer?.status === 'verified';
    const isPending = employer?.status === 'pending';

    // If verified, maybe show nothing or a small badge. Let's show nothing to keep UI clean,
    // or a small "Verified" indicator which is already in the header.
    if (isVerified) return null;

    if (completion === 100) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
                <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-2 rounded-full shrink-0">
                        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-blue-900 text-lg">Profile Under Review</h3>
                        <p className="text-blue-700 mt-1">
                            Great job! Your profile is 100% complete. Admin will review your details and contact you for authorization.
                        </p>
                        <p className="text-sm text-blue-600 mt-2">
                            Status: <span className="font-bold uppercase tracking-wide">Pending Approval</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-amber-200 rounded-lg p-5 mb-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                        Complete Your Profile
                        <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            {completion}%
                        </span>
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">
                        You must complete your profile (100%) to be verified and view worker candidates.
                    </p>
                </div>
                <div className="w-full md:w-56 shrink-0">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                            style={{ width: `${completion}%` }}
                        ></div>
                    </div>
                    <p className="text-right text-xs text-gray-400 mt-1">
                        {completion === 0 ? "Start by adding company name" :
                            completion < 100 ? "Keep going..." : "Done!"}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────
export default function EmployerProfilePage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<{ id: string } | null>(null);
    const [employer, setEmployer] = useState<EmployerProfile | null>(null);
    const [jobs, setJobs] = useState<JobRequest[]>([]);

    // ─ Company info state
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [companyAlert, setCompanyAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [companyForm, setCompanyForm] = useState({
        company_name: "", company_registration_number: "",
        company_address: "", contact_phone: "", country: "", city: "",
        website: "", industry: "", company_size: "", founded_year: "", description: "",
    });

    // ─ Job posting state
    const [postingJob, setPostingJob] = useState(false);
    const [jobAlert, setJobAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const emptyJob = {
        title: "", description: "", industry: "",
        positions_count: "1", salary_rsd: "60000",
        accommodation_address: "", work_schedule: "Full-time (40 hours/week)",
        contract_duration_months: "12", experience_required_years: "0",
    };
    const [jobForm, setJobForm] = useState({ ...emptyJob });

    // ─ Editing existing job state
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [editJobForm, setEditJobForm] = useState({ ...emptyJob });
    const [savingJob, setSavingJob] = useState(false);
    const [editJobError, setEditJobError] = useState<string | null>(null);
    const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<string | null>(null);

    // ─── Data fetching ──────────────────────────────────────────
    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUser(user);

            const { data: emp } = await supabase
                .from("employers").select("*")
                .eq("profile_id", user.id).single();

            if (emp) {
                setEmployer(emp);
                setCompanyForm({
                    company_name: emp.company_name || "",

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

                const { data: jobData } = await supabase
                    .from("job_requests").select("*")
                    .eq("employer_id", emp.id)
                    .order("created_at", { ascending: false });
                setJobs(jobData || []);
            } else {
                setEditing(true); // New employer, start in edit mode
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
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
            if (!companyForm.company_name.trim()) throw new Error("Company name is required");

            if (companyForm.company_registration_number && !/^\d{8}$/.test(companyForm.company_registration_number))
                throw new Error("Registration Number must be exactly 8 digits");
            if (companyForm.contact_phone) {
                const clean = companyForm.contact_phone.replace(/[\s\-()]/g, '');
                if (!/^\+\d{7,15}$/.test(clean)) throw new Error("Phone must start with + and country code");
            }

            const data = {
                company_name: companyForm.company_name,

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
                const { error } = await supabase.from("employers")
                    .insert({ ...data, profile_id: user.id, status: "pending" });
                if (error) throw error;
            }

            // Refresh employer data
            const { data: emp } = await supabase.from("employers").select("*")
                .eq("profile_id", user.id).single();
            if (emp) setEmployer(emp);

            setCompanyAlert({ type: "success", msg: "Company info saved!" });
            setEditing(false);
            setTimeout(() => setCompanyAlert(null), 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message
                : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
                    : "Failed to save";
            setCompanyAlert({ type: "error", msg: message });
        } finally {
            setSaving(false);
        }
    };

    const cancelEdit = () => {
        if (employer) {
            setCompanyForm({
                company_name: employer.company_name || "",

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

    // ─── Job posting handlers ───────────────────────────────────
    const handleJobChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setJobForm(prev => ({ ...prev, [name]: value }));
    };

    const submitJob = async () => {
        setPostingJob(true);
        setJobAlert(null);
        try {
            if (!employer) throw new Error("Please save your company info first");
            if (!jobForm.title.trim()) throw new Error("Job title is required");
            if (!jobForm.industry) throw new Error("Industry is required");
            if (Number(jobForm.salary_rsd) < 60000) throw new Error("Minimum salary is 60,000 RSD");
            if (!jobForm.accommodation_address.trim()) throw new Error("Accommodation address is required for visa");

            const { error } = await supabase.from("job_requests").insert({
                employer_id: employer.id,
                title: jobForm.title,
                description: jobForm.description || null,
                industry: jobForm.industry,
                positions_count: parseInt(jobForm.positions_count) || 1,
                salary_rsd: parseInt(jobForm.salary_rsd) || 60000,
                accommodation_address: jobForm.accommodation_address,
                work_schedule: jobForm.work_schedule,
                contract_duration_months: parseInt(jobForm.contract_duration_months) || 12,
                experience_required_years: parseInt(jobForm.experience_required_years) || 0,
                destination_country: "Serbia",
                status: "open",
            });
            if (error) throw error;

            // Refresh jobs list
            const { data: jobData } = await supabase.from("job_requests")
                .select("*").eq("employer_id", employer.id)
                .order("created_at", { ascending: false });
            setJobs(jobData || []);

            setJobForm({ ...emptyJob });
            setJobAlert({ type: "success", msg: "Job posted successfully!" });
            setTimeout(() => setJobAlert(null), 3000);
        } catch (err) {
            setJobAlert({ type: "error", msg: err instanceof Error ? err.message : "Failed to post job" });
        } finally {
            setPostingJob(false);
        }
    };

    // ─── Edit existing job handlers ─────────────────────────────
    const startEditJob = (job: JobRequest) => {
        setEditingJobId(job.id);
        setEditJobForm({
            title: job.title,
            description: job.description || "",
            industry: job.industry,
            positions_count: job.positions_count.toString(),
            salary_rsd: job.salary_rsd?.toString() || "60000",
            accommodation_address: job.accommodation_address || "",
            work_schedule: job.work_schedule || "Full-time (40 hours/week)",
            contract_duration_months: job.contract_duration_months?.toString() || "12",
            experience_required_years: job.experience_required_years?.toString() || "0",
        });
    };

    const saveEditJob = async () => {
        if (!editingJobId) return;
        setSavingJob(true);
        setEditJobError(null);
        try {
            const { error } = await supabase.from("job_requests").update({
                title: editJobForm.title,
                description: editJobForm.description || null,
                industry: editJobForm.industry,
                positions_count: parseInt(editJobForm.positions_count) || 1,
                salary_rsd: parseInt(editJobForm.salary_rsd) || 60000,
                accommodation_address: editJobForm.accommodation_address || null,
                work_schedule: editJobForm.work_schedule,
                contract_duration_months: parseInt(editJobForm.contract_duration_months) || 12,
                experience_required_years: parseInt(editJobForm.experience_required_years) || 0,
            }).eq("id", editingJobId);
            if (error) throw error;

            const { data: jobData } = await supabase.from("job_requests")
                .select("*").eq("employer_id", employer!.id)
                .order("created_at", { ascending: false });
            setJobs(jobData || []);
            setEditingJobId(null);
        } catch (err) {
            setEditJobError(err instanceof Error ? err.message : "Failed to update job");
        } finally {
            setSavingJob(false);
        }
    };

    const deleteJob = async (jobId: string) => {
        try {
            const { error } = await supabase.from("job_requests").delete().eq("id", jobId);
            if (error) throw error;
            setJobs(prev => prev.filter(j => j.id !== jobId));
            setConfirmDeleteJobId(null);
        } catch (err) {
            setEditJobError(err instanceof Error ? err.message : "Failed to delete job");
            setConfirmDeleteJobId(null);
        }
    };

    // ─── Industry select helper ─────────────────────────────────
    const IndustrySelect = ({ value, onChange, name = "industry", cls = inputClass }: {
        value: string; onChange: (val: string) => void; name?: string; cls?: string;
    }) => (
        <>
            <select
                name={name}
                value={value.startsWith("Other:") ? "Other" : value}
                onChange={(e) => onChange(e.target.value)}
                className={cls}
            >
                <option value="">Select industry...</option>
                {EMPLOYER_INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                ))}
            </select>
            {(value === "Other" || value.startsWith("Other:")) && (
                <input
                    type="text"
                    placeholder="Specify your industry..."
                    value={value.startsWith("Other:") ? value.replace("Other: ", "") : ""}
                    onChange={(e) => onChange(e.target.value ? `Other: ${e.target.value}` : "Other")}
                    className={`${cls} mt-2`}
                />
            )}
        </>
    );

    // ─── Loading ────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-[#1877f2] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* Top Nav */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[900px] mx-auto px-4 h-full">
                    <div className="flex justify-between h-full items-center">
                        <Link href="/" className="flex items-center gap-2">
                            <img src="/logo.png" alt="Workers United" className="h-[60px] w-auto object-contain" />
                            <span className="font-bold text-[#1E3A5F] text-xl tracking-tight hidden sm:inline">Workers United</span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/profile/settings"
                                className="w-9 h-9 bg-[#f0f2f5] rounded-full flex items-center justify-center text-[#050505] hover:bg-[#e4e6eb] transition-colors"
                                title="Account Settings"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
                                </svg>
                            </Link>
                            <a href="/auth/signout" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
                                Logout
                            </a>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-[900px] mx-auto px-4 py-6 space-y-6">

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
                        <p className="text-gray-500 mt-1">Manage your company and job postings</p>
                    </div>
                    {employer && !editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="bg-[#1877f2] text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-[#166fe5] transition-colors flex items-center gap-2"
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            Edit Profile
                        </button>
                    )}
                </div>

                {/* Verification Status Card */}
                <EmployerVerificationCard employer={employer} form={companyForm} />

                {/* ═══════════════ CARD 1: Company Info ═══════════════ */}
                <div className={cardClass}>
                    <div className={cardHeaderClass}>
                        <h2 className="font-semibold text-gray-900 text-[15px]">Company Information</h2>
                        <div className="flex items-center gap-2">
                            {employer && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${employer.status === 'active' ? 'bg-green-100 text-green-700' :
                                    employer.status === 'verified' ? 'bg-blue-100 text-blue-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                    {employer.status?.toUpperCase() || 'NEW'}
                                </span>
                            )}
                            {!editing && employer && (
                                <button
                                    onClick={() => setEditing(true)}
                                    className="text-[13px] font-semibold text-[#1877f2] hover:underline"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Alert */}
                    {companyAlert && (
                        <div className={`mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm font-medium ${companyAlert.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                            {companyAlert.msg}
                        </div>
                    )}

                    <div className="p-4">
                        {editing ? (
                            /* ── Edit Mode ── */
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Company Name <span className="text-red-500">*</span></label>
                                        <input type="text" name="company_name" required value={companyForm.company_name} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., ABC Construction d.o.o." />
                                    </div>

                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        <label className={labelClass}>City</label>
                                        <input type="text" name="city" value={companyForm.city} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., Belgrade" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Company Size</label>
                                        <select name="company_size" value={companyForm.company_size} onChange={handleCompanyChange} className={inputClass}>
                                            <option value="">Select size...</option>
                                            {COMPANY_SIZES.map(s => (<option key={s} value={s}>{s}</option>))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClass}>Contact Phone</label>
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
                                        <label className={labelClass}>Founded Year</label>
                                        <input type="text" name="founded_year" value={companyForm.founded_year} onChange={handleCompanyChange} className={inputClass} placeholder="2010" maxLength={4} />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Company Address</label>
                                    <textarea name="company_address" value={companyForm.company_address} onChange={handleCompanyChange} rows={2} className={`${inputClass} resize-none`} placeholder="Full registered business address..." />
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
                        ) : (
                            /* ── View Mode ── */
                            <div className="space-y-3">
                                <InfoRow label="Company Name" value={companyForm.company_name} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                    <InfoRow label="Company Reg. No." value={companyForm.company_registration_number} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <InfoRow label="Country" value={companyForm.country} />
                                    <InfoRow label="City" value={companyForm.city} />
                                    <InfoRow label="Company Size" value={companyForm.company_size} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <InfoRow label="Phone" value={companyForm.contact_phone} />
                                    <InfoRow label="Website" value={companyForm.website} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <InfoRow label="Founded" value={companyForm.founded_year} />
                                    <InfoRow label="Address" value={companyForm.company_address} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════ CARD 2: Post a Job ═══════════════ */}
                {employer && (
                    <div className={cardClass}>
                        <div className={cardHeaderClass}>
                            <h2 className="font-semibold text-gray-900 text-[15px]">📋 Post a Job</h2>
                        </div>

                        {jobAlert && (
                            <div className={`mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm font-medium ${jobAlert.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                                }`}>
                                {jobAlert.msg}
                            </div>
                        )}

                        <div className="p-4 space-y-4">
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
                                    <label className={labelClass}>Experience Required (years)</label>
                                    <input type="number" name="experience_required_years" min={0} max={20} value={jobForm.experience_required_years} onChange={handleJobChange} className={inputClass} />
                                    <p className="text-[11px] text-gray-500 mt-1">Set to 0 for no experience required</p>
                                </div>
                                <div>
                                    <label className={labelClass}>Accommodation Address <span className="text-red-500">*</span></label>
                                    <input type="text" name="accommodation_address" value={jobForm.accommodation_address} onChange={handleJobChange} className={inputClass} placeholder="Address for worker accommodation" />
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
                )}

                {/* ═══════════════ CARD 3: Posted Jobs ═══════════════ */}
                {employer && (
                    <div className={cardClass}>
                        <div className={cardHeaderClass}>
                            <h2 className="font-semibold text-gray-900 text-[15px]">📌 Posted Jobs</h2>
                            <span className="text-xs text-gray-500">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
                        </div>

                        <div className="p-4">
                            {editJobError && (
                                <div className="mb-3 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                                    {editJobError}
                                </div>
                            )}
                            {jobs.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <p className="text-lg mb-1">No jobs posted yet</p>
                                    <p className="text-sm">Use the form above to post your first job</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {jobs.map(job => (
                                        <div key={job.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                            {/* Job summary row */}
                                            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-semibold text-gray-900 text-[15px]">{job.title}</h3>
                                                        <JobStatusBadge status={job.status} />
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                                                        <span>🏢 {job.industry}</span>
                                                        <span>👥 {job.positions_filled}/{job.positions_count} positions</span>
                                                        {job.salary_rsd && <span>💰 {job.salary_rsd.toLocaleString()} RSD</span>}
                                                        <span>📅 {new Date(job.created_at).toLocaleDateString('en-GB')}</span>
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
                                                <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
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
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className={labelClass}>Experience (years)</label>
                                                            <input type="number" min={0} max={20} value={editJobForm.experience_required_years} onChange={(e) => setEditJobForm(p => ({ ...p, experience_required_years: e.target.value }))} className={inputClass} />
                                                        </div>
                                                        <div>
                                                            <label className={labelClass}>Accommodation Address</label>
                                                            <input type="text" value={editJobForm.accommodation_address} onChange={(e) => setEditJobForm(p => ({ ...p, accommodation_address: e.target.value }))} className={inputClass} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div >
    );
}

// ─── Helper Components ──────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
            <p className="text-[15px] text-gray-900 mt-0.5">{value || <span className="text-gray-400 italic">Not set</span>}</p>
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
