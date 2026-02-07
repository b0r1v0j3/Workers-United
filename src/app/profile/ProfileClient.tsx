"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    User,
    Briefcase,
    FileText,
    CheckCircle2,
    AlertCircle,
    Building2,
    MapPin,
    Phone,
    Globe,
    LogOut,
    Menu,
    X,
    ChevronRight,
    UploadCloud,
    Clock,
    Shield
} from "lucide-react";

interface ProfileClientProps {
    userType: "candidate" | "employer";
    user: any;
    candidate?: any;
    employer?: any;
    documents?: any[];
    offers?: any[];
}

const INDUSTRIES = [
    "Construction", "Manufacturing", "Agriculture", "Hospitality",
    "Healthcare", "Transportation", "Retail", "IT & Technology",
    "Food Processing", "Warehousing & Logistics", "Other"
];

const COMPANY_SIZES = [
    "1-10 employees", "11-50 employees", "51-200 employees",
    "201-500 employees", "500+ employees"
];

export default function ProfileClient({
    userType, user, candidate, employer, documents = [], offers = []
}: ProfileClientProps) {
    const router = useRouter();
    const supabase = createClient();
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Employer form state
    const [employerForm, setEmployerForm] = useState({
        company_name: employer?.company_name || "",
        pib: employer?.pib || "",
        industry: employer?.industry || "",
        company_size: employer?.company_size || "",
        contact_phone: employer?.contact_phone || "",
        website: employer?.website || "",
        company_address: employer?.company_address || "",
        accommodation_address: employer?.accommodation_address || "",
        work_location: employer?.work_location || "",
        workers_needed: employer?.workers_needed || 1,
        salary_range: employer?.salary_range || "",
        job_description: employer?.job_description || "",
        description: employer?.description || "",
    });

    const handleEmployerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setEmployerForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const saveEmployer = async () => {
        setSaving(true);
        setError("");
        try {
            if (employerForm.pib && !/^\d{8}$/.test(employerForm.pib)) {
                throw new Error("PIB must be exactly 8 digits");
            }

            const data = {
                company_name: employerForm.company_name || null,
                pib: employerForm.pib || null,
                industry: employerForm.industry || null,
                company_size: employerForm.company_size || null,
                contact_phone: employerForm.contact_phone || null,
                website: employerForm.website || null,
                company_address: employerForm.company_address || null,
                accommodation_address: employerForm.accommodation_address || null,
                work_location: employerForm.work_location || null,
                workers_needed: parseInt(String(employerForm.workers_needed)) || 1,
                salary_range: employerForm.salary_range || null,
                job_description: employerForm.job_description || null,
                description: employerForm.description || null,
            };

            if (employer?.id) {
                await supabase.from("employers").update(data).eq("id", employer.id);
            } else {
                await supabase.from("employers").insert({ ...data, profile_id: user.id, status: "pending" });
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const getDocStatus = (type: string) => {
        const doc = documents.find(d => d.document_type === type);
        if (!doc) return { status: "missing", label: "Not uploaded", color: "slate" };
        if (doc.status === "verified") return { status: "verified", label: "Verified", color: "emerald" };
        if (doc.status === "rejected") return { status: "rejected", label: "Rejected", color: "red" };
        if (doc.status === "verifying") return { status: "verifying", label: "Verifying...", color: "amber" };
        return { status: "uploaded", label: "Uploaded", color: "blue" };
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Top Navigation */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg group-hover:bg-blue-700 transition-colors">
                                W
                            </div>
                            <span className="font-bold text-slate-800 text-lg hidden sm:inline group-hover:text-blue-600 transition-colors">
                                Workers United
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-medium text-slate-900">{user.email}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${userType === "employer" ? "bg-indigo-50 text-indigo-700" : "bg-blue-50 text-blue-700"
                                    }`}>
                                    {userType === "employer" ? <Building2 size={10} /> : <User size={10} />}
                                    {userType === "employer" ? "Employer Account" : "Worker Account"}
                                </span>
                            </div>
                            <div className="h-8 w-px bg-slate-200" />
                            <a
                                href="/auth/signout"
                                className="text-sm font-medium text-slate-500 hover:text-red-600 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <LogOut size={16} />
                                Sign Out
                            </a>
                        </div>

                        {/* Mobile menu button */}
                        <div className="flex md:hidden items-center">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-slate-200 bg-white">
                        <div className="px-4 py-3 space-y-3">
                            <div className="pb-3 border-b border-slate-100">
                                <p className="text-sm font-medium text-slate-900">{user.email}</p>
                                <p className="text-xs text-slate-500 mt-1 capitalize">{userType}</p>
                            </div>
                            <a href="/auth/signout" className="block text-base font-medium text-slate-600 hover:text-slate-900 py-2">
                                Sign Out
                            </a>
                        </div>
                    </div>
                )}
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8 md:flex md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            {userType === "employer" ? "Company Dashboard" : "My Dashboard"}
                        </h1>
                        <p className="text-slate-500 mt-2 text-lg">
                            {userType === "employer"
                                ? "Manage your company profile and hiring needs."
                                : "Track your application status and manage documents."}
                        </p>
                    </div>
                    <div className="mt-4 md:mt-0">
                        {/* Action buttons could go here */}
                    </div>
                </div>

                {/* Feedback Alerts */}
                {success && (
                    <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 size={20} className="text-emerald-600" />
                        <span className="font-medium">Changes saved successfully!</span>
                    </div>
                )}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={20} className="text-red-600" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN (Main Content) */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* EMPLOYER FORM */}
                        {userType === "employer" && (
                            <>
                                <Section title="Company Details" icon={<Building2 />}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Input label="Company Name *" name="company_name" value={employerForm.company_name}
                                            onChange={handleEmployerChange} placeholder="ABC DOO" />
                                        <Input label="PIB (Tax ID) *" name="pib" value={employerForm.pib}
                                            onChange={handleEmployerChange} placeholder="12345678" maxLength={8}
                                            helper="Must be exactly 8 digits" />
                                        <Select label="Industry" name="industry" value={employerForm.industry}
                                            onChange={handleEmployerChange} options={INDUSTRIES} />
                                        <Select label="Company Size" name="company_size" value={employerForm.company_size}
                                            onChange={handleEmployerChange} options={COMPANY_SIZES} />
                                        <Input label="Website" name="website" value={employerForm.website}
                                            onChange={handleEmployerChange} placeholder="https://company.com" icon={<Globe size={16} />} />
                                        <Input label="Contact Phone" name="contact_phone" value={employerForm.contact_phone}
                                            onChange={handleEmployerChange} placeholder="+381..." icon={<Phone size={16} />} />
                                    </div>
                                    <div className="mt-6">
                                        <TextArea label="About Company" name="description" value={employerForm.description}
                                            onChange={handleEmployerChange} placeholder="Brief description..." />
                                    </div>
                                </Section>

                                <Section title="Locations" icon={<MapPin />}>
                                    <div className="space-y-6">
                                        <TextArea label="Registered Address" name="company_address" value={employerForm.company_address}
                                            onChange={handleEmployerChange} placeholder="Full address..." rows={2} />
                                        <TextArea label="Worker Accommodation Address *" name="accommodation_address" value={employerForm.accommodation_address}
                                            onChange={handleEmployerChange} placeholder="Where workers will stay..." rows={2}
                                            helper="Required for visa processing" />
                                        <Input label="Work City" name="work_location" value={employerForm.work_location}
                                            onChange={handleEmployerChange} placeholder="Belgrade, Serbia" />
                                    </div>
                                </Section>

                                <Section title="Hiring Requirements" icon={<Briefcase />}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Input type="number" label="Workers Needed" name="workers_needed"
                                            value={employerForm.workers_needed}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmployerForm(p => ({ ...p, workers_needed: parseInt(e.target.value) || 1 }))} />
                                        <Input label="Salary Range (EUR)" name="salary_range" value={employerForm.salary_range}
                                            onChange={handleEmployerChange} placeholder="e.g. 800 - 1200" />
                                    </div>
                                    <div className="mt-6">
                                        <TextArea label="Job Description & Requirements" name="job_description" value={employerForm.job_description}
                                            onChange={handleEmployerChange} placeholder="Describe the role..." rows={4} />
                                    </div>
                                </Section>

                                <div className="flex justify-end pt-4">
                                    <button
                                        onClick={saveEmployer}
                                        disabled={saving}
                                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                                    >
                                        {saving ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* CANDIDATE VIEW - MAIN COLUMN */}
                        {userType === "candidate" && (
                            <>
                                {/* Application Status Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <StatusCard
                                        label="Profile Status"
                                        status={candidate?.status || "pending"}
                                        icon={<User className="text-blue-500" />}
                                    />
                                    <StatusCard
                                        label="Documents"
                                        status={documents.length >= 3 ? "completed" : "pending"}
                                        icon={<FileText className="text-amber-500" />}
                                        subtext={`${documents.length}/3 Uploaded`}
                                    />
                                    <StatusCard
                                        label="Job Match"
                                        status={offers.length > 0 ? "active" : "waiting"}
                                        icon={<Briefcase className="text-purple-500" />}
                                        subtext={offers.length > 0 ? `${offers.length} Offers` : "In Queue"}
                                    />
                                </div>

                                {/* Application Data Summary */}
                                <Section title="Application Data" icon={<User />}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                        <InfoRow label="Full Name" value={candidate?.profiles?.full_name || "Not set"} />
                                        <InfoRow label="Email" value={user.email} />
                                        <InfoRow label="Phone" value={candidate?.phone || "—"} />
                                        <InfoRow label="Nationality" value={candidate?.nationality || "—"} />
                                        <InfoRow label="Date of Birth" value={candidate?.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString() : "—"} />
                                        <InfoRow label="Passport" value={candidate?.passport_number || "—"} />
                                    </div>

                                    {!candidate?.onboarding_completed && (
                                        <div className="mt-6 bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-4">
                                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                                <AlertCircle size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-amber-900">Complete your profile</h4>
                                                <p className="text-amber-700 text-sm mt-1 mb-3">
                                                    You need to complete the onboarding process to be verified.
                                                </p>
                                                <Link
                                                    href="/onboarding"
                                                    className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg transition-colors"
                                                >
                                                    Continue Onboarding <ChevronRight size={16} />
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                    {/* Link to Edit Application Data */}
                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <Link
                                            href="/dashboard/application"
                                            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"
                                        >
                                            Edit Personal Data <ChevronRight size={16} />
                                        </Link>
                                    </div>
                                </Section>

                                {/* Job Offers */}
                                {offers.length > 0 && (
                                    <Section title="Job Offers" icon={<Briefcase />} badge={offers.length.toString()}>
                                        <div className="space-y-4">
                                            {offers.map((offer: any) => (
                                                <div key={offer.id} className="group relative p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-200 transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h4 className="font-bold text-slate-900">{offer.employers?.company_name}</h4>
                                                            <p className="text-sm text-slate-500 font-medium">{offer.position || "Worker position"}</p>
                                                        </div>
                                                        <Badge status={offer.status} />
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                                        <span className="flex items-center gap-1"><MapPin size={12} /> {offer.employers?.work_location || "Serbia"}</span>
                                                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(offer.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}
                            </>
                        )}
                    </div>

                    {/* RIGHT COLUMN (Sidebar) */}
                    <div className="lg:col-span-1 space-y-8">
                        {/* Documents Sidebar */}
                        {userType === "candidate" && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-24">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <FileText size={18} className="text-slate-400" /> Documents
                                    </h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    <DocumentItem label="Passport" status={getDocStatus("passport")} />
                                    <DocumentItem label="Photo" status={getDocStatus("photo")} />
                                    <DocumentItem label="Diploma" status={getDocStatus("diploma")} />
                                    <DocumentItem label="Certificate" status={getDocStatus("certificate")} />
                                </div>
                                <div className="px-4 pb-4">
                                    <Link
                                        href="/onboarding"
                                        className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
                                    >
                                        <UploadCloud size={16} /> Manage Documents
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Help / Support Card */}
                        <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                            <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                <Shield size={18} /> Support Center
                            </h3>
                            <p className="text-sm text-indigo-700 mb-4">
                                Need help with your application or profile? Contact our support team.
                            </p>
                            <a href="mailto:support@workersunited.com" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                                Contact Support →
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------

function Section({ title, icon, children, badge }: any) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                        {icon}
                    </div>
                    <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                </div>
                {badge && (
                    <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-md text-xs font-bold">
                        {badge}
                    </span>
                )}
            </div>
            <div className="p-6 md:p-8">
                {children}
            </div>
        </div>
    );
}

function StatusCard({ label, status, icon, subtext }: any) {
    const isGood = status === "verified" || status === "completed" || status === "active" || status === "accepted";
    const isBad = status === "rejected";

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
                <div className={`w-2.5 h-2.5 rounded-full ${isGood ? 'bg-emerald-500' : isBad ? 'bg-red-500' : 'bg-amber-400'}`} />
            </div>
            <div>
                <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
                <p className="text-slate-900 font-bold text-lg capitalize">{status}</p>
                {subtext && <p className="text-slate-400 text-xs mt-1">{subtext}</p>}
            </div>
        </div>
    );
}

function Input({ label, name, value, onChange, placeholder, type = "text", maxLength, helper, icon }: any) {
    return (
        <div className="space-y-1.5 group">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            <div className="relative">
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    className={`w-full ${icon ? 'pl-10 mr-4' : 'px-4'} py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm text-slate-800 placeholder:text-slate-400`}
                />
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
                        {icon}
                    </div>
                )}
            </div>
            {helper && <p className="text-xs text-slate-500">{helper}</p>}
        </div>
    );
}

function TextArea({ label, name, value, onChange, placeholder, rows = 3, helper }: any) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            <textarea
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm text-slate-800 placeholder:text-slate-400 resize-none"
            />
            {helper && <p className="text-xs text-slate-500">{helper}</p>}
        </div>
    );
}

function Select({ label, name, value, onChange, options }: any) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            <div className="relative">
                <select
                    name={name}
                    value={value}
                    onChange={onChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm text-slate-800 appearance-none cursor-pointer"
                >
                    <option value="">Select...</option>
                    {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronRight size={16} className="rotate-90" />
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="py-2 border-b border-slate-50 last:border-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-slate-900 font-medium">{value}</p>
        </div>
    );
}

function DocumentItem({ label, status }: { label: string; status: any }) {
    const bgColors: any = {
        emerald: "bg-emerald-100 text-emerald-700",
        red: "bg-red-100 text-red-700",
        amber: "bg-amber-100 text-amber-700",
        blue: "bg-blue-100 text-blue-700",
        slate: "bg-slate-100 text-slate-600"
    };

    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
            <span className="text-sm font-semibold text-slate-700">{label}</span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${bgColors[status.color] || bgColors.slate}`}>
                {status.label}
            </span>
        </div>
    );
}

function Badge({ status }: { status: string }) {
    const styles = {
        accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
        rejected: "bg-red-100 text-red-700 border-red-200",
        pending: "bg-amber-100 text-amber-700 border-amber-200",
        waiting: "bg-slate-100 text-slate-600 border-slate-200"
    };

    // @ts-ignore
    const defaultStyle = styles[status] || styles.pending;

    return (
        <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${defaultStyle}`}>
            {status}
        </span>
    );
}

