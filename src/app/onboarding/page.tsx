"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SignaturePad } from "@/components/SignaturePad";

// Country codes for phone input
const COUNTRY_CODES = [
    // Balkans (first for easy access)
    { code: "+381", country: "Serbia", flag: "🇷🇸" },
    { code: "+385", country: "Croatia", flag: "🇭🇷" },
    { code: "+387", country: "Bosnia", flag: "🇧🇦" },
    { code: "+382", country: "Montenegro", flag: "🇲🇪" },
    { code: "+389", country: "N. Macedonia", flag: "🇲🇰" },
    { code: "+386", country: "Slovenia", flag: "🇸🇮" },
    { code: "+383", country: "Kosovo", flag: "🇽🇰" },
    { code: "+355", country: "Albania", flag: "🇦🇱" },
    // Europe
    { code: "+49", country: "Germany", flag: "🇩🇪" },
    { code: "+43", country: "Austria", flag: "🇦🇹" },
    { code: "+41", country: "Switzerland", flag: "🇨🇭" },
    { code: "+48", country: "Poland", flag: "🇵🇱" },
    { code: "+420", country: "Czech Rep.", flag: "🇨🇿" },
    { code: "+421", country: "Slovakia", flag: "🇸🇰" },
    { code: "+36", country: "Hungary", flag: "🇭🇺" },
    { code: "+40", country: "Romania", flag: "🇷🇴" },
    { code: "+359", country: "Bulgaria", flag: "🇧🇬" },
    { code: "+30", country: "Greece", flag: "🇬🇷" },
    { code: "+39", country: "Italy", flag: "🇮🇹" },
    { code: "+34", country: "Spain", flag: "🇪🇸" },
    { code: "+351", country: "Portugal", flag: "🇵🇹" },
    { code: "+33", country: "France", flag: "🇫🇷" },
    { code: "+32", country: "Belgium", flag: "🇧🇪" },
    { code: "+31", country: "Netherlands", flag: "🇳🇱" },
    { code: "+44", country: "UK", flag: "🇬🇧" },
    { code: "+353", country: "Ireland", flag: "🇮🇪" },
    { code: "+45", country: "Denmark", flag: "🇩🇰" },
    { code: "+46", country: "Sweden", flag: "🇸🇪" },
    { code: "+47", country: "Norway", flag: "🇳🇴" },
    { code: "+358", country: "Finland", flag: "🇫🇮" },
    { code: "+370", country: "Lithuania", flag: "🇱🇹" },
    { code: "+371", country: "Latvia", flag: "🇱🇻" },
    { code: "+372", country: "Estonia", flag: "🇪🇪" },
    { code: "+380", country: "Ukraine", flag: "🇺🇦" },
    { code: "+375", country: "Belarus", flag: "🇧🇾" },
    { code: "+373", country: "Moldova", flag: "🇲🇩" },
    { code: "+7", country: "Russia", flag: "🇷🇺" },
    // Americas
    { code: "+1", country: "USA", flag: "🇺🇸" },
    { code: "+1", country: "Canada", flag: "🇨🇦" },
    { code: "+52", country: "Mexico", flag: "🇲🇽" },
    { code: "+55", country: "Brazil", flag: "🇧🇷" },
    { code: "+54", country: "Argentina", flag: "🇦🇷" },
    // Middle East
    { code: "+90", country: "Turkey", flag: "🇹🇷" },
    { code: "+971", country: "UAE", flag: "🇦🇪" },
    { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
    // South Asia
    { code: "+91", country: "India", flag: "🇮🇳" },
    { code: "+92", country: "Pakistan", flag: "🇵🇰" },
    { code: "+880", country: "Bangladesh", flag: "🇧🇩" },
    // Southeast Asia
    { code: "+63", country: "Philippines", flag: "🇵🇭" },
    { code: "+84", country: "Vietnam", flag: "🇻🇳" },
    { code: "+62", country: "Indonesia", flag: "🇮🇩" },
    // East Asia
    { code: "+86", country: "China", flag: "🇨🇳" },
    { code: "+81", country: "Japan", flag: "🇯🇵" },
    { code: "+82", country: "South Korea", flag: "🇰🇷" },
    // Africa
    { code: "+234", country: "Nigeria", flag: "🇳🇬" },
    { code: "+254", country: "Kenya", flag: "🇰🇪" },
    { code: "+27", country: "South Africa", flag: "🇿🇦" },
    { code: "+20", country: "Egypt", flag: "🇪🇬" },
    // Oceania
    { code: "+61", country: "Australia", flag: "🇦🇺" },
    { code: "+64", country: "New Zealand", flag: "🇳🇿" },
];

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

export default function OnboardingPage() {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [countrySearch, setCountrySearch] = useState("");
    const router = useRouter();

    // Form data — ALL fields on one page
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        countryCode: "+381",
        phoneNumber: "",
        nationality: "",
        dobDay: "",
        dobMonth: "",
        dobYear: "",
        preferredJob: "",
        experience: "",
        languages: "",
        signatureData: "",
    });

    useEffect(() => {
        async function loadUser() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            if (user.user_metadata?.user_type === 'employer') {
                router.push("/employer/dashboard");
                return;
            }

            setUser(user);

            // Load profile
            const { data: profile } = await supabase
                .from("profiles")
                .select("first_name, last_name")
                .eq("id", user.id)
                .single();

            if (profile) {
                setFormData(prev => ({
                    ...prev,
                    firstName: profile.first_name || "",
                    lastName: profile.last_name || ""
                }));
            }

            // Load existing candidate data
            const { data: candidate } = await supabase
                .from("candidates")
                .select("*")
                .eq("profile_id", user.id)
                .single();

            if (candidate) {
                // Parse phone
                let countryCode = "+381";
                let phoneNumber = "";
                if (candidate.phone) {
                    const found = COUNTRY_CODES.find(c => candidate.phone.startsWith(c.code));
                    if (found) {
                        countryCode = found.code;
                        phoneNumber = candidate.phone.replace(found.code, "").trim();
                    } else {
                        phoneNumber = candidate.phone;
                    }
                }

                // Parse DOB
                let dobDay = "", dobMonth = "", dobYear = "";
                if (candidate.date_of_birth) {
                    const dob = new Date(candidate.date_of_birth);
                    dobDay = dob.getDate().toString();
                    dobMonth = (dob.getMonth() + 1).toString();
                    dobYear = dob.getFullYear().toString();
                }

                setFormData(prev => ({
                    ...prev,
                    countryCode,
                    phoneNumber,
                    nationality: candidate.nationality || "",
                    dobDay,
                    dobMonth,
                    dobYear,
                    preferredJob: candidate.preferred_job || "",
                    experience: candidate.experience_years?.toString() || "",
                    languages: candidate.languages?.join(", ") || "",
                    // FIX: Load existing signature so it doesn't get overwritten
                    signatureData: candidate.signature_url || "",
                }));
            }
        }

        loadUser();
    }, [router]);

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const getFullPhone = () => {
        return formData.phoneNumber ? `${formData.countryCode}${formData.phoneNumber}` : "";
    };

    const getFullDOB = () => {
        if (formData.dobDay && formData.dobMonth && formData.dobYear) {
            const month = formData.dobMonth.padStart(2, '0');
            const day = formData.dobDay.padStart(2, '0');
            return `${formData.dobYear}-${month}-${day}`;
        }
        return null;
    };

    const handleSignatureSave = async (signatureData: string) => {
        updateField("signatureData", signatureData);

        try {
            await fetch("/api/signatures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signatureData,
                    documentType: "onboarding",
                    agreedText: "I agree to the terms of service and consent to digital signature usage."
                }),
            });
        } catch (err) {
            console.error("Signature save failed:", err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const supabase = createClient();

            // Profile UPSERT
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", user.id)
                .single();

            const fullName = `${formData.firstName} ${formData.lastName}`.trim();

            const profileData = {
                id: user.id,
                email: user.email,
                first_name: formData.firstName || null,
                last_name: formData.lastName || null,
                full_name: fullName || null,
                user_type: "candidate"
            };

            let profileError;
            if (!existingProfile) {
                const { error } = await supabase.from("profiles").insert(profileData);
                profileError = error;
            } else {
                const { error } = await supabase.from("profiles").update({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    full_name: fullName
                }).eq("id", user.id);
                profileError = error;
            }

            if (profileError) {
                setError(`Profile error: ${profileError.message}`);
                return;
            }

            // Candidate UPSERT
            const { data: existingCandidate } = await supabase
                .from("candidates")
                .select("id")
                .eq("profile_id", user.id)
                .single();

            const candidateData = {
                profile_id: user.id,
                phone: getFullPhone() || null,
                nationality: formData.nationality || null,
                current_country: "Serbia",
                date_of_birth: getFullDOB(),
                preferred_job: formData.preferredJob || null,
                experience_years: formData.experience ? parseInt(formData.experience) : null,
                languages: formData.languages ? formData.languages.split(",").map(l => l.trim()) : [],
                preferred_country: "serbia",
                signature_url: formData.signatureData || null,
                updated_at: new Date().toISOString(),
            };

            let updateError;
            if (!existingCandidate) {
                const { error } = await supabase.from("candidates").insert(candidateData);
                updateError = error;
            } else {
                const { error } = await supabase.from("candidates").update(candidateData).eq("profile_id", user.id);
                updateError = error;
            }

            if (updateError) {
                setError(`Save error: ${updateError.message}`);
                return;
            }

            // Sync Auth
            await supabase.auth.updateUser({
                data: { full_name: fullName, first_name: formData.firstName, last_name: formData.lastName }
            });

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(`Error: ${err.message || "Failed to save"}`);
        } finally {
            setSaving(false);
        }
    };

    const selectedCountry = COUNTRY_CODES.find(c => c.code === formData.countryCode) || COUNTRY_CODES[0];

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1877f2]"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* Navbar */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[56px]">
                <div className="max-w-[900px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/dashboard" className="text-[#65676b] hover:text-[#050505] text-sm font-semibold flex items-center gap-2">
                        ← Back to Dashboard
                    </Link>
                    <Link href="/" className="flex items-center gap-2">
                        <img src="/logo.png" alt="Workers United" className="h-10 w-auto object-contain" />
                        <span className="font-bold text-[#1877f2] text-xl hidden sm:inline">Workers United</span>
                    </Link>
                    <div className="w-[120px]" /> {/* Spacer */}
                </div>
            </nav>

            {/* SINGLE PAGE FORM */}
            <div className="max-w-[700px] mx-auto px-4 py-6">
                <h1 className="text-2xl font-bold text-[#050505] mb-1">Edit Profile</h1>
                <p className="text-[#65676b] text-sm mb-6">All your information in one place. Fill in and save.</p>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-center gap-2">
                        ✓ Profile saved successfully!
                    </div>
                )}

                {/* Section 1: Personal Info */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <h2 className="text-lg font-bold text-[#050505] mb-4">👤 Personal Information</h2>
                    <div className="grid gap-4">
                        {/* Name */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5">First Name *</label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => updateField("firstName", e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none transition-colors"
                                    placeholder="First name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5">Last Name *</label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => updateField("lastName", e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none transition-colors"
                                    placeholder="Last name"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5">Phone (WhatsApp) *</label>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                        className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#dddfe2] bg-white hover:border-[#1877f2] transition-colors min-w-[130px]"
                                    >
                                        <span className="text-xl">{selectedCountry.flag}</span>
                                        <span className="font-medium text-[#050505]">{selectedCountry.code}</span>
                                        <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {showCountryDropdown && (
                                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#dddfe2] rounded-xl shadow-lg z-50 w-72">
                                            <div className="p-2 border-b border-[#dddfe2]">
                                                <input
                                                    type="text"
                                                    value={countrySearch}
                                                    onChange={(e) => setCountrySearch(e.target.value)}
                                                    placeholder="Search country..."
                                                    className="w-full px-3 py-2 rounded-lg border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none text-sm"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {COUNTRY_CODES
                                                    .filter(c =>
                                                        c.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                                        c.code.includes(countrySearch)
                                                    )
                                                    .map((country, i) => (
                                                        <button
                                                            key={`${country.code}-${country.country}-${i}`}
                                                            type="button"
                                                            onClick={() => {
                                                                updateField("countryCode", country.code);
                                                                setShowCountryDropdown(false);
                                                                setCountrySearch("");
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f0f2f5] text-left transition-colors"
                                                        >
                                                            <span className="text-xl">{country.flag}</span>
                                                            <span className="text-sm font-medium text-[#050505]">{country.country}</span>
                                                            <span className="text-sm text-[#65676b] ml-auto">{country.code}</span>
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="tel"
                                    value={formData.phoneNumber}
                                    onChange={(e) => updateField("phoneNumber", e.target.value.replace(/[^0-9]/g, ''))}
                                    className="flex-1 px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none transition-colors"
                                    placeholder="60 123 4567"
                                />
                            </div>
                        </div>

                        {/* Nationality */}
                        <div>
                            <label className="block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5">Nationality *</label>
                            <input
                                type="text"
                                value={formData.nationality}
                                onChange={(e) => updateField("nationality", e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none transition-colors"
                                placeholder="e.g., Serbian, Nigerian, Indian"
                            />
                        </div>

                        {/* Date of Birth */}
                        <div>
                            <label className="block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5">Date of Birth *</label>
                            <div className="grid grid-cols-3 gap-3">
                                <select
                                    value={formData.dobDay}
                                    onChange={(e) => updateField("dobDay", e.target.value)}
                                    className="px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none bg-white"
                                >
                                    <option value="">Day</option>
                                    {DAYS.map(day => (<option key={day} value={day}>{day}</option>))}
                                </select>
                                <select
                                    value={formData.dobMonth}
                                    onChange={(e) => updateField("dobMonth", e.target.value)}
                                    className="px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none bg-white"
                                >
                                    <option value="">Month</option>
                                    {MONTHS.map(month => (<option key={month.value} value={month.value}>{month.label}</option>))}
                                </select>
                                <select
                                    value={formData.dobYear}
                                    onChange={(e) => updateField("dobYear", e.target.value)}
                                    className="px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none bg-white"
                                >
                                    <option value="">Year</option>
                                    {YEARS.map(year => (<option key={year} value={year}>{year}</option>))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Work Preferences */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <h2 className="text-lg font-bold text-[#050505] mb-4">💼 Work Preferences</h2>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5">Preferred Job / Industry *</label>
                            <select
                                value={formData.preferredJob}
                                onChange={(e) => updateField("preferredJob", e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none bg-white"
                            >
                                <option value="">Select job type</option>
                                <option value="construction">Construction</option>
                                <option value="agriculture">Agriculture</option>
                                <option value="hospitality">Hospitality / Hotel</option>
                                <option value="manufacturing">Manufacturing</option>
                                <option value="healthcare">Healthcare</option>
                                <option value="logistics">Logistics / Warehouse</option>
                                <option value="cleaning">Cleaning Services</option>
                                <option value="it">IT / Technology</option>
                                <option value="driving">Driving / Transportation</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5">Years of Experience</label>
                            <select
                                value={formData.experience}
                                onChange={(e) => updateField("experience", e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none bg-white"
                            >
                                <option value="">Select experience</option>
                                <option value="0">No experience</option>
                                <option value="1">1 year</option>
                                <option value="2">2 years</option>
                                <option value="3">3-5 years</option>
                                <option value="5">5+ years</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5">Languages You Speak</label>
                            <input
                                type="text"
                                value={formData.languages}
                                onChange={(e) => updateField("languages", e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none transition-colors"
                                placeholder="e.g., English, Serbian, French"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 3: Signature */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <h2 className="text-lg font-bold text-[#050505] mb-2">✍️ Digital Signature</h2>
                    <p className="text-sm text-[#65676b] mb-4">Sign to confirm your application is accurate.</p>

                    {formData.signatureData ? (
                        <div className="space-y-3">
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-center gap-2">
                                ✓ Signature already saved
                            </div>
                            <button
                                onClick={() => updateField("signatureData", "")}
                                className="text-sm text-[#1877f2] font-semibold hover:underline"
                            >
                                Re-sign
                            </button>
                        </div>
                    ) : (
                        <SignaturePad
                            onSave={handleSignatureSave}
                            agreementText="I confirm that all information provided is accurate and I agree to the Terms of Service and Privacy Policy."
                        />
                    )}
                </div>

                {/* SAVE BUTTON */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-8 py-3.5 bg-[#1877f2] text-white rounded-xl font-bold text-base hover:bg-[#166fe5] transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Profile"}
                    </button>
                    <Link
                        href="/dashboard"
                        className="px-6 py-3.5 rounded-xl font-semibold text-[#65676b] hover:bg-white hover:text-[#050505] transition-colors border border-[#dddfe2]"
                    >
                        Cancel
                    </Link>
                </div>

                <p className="text-center text-xs text-[#65676b] mt-4 mb-8">
                    Your data is securely stored and never shared without your consent.
                </p>
            </div>
        </div>
    );
}
