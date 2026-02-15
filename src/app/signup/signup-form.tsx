"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SignupFormProps {
    userType: "worker" | "employer";
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

            // If auto-confirmed, redirect (welcome email DISABLED during preparation — see AGENTS.md gotcha #30)
            if (data.session) {
                // TODO: Re-enable when team approves email sending
                // fetch("/api/queue-user-email", {
                //     method: "POST",
                //     headers: { "Content-Type": "application/json" },
                //     body: JSON.stringify({ emailType: "welcome" }),
                // }).catch(() => { }); // fire-and-forget
            }

            router.push(userType === "employer" ? "/profile/employer" : "/profile/worker");
            router.refresh();
        } catch (err: unknown) {
            // Show more specific error message
            if (err instanceof Error) {
                if (err.message.includes("already registered") || err.message.includes("already exists")) {
                    setError("This email is already registered. Please sign in instead.");
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
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-100">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-[#1e293b] mb-2">Check your email</h3>
                <p className="text-[#64748b] text-sm leading-relaxed">
                    We&apos;ve sent a confirmation link to <strong className="text-[#1e293b]">{email}</strong>.
                    Please click the link to activate your account.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="fullName" className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider ml-1">
                    {userType === "employer" ? "Contact Person Name" : "Full Name"}
                </label>
                <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#f8fbff] border border-[#e2e8f0] px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all"
                    placeholder={userType === "employer" ? "John Smith" : "John Doe"}
                    required
                />
            </div>

            {userType === "employer" && (
                <div className="space-y-2">
                    <label htmlFor="companyName" className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider ml-1">
                        Company Name
                    </label>
                    <input
                        id="companyName"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-[#f8fbff] border border-[#e2e8f0] px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all"
                        placeholder="Your Company Ltd."
                        required
                    />
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="email" className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider ml-1">
                    Email address
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#f8fbff] border border-[#e2e8f0] px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all"
                    placeholder={userType === "employer" ? "hr@company.com" : "you@example.com"}
                    required
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="password" className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider ml-1">
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#f8fbff] border border-[#e2e8f0] px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all"
                    placeholder="••••••••"
                    minLength={6}
                    required
                />
                <p className="text-[11px] text-[#94a3b8] ml-1 font-medium">Must be at least 6 characters</p>
            </div>

            <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider ml-1">
                    Confirm Password
                </label>
                <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-[#f8fbff] border px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all ${password && confirmPassword && password !== confirmPassword
                        ? 'border-red-400 focus:ring-red-100 focus:border-red-400'
                        : 'border-[#e2e8f0]'
                        }`}
                    placeholder="••••••••"
                    minLength={6}
                    required
                />
                {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 ml-1 font-medium">Passwords do not match</p>
                )}
                {password && confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-emerald-600 ml-1 font-medium">✓ Passwords match</p>
                )}
            </div>

            {/* GDPR Consent */}
            <div className="flex items-start gap-3 bg-[#f8fbff] p-4 rounded-xl border border-[#e2e8f0]">
                <input
                    id="gdprConsent"
                    type="checkbox"
                    checked={gdprConsent}
                    onChange={(e) => setGdprConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#1877f2] rounded border-gray-300 focus:ring-[#1877f2] cursor-pointer"
                />
                <label htmlFor="gdprConsent" className="text-xs text-[#64748b] cursor-pointer leading-relaxed">
                    I have read and agree to the{" "}
                    <a href="/terms" target="_blank" className="text-[#1877f2] font-semibold hover:underline">Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy-policy" target="_blank" className="text-[#1877f2] font-semibold hover:underline">Privacy Policy</a>.
                    I consent to the processing of my personal data as described in the Privacy Policy.
                </label>
            </div>

            <button
                type="submit"
                disabled={loading || (password !== confirmPassword) || !gdprConsent}
                className="w-full bg-[#1877f2] text-white font-bold py-4 rounded-full shadow-lg shadow-blue-200/50 hover:bg-[#1665d8] transition-all transform hover:translate-y-[-1px] active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 mt-2"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
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
                    </span>
                ) : (
                    <>Create {userType === "employer" ? "employer" : "worker"} account</>
                )}
            </button>
        </form>
    );
}
