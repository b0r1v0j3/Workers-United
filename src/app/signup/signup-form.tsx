"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SignupFormProps {
    userType: "candidate" | "employer";
}

export function SignupForm({ userType }: SignupFormProps) {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [gdprConsent, setGdprConsent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Check GDPR consent
        if (!gdprConsent) {
            setError("You must agree to the Terms of Service and Privacy Policy to create an account.");
            return;
        }

        // Check password match
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const supabase = createClient();

            // Sign up the user
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        company_name: userType === "employer" ? companyName : null,
                        user_type: userType,
                        gdpr_consent: true,
                        gdpr_consent_at: new Date().toISOString(),
                    },
                },
            });

            if (signUpError) {
                setError(signUpError.message);
                return;
            }

            // If email confirmation is required
            if (data.user && !data.session) {
                setSuccess(true);
                return;
            }

            // If auto-confirmed, redirect to appropriate profile page
            router.push(userType === "employer" ? "/profile/employer" : "/profile/worker");
            router.refresh();
        } catch (err: unknown) {
            // Show more specific error message
            if (err instanceof Error) {
                if (err.message.includes("already registered") || err.message.includes("already exists")) {
                    setError("This email is already registered. Please log in instead.");
                } else {
                    setError(err.message);
                }
            } else {
                setError("An unexpected error occurred. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h3>
                <p className="text-gray-600 text-sm">
                    We&apos;ve sent a confirmation link to <strong>{email}</strong>.
                    Please click the link to activate your account.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div>
                <label htmlFor="fullName" className="label">
                    {userType === "employer" ? "Contact Person Name" : "Full Name"} <span className="text-red-500">*</span>
                </label>
                <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                    placeholder={userType === "employer" ? "John Smith" : "John Doe"}
                    required
                />
            </div>

            {userType === "employer" && (
                <div>
                    <label htmlFor="companyName" className="label">
                        Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="companyName"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="input"
                        placeholder="Your Company Ltd."
                        required
                    />
                </div>
            )}

            <div>
                <label htmlFor="email" className="label">
                    Email address <span className="text-red-500">*</span>
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder={userType === "employer" ? "hr@company.com" : "you@example.com"}
                    required
                />
            </div>

            <div>
                <label htmlFor="password" className="label">
                    Password <span className="text-red-500">*</span>
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    minLength={6}
                    required
                />
                <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
            </div>

            <div>
                <label htmlFor="confirmPassword" className="label">
                    Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`input ${password && confirmPassword && password !== confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="••••••••"
                    minLength={6}
                    required
                />
                {password && confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
                {password && confirmPassword && password === confirmPassword && (
                    <p className="mt-1 text-xs text-green-600">✓ Passwords match</p>
                )}
            </div>

            {/* GDPR Consent Checkbox */}
            <div className="flex items-start gap-3 mt-4">
                <input
                    id="gdprConsent"
                    type="checkbox"
                    checked={gdprConsent}
                    onChange={(e) => setGdprConsent(e.target.checked)}
                    className="mt-1 w-4 h-4 text-[#1877f2] rounded border-gray-300 focus:ring-[#1877f2] cursor-pointer"
                />
                <label htmlFor="gdprConsent" className="text-xs text-gray-600 cursor-pointer leading-relaxed">
                    I have read and agree to the{" "}
                    <a href="/terms" target="_blank" className="text-[#1877f2] font-semibold hover:underline">Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy-policy" target="_blank" className="text-[#1877f2] font-semibold hover:underline">Privacy Policy</a>.
                    I consent to the processing of my personal data as described in the Privacy Policy. <span className="text-red-500">*</span>
                </label>
            </div>

            <button
                type="submit"
                disabled={loading || (password !== confirmPassword) || !gdprConsent}
                className={`btn w-full btn-primary`}
                style={{ marginTop: "1.5rem" }}
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        Creating account...
                    </>
                ) : (
                    <>
                        Create {userType === "employer" ? "employer" : "candidate"} account
                    </>
                )}
            </button>
        </form>
    );
}
