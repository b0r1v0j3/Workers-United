"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Profile {
    id: string;
    email: string;
    full_name: string;
    user_type: string;
}

interface Candidate {
    id: string;
    nationality: string;
    date_of_birth: string;
    phone: string;
    address: string;
    current_country: string;
    preferred_job: string;
    desired_countries: string[];
    desired_industries: string[];
}

// Generate days, months, years for DOB
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => currentYear - 18 - i);

export default function ProfilePage() {
    const supabase = createClient();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        full_name: "",
        nationality: "",
        dobDay: "",
        dobMonth: "",
        dobYear: "",
        phone: "",
        address: "",
        current_country: "",
        preferred_job: "",
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    async function fetchProfile() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (profileData) {
                setProfile(profileData);
                setFormData(prev => ({ ...prev, full_name: profileData.full_name || "" }));
            }

            const { data: candidateData } = await supabase
                .from("candidates")
                .select("*")
                .eq("profile_id", user.id)
                .single();

            if (candidateData) {
                setCandidate(candidateData);
                // Parse DOB
                let dobDay = "", dobMonth = "", dobYear = "";
                if (candidateData.date_of_birth) {
                    const dob = new Date(candidateData.date_of_birth);
                    dobDay = dob.getDate().toString();
                    dobMonth = (dob.getMonth() + 1).toString();
                    dobYear = dob.getFullYear().toString();
                }
                setFormData(prev => ({
                    ...prev,
                    nationality: candidateData.nationality || "",
                    dobDay,
                    dobMonth,
                    dobYear,
                    phone: candidateData.phone || "",
                    address: candidateData.address || "",
                    current_country: candidateData.current_country || "",
                    preferred_job: candidateData.preferred_job || "",
                }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError("");
        setSuccess(false);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error: profileErr } = await supabase
                .from("profiles")
                .update({ full_name: formData.full_name })
                .eq("id", user.id);
            if (profileErr) throw new Error(profileErr.message);

            // Combine DOB
            let dateOfBirth: string | null = null;
            if (formData.dobDay && formData.dobMonth && formData.dobYear) {
                const month = formData.dobMonth.padStart(2, '0');
                const day = formData.dobDay.padStart(2, '0');
                dateOfBirth = `${formData.dobYear}-${month}-${day}`;
            }

            const candidateUpdates = {
                nationality: formData.nationality || null,
                date_of_birth: dateOfBirth,
                phone: formData.phone || null,
                address: formData.address || null,
                current_country: formData.current_country || null,
                preferred_job: formData.preferred_job || null,
            };

            if (candidate) {
                const { error: updateErr } = await supabase
                    .from("candidates")
                    .update(candidateUpdates)
                    .eq("id", candidate.id);
                if (updateErr) throw new Error(updateErr.message);
            } else {
                const { error: insertErr } = await supabase
                    .from("candidates")
                    .insert({
                        profile_id: user.id,
                        ...candidateUpdates,
                    });
                if (insertErr) throw new Error(insertErr.message);
            }

            setSuccess(true);
            await fetchProfile();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
            {/* Navbar */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[900px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/profile/worker" className="flex items-center gap-2 text-[#65676b] hover:text-[#050505] text-sm font-semibold">
                        ← Back to Profile
                    </Link>
                    <Link href="/" className="flex items-center gap-2">
                        <img src="/logo.png" alt="Workers United" className="h-[60px] w-auto object-contain" />
                        <span className="font-bold text-[#1877f2] text-xl hidden sm:inline">Workers United</span>
                    </Link>
                    <div className="w-[120px]" /> {/* Spacer */}
                </div>
            </nav>

            <div className="max-w-[900px] mx-auto px-4 py-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
                    <p className="text-gray-500 mt-1">Complete your profile to get verified and matched with employers.</p>
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
                        {/* Account Information Card */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Account Information</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={profile?.email || ""}
                                            disabled
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] bg-gray-100 cursor-not-allowed text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="full_name"
                                            value={formData.full_name}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="Your full name"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Personal Information Card */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Personal Information</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Nationality <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="nationality"
                                            value={formData.nationality}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="e.g., Serbian"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Date of Birth <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <select
                                                value={formData.dobDay}
                                                onChange={(e) => setFormData(prev => ({ ...prev, dobDay: e.target.value }))}
                                                className="border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            >
                                                <option value="">Day</option>
                                                {DAYS.map(day => (<option key={day} value={day}>{day}</option>))}
                                            </select>
                                            <select
                                                value={formData.dobMonth}
                                                onChange={(e) => setFormData(prev => ({ ...prev, dobMonth: e.target.value }))}
                                                className="border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            >
                                                <option value="">Month</option>
                                                {MONTHS.map(month => (<option key={month.value} value={month.value}>{month.label}</option>))}
                                            </select>
                                            <select
                                                value={formData.dobYear}
                                                onChange={(e) => setFormData(prev => ({ ...prev, dobYear: e.target.value }))}
                                                className="border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            >
                                                <option value="">Year</option>
                                                {YEARS.map(year => (<option key={year} value={year}>{year}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Phone Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="+381 ..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                            Current Country <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="current_country"
                                            value={formData.current_country}
                                            onChange={handleChange}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                            placeholder="Where you live now"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                        Address
                                    </label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                        placeholder="Your full address"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Job Preferences Card */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Job Preferences</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                                        Preferred Job / Industry <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="preferred_job"
                                        value={formData.preferred_job}
                                        onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors"
                                    >
                                        <option value="">Select industry...</option>
                                        <option value="Construction">Construction</option>
                                        <option value="Manufacturing">Manufacturing</option>
                                        <option value="Agriculture">Agriculture</option>
                                        <option value="Hospitality">Hospitality</option>
                                        <option value="Healthcare">Healthcare</option>
                                        <option value="Transportation">Transportation</option>
                                        <option value="Retail">Retail</option>
                                        <option value="IT & Technology">IT & Technology</option>
                                        <option value="Food Processing">Food Processing</option>
                                        <option value="Warehousing & Logistics">Warehousing & Logistics</option>
                                        <option value="Cleaning Services">Cleaning Services</option>
                                        <option value="Driving">Driving</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>


                        {/* Save / Cancel Buttons */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Link
                                href="/profile/worker"
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
