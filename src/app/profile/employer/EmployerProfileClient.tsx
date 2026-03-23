"use client";

import { useState, useEffect, useCallback } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InternationalPhoneField from "@/components/forms/InternationalPhoneField";
import AdaptiveSelect from "@/components/forms/AdaptiveSelect";
import { syncCurrentUserAuthContact } from "@/lib/auth-contact-sync-client";
import { getCountryDisplayLabel } from "@/lib/country-display";
import { EMPLOYER_INDUSTRIES, COMPANY_SIZES, EUROPEAN_COUNTRIES } from "@/lib/constants";
import { ensureEmployerRecord } from "@/lib/employers";
import { getEmployerCompletion } from "@/lib/profile-completion";
import {
    Building2, MapPin, Globe, Phone, Calendar, FileText, Hash, Users,
    Pencil, Briefcase, CheckCircle2, AlertCircle, Plus, Trash2, Banknote
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

export interface EmployerInspectSnapshot {
    profile: {
        id: string;
        email: string | null;
        full_name: string | null;
    } | null;
    employer: EmployerProfile | null;
    jobs: JobRequest[];
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

function createCompanyFormFromEmployer(employer: EmployerProfile | null): CompanyForm {
    return {
        company_name: employer?.company_name || "",
        tax_id: employer?.tax_id || "",
        company_registration_number: employer?.company_registration_number || "",
        company_address: employer?.company_address || "",
        contact_phone: employer?.contact_phone || "",
        country: employer?.country || "",
        city: employer?.city || "",
        postal_code: employer?.postal_code || "",
        website: employer?.website || "",
        industry: employer?.industry || "",
        company_size: employer?.company_size || "",
        founded_year: employer?.founded_year || "",
        description: employer?.description || "",
        business_registry_number: employer?.business_registry_number || "",
        founding_date: employer?.founding_date || "",
    };
}

// ─── Shared styles ──────────────────────────────────────────────
const inputClass = "min-w-0 w-full rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-[15px] text-[#18181b] outline-none transition hover:bg-[#fafafa] focus:border-[#111111] focus:bg-white focus:ring-0";
const labelClass = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]";
const surfaceClass = "relative rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-[26px] sm:border sm:border-[#e5e7eb] sm:bg-white sm:p-6 sm:shadow-[0_20px_50px_-40px_rgba(15,23,42,0.18)] sm:before:hidden";
const heroSurfaceClass = "relative overflow-hidden rounded-none border-0 bg-transparent px-1 py-0 shadow-none sm:rounded-[28px] sm:border sm:border-[#e5e7eb] sm:bg-white sm:p-6 sm:shadow-[0_30px_70px_-52px_rgba(15,23,42,0.22)]";

type TabType = "company" | "post-job" | "jobs";

function getEmployerTab(tab: string | null): TabType {
    if (tab === "post-job" || tab === "jobs") {
        return tab;
    }
    return "company";
}

// ─── Main Component ─────────────────────────────────────────────
export default function EmployerProfilePage({
    readOnlyPreview = false,
    inspectSnapshot = null,
    adminTestMode = false,
    initialSandboxState = null,
}: {
    readOnlyPreview?: boolean;
    inspectSnapshot?: EmployerInspectSnapshot | null;
    adminTestMode?: boolean;
    initialSandboxState?: {
        employer: EmployerProfile | null;
        jobs: JobRequest[];
    } | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    const requestedTab = getEmployerTab(searchParams.get("tab"));
    const inspectProfileId = readOnlyPreview ? inspectSnapshot?.profile?.id || searchParams.get("inspect") : null;

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [employer, setEmployer] = useState<EmployerProfile | null>(null);
    const [jobs, setJobs] = useState<JobRequest[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>(requestedTab);

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
        if (adminTestMode && initialSandboxState) {
            setEmployer(initialSandboxState.employer);
            setCompanyForm(createCompanyFormFromEmployer(initialSandboxState.employer));
            setJobs(initialSandboxState.jobs);
            setEditing(!initialSandboxState.employer);
            setLoading(false);
            return;
        }

        if (readOnlyPreview && inspectSnapshot) {
            setEmployer(inspectSnapshot.employer);
            setCompanyForm(createCompanyFormFromEmployer(inspectSnapshot.employer));
            setJobs(inspectSnapshot.jobs);
            setEditing(false);
            setLoading(false);
            return;
        }

        if (adminTestMode) {
            const response = await fetch("/api/admin/test-personas/employer", { cache: "no-store" });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Failed to load employer sandbox.");
            }

            setEmployer(payload.employer);
            setCompanyForm(createCompanyFormFromEmployer(payload.employer));
            setJobs(payload.jobs || []);
            setEditing(!payload.employer);
            setLoading(false);
            return;
        }

        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) { router.replace("/login"); return; }
        setUser(u);

        const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", u.id).single();
        if (profile?.user_type !== "employer" && profile?.user_type !== "admin") { router.replace("/profile/worker"); return; }

        const { data: emp } = await supabase
            .from("employers")
            .select("*")
            .eq("profile_id", u.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (emp) {
            setEmployer(emp);
            setCompanyForm(createCompanyFormFromEmployer(emp));
            const { data: jobData } = await supabase.from("job_requests").select("*").eq("employer_id", emp.id).order("created_at", { ascending: false });
            setJobs(jobData || []);
        } else {
            if (readOnlyPreview) {
                setEditing(false);
            } else {
                setEditing(true);
                setCompanyForm(prev => ({
                    ...prev,
                    company_name: u.user_metadata?.company_name || "",
                }));
            }
        }
        setLoading(false);
    }, [adminTestMode, initialSandboxState, inspectSnapshot, readOnlyPreview, router, supabase]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        setActiveTab(requestedTab);
    }, [requestedTab]);

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
        const params = new URLSearchParams();
        if (tab !== "company") {
            params.set("tab", tab);
        }
        if (inspectProfileId) {
            params.set("inspect", inspectProfileId);
        }
        const nextPath = params.toString() ? `/profile/employer?${params.toString()}` : "/profile/employer";
        router.replace(nextPath, { scroll: false });
    }, [router, inspectProfileId]);

    // ─── Company info handlers ──────────────────────────────────
    const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCompanyForm(prev => ({ ...prev, [name]: value }));
    };

    const saveCompany = async () => {
        if (readOnlyPreview) {
            setCompanyAlert({ type: "error", msg: "Admin preview is read-only." });
            return;
        }
        setSaving(true);
        setCompanyAlert(null);
        let authSyncWarning = false;
        try {
            if (!companyForm.company_name.trim()) throw new Error("Company name is required");
            if (!companyForm.country.trim()) throw new Error("Country is required");

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
                tax_id: companyForm.tax_id || null,
                company_registration_number: companyForm.company_registration_number || null,
                company_address: companyForm.company_address || null,
                city: companyForm.city || null,
                postal_code: companyForm.postal_code || null,
                company_size: companyForm.company_size || null,
                founded_year: companyForm.founded_year || null,
                business_registry_number: companyForm.business_registry_number || null,
                founding_date: companyForm.founding_date || null,
                description: companyForm.description || null,
            };

            if (adminTestMode) {
                const response = await fetch("/api/admin/test-personas/employer", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Failed to save sandbox employer.");
            } else {
                if (!user) throw new Error("Not logged in");
                if (employer) {
                    const { error } = await supabase.from("employers").update(data).eq("id", employer.id);
                    if (error) throw error;
                } else {
                    const employerResult = await ensureEmployerRecord(supabase, {
                        userId: user.id,
                        email: user.email,
                        fullName: user.user_metadata?.full_name,
                        companyName: data.company_name,
                        contactPhone: data.contact_phone,
                        contactEmail: user.email,
                    });

                    if (!employerResult.employer) {
                        throw new Error("Failed to create employer record.");
                    }

                    const { error } = await supabase
                        .from("employers")
                        .update(data)
                        .eq("id", employerResult.employer.id);
                    if (error) throw error;
                }

                const authSync = await syncCurrentUserAuthContact({
                    phone: data.contact_phone,
                });
                if (!authSync.ok) {
                    authSyncWarning = true;
                    console.warn("[EmployerProfile] Auth contact sync failed:", authSync.error);
                }
            }

            await fetchData();

            setCompanyAlert({
                type: "success",
                msg: authSyncWarning
                    ? "Company info saved. Auth phone sync will retry on your next sign-in."
                    : "Company info saved!",
            });
            setEditing(false);
            setTimeout(() => setCompanyAlert(null), 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setCompanyAlert({ type: "error", msg: message });
        } finally { setSaving(false); }
    };

    const cancelEdit = () => {
        if (employer) {
            setCompanyForm(createCompanyFormFromEmployer(employer));
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
        if (readOnlyPreview) {
            setJobAlert({ type: "error", msg: "Admin preview is read-only." });
            return;
        }
        setPostingJob(true); setJobAlert(null);
        try {
            if (!jobForm.title.trim()) throw new Error("Job title is required");
            if (!jobForm.industry.trim()) throw new Error("Industry is required");
            if (!jobForm.work_city.trim()) throw new Error("Work city is required");
            if (!jobForm.accommodation_address.trim()) throw new Error("Accommodation address is required by law");

            if (adminTestMode) {
                const response = await fetch("/api/admin/test-personas/employer/jobs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
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
                        destination_country: companyForm.country || "Europe",
                        status: "open",
                    }),
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Failed to create sandbox job request.");
            } else {
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
                    destination_country: companyForm.country || "Europe",
                    status: "open",
                });
                if (error) throw error;
            }
            setJobForm({ ...emptyJob });
            setJobAlert({ type: "success", msg: "Job posted!" });
            setTimeout(() => setJobAlert(null), 3000);

            await fetchData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setJobAlert({ type: "error", msg: message });
        } finally { setPostingJob(false); }
    };

    const startEditJob = (job: JobRequest) => {
        if (readOnlyPreview) {
            setJobAlert({ type: "error", msg: "Admin preview is read-only." });
            return;
        }
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
        if (readOnlyPreview) {
            setJobAlert({ type: "error", msg: "Admin preview is read-only." });
            return;
        }
        setSavingJob(true); setEditJobError(null);
        try {
            if (adminTestMode) {
                const response = await fetch(`/api/admin/test-personas/employer/jobs/${editingJobId!}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
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
                    }),
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Failed to update sandbox job request.");
            } else {
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
            }
            setEditingJobId(null);
            await fetchData();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to save";
            setEditJobError(msg);
        } finally { setSavingJob(false); }
    };

    const deleteJob = async (jobId: string) => {
        if (readOnlyPreview) {
            setJobAlert({ type: "error", msg: "Admin preview is read-only." });
            return;
        }
        try {
            if (adminTestMode) {
                const response = await fetch(`/api/admin/test-personas/employer/jobs/${jobId}`, {
                    method: "DELETE",
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || "Failed to delete sandbox job request.");
            } else {
                await supabase.from("job_requests").delete().eq("id", jobId);
                setJobs(prev => prev.filter(j => j.id !== jobId));
            }
            if (adminTestMode) {
                await fetchData();
            }
            setConfirmDeleteJobId(null);
        } catch (error) {
            setJobAlert({ type: "error", msg: error instanceof Error ? error.message : "Failed to delete job." });
        }
    };

    const completion = getEmployerCompletion({ employer: companyForm }).completion;

    if (loading) return (
        <div className={`${surfaceClass} flex min-h-[320px] items-center justify-center`}>
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-[#111111] border-t-transparent" />
        </div>
    );

    const hasCountry = companyForm.country.trim().length > 0;
    const openJobsCount = jobs.filter((job) => job.status === "open").length;
    const showCompanyForm = editing || (readOnlyPreview && !employer);
    const workspaceStatus = readOnlyPreview
        ? "Preview"
        : !hasCountry
            ? "Setup"
            : completion === 100
                ? "Complete"
                : "In Progress";
    const workspaceSummary = readOnlyPreview
        ? "Review the employer workspace structure without changing your admin role."
        : "Keep company details, readiness, and job requests in one workspace.";

    return (
        <div className="space-y-6">
            <section className={heroSurfaceClass}>
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                            <Building2 size={14} />
                            Employer Workspace
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">
                            {companyForm.company_name || (readOnlyPreview ? "Employer Preview" : "Company Profile")}
                        </h1>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#52525b]">
                            {workspaceSummary}
                        </p>
                        {hasCountry && (
                            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#9ca3af]">
                                {companyForm.country}
                                {companyForm.city ? ` · ${companyForm.city}` : ""}
                                {companyForm.website ? ` · ${companyForm.website}` : ""}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <EmployerMetricCard label="Completion" value={`${completion}%`} />
                        <EmployerMetricCard label="Jobs" value={jobs.length} />
                        <EmployerMetricCard label="Open" value={openJobsCount} />
                        <EmployerMetricCard label="Status" value={workspaceStatus} />
                    </div>
                </div>
                <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[#111111]/5 blur-3xl" />
            </section>

            <section className="space-y-6">
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

                                {showCompanyForm ? (
                                    <div className={surfaceClass}>
                                        <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold text-[#18181b]">
                                            {showCompanyForm && !readOnlyPreview ? <Pencil size={20} className="text-[#111111]" /> : <Building2 className="text-[#111111]" />}
                                            {readOnlyPreview ? "Company Profile Preview" : employer ? "Edit Company Details" : "Complete Company Details"}
                                        </h3>

                                        <fieldset className="space-y-6" disabled={readOnlyPreview || saving}>
                                            <div>
                                                <label className={labelClass}>Company Name <span className="text-red-500">*</span></label>
                                                <input type="text" name="company_name" required value={companyForm.company_name} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., Northway Logistics Ltd." />
                                            </div>

                                            <div>
                                                <label className={labelClass}>Industry <span className="text-red-500">*</span></label>
                                                <AdaptiveSelect name="industry" value={companyForm.industry} onChange={handleCompanyChange} className={inputClass} desktopSearchPlaceholder="Search industry">
                                                    <option value="">Select industry...</option>
                                                    {EMPLOYER_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                                </AdaptiveSelect>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className={labelClass}>Tax ID / VAT (Optional)</label>
                                                    <input type="text" name="tax_id" value={companyForm.tax_id} onChange={handleCompanyChange} className={inputClass} placeholder="Company tax or VAT number" maxLength={32} />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Company Registration Number (Optional)</label>
                                                    <input type="text" name="company_registration_number" value={companyForm.company_registration_number} onChange={handleCompanyChange} className={inputClass} placeholder="Official registration number" maxLength={32} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <label className={labelClass}>Country <span className="text-red-500">*</span></label>
                                                    <AdaptiveSelect name="country" value={companyForm.country} onChange={handleCompanyChange} className={inputClass} desktopSearchPlaceholder="Search country">
                                                        <option value="">Select country...</option>
                                                        {EUROPEAN_COUNTRIES.map(c => (<option key={c} value={c}>{getCountryDisplayLabel(c)}</option>))}
                                                    </AdaptiveSelect>
                                                </div>
                                                <div>
                                                    <label className={labelClass}>City (Optional)</label>
                                                    <input type="text" name="city" value={companyForm.city} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., Berlin" />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Postal Code (Optional)</label>
                                                    <input type="text" name="postal_code" value={companyForm.postal_code} onChange={handleCompanyChange} className={inputClass} placeholder="e.g., 10115" maxLength={16} />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Company Size (Optional)</label>
                                                    <AdaptiveSelect name="company_size" value={companyForm.company_size} onChange={handleCompanyChange} className={inputClass} desktopSearchThreshold={999}>
                                                        <option value="">Select size...</option>
                                                        {COMPANY_SIZES.map(s => (<option key={s} value={s}>{s}</option>))}
                                                    </AdaptiveSelect>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <label className={labelClass}>Contact Phone <span className="text-red-500">*</span></label>
                                                    <InternationalPhoneField
                                                        value={companyForm.contact_phone}
                                                        onChange={(phone) => setCompanyForm(prev => ({ ...prev, contact_phone: phone }))}
                                                        inputClassName={inputClass}
                                                    />
                                                    <p className="text-[11px] text-gray-500 mt-1">
                                                        Do not type &apos;0&apos; before your number. If your number is 0601234567, just type 601234567.
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Website (Optional)</label>
                                                    <input type="url" name="website" value={companyForm.website} onChange={handleCompanyChange} className={inputClass} placeholder="https://yourcompany.com" />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Founded Year (Optional)</label>
                                                    <input type="text" name="founded_year" value={companyForm.founded_year} onChange={handleCompanyChange} className={inputClass} placeholder="2010" maxLength={4} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className={labelClass}>Business Registry Number (Optional)</label>
                                                    <input type="text" name="business_registry_number" value={companyForm.business_registry_number} onChange={handleCompanyChange} className={inputClass} placeholder="Official registry reference" />
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Company Founding Date (Optional)</label>
                                                    <input type="text" name="founding_date" value={companyForm.founding_date} onChange={handleCompanyChange} className={inputClass} placeholder="DD/MM/YYYY" />
                                                </div>
                                            </div>

                                            <div>
                                                <label className={labelClass}>Company Address (Optional)</label>
                                                <textarea name="company_address" value={companyForm.company_address} onChange={handleCompanyChange} rows={2} className={`${inputClass} resize-none`} placeholder="Registered business address..." />
                                            </div>

                                            <div>
                                                <label className={labelClass}>Company Description (Optional)</label>
                                                <textarea name="description" value={companyForm.description} onChange={handleCompanyChange} rows={3} className={`${inputClass} resize-none`} placeholder="Brief description of your company and activities..." />
                                            </div>

                                            <div className="flex flex-col-reverse gap-3 border-t border-[#e5e7eb] pt-4 sm:flex-row sm:justify-end">
                                                {employer && !readOnlyPreview && (
                                                    <button type="button" onClick={cancelEdit} className="w-full rounded-2xl border border-[#d1d5db] px-6 py-3 text-center font-semibold text-[#52525b] transition hover:bg-[#fafafa] sm:w-auto">
                                                        Cancel
                                                    </button>
                                                )}
                                                {readOnlyPreview ? (
                                                    <div className="w-full rounded-2xl border border-[#dbe4f0] bg-[#f8fafc] px-4 py-3 text-center text-sm font-medium text-[#475569] sm:w-auto">
                                                        Company editing is disabled in admin preview.
                                                    </div>
                                                ) : (
                                                    <button type="button" onClick={saveCompany} disabled={saving}
                                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-8 py-3 font-semibold text-white transition hover:bg-[#2b2b2b] disabled:opacity-50 sm:w-auto">
                                                        {saving ? "Saving..." : "Save Changes"}
                                                    </button>
                                                )}
                                            </div>
                                        </fieldset>
                                    </div>
                                ) : (
                                    <div className={surfaceClass}>
                                        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <h3 className="flex items-center gap-2 text-xl font-semibold text-[#18181b]">
                                                <Building2 className="text-[#111111]" /> Company Information
                                            </h3>
                                            {!readOnlyPreview && employer && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing(true)}
                                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d1d5db] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:bg-slate-50"
                                                >
                                                    <Pencil size={16} />
                                                    Edit company
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <InfoRow icon={<Building2 size={18} />} label="Company Name" value={companyForm.company_name} />
                                            <InfoRow icon={<Briefcase size={18} />} label="Industry" value={companyForm.industry} />
                                            {companyForm.tax_id && <InfoRow icon={<Hash size={18} />} label="Tax ID / VAT" value={companyForm.tax_id} />}
                                            {companyForm.company_registration_number && <InfoRow icon={<FileText size={18} />} label="Registration No." value={companyForm.company_registration_number} />}
                                            <InfoRow icon={<Globe size={18} />} label="Country" value={companyForm.country} />
                                            {companyForm.city && <InfoRow icon={<MapPin size={18} />} label="City" value={companyForm.city} />}
                                            {companyForm.company_size && <InfoRow icon={<Users size={18} />} label="Company Size" value={companyForm.company_size} />}
                                            <InfoRow icon={<Phone size={18} />} label="Phone" value={companyForm.contact_phone} />
                                            <InfoRow icon={<Globe size={18} />} label="Website" value={companyForm.website} />
                                            {companyForm.founded_year && <InfoRow icon={<Calendar size={18} />} label="Founded" value={companyForm.founded_year} />}
                                            {companyForm.postal_code && <InfoRow icon={<MapPin size={18} />} label="Postal Code" value={companyForm.postal_code} />}
                                            {companyForm.business_registry_number && <InfoRow icon={<FileText size={18} />} label="Business Registry No." value={companyForm.business_registry_number} />}
                                            {companyForm.founding_date && <InfoRow icon={<Calendar size={18} />} label="Founding Date" value={companyForm.founding_date} />}
                                            {companyForm.company_address && <InfoRow icon={<MapPin size={18} />} label="Address" value={companyForm.company_address} />}
                                            {companyForm.description && <InfoRow icon={<FileText size={18} />} label="Description" value={companyForm.description} />}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ====================== POST A JOB TAB ====================== */}
                        {activeTab === 'post-job' && (employer || readOnlyPreview) && (
                            <div className={surfaceClass}>
                                <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold text-[#18181b]">
                                    <div className="rounded-lg bg-[#eef2f7] p-2 text-[#475569]"><Plus size={20} /></div>
                                    {readOnlyPreview ? "New Job Request Preview" : "New Job Request"}
                                </h3>

                                {jobAlert && !readOnlyPreview && (
                                    <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${jobAlert.type === "success"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-red-50 text-red-700 border border-red-200"}`}>
                                        {jobAlert.msg}
                                    </div>
                                )}

                                <fieldset className="space-y-6" disabled={readOnlyPreview}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className={labelClass}>Job Title <span className="text-red-500">*</span></label>
                                            <input type="text" name="title" value={jobForm.title} onChange={handleJobChange} className={inputClass} placeholder="e.g., Construction Worker, Welder" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Industry <span className="text-red-500">*</span></label>
                                            <AdaptiveSelect value={jobForm.industry} onChange={(e) => setJobForm(prev => ({ ...prev, industry: e.target.value }))} className={inputClass} desktopSearchPlaceholder="Search industry">
                                                <option value="">Select Industry</option>
                                                {EMPLOYER_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                            </AdaptiveSelect>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Job Description</label>
                                        <textarea name="description" value={jobForm.description} onChange={handleJobChange} rows={3} className={`${inputClass} resize-none`} placeholder="Describe responsibilities, requirements..." />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
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
                                            <AdaptiveSelect name="work_schedule" value={jobForm.work_schedule} onChange={handleJobChange} className={inputClass} desktopSearchThreshold={999}>
                                                <option value="Full-time (40 hours/week)">Full-time (40h)</option>
                                                <option value="Shift work">Shift work</option>
                                            </AdaptiveSelect>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Contract</label>
                                            <AdaptiveSelect name="contract_duration_months" value={jobForm.contract_duration_months} onChange={handleJobChange} className={inputClass} desktopSearchThreshold={999}>
                                                <option value="6">6 months</option>
                                                <option value="12">12 months</option>
                                                <option value="24">24 months</option>
                                                <option value="36">36+ months</option>
                                            </AdaptiveSelect>
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

                                    <div className="flex flex-col gap-3 border-t border-[#e5e7eb] pt-4 sm:flex-row sm:justify-end">
                                        {readOnlyPreview ? (
                                                <div className="w-full rounded-2xl border border-[#dbe4f0] bg-[#f8fafc] px-4 py-3 text-center text-sm font-medium text-[#475569] sm:w-auto">
                                                Job request creation is disabled in admin preview
                                            </div>
                                        ) : (
                                            <button type="button" onClick={submitJob} disabled={postingJob}
                                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-8 py-3 font-semibold text-white transition hover:bg-[#2b2b2b] disabled:opacity-50 sm:w-auto">
                                                {postingJob ? (
                                                    <><div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div> Posting...</>
                                                ) : <><Plus className="w-5 h-5" /> Create Job Request</>}
                                            </button>
                                        )}
                                    </div>
                                </fieldset>
                            </div>
                        )}

                        {/* ====================== POSTED JOBS TAB ====================== */}
                        {activeTab === 'jobs' && (employer || readOnlyPreview) && (
                            <div className="space-y-6">
                                {jobs.length === 0 ? (
                                    <div className={`${surfaceClass} px-4 py-10 text-center sm:p-12`}>
                                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#fafafa]">
                                            <Briefcase size={32} className="text-[#6b7280]" />
                                        </div>
                                        <h3 className="mb-2 text-xl font-semibold text-[#18181b]">No job requests yet</h3>
                                        <p className="text-[#6b7280]">Use New Job Request in the sidebar to create the first opening and start matching with workers.</p>
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
                                                        {editingJobId === job.id && !readOnlyPreview ? (
                                                            <>
                                                                <button onClick={() => setEditingJobId(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
                                                                <button onClick={saveEditJob} disabled={savingJob} className="px-4 py-2 text-sm font-bold bg-[#1877f2] text-white rounded-lg hover:bg-blue-600">Save</button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {!readOnlyPreview && (
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
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Editing Form */}
                                                {editingJobId === job.id && !readOnlyPreview && (
                                                    <div className="mt-6 pt-6 border-t border-slate-100 bg-slate-50/50 -mx-6 -mb-6 p-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                            <div>
                                                                <label className={labelClass}>Job Title</label>
                                                                <input type="text" value={editJobForm.title} onChange={(e) => setEditJobForm(p => ({ ...p, title: e.target.value }))} className={inputClass} />
                                                            </div>
                                                            <div>
                                                                <label className={labelClass}>Industry</label>
                                                                <AdaptiveSelect value={editJobForm.industry} onChange={(e) => setEditJobForm(p => ({ ...p, industry: e.target.value }))} className={inputClass} desktopSearchPlaceholder="Search industry">
                                                                    {EMPLOYER_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                                                </AdaptiveSelect>
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
            </section>
        </div>
    );
}

// ─── Helper Components ──────────────────────────────────────────

function EmployerMetricCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 shadow-[0_18px_35px_-32px_rgba(15,23,42,0.18)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-[#18181b]">{value}</div>
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | null | undefined }) {
    return (
        <div className="group">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[#9ca3af] transition-colors group-hover:text-[#52525b]">{icon}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">{label}</span>
            </div>
            <div className="border-b border-transparent pb-1 pl-7 text-sm font-medium text-[#18181b] transition-colors group-hover:border-[#e5e7eb]">
                {value || <span className="italic text-[#9ca3af]">Not provided</span>}
            </div>
        </div>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-emerald-100 text-emerald-700 border-emerald-200",
        closed: "bg-slate-100 text-slate-600 border-slate-200",
        filled: "bg-blue-100 text-blue-700 border-blue-200",
        draft: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return (
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${styles[status] || styles.closed}`}>
            {status}
        </span>
    );
}

const IndustrySelect = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
    <AdaptiveSelect value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} desktopSearchPlaceholder="Search industry">
        <option value="">Select Industry</option>
        {EMPLOYER_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
    </AdaptiveSelect>
);
