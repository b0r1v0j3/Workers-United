"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { WORLD_COUNTRIES, WORKER_INDUSTRIES, MARITAL_STATUSES, GENDER_OPTIONS, EUROPEAN_COUNTRIES } from "@/lib/constants";
import { logActivity, logError } from "@/lib/activityLogger";

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
    birth_country: string;
    birth_city: string;
    citizenship: string;
    original_citizenship: string;
    maiden_name: string;
    father_name: string;
    mother_name: string;
    marital_status: string;
    gender: string;
    family_data: any;
    passport_number: string;
    passport_issued_by: string;
    passport_issue_date: string;
    passport_expiry_date: string;
    lives_abroad: string;
    previous_visas: string;
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
// Family DOB years (0–100 years ago)
const ALL_YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);
// Passport issue date: last 10 years
const PASSPORT_ISSUE_YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);
// Passport expiry date: current year + 10 years ahead
const PASSPORT_EXPIRY_YEARS = Array.from({ length: 11 }, (_, i) => currentYear + i);

// Empty child template
const EMPTY_CHILD = { last_name: "", first_name: "", dobDay: "", dobMonth: "", dobYear: "" };

// Helper to parse YYYY-MM-DD into { prefixDay, prefixMonth, prefixYear }
function parseDateToComponents(dateStr: string | null | undefined, prefix: string) {
    if (!dateStr) return { [`${prefix}Day`]: "", [`${prefix}Month`]: "", [`${prefix}Year`]: "" };
    const d = new Date(dateStr);
    return {
        [`${prefix}Day`]: d.getDate().toString(),
        [`${prefix}Month`]: (d.getMonth() + 1).toString(),
        [`${prefix}Year`]: d.getFullYear().toString(),
    };
}

export default function ProfilePage() {
    const supabase = createClient();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // Removed error/success state as we use Toast now

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
        desired_countries: [] as string[],
        // New visa fields
        birth_country: "",
        birth_city: "",
        citizenship: "",
        original_citizenship_same: true,
        original_citizenship: "",
        maiden_name: "",
        father_name: "",
        mother_name: "",
        marital_status: "",
        gender: "",
        // Passport & travel
        passport_number: "",
        passport_issued_by: "",
        passport_issue_day: "",
        passport_issue_month: "",
        passport_issue_year: "",
        passport_expiry_day: "",
        passport_expiry_month: "",
        passport_expiry_year: "",
        lives_abroad: "",
        previous_visas: "",
    });

    // Family data (separate state for complex nested data)
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

                // Determine if original_citizenship is same
                const origSame = !candidateData.original_citizenship ||
                    candidateData.original_citizenship === candidateData.citizenship;

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
                    desired_countries: candidateData.desired_countries || [],
                    // New fields
                    birth_country: candidateData.birth_country || "",
                    birth_city: candidateData.birth_city || "",
                    citizenship: candidateData.citizenship || "",
                    original_citizenship_same: origSame,
                    original_citizenship: candidateData.original_citizenship || "",
                    maiden_name: candidateData.maiden_name || "",
                    father_name: candidateData.father_name || "",
                    mother_name: candidateData.mother_name || "",
                    marital_status: candidateData.marital_status || "",
                    gender: candidateData.gender || "",
                    passport_number: candidateData.passport_number || "",
                    passport_issued_by: candidateData.passport_issued_by || "",
                    ...parseDateToComponents(candidateData.passport_issue_date, "passport_issue"),
                    ...parseDateToComponents(candidateData.passport_expiry_date, "passport_expiry"),
                    lives_abroad: candidateData.lives_abroad || "",
                    previous_visas: candidateData.previous_visas || "",
                }));

                // Load family data
                if (candidateData.family_data) {
                    const fd = candidateData.family_data;
                    if (fd.spouse) {
                        setHasSpouse(true);
                        // Parse spouse dob into components
                        const sp = fd.spouse;
                        const spParsed = sp.dob ? parseDateToComponents(sp.dob, "dob") : { dobDay: "", dobMonth: "", dobYear: "" };
                        setSpouseData({
                            first_name: sp.first_name || "",
                            last_name: sp.last_name || "",
                            dobDay: spParsed.dobDay || "",
                            dobMonth: spParsed.dobMonth || "",
                            dobYear: spParsed.dobYear || "",
                            birth_country: sp.birth_country || "",
                            birth_city: sp.birth_city || "",
                        });
                    }
                    if (fd.children && fd.children.length > 0) {
                        setHasChildren(true);
                        setChildren(fd.children.map((c: any) => {
                            const cp = c.dob ? parseDateToComponents(c.dob, "dob") : { dobDay: "", dobMonth: "", dobYear: "" };
                            return {
                                first_name: c.first_name || "",
                                last_name: c.last_name || "",
                                dobDay: cp.dobDay || "",
                                dobMonth: cp.dobMonth || "",
                                dobYear: cp.dobYear || "",
                            };
                        }));
                    }
                }
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
        // Removed setError/setSuccess

        try {
            // Validate phone format for WhatsApp compatibility
            if (formData.phone && !/^\+\d{7,15}$/.test(formData.phone.replace(/[\s\-()]/g, ''))) {
                throw new Error("Phone number must start with + and country code (e.g., +381641234567)");
            }

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

            // Build family_data JSON
            const familyData: any = {};
            if (hasSpouse) {
                let spouseDob: string | null = null;
                if (spouseData.dobDay && spouseData.dobMonth && spouseData.dobYear) {
                    spouseDob = `${spouseData.dobYear}-${spouseData.dobMonth.padStart(2, '0')}-${spouseData.dobDay.padStart(2, '0')}`;
                }
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
                    let childDob: string | null = null;
                    if (c.dobDay && c.dobMonth && c.dobYear) {
                        childDob = `${c.dobYear}-${c.dobMonth.padStart(2, '0')}-${c.dobDay.padStart(2, '0')}`;
                    }
                    return { first_name: c.first_name, last_name: c.last_name, dob: childDob };
                });
            }

            // Build passport dates
            let passportIssueDate: string | null = null;
            if (formData.passport_issue_day && formData.passport_issue_month && formData.passport_issue_year) {
                passportIssueDate = `${formData.passport_issue_year}-${formData.passport_issue_month.padStart(2, '0')}-${formData.passport_issue_day.padStart(2, '0')}`;
            }
            let passportExpiryDate: string | null = null;
            if (formData.passport_expiry_day && formData.passport_expiry_month && formData.passport_expiry_year) {
                passportExpiryDate = `${formData.passport_expiry_year}-${formData.passport_expiry_month.padStart(2, '0')}-${formData.passport_expiry_day.padStart(2, '0')}`;
            }

            const candidateUpdates = {
                nationality: formData.nationality || null,
                date_of_birth: dateOfBirth,
                phone: formData.phone ? formData.phone.replace(/[\s\-()]/g, '') : null,
                address: formData.address || null,
                current_country: formData.current_country || null,
                preferred_job: formData.preferred_job || null,
                desired_countries: formData.desired_countries && formData.desired_countries.length > 0 ? formData.desired_countries : null,
                // New fields
                birth_country: formData.birth_country || null,
                birth_city: formData.birth_city || null,
                citizenship: formData.citizenship || null,
                original_citizenship: formData.original_citizenship_same
                    ? (formData.citizenship || null)
                    : (formData.original_citizenship || null),
                maiden_name: formData.maiden_name || null,
                father_name: formData.father_name || null,
                mother_name: formData.mother_name || null,
                marital_status: formData.marital_status || null,
                gender: formData.gender || null,
                family_data: (Object.keys(familyData).length > 0) ? familyData : null,
                passport_number: formData.passport_number || null,
                passport_issued_by: formData.passport_issued_by || null,
                passport_issue_date: passportIssueDate,
                passport_expiry_date: passportExpiryDate,
                lives_abroad: formData.lives_abroad || null,
                previous_visas: formData.previous_visas || null,
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

            // Sync phone to Supabase Auth so it appears in Auth dashboard
            const cleanPhone = formData.phone ? formData.phone.replace(/[\s\-()]/g, '') : null;
            if (cleanPhone) {
                await supabase.auth.updateUser({
                    data: { phone: cleanPhone }
                });
            }

            logActivity("profile_saved", "profile", { is_new: !candidate, fields_filled: Object.keys(candidateUpdates).filter(k => (candidateUpdates as Record<string, unknown>)[k] != null).length });
            toast.success("Profile saved successfully!");
            await fetchProfile();
        } catch (err) {
            logError("profile_save_failed", "profile", err);
            toast.error(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f0f2f5]">
                {/* Navbar Skeleton */}
                <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                    <div className="max-w-[900px] mx-auto px-4 h-full flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-10 w-40" />
                        <div className="w-[120px]" />
                    </div>
                </nav>

                <div className="max-w-[900px] mx-auto px-4 py-6">
                    {/* Header Skeleton */}
                    <div className="mb-6 space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-96" />
                    </div>

                    <div className="space-y-4">
                        {/* Card 1 Skeleton */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
                            <Skeleton className="h-6 w-40 mb-4" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            </div>
                        </div>

                        {/* Card 2 Skeleton */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
                            <Skeleton className="h-6 w-40 mb-4" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] focus:ring-2 focus:ring-[#1877f2] focus:border-transparent bg-gray-50 hover:bg-white focus:bg-white transition-colors";
    const labelClass = "block text-[13px] font-medium text-gray-700 mb-1.5";

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
                        <span className="font-bold text-[#1E3A5F] text-xl hidden sm:inline">Workers United</span>
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

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {/* • • • • • • • • • • • • • • •  Account Information Card • • • • • • • • • • • • • • •  */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Account Information</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Email</label>
                                        <input
                                            type="email"
                                            value={profile?.email || ""}
                                            disabled
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-[15px] bg-gray-100 cursor-not-allowed text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="full_name"
                                            value={formData.full_name}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="Your full name"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* • • • • • • • • • • • • • • •  Personal Information Card • • • • • • • • • • • • • • •  */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Personal Information</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Row: Gender + Marital Status */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Gender <span className="text-red-500">*</span>
                                        </label>
                                        <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
                                            <option value="">Select gender...</option>
                                            {GENDER_OPTIONS.map(g => (<option key={g} value={g}>{g}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Marital Status <span className="text-red-500">*</span>
                                        </label>
                                        <select name="marital_status" value={formData.marital_status} onChange={handleChange} className={inputClass}>
                                            <option value="">Select status...</option>
                                            {MARITAL_STATUSES.map(s => (<option key={s} value={s}>{s}</option>))}
                                        </select>
                                    </div>
                                </div>

                                {/* Row: Nationality + DOB */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Nationality <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="nationality"
                                            value={formData.nationality}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="e.g., Indian"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Date of Birth <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <select
                                                value={formData.dobDay}
                                                onChange={(e) => setFormData(prev => ({ ...prev, dobDay: e.target.value }))}
                                                className={inputClass}
                                            >
                                                <option value="">Day</option>
                                                {DAYS.map(day => (<option key={day} value={day}>{day}</option>))}
                                            </select>
                                            <select
                                                value={formData.dobMonth}
                                                onChange={(e) => setFormData(prev => ({ ...prev, dobMonth: e.target.value }))}
                                                className={inputClass}
                                            >
                                                <option value="">Month</option>
                                                {MONTHS.map(month => (<option key={month.value} value={month.value}>{month.label}</option>))}
                                            </select>
                                            <select
                                                value={formData.dobYear}
                                                onChange={(e) => setFormData(prev => ({ ...prev, dobYear: e.target.value }))}
                                                className={inputClass}
                                            >
                                                <option value="">Year</option>
                                                {YEARS.map(year => (<option key={year} value={year}>{year}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Row: Birth Country + Birth City */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Country of Birth <span className="text-red-500">*</span>
                                        </label>
                                        <select name="birth_country" value={formData.birth_country} onChange={handleChange} className={inputClass}>
                                            <option value="">Select country...</option>
                                            {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            City of Birth <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="birth_city"
                                            value={formData.birth_city}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="e.g., Mumbai"
                                        />
                                    </div>
                                </div>

                                {/* Row: Citizenship + Original Citizenship */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Citizenship <span className="text-red-500">*</span>
                                        </label>
                                        <select name="citizenship" value={formData.citizenship} onChange={handleChange} className={inputClass}>
                                            <option value="">Select country...</option>
                                            {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Original Citizenship</label>
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                id="origCitizenshipSame"
                                                checked={formData.original_citizenship_same}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    original_citizenship_same: e.target.checked,
                                                    original_citizenship: e.target.checked ? "" : prev.original_citizenship
                                                }))}
                                                className="w-4 h-4 text-[#1877f2] rounded focus:ring-[#1877f2]"
                                            />
                                            <label htmlFor="origCitizenshipSame" className="text-[13px] text-gray-600">
                                                Same as current citizenship
                                            </label>
                                        </div>
                                        {!formData.original_citizenship_same && (
                                            <select
                                                name="original_citizenship"
                                                value={formData.original_citizenship}
                                                onChange={handleChange}
                                                className={inputClass}
                                            >
                                                <option value="">Select country...</option>
                                                {WORLD_COUNTRIES.map(c => (<option key={c} value={c}>{c}</option>))}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* Row: Maiden Name */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Maiden Name (Birth Surname)</label>
                                        <input
                                            type="text"
                                            name="maiden_name"
                                            value={formData.maiden_name}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="Only if different from current surname"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">Optional — if your surname changed after marriage</p>
                                    </div>
                                </div>

                                {/* Row: Father + Mother name */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Father&apos;s First Name</label>
                                        <input
                                            type="text"
                                            name="father_name"
                                            value={formData.father_name}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="Father's first name"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">Optional</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Mother&apos;s First Name</label>
                                        <input
                                            type="text"
                                            name="mother_name"
                                            value={formData.mother_name}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="Mother's first name"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">Optional</p>
                                    </div>
                                </div>

                                {/* Row: Phone + Current Country */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Phone Number (WhatsApp) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (val.length === 1 && val !== '+') val = '+' + val;
                                                setFormData(prev => ({ ...prev, phone: val }));
                                            }}
                                            className={inputClass}
                                            placeholder="+381641234567"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">Must include country code, e.g. +381 for Serbia, +91 for India</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Current Country <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="current_country"
                                            value={formData.current_country}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="Where you live now"
                                        />
                                    </div>
                                </div>

                                {/* Address */}
                                <div>
                                    <label className={labelClass}>Address</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Your full address"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* • • • • • • • • • • • • • • •  Family Information Card • • • • • • • • • • • • • • •  */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Family Information</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Spouse Toggle */}
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="hasSpouse"
                                        checked={hasSpouse}
                                        onChange={(e) => setHasSpouse(e.target.checked)}
                                        className="w-4 h-4 text-[#1877f2] rounded focus:ring-[#1877f2]"
                                    />
                                    <label htmlFor="hasSpouse" className="text-[14px] font-medium text-gray-700">
                                        I have a spouse / partner
                                    </label>
                                </div>

                                {/* Spouse Fields */}
                                {hasSpouse && (
                                    <div className="border border-gray-200 rounded-md p-4 bg-gray-50 space-y-4">
                                        <h3 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wide">Spouse Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClass}>First Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={spouseData.first_name}
                                                    onChange={(e) => setSpouseData(prev => ({ ...prev, first_name: e.target.value }))}
                                                    className={inputClass}
                                                    placeholder="Spouse's first name"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={spouseData.last_name}
                                                    onChange={(e) => setSpouseData(prev => ({ ...prev, last_name: e.target.value }))}
                                                    className={inputClass}
                                                    placeholder="Spouse's last name"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelClass}>Date of Birth <span className="text-red-500">*</span></label>
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
                                                    className={inputClass}
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
                                <div className="flex items-center gap-3 mt-2">
                                    <input
                                        type="checkbox"
                                        id="hasChildren"
                                        checked={hasChildren}
                                        onChange={(e) => {
                                            setHasChildren(e.target.checked);
                                            if (e.target.checked && children.length === 0) {
                                                setChildren([{ ...EMPTY_CHILD }]);
                                            }
                                        }}
                                        className="w-4 h-4 text-[#1877f2] rounded focus:ring-[#1877f2]"
                                    />
                                    <label htmlFor="hasChildren" className="text-[14px] font-medium text-gray-700">
                                        I have children
                                    </label>
                                </div>

                                {/* Children Fields */}
                                {hasChildren && (
                                    <div className="space-y-3">
                                        {children.map((child, index) => (
                                            <div key={index} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wide">
                                                        Child {index + 1}
                                                    </h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeChild(index)}
                                                        className="text-red-500 text-[13px] hover:text-red-700 font-medium"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                className="text-[#1877f2] text-[14px] font-semibold hover:underline"
                                            >
                                                + Add another child
                                            </button>
                                        )}
                                        {children.length >= 5 && (
                                            <p className="text-[12px] text-gray-500">Maximum 5 children can be added.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* • • • • • • • • • • • • • • •  Passport & Travel Card • • • • • • • • • • • • • • •  */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Passport & Travel</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Row: Passport Number + Issued By */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Passport Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="passport_number"
                                            value={formData.passport_number}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="e.g., AB1234567"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Issued By <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="passport_issued_by"
                                            value={formData.passport_issued_by}
                                            onChange={handleChange}
                                            className={inputClass}
                                            placeholder="Issuing authority"
                                        />
                                    </div>
                                </div>

                                {/* Row: Issue Date + Expiry Date */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Issue Date <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <select name="passport_issue_day" value={formData.passport_issue_day} onChange={handleChange} className={inputClass}>
                                                <option value="">Day</option>
                                                {DAYS.map(d => (<option key={d} value={d.toString()}>{d}</option>))}
                                            </select>
                                            <select name="passport_issue_month" value={formData.passport_issue_month} onChange={handleChange} className={inputClass}>
                                                <option value="">Month</option>
                                                {MONTHS.map(m => (<option key={m.value} value={m.value.toString()}>{m.label}</option>))}
                                            </select>
                                            <select name="passport_issue_year" value={formData.passport_issue_year} onChange={handleChange} className={inputClass}>
                                                <option value="">Year</option>
                                                {PASSPORT_ISSUE_YEARS.map(y => (<option key={y} value={y.toString()}>{y}</option>))}
                                            </select>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1">Must be within the last 10 years</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Expiry Date <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <select name="passport_expiry_day" value={formData.passport_expiry_day} onChange={handleChange} className={inputClass}>
                                                <option value="">Day</option>
                                                {DAYS.map(d => (<option key={d} value={d.toString()}>{d}</option>))}
                                            </select>
                                            <select name="passport_expiry_month" value={formData.passport_expiry_month} onChange={handleChange} className={inputClass}>
                                                <option value="">Month</option>
                                                {MONTHS.map(m => (<option key={m.value} value={m.value.toString()}>{m.label}</option>))}
                                            </select>
                                            <select name="passport_expiry_year" value={formData.passport_expiry_year} onChange={handleChange} className={inputClass}>
                                                <option value="">Year</option>
                                                {PASSPORT_EXPIRY_YEARS.map(y => (<option key={y} value={y.toString()}>{y}</option>))}
                                            </select>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1">Must be valid for at least 3 months after departure</p>
                                    </div>
                                </div>

                                {/* Row: Lives Abroad + Previous Visas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>
                                            Do you live outside your home country? <span className="text-red-500">*</span>
                                        </label>
                                        <select name="lives_abroad" value={formData.lives_abroad} onChange={handleChange} className={inputClass}>
                                            <option value="">Select...</option>
                                            <option value="No">No</option>
                                            <option value="Yes">Yes</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>
                                            Have you had any visas in the last 3 years? <span className="text-red-500">*</span>
                                        </label>
                                        <select name="previous_visas" value={formData.previous_visas} onChange={handleChange} className={inputClass}>
                                            <option value="">Select...</option>
                                            <option value="No">No</option>
                                            <option value="Yes">Yes</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* • • • • • • • • • • • • • • •  Job Preferences Card • • • • • • • • • • • • • • •  */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="font-semibold text-gray-900 text-[15px]">Job Preferences</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className={labelClass}>
                                        Preferred Job / Industry <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="preferred_job"
                                        value={formData.preferred_job}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="">Select industry...</option>
                                        {WORKER_INDUSTRIES.map(ind => (<option key={ind} value={ind}>{ind}</option>))}
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Preferred Destinations (Europe)
                                    </label>

                                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 max-h-60 overflow-y-auto">
                                        <label className="flex items-center space-x-2 mb-2 pb-2 border-b border-gray-200">
                                            <input
                                                type="checkbox"
                                                checked={formData.desired_countries.includes("Any")}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFormData(prev => ({ ...prev, desired_countries: ["Any"] }));
                                                    } else {
                                                        setFormData(prev => ({ ...prev, desired_countries: [] }));
                                                    }
                                                }}
                                                className="rounded text-[#1877f2] focus:ring-[#1877f2]"
                                            />
                                            <span className="text-sm font-medium text-gray-900">Any (Open to anywhere in Europe)</span>
                                        </label>

                                        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${formData.desired_countries.includes("Any") ? "opacity-50 pointer-events-none" : ""}`}>
                                            {EUROPEAN_COUNTRIES.map(country => (
                                                <label key={country} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.desired_countries.includes(country)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setFormData(prev => {
                                                                const current = prev.desired_countries.filter(c => c !== "Any");
                                                                if (checked) {
                                                                    return { ...prev, desired_countries: [...current, country] };
                                                                } else {
                                                                    return { ...prev, desired_countries: current.filter(c => c !== country) };
                                                                }
                                                            });
                                                        }}
                                                        className="rounded text-[#1877f2] focus:ring-[#1877f2]"
                                                    />
                                                    <span className="text-sm text-gray-700">{country}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-[12px] text-gray-500 mt-2">
                                        ⓘ Selecting a specific country doesn&apos;t guarantee a job there. You might receive offers from other EU countries.
                                    </p>
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
