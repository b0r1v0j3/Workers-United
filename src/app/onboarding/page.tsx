"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { WORLD_COUNTRIES, INDUSTRIES, MARITAL_STATUSES, GENDER_OPTIONS } from "@/lib/constants";

// Country codes for phone input
const COUNTRY_CODES = [
    // Balkans (first for easy access)
    { code: "+381", country: "Serbia", flag: "🇷🇸" },
    { code: "+385", country: "Croatia", flag: "🇭🇷" },
    { code: "+387", country: "Bosnia", flag: "🇧🇦" },
    { code: "+389", country: "N. Macedonia", flag: "🇲🇰" },
    { code: "+383", country: "Kosovo", flag: "🇽🇰" },
    { code: "+382", country: "Montenegro", flag: "🇲🇪" },
    { code: "+386", country: "Slovenia", flag: "🇸🇮" },
    { code: "+355", country: "Albania", flag: "🇦🇱" },
    { code: "+40", country: "Romania", flag: "🇷🇴" },
    { code: "+359", country: "Bulgaria", flag: "🇧🇬" },
    { code: "+36", country: "Hungary", flag: "🇭🇺" },
    // Western Europe
    { code: "+49", country: "Germany", flag: "🇩🇪" },
    { code: "+43", country: "Austria", flag: "🇦🇹" },
    { code: "+41", country: "Switzerland", flag: "🇨🇭" },
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
    { code: "+48", country: "Poland", flag: "🇵🇱" },
    { code: "+420", country: "Czech Republic", flag: "🇨🇿" },
    { code: "+421", country: "Slovakia", flag: "🇸🇰" },
    { code: "+30", country: "Greece", flag: "🇬🇷" },
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
    // Eastern Europe & Central Asia
    { code: "+380", country: "Ukraine", flag: "🇺🇦" },
    { code: "+7", country: "Russia", flag: "🇷🇺" },
    { code: "+375", country: "Belarus", flag: "🇧🇾" },
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
// Family DOB years (0–100 years ago)
const ALL_YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);
// Passport issue date: last 10 years
const PASSPORT_ISSUE_YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);
// Passport expiry date: current year + 10 years ahead
const PASSPORT_EXPIRY_YEARS = Array.from({ length: 11 }, (_, i) => currentYear + i);

// Empty child template
const EMPTY_CHILD = { last_name: "", first_name: "", dobDay: "", dobMonth: "", dobYear: "" };

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
        languages: "",
        signatureData: "",
        // New visa fields
        gender: "",
        maritalStatus: "",
        birthCountry: "",
        birthCity: "",
        citizenship: "",
        originalCitizenshipSame: true,
        originalCitizenship: "",
        maidenName: "",
        fatherName: "",
        motherName: "",
        // Passport & travel
        passportNumber: "",
        passportIssuedBy: "",
        passportIssueDay: "",
        passportIssueMonth: "",
        passportIssueYear: "",
        passportExpiryDay: "",
        passportExpiryMonth: "",
        passportExpiryYear: "",
        livesAbroad: "",
        previousVisas: "",
    });

    // Family data
    const [hasSpouse, setHasSpouse] = useState(false);
    const [spouseData, setSpouseData] = useState({
        first_name: "",
        last_name: "",
        dobDay: "",
        dobMonth: "",
        dobYear: "",
        birth_country: "",
        birth_city: "",
    });
    const [hasChildren, setHasChildren] = useState(false);
    const [children, setChildren] = useState<Array<{ last_name: string; first_name: string; dobDay: string; dobMonth: string; dobYear: string }>>([]);

    useEffect(() => {
        async function loadUser() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            if (user.user_metadata?.user_type === 'employer') {
                router.push("/profile/employer");
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

                // Determine if original_citizenship is same
                const origSame = !candidate.original_citizenship ||
                    candidate.original_citizenship === candidate.citizenship;

                setFormData(prev => ({
                    ...prev,
                    countryCode,
                    phoneNumber,
                    nationality: candidate.nationality || "",
                    dobDay,
                    dobMonth,
                    dobYear,
                    preferredJob: candidate.preferred_job || "",
                    languages: candidate.languages?.join(", ") || "",
                    // FIX: Load existing signature so it doesn't get overwritten
                    signatureData: candidate.signature_url || "",
                    // New fields
                    gender: candidate.gender || "",
                    maritalStatus: candidate.marital_status || "",
                    birthCountry: candidate.birth_country || "",
                    birthCity: candidate.birth_city || "",
                    citizenship: candidate.citizenship || "",
                    originalCitizenshipSame: origSame,
                    originalCitizenship: candidate.original_citizenship || "",
                    maidenName: candidate.maiden_name || "",
                    fatherName: candidate.father_name || "",
                    motherName: candidate.mother_name || "",
                    passportNumber: candidate.passport_number || "",
                    passportIssuedBy: candidate.passport_issued_by || "",
                    passportIssueDate: candidate.passport_issue_date || "",
                    passportExpiryDate: candidate.passport_expiry_date || "",
                    livesAbroad: candidate.lives_abroad || "",
                    previousVisas: candidate.previous_visas || "",
                }));

                // Load family data
                if (candidate.family_data) {
                    const fd = candidate.family_data;
                    if (fd.spouse) {
                        setHasSpouse(true);
                        const sp = fd.spouse;
                        let spDobDay = "", spDobMonth = "", spDobYear = "";
                        if (sp.dob) {
                            const d = new Date(sp.dob);
                            spDobDay = d.getDate().toString();
                            spDobMonth = (d.getMonth() + 1).toString();
                            spDobYear = d.getFullYear().toString();
                        }
                        setSpouseData({
                            first_name: sp.first_name || "",
                            last_name: sp.last_name || "",
                            dobDay: spDobDay,
                            dobMonth: spDobMonth,
                            dobYear: spDobYear,
                            birth_country: sp.birth_country || "",
                            birth_city: sp.birth_city || "",
                        });
                    }
                    if (fd.children && fd.children.length > 0) {
                        setHasChildren(true);
                        setChildren(fd.children.map((c: any) => {
                            let cDay = "", cMonth = "", cYear = "";
                            if (c.dob) {
                                const d = new Date(c.dob);
                                cDay = d.getDate().toString();
                                cMonth = (d.getMonth() + 1).toString();
                                cYear = d.getFullYear().toString();
                            }
                            return {
                                first_name: c.first_name || "",
                                last_name: c.last_name || "",
                                dobDay: cDay,
                                dobMonth: cMonth,
                                dobYear: cYear,
                            };
                        }));
                    }
                }
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
            const month = formData.dobMonth.toString().padStart(2, '0');
            const day = formData.dobDay.toString().padStart(2, '0');
            return `${formData.dobYear}-${month}-${day}`;
        }
        return null;
    };

    const handleSignatureSave = (signatureData: string) => {
        setFormData(prev => ({
            ...prev,
            signatureData
        }));
    };

    // Helper: add a child
    const addChild = () => {
        if (children.length < 5) {
            setChildren(prev => [...prev, { ...EMPTY_CHILD }]);
        }
    };

    // Helper: remove a child
    const removeChild = (index: number) => {
        setChildren(prev => prev.filter((_, i) => i !== index));
    };

    // Helper: update a child field
    const updateChild = (index: number, field: string, value: string) => {
        setChildren(prev => prev.map((child, i) =>
            i === index ? { ...child, [field]: value } : child
        ));
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

            // Build family_data JSON
            const familyData: any = {};
            if (hasSpouse) {
                const spouseDob = (spouseData.dobDay && spouseData.dobMonth && spouseData.dobYear)
                    ? `${spouseData.dobYear}-${spouseData.dobMonth.padStart(2, '0')}-${spouseData.dobDay.padStart(2, '0')}`
                    : null;
                familyData.spouse = {
                    first_name: spouseData.first_name,
                    last_name: spouseData.last_name,
                    dob: spouseDob,
                    birth_country: spouseData.birth_country,
                    birth_city: spouseData.birth_city,
                };
            }
            if (hasChildren && children.length > 0) {
                familyData.children = children.map(c => {
                    const childDob = (c.dobDay && c.dobMonth && c.dobYear)
                        ? `${c.dobYear}-${c.dobMonth.padStart(2, '0')}-${c.dobDay.padStart(2, '0')}`
                        : null;
                    return { first_name: c.first_name, last_name: c.last_name, dob: childDob };
                });
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
                languages: formData.languages ? formData.languages.split(",").map(l => l.trim()) : [],
                preferred_country: "serbia",
                signature_url: formData.signatureData || null,
                updated_at: new Date().toISOString(),
                // New fields
                gender: formData.gender || null,
                marital_status: formData.maritalStatus || null,
                birth_country: formData.birthCountry || null,
                birth_city: formData.birthCity || null,
                citizenship: formData.citizenship || null,
                original_citizenship: formData.originalCitizenshipSame
                    ? (formData.citizenship || null)
                    : (formData.originalCitizenship || null),
                maiden_name: formData.maidenName || null,
                father_name: formData.fatherName || null,
                mother_name: formData.motherName || null,
                family_data: (Object.keys(familyData).length > 0) ? familyData : null,
                passport_number: formData.passportNumber || null,
                passport_issued_by: formData.passportIssuedBy || null,
                passport_issue_date: (formData.passportIssueDay && formData.passportIssueMonth && formData.passportIssueYear) ? `${formData.passportIssueYear}-${formData.passportIssueMonth.padStart(2, '0')}-${formData.passportIssueDay.padStart(2, '0')}` : null,
                passport_expiry_date: (formData.passportExpiryDay && formData.passportExpiryMonth && formData.passportExpiryYear) ? `${formData.passportExpiryYear}-${formData.passportExpiryMonth.padStart(2, '0')}-${formData.passportExpiryDay.padStart(2, '0')}` : null,
                lives_abroad: formData.livesAbroad || null,
                previous_visas: formData.previousVisas || null,
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

    const inputClass = "w-full px-4 py-3 rounded-xl border border-[#dddfe2] focus:border-[#1877f2] focus:outline-none transition-colors";
    const labelClass = "block text-xs font-semibold text-[#65676b] uppercase tracking-wide mb-1.5";

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
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[900px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/profile" className="text-[#65676b] hover:text-[#050505] text-sm font-semibold flex items-center gap-2">
                        ← Back to Profile
                    </Link>
                    <Link href="/" className="flex items-center gap-2">
                        <img src="/logo.png" alt="Workers United" className="h-[60px] w-auto object-contain" />
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

                {/* ═══════════════ Section 1: Personal Info ═══════════════ */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <h2 className="text-lg font-bold text-[#050505] mb-4">👤 Personal Information</h2>
                    <div className="grid gap-4">
                        {/* Name */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>First Name *</label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => updateField("firstName", e.target.value)}
                                    className={inputClass}
                                    placeholder="First name"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Last Name *</label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => updateField("lastName", e.target.value)}
                                    className={inputClass}
                                    placeholder="Last name"
                                />
                            </div>
                        </div>

                        {/* Gender + Marital Status */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Gender *</label>
                                <select
                                    value={formData.gender}
                                    onChange={(e) => updateField("gender", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Select gender...</option>
                                    {GENDER_OPTIONS.map(g => (<option key={g} value={g}>{g}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Marital Status *</label>
                                <select
                                    value={formData.maritalStatus}
                                    onChange={(e) => updateField("maritalStatus", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Select status...</option>
                                    {MARITAL_STATUSES.map(s => (<option key={s} value={s}>{s}</option>))}
                                </select>
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className={labelClass}>Phone (WhatsApp) *</label>
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
                                    className={`flex-1 ${inputClass}`}
                                    placeholder="60 123 4567"
                                />
                            </div>
                        </div>

                        {/* Nationality */}
                        <div>
                            <label className={labelClass}>Nationality *</label>
                            <input
                                type="text"
                                value={formData.nationality}
                                onChange={(e) => updateField("nationality", e.target.value)}
                                className={inputClass}
                                placeholder="e.g., Serbian, Nigerian, Indian"
                            />
                        </div>

                        {/* Date of Birth */}
                        <div>
                            <label className={labelClass}>Date of Birth *</label>
                            <div className="grid grid-cols-3 gap-3">
                                <select
                                    value={formData.dobDay}
                                    onChange={(e) => updateField("dobDay", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Day</option>
                                    {DAYS.map(day => (<option key={day} value={day}>{day}</option>))}
                                </select>
                                <select
                                    value={formData.dobMonth}
                                    onChange={(e) => updateField("dobMonth", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Month</option>
                                    {MONTHS.map(month => (<option key={month.value} value={month.value}>{month.label}</option>))}
                                </select>
                                <select
                                    value={formData.dobYear}
                                    onChange={(e) => updateField("dobYear", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Year</option>
                                    {YEARS.map(year => (<option key={year} value={year}>{year}</option>))}
                                </select>
                            </div>
                        </div>

                        {/* Birth Country + Birth City */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Country of Birth *</label>
                                <select
                                    value={formData.birthCountry}
                                    onChange={(e) => updateField("birthCountry", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Select country...</option>
                                    {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>City of Birth *</label>
                                <input
                                    type="text"
                                    value={formData.birthCity}
                                    onChange={(e) => updateField("birthCity", e.target.value)}
                                    className={inputClass}
                                    placeholder="e.g., Mumbai"
                                />
                            </div>
                        </div>

                        {/* Citizenship */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Citizenship *</label>
                                <select
                                    value={formData.citizenship}
                                    onChange={(e) => updateField("citizenship", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Select country...</option>
                                    {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Original Citizenship</label>
                                <div className="flex items-center gap-2 mb-2 mt-1">
                                    <input
                                        type="checkbox"
                                        id="origCitizenshipSameOnboard"
                                        checked={formData.originalCitizenshipSame}
                                        onChange={(e) => updateField("originalCitizenshipSame", e.target.checked)}
                                        className="w-4 h-4 text-[#1877f2] rounded focus:ring-[#1877f2]"
                                    />
                                    <label htmlFor="origCitizenshipSameOnboard" className="text-[12px] text-gray-600">
                                        Same as current
                                    </label>
                                </div>
                                {!formData.originalCitizenshipSame && (
                                    <select
                                        value={formData.originalCitizenship}
                                        onChange={(e) => updateField("originalCitizenship", e.target.value)}
                                        className={`${inputClass} bg-white`}
                                    >
                                        <option value="">Select country...</option>
                                        {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                    </select>
                                )}
                            </div>
                        </div>

                        {/* Maiden Name */}
                        <div>
                            <label className={labelClass}>Maiden Name (Birth Surname)</label>
                            <input
                                type="text"
                                value={formData.maidenName}
                                onChange={(e) => updateField("maidenName", e.target.value)}
                                className={inputClass}
                                placeholder="Only if different from current surname"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Optional — if your surname changed after marriage</p>
                        </div>

                        {/* Father + Mother name */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Father&apos;s First Name</label>
                                <input
                                    type="text"
                                    value={formData.fatherName}
                                    onChange={(e) => updateField("fatherName", e.target.value)}
                                    className={inputClass}
                                    placeholder="Optional"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Mother&apos;s First Name</label>
                                <input
                                    type="text"
                                    value={formData.motherName}
                                    onChange={(e) => updateField("motherName", e.target.value)}
                                    className={inputClass}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════ Section 2: Family Information ═══════════════ */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <h2 className="text-lg font-bold text-[#050505] mb-4">👨‍👩‍👧‍👦 Family Information</h2>
                    <div className="grid gap-4">
                        {/* Spouse Toggle */}
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="hasSpouseOnboard"
                                checked={hasSpouse}
                                onChange={(e) => setHasSpouse(e.target.checked)}
                                className="w-4 h-4 text-[#1877f2] rounded focus:ring-[#1877f2]"
                            />
                            <label htmlFor="hasSpouseOnboard" className="text-[14px] font-medium text-gray-700">
                                I have a spouse / partner
                            </label>
                        </div>

                        {/* Spouse Fields */}
                        {hasSpouse && (
                            <div className="border border-[#dddfe2] rounded-xl p-4 bg-[#f9fafb] space-y-3">
                                <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Spouse Details</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>First Name *</label>
                                        <input
                                            type="text"
                                            value={spouseData.first_name}
                                            onChange={(e) => setSpouseData(prev => ({ ...prev, first_name: e.target.value }))}
                                            className={inputClass}
                                            placeholder="Spouse's first name"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Last Name *</label>
                                        <input
                                            type="text"
                                            value={spouseData.last_name}
                                            onChange={(e) => setSpouseData(prev => ({ ...prev, last_name: e.target.value }))}
                                            className={inputClass}
                                            placeholder="Spouse's last name"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className={labelClass}>Date of Birth *</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <select value={spouseData.dobDay} onChange={(e) => setSpouseData(prev => ({ ...prev, dobDay: e.target.value }))} className={inputClass}>
                                                <option value="">Day</option>
                                                {DAYS.map(d => (<option key={d} value={d.toString()}>{d}</option>))}
                                            </select>
                                            <select value={spouseData.dobMonth} onChange={(e) => setSpouseData(prev => ({ ...prev, dobMonth: e.target.value }))} className={inputClass}>
                                                <option value="">Month</option>
                                                {MONTHS.map(m => (<option key={m.value} value={m.value.toString()}>{m.label}</option>))}
                                            </select>
                                            <select value={spouseData.dobYear} onChange={(e) => setSpouseData(prev => ({ ...prev, dobYear: e.target.value }))} className={inputClass}>
                                                <option value="">Year</option>
                                                {ALL_YEARS.map(y => (<option key={y} value={y.toString()}>{y}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Country of Birth</label>
                                        <select
                                            value={spouseData.birth_country}
                                            onChange={(e) => setSpouseData(prev => ({ ...prev, birth_country: e.target.value }))}
                                            className={`${inputClass} bg-white`}
                                        >
                                            <option value="">Select...</option>
                                            {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>City of Birth</label>
                                        <input
                                            type="text"
                                            value={spouseData.birth_city}
                                            onChange={(e) => setSpouseData(prev => ({ ...prev, birth_city: e.target.value }))}
                                            className={inputClass}
                                            placeholder="City"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Children Toggle */}
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="hasChildrenOnboard"
                                checked={hasChildren}
                                onChange={(e) => {
                                    setHasChildren(e.target.checked);
                                    if (e.target.checked && children.length === 0) {
                                        setChildren([{ ...EMPTY_CHILD }]);
                                    }
                                }}
                                className="w-4 h-4 text-[#1877f2] rounded focus:ring-[#1877f2]"
                            />
                            <label htmlFor="hasChildrenOnboard" className="text-[14px] font-medium text-gray-700">
                                I have children
                            </label>
                        </div>

                        {/* Children Fields */}
                        {hasChildren && (
                            <div className="space-y-3">
                                {children.map((child, index) => (
                                    <div key={index} className="border border-[#dddfe2] rounded-xl p-4 bg-[#f9fafb]">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                                                Child {index + 1}
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => removeChild(index)}
                                                className="text-red-500 text-[12px] hover:text-red-700 font-medium"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className={labelClass}>Last Name</label>
                                                <input
                                                    type="text"
                                                    value={child.last_name}
                                                    onChange={(e) => updateChild(index, "last_name", e.target.value)}
                                                    className={inputClass}
                                                    placeholder="Last name"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>First Name</label>
                                                <input
                                                    type="text"
                                                    value={child.first_name}
                                                    onChange={(e) => updateChild(index, "first_name", e.target.value)}
                                                    className={inputClass}
                                                    placeholder="First name"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Date of Birth</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <select value={child.dobDay} onChange={(e) => updateChild(index, "dobDay", e.target.value)} className={inputClass}>
                                                        <option value="">Day</option>
                                                        {DAYS.map(d => (<option key={d} value={d.toString()}>{d}</option>))}
                                                    </select>
                                                    <select value={child.dobMonth} onChange={(e) => updateChild(index, "dobMonth", e.target.value)} className={inputClass}>
                                                        <option value="">Month</option>
                                                        {MONTHS.map(m => (<option key={m.value} value={m.value.toString()}>{m.label}</option>))}
                                                    </select>
                                                    <select value={child.dobYear} onChange={(e) => updateChild(index, "dobYear", e.target.value)} className={inputClass}>
                                                        <option value="">Year</option>
                                                        {ALL_YEARS.map(y => (<option key={y} value={y.toString()}>{y}</option>))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {children.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={addChild}
                                        className="text-[#1877f2] text-[13px] font-semibold hover:underline"
                                    >
                                        + Add another child
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════ Section 3: Passport & Travel ═══════════════ */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <h2 className="text-lg font-bold text-[#050505] mb-4">🛂 Passport & Travel</h2>
                    <div className="grid gap-4">
                        {/* Passport Number + Issued By */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Passport Number *</label>
                                <input
                                    type="text"
                                    value={formData.passportNumber}
                                    onChange={(e) => updateField("passportNumber", e.target.value)}
                                    className={inputClass}
                                    placeholder="e.g., AB1234567"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Issued By *</label>
                                <input
                                    type="text"
                                    value={formData.passportIssuedBy}
                                    onChange={(e) => updateField("passportIssuedBy", e.target.value)}
                                    className={inputClass}
                                    placeholder="Issuing authority"
                                />
                            </div>
                        </div>

                        {/* Issue Date + Expiry Date */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Issue Date *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <select value={formData.passportIssueDay} onChange={(e) => updateField("passportIssueDay", e.target.value)} className={inputClass}>
                                        <option value="">Day</option>
                                        {DAYS.map(d => (<option key={d} value={d.toString()}>{d}</option>))}
                                    </select>
                                    <select value={formData.passportIssueMonth} onChange={(e) => updateField("passportIssueMonth", e.target.value)} className={inputClass}>
                                        <option value="">Month</option>
                                        {MONTHS.map(m => (<option key={m.value} value={m.value.toString()}>{m.label}</option>))}
                                    </select>
                                    <select value={formData.passportIssueYear} onChange={(e) => updateField("passportIssueYear", e.target.value)} className={inputClass}>
                                        <option value="">Year</option>
                                        {PASSPORT_ISSUE_YEARS.map(y => (<option key={y} value={y.toString()}>{y}</option>))}
                                    </select>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Must be within the last 10 years</p>
                            </div>
                            <div>
                                <label className={labelClass}>Expiry Date *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <select value={formData.passportExpiryDay} onChange={(e) => updateField("passportExpiryDay", e.target.value)} className={inputClass}>
                                        <option value="">Day</option>
                                        {DAYS.map(d => (<option key={d} value={d.toString()}>{d}</option>))}
                                    </select>
                                    <select value={formData.passportExpiryMonth} onChange={(e) => updateField("passportExpiryMonth", e.target.value)} className={inputClass}>
                                        <option value="">Month</option>
                                        {MONTHS.map(m => (<option key={m.value} value={m.value.toString()}>{m.label}</option>))}
                                    </select>
                                    <select value={formData.passportExpiryYear} onChange={(e) => updateField("passportExpiryYear", e.target.value)} className={inputClass}>
                                        <option value="">Year</option>
                                        {PASSPORT_EXPIRY_YEARS.map(y => (<option key={y} value={y.toString()}>{y}</option>))}
                                    </select>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Must be 3+ months after departure</p>
                            </div>
                        </div>

                        {/* Lives Abroad + Previous Visas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Do you live outside your home country? *</label>
                                <select
                                    value={formData.livesAbroad}
                                    onChange={(e) => updateField("livesAbroad", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Select...</option>
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Have you had any visas in the last 3 years? *</label>
                                <select
                                    value={formData.previousVisas}
                                    onChange={(e) => updateField("previousVisas", e.target.value)}
                                    className={`${inputClass} bg-white`}
                                >
                                    <option value="">Select...</option>
                                    <option value="No">No</option>
                                    <option value="Yes">Yes</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════ Section 4: Work Preferences ═══════════════ */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <h2 className="text-lg font-bold text-[#050505] mb-4">💼 Work Preferences</h2>
                    <div className="grid gap-4">
                        <div>
                            <label className={labelClass}>Preferred Job / Industry *</label>
                            <select
                                value={formData.preferredJob}
                                onChange={(e) => updateField("preferredJob", e.target.value)}
                                className={`${inputClass} bg-white`}
                            >
                                <option value="">Select industry...</option>
                                {INDUSTRIES.map(ind => (<option key={ind} value={ind}>{ind}</option>))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Languages You Speak</label>
                            <input
                                type="text"
                                value={formData.languages}
                                onChange={(e) => updateField("languages", e.target.value)}
                                className={inputClass}
                                placeholder="e.g., English, Serbian, French"
                            />
                        </div>
                    </div>
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
                        href="/profile"
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
