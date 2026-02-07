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
    years_experience: number;
    languages: string[];
    education_level: string;
}

export default function ProfilePage() {
    const supabase = createClient();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form state
    const [formData, setFormData] = useState({
        full_name: "",
        nationality: "",
        date_of_birth: "",
        phone: "",
        address: "",
        current_country: "",
        preferred_job: "",
        years_experience: 0,
        education_level: "",
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    async function fetchProfile() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get profile
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (profileData) {
                setProfile(profileData);
                setFormData(prev => ({ ...prev, full_name: profileData.full_name || "" }));
            }

            // Get candidate details
            const { data: candidateData } = await supabase
                .from("candidates")
                .select("*")
                .eq("profile_id", user.id)
                .single();

            if (candidateData) {
                setCandidate(candidateData);
                setFormData(prev => ({
                    ...prev,
                    nationality: candidateData.nationality || "",
                    date_of_birth: candidateData.date_of_birth || "",
                    phone: candidateData.phone || "",
                    address: candidateData.address || "",
                    current_country: candidateData.current_country || "",
                    preferred_job: candidateData.preferred_job || "",
                    years_experience: candidateData.years_experience || 0,
                    education_level: candidateData.education_level || "",
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
        setSuccess("");

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Update profile
            await supabase
                .from("profiles")
                .update({ full_name: formData.full_name })
                .eq("id", user.id);

            // Only update fields this form manages — preserve all other fields
            const candidateUpdates = {
                nationality: formData.nationality || null,
                date_of_birth: formData.date_of_birth || null,
                phone: formData.phone || null,
                address: formData.address || null,
                current_country: formData.current_country || null,
                preferred_job: formData.preferred_job || null,
                years_experience: formData.years_experience || 0,
                education_level: formData.education_level || null,
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

            setSuccess("Profile updated successfully!");
            await fetchProfile();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-600">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <Link href="/profile/worker" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back to Profile
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Profile</h1>
                <p className="text-gray-600 mb-6">
                    Complete your profile to get verified and matched with employers.
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="card">
                    <div className="space-y-6">
                        {/* Account Info */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
                            <div className="grid gap-4">
                                <div>
                                    <label className="label">Email</label>
                                    <input
                                        type="email"
                                        value={profile?.email || ""}
                                        disabled
                                        className="input bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="label">Full Name</label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        className="input"
                                        placeholder="Your full name"
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-200" />

                        {/* Personal Info */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Nationality</label>
                                    <input
                                        type="text"
                                        value={formData.nationality}
                                        onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Serbian"
                                    />
                                </div>
                                <div>
                                    <label className="label">Date of Birth</label>
                                    <input
                                        type="date"
                                        value={formData.date_of_birth}
                                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="input"
                                        placeholder="+381 ..."
                                    />
                                </div>
                                <div>
                                    <label className="label">Current Country</label>
                                    <input
                                        type="text"
                                        value={formData.current_country}
                                        onChange={(e) => setFormData({ ...formData, current_country: e.target.value })}
                                        className="input"
                                        placeholder="Where you live now"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="label">Address</label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="input"
                                        placeholder="Your full address"
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-200" />

                        {/* Job Preferences */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Preferences</h2>
                            <div className="grid gap-4">
                                <div>
                                    <label className="label">Preferred Job / Industry</label>
                                    <input
                                        type="text"
                                        value={formData.preferred_job}
                                        onChange={(e) => setFormData({ ...formData, preferred_job: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Construction, Hospitality, Driver..."
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-200" />

                        {/* Professional Info */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Professional Background</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Years of Experience</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={formData.years_experience}
                                        onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) || 0 })}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label">Highest Education</label>
                                    <select
                                        value={formData.education_level}
                                        onChange={(e) => setFormData({ ...formData, education_level: e.target.value })}
                                        className="input"
                                    >
                                        <option value="">Select...</option>
                                        <option value="high_school">High School</option>
                                        <option value="vocational">Vocational Training</option>
                                        <option value="bachelors">Bachelor's Degree</option>
                                        <option value="masters">Master's Degree</option>
                                        <option value="phd">PhD</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="btn btn-primary"
                            >
                                {saving ? "Saving..." : "Save Profile"}
                            </button>
                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
}
