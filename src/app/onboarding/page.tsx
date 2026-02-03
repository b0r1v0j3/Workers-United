"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SignaturePad } from "@/components/SignaturePad";

const STEPS = [
    { id: 1, title: "Personal Info", icon: "👤" },
    { id: 2, title: "Work Preferences", icon: "💼" },
    { id: 3, title: "Documents", icon: "📄" },
    { id: 4, title: "Signature", icon: "✍️" },
];

// Country codes for phone input
const COUNTRY_CODES = [
    { code: "+381", country: "Serbia", flag: "🇷🇸" },
    { code: "+385", country: "Croatia", flag: "🇭🇷" },
    { code: "+386", country: "Slovenia", flag: "🇸🇮" },
    { code: "+387", country: "Bosnia", flag: "🇧🇦" },
    { code: "+389", country: "N. Macedonia", flag: "🇲🇰" },
    { code: "+382", country: "Montenegro", flag: "🇲🇪" },
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
    { code: "+33", country: "France", flag: "🇫🇷" },
    { code: "+44", country: "UK", flag: "🇬🇧" },
    { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
    { code: "+234", country: "Nigeria", flag: "🇳🇬" },
    { code: "+91", country: "India", flag: "🇮🇳" },
    { code: "+63", country: "Philippines", flag: "🇵🇭" },
    { code: "+92", country: "Pakistan", flag: "🇵🇰" },
    { code: "+880", country: "Bangladesh", flag: "🇧🇩" },
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
const YEARS = Array.from({ length: 80 }, (_, i) => currentYear - 18 - i); // 18 to 98 years old

export default function OnboardingPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const router = useRouter();

    // Form data
    const [formData, setFormData] = useState({
        // Step 1: Personal Info
        countryCode: "+381",
        phoneNumber: "",
        nationality: "",
        dobDay: "",
        dobMonth: "",
        dobYear: "",

        // Step 2: Work Preferences
        preferredJob: "",
        experience: "",
        languages: "",

        // Step 3: Documents
        passportFile: null as File | null,
        photoFile: null as File | null,
        diplomaFile: null as File | null,

        // Step 4: Signature
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

            setUser(user);

            // Load existing candidate data
            const { data: candidate } = await supabase
                .from("candidates")
                .select("*")
                .eq("profile_id", user.id)
                .single();

            if (candidate) {
                // Parse phone number if exists
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

                // Parse date of birth
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

    const saveProgress = async () => {
        setSaving(true);
        setError(null);

        try {
            const supabase = createClient();

            await supabase
                .from("candidates")
                .upsert({
                    profile_id: user.id,
                    phone: getFullPhone(),
                    nationality: formData.nationality,
                    current_country: "Serbia", // Fixed to Serbia
                    date_of_birth: getFullDOB(),
                    preferred_job: formData.preferredJob,
                    experience_years: formData.experience ? parseInt(formData.experience) : null,
                    languages: formData.languages ? formData.languages.split(",").map(l => l.trim()) : [],
                    preferred_country: "serbia", // Fixed to Serbia
                    updated_at: new Date().toISOString(),
                }, { onConflict: "profile_id" });

        } catch (err) {
            setError("Failed to save progress");
        } finally {
            setSaving(false);
        }
    };

    const handleNext = async () => {
        await saveProgress();
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleFileUpload = async (field: "passportFile" | "photoFile" | "diplomaFile", file: File) => {
        updateField(field, file);

        const supabase = createClient();
        const fileExt = file.name.split('.').pop();
        const docType = field.replace("File", "");
        const fileName = `${user.id}/${docType}_${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
            .from("documents")
            .upload(fileName, file, { upsert: true });

        if (!error) {
            const { data: { publicUrl } } = supabase.storage
                .from("documents")
                .getPublicUrl(fileName);

            const dbField = field === "passportFile" ? "passport_url"
                : field === "photoFile" ? "photo_url"
                    : "diploma_url";

            await supabase
                .from("candidates")
                .update({ [dbField]: publicUrl })
                .eq("profile_id", user.id);
        }
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

    const handleComplete = async () => {
        setLoading(true);
        await saveProgress();

        const supabase = createClient();
        await supabase
            .from("candidates")
            .update({
                status: "VERIFIED",
                onboarding_completed: true,
                updated_at: new Date().toISOString()
            })
            .eq("profile_id", user.id);

        router.push("/dashboard");
    };

    const selectedCountry = COUNTRY_CODES.find(c => c.code === formData.countryCode) || COUNTRY_CODES[0];

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f6fb] font-montserrat">
            {/* Header */}
            <header className="bg-white border-b border-[#dde3ec] sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <img src="/logo.png" alt="Workers United" width={32} height={32} className="rounded" />
                        <span className="font-bold text-lg text-[#183b56]">Workers United</span>
                    </Link>
                    <div className="text-sm text-[#6c7a89]">
                        Step {currentStep} of 4
                    </div>
                </div>
            </header>

            {/* Progress Bar */}
            <div className="bg-white border-b border-[#dde3ec]">
                <div className="max-w-4xl mx-auto px-5 py-6">
                    <div className="flex items-center justify-between">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`flex flex-col items-center ${index < STEPS.length - 1 ? "flex-1" : ""}`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${currentStep >= step.id
                                        ? "bg-[#2f6fed] text-white"
                                        : "bg-gray-100 text-gray-400"
                                        }`}>
                                        {currentStep > step.id ? "✓" : step.icon}
                                    </div>
                                    <span className={`mt-2 text-xs font-medium ${currentStep >= step.id ? "text-[#183b56]" : "text-gray-400"
                                        }`}>
                                        {step.title}
                                    </span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className={`flex-1 h-1 mx-4 rounded ${currentStep > step.id ? "bg-[#2f6fed]" : "bg-gray-200"
                                        }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Form Content */}
            <main className="max-w-2xl mx-auto px-5 py-10">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#dde3ec]">
                    {/* Step 1: Personal Info */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-[#183b56] mb-2">Personal Information</h2>
                                <p className="text-[#6c7a89]">Tell us a bit about yourself</p>
                            </div>

                            <div className="grid gap-5">
                                {/* Phone with Country Selector */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Phone (WhatsApp) *
                                    </label>
                                    <div className="flex gap-2">
                                        {/* Country Code Selector */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#dde3ec] bg-white hover:border-[#2f6fed] transition-colors min-w-[130px]"
                                            >
                                                <span className="text-xl">{selectedCountry.flag}</span>
                                                <span className="font-medium text-[#183b56]">{selectedCountry.code}</span>
                                                <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {showCountryDropdown && (
                                                <div className="absolute top-full left-0 mt-1 bg-white border border-[#dde3ec] rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto w-64">
                                                    {COUNTRY_CODES.map(country => (
                                                        <button
                                                            key={country.code}
                                                            type="button"
                                                            onClick={() => {
                                                                updateField("countryCode", country.code);
                                                                setShowCountryDropdown(false);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f4f6fb] text-left transition-colors"
                                                        >
                                                            <span className="text-xl">{country.flag}</span>
                                                            <span className="font-medium text-[#183b56]">{country.country}</span>
                                                            <span className="text-[#6c7a89] ml-auto">{country.code}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Phone Number */}
                                        <input
                                            type="tel"
                                            value={formData.phoneNumber}
                                            onChange={(e) => updateField("phoneNumber", e.target.value.replace(/[^0-9]/g, ''))}
                                            className="flex-1 px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                            placeholder="60 123 4567"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Nationality */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Nationality *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.nationality}
                                        onChange={(e) => updateField("nationality", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                        placeholder="e.g., Serbian, Nigerian, Indian"
                                        required
                                    />
                                </div>

                                {/* Date of Birth - 3 Dropdowns */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Date of Birth *
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {/* Day */}
                                        <select
                                            value={formData.dobDay}
                                            onChange={(e) => updateField("dobDay", e.target.value)}
                                            className="px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none bg-white"
                                            required
                                        >
                                            <option value="">Day</option>
                                            {DAYS.map(day => (
                                                <option key={day} value={day}>{day}</option>
                                            ))}
                                        </select>

                                        {/* Month */}
                                        <select
                                            value={formData.dobMonth}
                                            onChange={(e) => updateField("dobMonth", e.target.value)}
                                            className="px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none bg-white"
                                            required
                                        >
                                            <option value="">Month</option>
                                            {MONTHS.map(month => (
                                                <option key={month.value} value={month.value}>{month.label}</option>
                                            ))}
                                        </select>

                                        {/* Year */}
                                        <select
                                            value={formData.dobYear}
                                            onChange={(e) => updateField("dobYear", e.target.value)}
                                            className="px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none bg-white"
                                            required
                                        >
                                            <option value="">Year</option>
                                            {YEARS.map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Work Preferences */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-[#183b56] mb-2">Work Preferences</h2>
                                <p className="text-[#6c7a89]">Help us find the right job for you</p>
                            </div>

                            <div className="grid gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Preferred Job / Industry *
                                    </label>
                                    <select
                                        value={formData.preferredJob}
                                        onChange={(e) => updateField("preferredJob", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none bg-white"
                                        required
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
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Years of Experience
                                    </label>
                                    <select
                                        value={formData.experience}
                                        onChange={(e) => updateField("experience", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none bg-white"
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
                                    <label className="block text-sm font-semibold text-[#183b56] mb-2">
                                        Languages You Speak
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.languages}
                                        onChange={(e) => updateField("languages", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                        placeholder="e.g., English, Serbian, French"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Documents */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-[#183b56] mb-2">Upload Documents</h2>
                                <p className="text-[#6c7a89]">We need these for visa processing</p>
                            </div>

                            <div className="grid gap-5">
                                {/* Passport */}
                                <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${formData.passportFile ? 'border-green-400 bg-green-50' : 'border-[#dde3ec] hover:border-[#2f6fed]'}`}>
                                    <div className="text-3xl mb-2">🛂</div>
                                    <h3 className="font-semibold text-[#183b56] mb-1">Passport Photo Page *</h3>
                                    <p className="text-sm text-[#6c7a89] mb-3">Clear photo of your passport data page</p>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => e.target.files?.[0] && handleFileUpload("passportFile", e.target.files[0])}
                                        className="hidden"
                                        id="passport-upload"
                                    />
                                    <label
                                        htmlFor="passport-upload"
                                        className={`inline-block px-5 py-2 rounded-lg font-medium cursor-pointer transition-colors ${formData.passportFile
                                            ? 'bg-green-500 text-white'
                                            : 'bg-[#2f6fed] text-white hover:bg-[#1e5cd6]'}`}
                                    >
                                        {formData.passportFile ? "✓ Uploaded" : "Upload Passport"}
                                    </label>
                                </div>

                                {/* Biometric Photo */}
                                <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${formData.photoFile ? 'border-green-400 bg-green-50' : 'border-[#dde3ec] hover:border-[#2f6fed]'}`}>
                                    <div className="text-3xl mb-2">📷</div>
                                    <h3 className="font-semibold text-[#183b56] mb-1">Biometric Photo *</h3>
                                    <p className="text-sm text-[#6c7a89] mb-3">Passport-style photo (35x45mm, white background)</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => e.target.files?.[0] && handleFileUpload("photoFile", e.target.files[0])}
                                        className="hidden"
                                        id="photo-upload"
                                    />
                                    <label
                                        htmlFor="photo-upload"
                                        className={`inline-block px-5 py-2 rounded-lg font-medium cursor-pointer transition-colors ${formData.photoFile
                                            ? 'bg-green-500 text-white'
                                            : 'bg-[#2f6fed] text-white hover:bg-[#1e5cd6]'}`}
                                    >
                                        {formData.photoFile ? "✓ Uploaded" : "Upload Photo"}
                                    </label>
                                </div>

                                {/* Diploma */}
                                <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${formData.diplomaFile ? 'border-green-400 bg-green-50' : 'border-[#dde3ec] hover:border-[#2f6fed]'}`}>
                                    <div className="text-3xl mb-2">🎓</div>
                                    <h3 className="font-semibold text-[#183b56] mb-1">Diploma / Certificate</h3>
                                    <p className="text-sm text-[#6c7a89] mb-3">Education or professional certificate (optional)</p>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => e.target.files?.[0] && handleFileUpload("diplomaFile", e.target.files[0])}
                                        className="hidden"
                                        id="diploma-upload"
                                    />
                                    <label
                                        htmlFor="diploma-upload"
                                        className={`inline-block px-5 py-2 rounded-lg font-medium cursor-pointer transition-colors ${formData.diplomaFile
                                            ? 'bg-green-500 text-white'
                                            : 'bg-[#2f6fed] text-white hover:bg-[#1e5cd6]'}`}
                                    >
                                        {formData.diplomaFile ? "✓ Uploaded" : "Upload Diploma"}
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Signature */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-[#183b56] mb-2">Digital Signature</h2>
                                <p className="text-[#6c7a89]">Sign to confirm your application</p>
                            </div>

                            <SignaturePad
                                onSave={handleSignatureSave}
                                agreementText="I confirm that all information provided is accurate and I agree to the Terms of Service and Privacy Policy."
                            />

                            {formData.signatureData && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                                    <span className="text-lg">✓</span>
                                    Signature saved successfully
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-8 pt-6 border-t border-[#dde3ec]">
                        <button
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className={`px-6 py-3 rounded-xl font-medium transition-colors ${currentStep === 1
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-[#6c7a89] hover:text-[#183b56] hover:bg-gray-100"
                                }`}
                        >
                            ← Back
                        </button>

                        {currentStep < 4 ? (
                            <button
                                onClick={handleNext}
                                disabled={saving}
                                className="px-8 py-3 bg-[#2f6fed] text-white rounded-xl font-semibold hover:bg-[#1e5cd6] transition-colors shadow-lg shadow-blue-500/30"
                            >
                                {saving ? "Saving..." : "Continue →"}
                            </button>
                        ) : (
                            <button
                                onClick={handleComplete}
                                disabled={loading || !formData.signatureData}
                                className={`px-8 py-3 rounded-xl font-semibold transition-colors ${formData.signatureData
                                    ? "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/30"
                                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    }`}
                            >
                                {loading ? "Completing..." : "Complete Profile ✓"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Save Progress Note */}
                <p className="text-center text-sm text-[#6c7a89] mt-6">
                    Your progress is automatically saved. You can come back anytime.
                </p>
            </main>
        </div>
    );
}
