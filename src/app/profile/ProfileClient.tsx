"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
        if (!doc) return { status: "missing", label: "Not uploaded", color: "gray" };
        if (doc.verification_status === "verified") return { status: "verified", label: "Verified", color: "green" };
        if (doc.verification_status === "rejected") return { status: "rejected", label: "Rejected", color: "red" };
        return { status: "pending", label: "Pending review", color: "amber" };
    };

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* Top Navigation */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-200">
                <div className="max-w-[900px] mx-auto px-4">
                    <div className="flex justify-between h-14 items-center">
                        <Link href="/" className="flex items-center gap-2">
                            <img src="/logo.png" alt="Workers United" width={36} height={36} className="rounded" />
                            <span className="font-bold text-teal-600 text-lg hidden sm:inline">Workers United</span>
                        </Link>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 hidden sm:inline">
                                {user.email}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${userType === "employer" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700"
                                }`}>
                                {userType === "employer" ? "Employer" : "Worker"}
                            </span>
                            <a href="/auth/signout" className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100">
                                Logout
                            </a>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-[900px] mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {userType === "employer" ? "Company Profile" : "My Profile"}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {userType === "employer"
                            ? "Manage your company information and hiring preferences"
                            : "View your application status and documents"}
                    </p>
                </div>

                {/* Alerts */}
                {success && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <span>✓</span> Saved successfully!
                    </div>
                )}
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* EMPLOYER VIEW */}
                {userType === "employer" && (
                    <div className="space-y-4">
                        {/* Company Info */}
                        <Card title="Company Information" badge={employer?.status}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Company Name *" name="company_name" value={employerForm.company_name}
                                    onChange={handleEmployerChange} placeholder="ABC Construction d.o.o." />
                                <Input label="PIB (Tax ID) *" name="pib" value={employerForm.pib}
                                    onChange={handleEmployerChange} placeholder="12345678" maxLength={8}
                                    helper="8 digits, required for visa" />
                                <Select label="Industry" name="industry" value={employerForm.industry}
                                    onChange={handleEmployerChange} options={INDUSTRIES} />
                                <Select label="Company Size" name="company_size" value={employerForm.company_size}
                                    onChange={handleEmployerChange} options={COMPANY_SIZES} />
                                <Input label="Contact Phone" name="contact_phone" value={employerForm.contact_phone}
                                    onChange={handleEmployerChange} placeholder="+381 11 123 4567" />
                                <Input label="Website" name="website" value={employerForm.website}
                                    onChange={handleEmployerChange} placeholder="https://company.com" />
                            </div>
                            <div className="mt-4">
                                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">About Company</label>
                                <textarea name="description" value={employerForm.description} onChange={handleEmployerChange}
                                    rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] 
                                    bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                                    placeholder="Brief company description..." />
                            </div>
                        </Card>

                        {/* Addresses */}
                        <Card title="Addresses">
                            <div className="space-y-4">
                                <Input label="Company Address" name="company_address" value={employerForm.company_address}
                                    onChange={handleEmployerChange} placeholder="Full registered address" textarea />
                                <Input label="Worker Accommodation *" name="accommodation_address" value={employerForm.accommodation_address}
                                    onChange={handleEmployerChange} placeholder="Where workers will stay" textarea
                                    helper="⚠️ Required for visa processing" />
                                <Input label="Work Location" name="work_location" value={employerForm.work_location}
                                    onChange={handleEmployerChange} placeholder="City, Serbia" />
                            </div>
                        </Card>

                        {/* Hiring */}
                        <Card title="Hiring Preferences">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input type="number" label="Workers Needed" name="workers_needed"
                                    value={employerForm.workers_needed}
                                    onChange={(e) => setEmployerForm(p => ({ ...p, workers_needed: parseInt(e.target.value) || 1 }))} />
                                <Input label="Salary (EUR/month)" name="salary_range" value={employerForm.salary_range}
                                    onChange={handleEmployerChange} placeholder="1200-1500" />
                            </div>
                            <div className="mt-4">
                                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Job Description</label>
                                <textarea name="job_description" value={employerForm.job_description} onChange={handleEmployerChange}
                                    rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] 
                                    bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                                    placeholder="Job duties, requirements, conditions..." />
                            </div>
                        </Card>

                        {/* Save Button */}
                        <div className="flex justify-end">
                            <button onClick={saveEmployer} disabled={saving}
                                className="px-6 py-2.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-medium disabled:opacity-50">
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                )}

                {/* CANDIDATE VIEW */}
                {userType === "candidate" && (
                    <div className="space-y-4">
                        {/* Personal Info */}
                        <Card title="Personal Information" badge={candidate?.status}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InfoRow label="Full Name" value={candidate?.profiles?.full_name || "—"} />
                                <InfoRow label="Email" value={user.email} />
                                <InfoRow label="Phone" value={candidate?.phone || "—"} />
                                <InfoRow label="Date of Birth" value={candidate?.date_of_birth || "—"} />
                                <InfoRow label="Nationality" value={candidate?.nationality || "—"} />
                                <InfoRow label="Passport Number" value={candidate?.passport_number || "—"} />
                            </div>
                            {!candidate?.onboarding_completed && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-amber-800 text-sm">
                                        ⚠️ Complete your profile to proceed with verification.
                                    </p>
                                    <Link href="/onboarding" className="text-amber-700 font-medium text-sm hover:underline mt-1 inline-block">
                                        Continue Onboarding →
                                    </Link>
                                </div>
                            )}
                        </Card>

                        {/* Documents */}
                        <Card title="Documents">
                            <div className="space-y-3">
                                <DocRow label="Passport" status={getDocStatus("passport")} />
                                <DocRow label="Photo" status={getDocStatus("photo")} />
                                <DocRow label="Diploma" status={getDocStatus("diploma")} />
                            </div>
                            {candidate?.onboarding_completed && (
                                <Link href="/onboarding" className="text-teal-600 font-medium text-sm hover:underline mt-4 inline-block">
                                    Update Documents →
                                </Link>
                            )}
                        </Card>

                        {/* Application Status */}
                        <Card title="Application Status">
                            <div className="space-y-3">
                                <StatusStep label="Profile Created" done={!!candidate} />
                                <StatusStep label="Documents Uploaded" done={documents.length >= 3} />
                                <StatusStep label="Verification Complete" done={candidate?.status === "verified"} />
                                <StatusStep label="In Matching Queue" done={candidate?.status === "verified"} />
                            </div>
                        </Card>

                        {/* Offers */}
                        {offers.length > 0 && (
                            <Card title="Job Offers">
                                <div className="space-y-3">
                                    {offers.map((offer: any) => (
                                        <div key={offer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="font-medium text-gray-900">{offer.employers?.company_name}</p>
                                                <p className="text-sm text-gray-500">{offer.position || "Worker position"}</p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${offer.status === "accepted" ? "bg-green-100 text-green-700" :
                                                    offer.status === "rejected" ? "bg-red-100 text-red-700" :
                                                        "bg-amber-100 text-amber-700"
                                                }`}>
                                                {offer.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Reusable Components
function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-[15px]">{title}</h2>
                {badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge === "verified" || badge === "active" ? "bg-green-100 text-green-700" :
                            badge === "rejected" ? "bg-red-100 text-red-700" :
                                "bg-amber-100 text-amber-700"
                        }`}>
                        {badge.toUpperCase()}
                    </span>
                )}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

function Input({ label, name, value, onChange, placeholder, type = "text", maxLength, helper, textarea }: any) {
    const baseClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors";
    return (
        <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{label}</label>
            {textarea ? (
                <textarea name={name} value={value} onChange={onChange} placeholder={placeholder}
                    rows={2} className={baseClass + " resize-none"} />
            ) : (
                <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder}
                    maxLength={maxLength} className={baseClass} />
            )}
            {helper && <p className="text-[11px] text-gray-500 mt-1">{helper}</p>}
        </div>
    );
}

function Select({ label, name, value, onChange, options }: any) {
    return (
        <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{label}</label>
            <select name={name} value={value} onChange={onChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                <option value="">Select...</option>
                {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[13px] text-gray-500">{label}</p>
            <p className="text-[15px] text-gray-900 font-medium">{value}</p>
        </div>
    );
}

function DocRow({ label, status }: { label: string; status: { label: string; color: string } }) {
    const colors: Record<string, string> = {
        green: "bg-green-100 text-green-700",
        red: "bg-red-100 text-red-700",
        amber: "bg-amber-100 text-amber-700",
        gray: "bg-gray-100 text-gray-600"
    };
    return (
        <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="text-[15px] text-gray-900">{label}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[status.color]}`}>
                {status.label}
            </span>
        </div>
    );
}

function StatusStep({ label, done }: { label: string; done: boolean }) {
    return (
        <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${done ? "bg-green-500" : "bg-gray-300"
                }`}>
                {done ? "✓" : ""}
            </div>
            <span className={`text-[15px] ${done ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
        </div>
    );
}
