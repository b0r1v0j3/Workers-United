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
    status: string;
}

export default function EmployerProfilePage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const [employer, setEmployer] = useState<EmployerProfile | null>(null);

    const [formData, setFormData] = useState({
        company_name: "",
        pib: "",
        company_address: "",
        accommodation_address: "",
        contact_phone: "",
    });

    useEffect(() => {
        async function fetchProfile() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push("/login");
                    return;
                }

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
            // Validate PIB (8 digits)
            if (!/^\d{8}$/.test(formData.pib)) {
                throw new Error("PIB must be exactly 8 digits");
            }

            if (!formData.accommodation_address.trim()) {
                throw new Error("Accommodation address is required");
            }

            const { error: updateError } = await supabase
                .from("employers")
                .update({
                    company_name: formData.company_name,
                    pib: formData.pib,
                    company_address: formData.company_address,
                    accommodation_address: formData.accommodation_address,
                    contact_phone: formData.contact_phone,
                })
                .eq("id", employer?.id);

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => router.push("/employer/dashboard"), 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Loading...</p>
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
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Company Profile</h1>
                <p className="text-gray-600 mb-6">
                    Complete your company details to start posting job requests.
                </p>

                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                        ✓ Profile saved successfully! Redirecting...
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Company Name *
                                </label>
                                <input
                                    type="text"
                                    id="company_name"
                                    name="company_name"
                                    required
                                    value={formData.company_name}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="e.g., ABC Construction d.o.o."
                                />
                            </div>

                            <div>
                                <label htmlFor="pib" className="block text-sm font-medium text-gray-700 mb-1">
                                    PIB (Tax Identification Number) *
                                </label>
                                <input
                                    type="text"
                                    id="pib"
                                    name="pib"
                                    required
                                    maxLength={8}
                                    pattern="\d{8}"
                                    value={formData.pib}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="12345678"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Serbian PIB - exactly 8 digits
                                </p>
                            </div>

                            <div>
                                <label htmlFor="company_address" className="block text-sm font-medium text-gray-700 mb-1">
                                    Company Address
                                </label>
                                <textarea
                                    id="company_address"
                                    name="company_address"
                                    rows={2}
                                    value={formData.company_address}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="Full registered business address..."
                                />
                            </div>

                            <div>
                                <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 mb-1">
                                    Contact Phone
                                </label>
                                <input
                                    type="tel"
                                    id="contact_phone"
                                    name="contact_phone"
                                    value={formData.contact_phone}
                                    onChange={handleChange}
                                    className="input"
                                    placeholder="+381 11 123 4567"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Worker Accommodation
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
                                rows={3}
                                value={formData.accommodation_address}
                                onChange={handleChange}
                                className="input"
                                placeholder="Full address where workers will be accommodated (street, city, postal code)..."
                            />
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn btn-primary flex-1"
                        >
                            {saving ? "Saving..." : "Save Profile"}
                        </button>
                        <Link href="/employer/dashboard" className="btn btn-secondary">
                            Cancel
                        </Link>
                    </div>
                </form>
            </main>
        </div>
    );
}
