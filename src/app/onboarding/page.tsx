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

export default function OnboardingPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    // Form data
    const [formData, setFormData] = useState({
        // Step 1: Personal Info
        phone: "",
        nationality: "",
        currentCountry: "",
        dateOfBirth: "",

        // Step 2: Work Preferences
        preferredJob: "",
        experience: "",
        languages: "",
        preferredCountry: "",

        // Step 3: Documents
        passportFile: null as File | null,
        cvFile: null as File | null,

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
                setFormData(prev => ({
                    ...prev,
                    phone: candidate.phone || user.user_metadata?.phone || "",
                    nationality: candidate.nationality || "",
                    currentCountry: candidate.current_country || "",
                    dateOfBirth: candidate.date_of_birth || "",
                    preferredJob: candidate.preferred_job || "",
                    experience: candidate.experience_years?.toString() || "",
                    languages: candidate.languages?.join(", ") || "",
                    preferredCountry: candidate.preferred_country || "",
                }));
            }
        }

        loadUser();
    }, [router]);

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
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
                    phone: formData.phone,
                    nationality: formData.nationality,
                    current_country: formData.currentCountry,
                    date_of_birth: formData.dateOfBirth || null,
                    preferred_job: formData.preferredJob,
                    experience_years: formData.experience ? parseInt(formData.experience) : null,
                    languages: formData.languages ? formData.languages.split(",").map(l => l.trim()) : [],
                    preferred_country: formData.preferredCountry,
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

    const handleFileUpload = async (field: "passportFile" | "cvFile", file: File) => {
        updateField(field, file);

        const supabase = createClient();
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${field}_${Date.now()}.${fileExt}`;

        const { error } = await supabase.storage
            .from("documents")
            .upload(fileName, file, { upsert: true });

        if (!error) {
            const { data: { publicUrl } } = supabase.storage
                .from("documents")
                .getPublicUrl(fileName);

            const updateField = field === "passportFile" ? "passport_url" : "cv_url";
            await supabase
                .from("candidates")
                .update({ [updateField]: publicUrl })
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

                            <div className="grid gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[#183b56] mb-2">
                                        Phone (WhatsApp) *
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => updateField("phone", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                        placeholder="+1 234 567 8900"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#183b56] mb-2">
                                        Nationality *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.nationality}
                                        onChange={(e) => updateField("nationality", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                        placeholder="e.g., Nigerian, Indian, Philippine"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#183b56] mb-2">
                                        Current Country *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.currentCountry}
                                        onChange={(e) => updateField("currentCountry", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                        placeholder="Country where you currently live"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#183b56] mb-2">
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.dateOfBirth}
                                        onChange={(e) => updateField("dateOfBirth", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                    />
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

                            <div className="grid gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[#183b56] mb-2">
                                        Preferred Job / Industry *
                                    </label>
                                    <select
                                        value={formData.preferredJob}
                                        onChange={(e) => updateField("preferredJob", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
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
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#183b56] mb-2">
                                        Years of Experience
                                    </label>
                                    <select
                                        value={formData.experience}
                                        onChange={(e) => updateField("experience", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
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
                                    <label className="block text-sm font-medium text-[#183b56] mb-2">
                                        Languages You Speak
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.languages}
                                        onChange={(e) => updateField("languages", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                        placeholder="e.g., English, French, Arabic"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[#183b56] mb-2">
                                        Preferred Work Country
                                    </label>
                                    <select
                                        value={formData.preferredCountry}
                                        onChange={(e) => updateField("preferredCountry", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-[#dde3ec] focus:border-[#2f6fed] focus:ring-2 focus:ring-[#2f6fed]/20 outline-none"
                                    >
                                        <option value="">Any country in Europe</option>
                                        <option value="serbia">Serbia</option>
                                        <option value="croatia">Croatia</option>
                                        <option value="slovenia">Slovenia</option>
                                        <option value="germany">Germany</option>
                                        <option value="poland">Poland</option>
                                        <option value="czech">Czech Republic</option>
                                    </select>
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

                            <div className="grid gap-6">
                                <div className="border-2 border-dashed border-[#dde3ec] rounded-xl p-6 text-center hover:border-[#2f6fed] transition-colors">
                                    <div className="text-4xl mb-3">🛂</div>
                                    <h3 className="font-semibold text-[#183b56] mb-2">Passport Photo Page</h3>
                                    <p className="text-sm text-[#6c7a89] mb-4">Clear photo of your passport information page</p>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => e.target.files?.[0] && handleFileUpload("passportFile", e.target.files[0])}
                                        className="hidden"
                                        id="passport-upload"
                                    />
                                    <label
                                        htmlFor="passport-upload"
                                        className="inline-block px-6 py-2 bg-[#2f6fed] text-white rounded-lg font-medium cursor-pointer hover:bg-[#1e5cd6] transition-colors"
                                    >
                                        {formData.passportFile ? "✓ Uploaded" : "Upload Passport"}
                                    </label>
                                </div>

                                <div className="border-2 border-dashed border-[#dde3ec] rounded-xl p-6 text-center hover:border-[#2f6fed] transition-colors">
                                    <div className="text-4xl mb-3">📋</div>
                                    <h3 className="font-semibold text-[#183b56] mb-2">CV / Resume</h3>
                                    <p className="text-sm text-[#6c7a89] mb-4">Your work history and skills</p>
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => e.target.files?.[0] && handleFileUpload("cvFile", e.target.files[0])}
                                        className="hidden"
                                        id="cv-upload"
                                    />
                                    <label
                                        htmlFor="cv-upload"
                                        className="inline-block px-6 py-2 bg-[#2f6fed] text-white rounded-lg font-medium cursor-pointer hover:bg-[#1e5cd6] transition-colors"
                                    >
                                        {formData.cvFile ? "✓ Uploaded" : "Upload CV"}
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
