"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function CreateJobPage() {
    const router = useRouter();
    const supabase = createClient();


    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // Validation
            if (formData.salary_rsd < 60000) {
                throw new Error("Minimum salary must be at least 60,000 RSD");
            }
            if (!formData.accommodation_address.trim()) {
                throw new Error("Accommodation address is required for visa processing");
            }
            if (formData.positions_count < 1) {
                throw new Error("At least 1 position is required");
            }

            // Get employer ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data: employer } = await supabase
                .from("employers")
                .select("id, pib")
                .eq("profile_id", user.id)
                .single();

            if (!employer) throw new Error("Employer profile not found");
            if (!employer.pib) throw new Error("Please complete your company profile with PIB first");

            // Create job request
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
            setTimeout(() => router.push("/employer/jobs"), 2000);
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

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                            <polyline points="20,6 9,17 4,12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Job Request Created!</h2>
                    <p className="text-gray-600">
                        Our system is automatically matching candidates from the queue...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <Link href="/employer/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Job Request</h1>
                <p className="text-gray-600 mb-6">
                    Fill in the details below. Once submitted, candidates will be automatically matched from our queue.
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Job Details Card */}
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                                    Job Title *
                                </label>
                                <input
                                    type="text"
                                    id="title"
                                    name="title"
                                    required
                                    value={formData.title}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="e.g., Construction Worker, Welder, Warehouse Operator"
                                />
                            </div>

                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                                    Job Description
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    rows={4}
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="Describe the job responsibilities, requirements, and expectations..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                                        Industry *
                                    </label>
                                    <select
                                        id="industry"
                                        name="industry"
                                        required
                                        value={formData.industry}
                                        onChange={handleChange}
                                        className="input"
                                    >
                                        <option value="">Select industry</option>
                                        <option value="construction">Construction</option>
                                        <option value="manufacturing">Manufacturing</option>
                                        <option value="logistics">Logistics & Warehouse</option>
                                        <option value="hospitality">Hospitality</option>
                                        <option value="agriculture">Agriculture</option>
                                        <option value="healthcare">Healthcare</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="positions_count" className="block text-sm font-medium text-gray-700 mb-1">
                                        Number of Positions *
                                    </label>
                                    <input
                                        type="number"
                                        id="positions_count"
                                        name="positions_count"
                                        required
                                        min={1}
                                        max={50}
                                        value={formData.positions_count}
                                        onChange={handleChange}
                                        className="input"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="experience_required_years" className="block text-sm font-medium text-gray-700 mb-1">
                                    Experience Required (years)
                                </label>
                                <input
                                    type="number"
                                    id="experience_required_years"
                                    name="experience_required_years"
                                    min={0}
                                    max={20}
                                    value={formData.experience_required_years}
                                    onChange={handleChange}
                                    className="input"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Compensation Card */}
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Compensation & Terms</h2>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="salary_rsd" className="block text-sm font-medium text-gray-700 mb-1">
                                    Monthly Salary (RSD) *
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        id="salary_rsd"
                                        name="salary_rsd"
                                        required
                                        min={60000}
                                        step={1000}
                                        value={formData.salary_rsd}
                                        onChange={handleChange}
                                        className="input pr-16"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                                        RSD
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Minimum: 60,000 RSD (approximately €510/month)
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="work_schedule" className="block text-sm font-medium text-gray-700 mb-1">
                                        Work Schedule
                                    </label>
                                    <select
                                        id="work_schedule"
                                        name="work_schedule"
                                        value={formData.work_schedule}
                                        onChange={handleChange}
                                        className="input"
                                    >
                                        <option value="Full-time (40 hours/week)">Full-time (40 hours/week)</option>
                                        <option value="Part-time (20 hours/week)">Part-time (20 hours/week)</option>
                                        <option value="Shift work">Shift work</option>
                                        <option value="Flexible hours">Flexible hours</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="contract_duration_months" className="block text-sm font-medium text-gray-700 mb-1">
                                        Contract Duration
                                    </label>
                                    <select
                                        id="contract_duration_months"
                                        name="contract_duration_months"
                                        value={formData.contract_duration_months}
                                        onChange={handleChange}
                                        className="input"
                                    >
                                        <option value={6}>6 months</option>
                                        <option value={12}>12 months</option>
                                        <option value={24}>24 months</option>
                                        <option value={36}>36 months (indefinite)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Accommodation Card */}
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Accommodation Details
                            <span className="text-red-500 ml-1">*</span>
                        </h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Required for visa processing. You must provide housing for international workers.
                        </p>

                        <div>
                            <label htmlFor="accommodation_address" className="block text-sm font-medium text-gray-700 mb-1">
                                Accommodation Address *
                            </label>
                            <textarea
                                id="accommodation_address"
                                name="accommodation_address"
                                required
                                rows={2}
                                value={formData.accommodation_address}
                                onChange={handleChange}
                                className="input"
                                placeholder="Full address where workers will be accommodated..."
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary flex-1"
                        >
                            {loading ? "Creating..." : "Create Job Request"}
                        </button>
                        <Link href="/employer/dashboard" className="btn btn-secondary">
                            Cancel
                        </Link>
                    </div>

                    <p className="text-xs text-center text-gray-500">
                        By creating a job request, you agree to provide legal employment under Serbian labor laws.
                    </p>
                </form>
            </main>
        </div>
    );
}
