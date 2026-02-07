"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface EmployerProfile {
    id: string;
    company_name: string;
    pib: string | null;
    accommodation_address: string | null;
    company_address: string | null;
    contact_phone: string | null;
    workers_needed: number | null;
    job_description: string | null;
    salary_range: string | null;
    work_location: string | null;
    status: string;
    website: string | null;
    industry: string | null;
    company_size: string | null;
    founded_year: string | null;
    description: string | null;
}

const INDUSTRIES = [
    "Construction",
    "Manufacturing",
    "Agriculture",
    "Hospitality",
    "Healthcare",
    "Transportation",
    "Retail",
    "IT & Technology",
    "Food Processing",
    "Warehousing & Logistics",
    "Other"
];

const COMPANY_SIZES = [
    "1-10 employees",
    "11-50 employees",
    "51-200 employees",
    "201-500 employees",
    "500+ employees"
];

export default function EmployerProfilePage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [employer, setEmployer] = useState<EmployerProfile | null>(null);

    const [formData, setFormData] = useState({
        company_name: "",
        pib: "",
        company_address: "",
        accommodation_address: "",
        contact_phone: "",
        workers_needed: 1,
        job_description: "",
        salary_range: "",
        work_location: "",
        website: "",
        industry: "",
        company_size: "",
        founded_year: "",
        description: "",
    });

    useEffect(() => {
        async function fetchProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push("/login");
                    return;
                }
                setUser(user);

                const { data: emp } = await supabase
                    .from("employers")
                    .select("*")
                    .eq("profile_id", user.id)
                    .single();

                if (emp) {
                    setEmployer(emp);
                    setFormData({
                        company_name: emp.company_name || "",
                        pib: emp.pib || "",
                        company_address: emp.company_address || "",
                        accommodation_address: emp.accommodation_address || "",
                        contact_phone: emp.contact_phone || "",
                        workers_needed: emp.workers_needed || 1,
                        job_description: emp.job_description || "",
                        salary_range: emp.salary_range || "",
                        work_location: emp.work_location || "",
                        website: emp.website || "",
                        industry: emp.industry || "",
                        company_size: emp.company_size || "",
                        founded_year: emp.founded_year || "",
                        description: emp.description || "",
                    });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [supabase, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSaving(true);

        try {
            if (formData.pib && !/^\d{8}$/.test(formData.pib)) {
                throw new Error("PIB must be exactly 8 digits");
            }

            if (!formData.company_name.trim()) {
                throw new Error("Company name is required");
            }

            const updateData = {
                company_name: formData.company_name,
                pib: formData.pib || null,
                company_address: formData.company_address || null,
                accommodation_address: formData.accommodation_address || null,
                contact_phone: formData.contact_phone || null,
                workers_needed: formData.workers_needed,
                job_description: formData.job_description || null,
                salary_range: formData.salary_range || null,
                work_location: formData.work_location || null,
                website: formData.website || null,
                industry: formData.industry || null,
                company_size: formData.company_size || null,
                founded_year: formData.founded_year || null,
                description: formData.description || null,
            };

            if (employer) {
                const { error: updateError } = await supabase
                    .from("employers")
                    .update(updateData)
                    .eq("id", employer.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from("employers")
                    .insert({ ...updateData, profile_id: user.id, status: "pending" });
                if (insertError) throw insertError;
            }

            setSuccess(true);
            const { data: emp } = await supabase
                .from("employers")
                .select("*")
                .eq("profile_id", user.id)
                .single();
            if (emp) setEmployer(emp);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-[#1877f2] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* Facebook-style Top Nav */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-200">
                <div className="max-w-[900px] mx-auto px-4">
                    <div className="flex justify-between h-14 items-center">
                        <Link href="/" className="flex items-center gap-2">
                            <img src="/logo.png" alt="Workers United" className="h-20 w-auto object-contain" />
                            <span className="font-bold text-[#1877f2] text-xl tracking-tight">Workers United</span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/profile/employer"
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Overview
                            </Link>
                            <a href="/auth/signout" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
                                Logout
                            </a>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-[900px] mx-auto px-4 py-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
                    <p className="text-gray-500 mt-1">Manage your company information and hiring preferences</p>
                </div>

                {/* Alerts */}
                {success && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Profile saved successfully!
                    </div>
                )}
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {/* Basic Info Card */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Basic Information</h2>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${employer?.status === 'active' ? 'bg-green-100 text-green-700' :
                                    employer?.status === 'verified' ? 'bg-blue-100 text-blue-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                    {employer?.status?.toUpperCase() || 'NEW'}
                                </span>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Row 1 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Company Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="company_name"
                                            required
                                            value={formData.company_name}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="e.g., ABC Construction d.o.o."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            PIB (Tax ID) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="pib"
                                            value={formData.pib}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="12345678"
                                            maxLength={8}
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">8 digits, required for visa processing</p>
                                    </div>
                                </div>

                                {/* Row 2 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Industry
                                        </label>
                                        <select
                                            name="industry"
                                            value={formData.industry}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                        >
                                            <option value="">Select industry...</option>
                                            {INDUSTRIES.map(ind => (
                                                <option key={ind} value={ind}>{ind}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Company Size
                                        </label>
                                        <select
                                            name="company_size"
                                            value={formData.company_size}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                        >
                                            <option value="">Select size...</option>
                                            {COMPANY_SIZES.map(size => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Row 3 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Contact Phone
                                        </label>
                                        <input
                                            type="tel"
                                            name="contact_phone"
                                            value={formData.contact_phone}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="+381 11 123 4567"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Website
                                        </label>
                                        <input
                                            type="url"
                                            name="website"
                                            value={formData.website}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="https://yourcompany.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Founded Year
                                        </label>
                                        <input
                                            type="text"
                                            name="founded_year"
                                            value={formData.founded_year}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="2010"
                                            maxLength={4}
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                        About Company
                                    </label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors resize-none"
                                        placeholder="Brief description of your company..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Address Card */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Addresses</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                        Company Address
                                    </label>
                                    <textarea
                                        name="company_address"
                                        value={formData.company_address}
                                        onChange={handleChange}
                                        rows={2}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors resize-none"
                                        placeholder="Full registered business address..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                        Worker Accommodation Address <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="accommodation_address"
                                        value={formData.accommodation_address}
                                        onChange={handleChange}
                                        rows={2}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors resize-none"
                                        placeholder="Address where international workers will be accommodated..."
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1">⚠️ Required for visa processing</p>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                        Work Location
                                    </label>
                                    <input
                                        type="text"
                                        name="work_location"
                                        value={formData.work_location}
                                        onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                        placeholder="City or region, e.g., Belgrade, Serbia"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Hiring Preferences Card */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Hiring Preferences</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Workers Needed
                                        </label>
                                        <input
                                            type="number"
                                            name="workers_needed"
                                            value={formData.workers_needed}
                                            onChange={(e) => setFormData(prev => ({ ...prev, workers_needed: parseInt(e.target.value) || 1 }))}
                                            min={1}
                                            max={100}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Salary Range (EUR/month)
                                        </label>
                                        <input
                                            type="text"
                                            name="salary_range"
                                            value={formData.salary_range}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="e.g., 1200-1500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                        Job Description
                                    </label>
                                    <textarea
                                        name="job_description"
                                        value={formData.job_description}
                                        onChange={handleChange}
                                        rows={4}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors resize-none"
                                        placeholder="Describe typical job duties, required skills, working conditions..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Link
                                href="/profile/employer"
                                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-[15px]"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 bg-[#1877f2] text-white rounded-md hover:bg-[#166fe5] font-medium text-[15px] disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
