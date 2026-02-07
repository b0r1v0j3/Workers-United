"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function CreateJobClient() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        destination_country: "Serbia",
        industry: "",
        positions_count: 1,
        salary_rsd: 60000,
        accommodation_address: "",
        work_schedule: "Full-time (40 hours/week)",
        contract_duration_months: 12,
        experience_required_years: 0,
    });

    const STEPS = [
        { id: 0, title: "Job Details", icon: "📋" },
        { id: 1, title: "Compensation", icon: "💰" },
        { id: 2, title: "Accommodation", icon: "🏠" },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (formData.salary_rsd < 60000) {
                throw new Error("Minimum salary must be at least 60,000 RSD");
            }
            if (!formData.accommodation_address.trim()) {
                throw new Error("Accommodation address is required for visa processing");
            }
            if (formData.positions_count < 1) {
                throw new Error("At least 1 position is required");
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data: employer } = await supabase
                .from("employers")
                .select("id, pib")
                .eq("profile_id", user.id)
                .single();

            if (!employer) throw new Error("Employer profile not found");
            if (!employer.pib) throw new Error("Please complete your company profile with PIB first");

            const { error: insertError } = await supabase
                .from("job_requests")
                .insert({
                    employer_id: employer.id,
                    title: formData.title,
                    description: formData.description,
                    destination_country: formData.destination_country,
                    industry: formData.industry,
                    positions_count: formData.positions_count,
                    salary_rsd: formData.salary_rsd,
                    accommodation_address: formData.accommodation_address,
                    work_schedule: formData.work_schedule,
                    contract_duration_months: formData.contract_duration_months,
                    experience_required_years: formData.experience_required_years,
                    status: "open",
                });

            if (insertError) throw insertError;

            setSuccess(true);
            setTimeout(() => router.push("/profile/employer/jobs"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create job");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "number" ? Number(value) : value,
        }));
    };

    const canProceed = () => {
        if (currentStep === 0) {
            return formData.title && formData.industry;
        }
        if (currentStep === 1) {
            return formData.salary_rsd >= 60000;
        }
        return formData.accommodation_address.trim().length > 0;
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20,6 9,17 4,12" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-[#183b56] mb-3">Job Request Created!</h2>
                    <p className="text-[#64748b]">
                        Our system is automatically matching candidates from the queue...
                    </p>
                    <div className="mt-6 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2f6fed]"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0]">
            {/* Header */}
            <nav className="bg-white/80 backdrop-blur-sm border-b border-[#dde3ec] sticky top-0 z-10">
                <div className="max-w-[700px] mx-auto px-5">
                    <div className="flex justify-between h-16 items-center">
                        <Link href="/profile/employer" className="flex items-center gap-2 text-[#64748b] hover:text-[#183b56] transition-colors">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            <span className="font-medium">Back to Profile</span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="Workers United" className="h-10 w-auto object-contain" />
                            <span className="font-bold text-[#1877f2]">Workers United</span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-[700px] mx-auto px-5 py-8">
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-[#2f6fed] to-[#1e5cd6] rounded-2xl p-6 mb-8 text-white shadow-lg">
                    <h1 className="text-2xl font-bold mb-2">Create Job Request</h1>
                    <p className="text-white/90 text-sm">
                        Find pre-verified international workers for your business
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-8 px-4">
                    {STEPS.map((step, index) => (
                        <div key={step.id} className="flex items-center">
                            <div className="flex flex-col items-center">
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all duration-300 ${currentStep >= step.id
                                        ? "bg-gradient-to-br from-[#2f6fed] to-[#1e5cd6] text-white shadow-lg shadow-blue-500/30"
                                        : "bg-[#e2e8f0] text-[#94a3b8]"
                                        }`}
                                >
                                    {step.icon}
                                </div>
                                <span className={`text-xs mt-2 font-medium ${currentStep >= step.id ? "text-[#183b56]" : "text-[#94a3b8]"
                                    }`}>
                                    {step.title}
                                </span>
                            </div>
                            {index < STEPS.length - 1 && (
                                <div className={`w-16 h-1 mx-2 rounded-full transition-all ${currentStep > step.id ? "bg-[#2f6fed]" : "bg-[#e2e8f0]"
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
                        <span className="text-xl">⚠️</span>
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Step 1: Job Details */}
                    {currentStep === 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-[#dde3ec] p-6 mb-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#2f6fed] to-[#1e5cd6] rounded-xl flex items-center justify-center text-white">
                                    📋
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-[#183b56]">Job Details</h2>
                                    <p className="text-sm text-[#64748b]">Basic information about the position</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Job Title *
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        required
                                        value={formData.title}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all"
                                        placeholder="e.g., Construction Worker, Welder"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Job Description
                                    </label>
                                    <textarea
                                        name="description"
                                        rows={4}
                                        value={formData.description}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all resize-none"
                                        placeholder="Describe responsibilities, requirements..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                            Industry *
                                        </label>
                                        <select
                                            name="industry"
                                            required
                                            value={formData.industry}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all bg-white"
                                        >
                                            <option value="">Select industry</option>
                                            <option value="construction">🏗️ Construction</option>
                                            <option value="manufacturing">🏭 Manufacturing</option>
                                            <option value="logistics">📦 Logistics</option>
                                            <option value="hospitality">🏨 Hospitality</option>
                                            <option value="agriculture">🌾 Agriculture</option>
                                            <option value="healthcare">🏥 Healthcare</option>
                                            <option value="other">📌 Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                            Positions *
                                        </label>
                                        <input
                                            type="number"
                                            name="positions_count"
                                            required
                                            min={1}
                                            max={50}
                                            value={formData.positions_count}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Experience Required (years)
                                    </label>
                                    <input
                                        type="number"
                                        name="experience_required_years"
                                        min={0}
                                        max={20}
                                        value={formData.experience_required_years}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all"
                                    />
                                    <p className="text-xs text-[#64748b] mt-1">Set to 0 for no experience required</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Compensation */}
                    {currentStep === 1 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-[#dde3ec] p-6 mb-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#f59e0b] to-[#d97706] rounded-xl flex items-center justify-center text-white">
                                    💰
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-[#183b56]">Compensation & Terms</h2>
                                    <p className="text-sm text-[#64748b]">Salary and contract details</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Monthly Salary (RSD) *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="salary_rsd"
                                            required
                                            min={60000}
                                            step={1000}
                                            value={formData.salary_rsd}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 pr-16 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748b] font-medium">
                                            RSD
                                        </span>
                                    </div>
                                    <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                        <p className="text-sm text-amber-800 font-medium">
                                            💡 Minimum: 60,000 RSD (~€510/month)
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                            Work Schedule
                                        </label>
                                        <select
                                            name="work_schedule"
                                            value={formData.work_schedule}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all bg-white"
                                        >
                                            <option value="Full-time (40 hours/week)">Full-time (40h)</option>
                                            <option value="Shift work">Shift work</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                            Contract Duration
                                        </label>
                                        <select
                                            name="contract_duration_months"
                                            value={formData.contract_duration_months}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all bg-white"
                                        >
                                            <option value={6}>6 months</option>
                                            <option value={12}>12 months</option>
                                            <option value={24}>24 months</option>
                                            <option value={36}>36+ months</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Accommodation */}
                    {currentStep === 2 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-[#dde3ec] p-6 mb-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#ec4899] to-[#db2777] rounded-xl flex items-center justify-center text-white">
                                    🏠
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-[#183b56]">Accommodation Details</h2>
                                    <p className="text-sm text-[#64748b]">Required for visa processing</p>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-5">
                                <div className="flex gap-3">
                                    <span className="text-xl">ℹ️</span>
                                    <div>
                                        <p className="text-sm text-blue-900 font-medium">Important</p>
                                        <p className="text-sm text-blue-800">
                                            Serbian law requires employers to provide accommodation for international workers.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                    Accommodation Address *
                                </label>
                                <textarea
                                    name="accommodation_address"
                                    required
                                    rows={3}
                                    value={formData.accommodation_address}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 focus:outline-none transition-all resize-none"
                                    placeholder="Full address where workers will be accommodated..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex gap-3">
                        {currentStep > 0 && (
                            <button
                                type="button"
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="px-6 py-3 border border-[#dde3ec] rounded-xl font-semibold text-[#64748b] hover:bg-gray-50 transition-colors"
                            >
                                ← Back
                            </button>
                        )}

                        {currentStep < 2 ? (
                            <button
                                type="button"
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                disabled={!canProceed()}
                                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${canProceed()
                                    ? "bg-gradient-to-r from-[#2f6fed] to-[#1e5cd6] text-white shadow-lg shadow-blue-500/30 hover:shadow-xl"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    }`}
                            >
                                Continue →
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={loading || !canProceed()}
                                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${canProceed() && !loading
                                    ? "bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-lg shadow-green-500/30 hover:shadow-xl"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    }`}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Creating...
                                    </span>
                                ) : (
                                    "Create Job Request ✓"
                                )}
                            </button>
                        )}
                    </div>

                    <p className="text-xs text-center text-[#94a3b8] mt-4">
                        By creating a job request, you agree to provide legal employment under Serbian labor laws.
                    </p>
                </form>
            </main>
        </div>
    );
}
