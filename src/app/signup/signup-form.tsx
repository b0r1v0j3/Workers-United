"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { toast } from "sonner";

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
    const [googleLoading, setGoogleLoading] = useState(false);
    const router = useRouter();

    // Password strength checks
    const passwordChecks = {
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    const allChecksPassed = Object.values(passwordChecks).every(Boolean);
    const passwordsMatch = password === confirmPassword;

    // Email validation — catch typos in common domains
    const COMMON_DOMAINS: Record<string, string> = {
        "gmai.com": "gmail.com", "gmial.com": "gmail.com", "gmaill.com": "gmail.com",
        "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmal.com": "gmail.com",
        "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.om": "gmail.com",
        "yahoo.coms": "yahoo.com", "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com",
        "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com",
        "hotmai.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com",
        "hotmail.con": "hotmail.com", "hotmail.co": "hotmail.com",
        "outloo.com": "outlook.com", "outlok.com": "outlook.com", "outllok.com": "outlook.com",
        "outlook.con": "outlook.com",
        "1yahoo.com": "yahoo.com", "1gmail.com": "gmail.com", "1hotmail.com": "hotmail.com",
    };

    const getEmailError = (): { error: string | null; suggestion: string | null } => {
        if (!email) return { error: null, suggestion: null };
        const trimmed = email.trim().toLowerCase();
        // Basic format check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            return { error: "Please enter a valid email address", suggestion: null };
        }
        // Trailing dot (e.g., user@gmail.com.)
        if (trimmed.endsWith(".")) {
            return { error: "Email cannot end with a dot", suggestion: trimmed.slice(0, -1) };
        }
        // Double dots (e.g., user@gmail..com)
        if (trimmed.includes("..")) {
            return { error: "Email contains double dots", suggestion: null };
        }
        const domain = trimmed.split("@")[1];
        if (!domain || domain.length < 3) {
            return { error: "Invalid email domain", suggestion: null };
        }
        // TLD must be at least 2 chars (no .c, .o, etc.)
        const tld = domain.split(".").pop() || "";
        if (tld.length < 2) {
            return { error: "Invalid domain extension", suggestion: null };
        }
        // Check for common domain typos
        if (COMMON_DOMAINS[domain]) {
            const corrected = `${trimmed.split("@")[0]}@${COMMON_DOMAINS[domain]}`;
            return {
                error: null,
                suggestion: corrected,
            };
        }
        return { error: null, suggestion: null };
    };

    const emailValidation = getEmailError();
    const emailIsValid = !emailValidation.error && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const canSubmit = allChecksPassed && passwordsMatch && gdprConsent && emailIsValid && !loading;

    const handleGoogleSignup = async () => {
        setGoogleLoading(true);
        setError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?user_type=${userType}`,
            },
        });
        if (error) {
            toast.error(error.message);
            setGoogleLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Check GDPR consent
        if (!gdprConsent) {
            toast.error("You must agree to the Terms of Service and Privacy Policy to create an account.");
            return;
        }

        // Check password strength
        if (!allChecksPassed) {
            toast.error("Password does not meet all requirements.");
            return;
        }

        // Check password match
        if (!passwordsMatch) {
            toast.error("Passwords do not match");
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
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
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
                toast.error(signUpError.message);
                return;
            }

            // If email confirmation is required
            if (data.user && !data.session) {
                setSuccess(true);
                return;
            }

            // If auto-confirmed, queue welcome email and redirect
            if (data.session) {
                fetch("/api/queue-user-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ emailType: "welcome" }),
                }).catch(() => { }); // fire-and-forget
            }

            router.push(userType === "employer" ? "/profile/employer" : "/profile/worker");
            router.refresh();
        } catch (err: unknown) {
            // Show more specific error message
            if (err instanceof Error) {
                if (err.message.includes("already registered") || err.message.includes("already exists")) {
                    toast.error("This email is already registered. Please sign in instead.");
                } else {
                    toast.error(err.message);
                }
            } else {
                toast.error("An unexpected error occurred. Please try again.");
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
        <div className="space-y-5">
            {/* Google Sign Up */}
            <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-[#dadce0] rounded-full py-3.5 px-6 text-[#3c4043] font-semibold text-[15px] hover:bg-[#f8f9fa] hover:border-[#c6c9cc] transition-all hover:shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
                {googleLoading ? (
                    <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                ) : (
                    <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={20} height={20} className="w-5 h-5" />
                )}
                {googleLoading ? "Redirecting..." : `Sign up with Google`}
            </button>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#e2e8f0]"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest">
                    <span className="bg-white px-4 text-[#94a3b8]">Or with email</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

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
                        className={`w-full bg-[#f8fbff] border px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-all ${emailValidation.error
                                ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
                                : emailValidation.suggestion
                                    ? 'border-amber-300 focus:ring-amber-100 focus:border-amber-400'
                                    : 'border-[#e2e8f0] focus:ring-blue-100 focus:border-[#2f6fed]'
                            }`}
                        placeholder={userType === "employer" ? "hr@company.com" : "you@example.com"}
                        required
                    />
                    {emailValidation.error && email && (
                        <p className="text-xs text-red-500 ml-1 mt-1">{emailValidation.error}</p>
                    )}
                    {emailValidation.suggestion && !emailValidation.error && (
                        <button
                            type="button"
                            onClick={() => setEmail(emailValidation.suggestion!)}
                            className="text-xs text-amber-600 hover:text-amber-800 ml-1 mt-1 underline underline-offset-2"
                        >
                            Did you mean {emailValidation.suggestion}?
                        </button>
                    )}
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
                        minLength={8}
                        required
                    />
                    {password.length > 0 && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5 ml-1">
                            {[
                                { check: passwordChecks.minLength, label: "8+ characters" },
                                { check: passwordChecks.hasUppercase, label: "Uppercase (A-Z)" },
                                { check: passwordChecks.hasLowercase, label: "Lowercase (a-z)" },
                                { check: passwordChecks.hasNumber, label: "Number (0-9)" },
                                { check: passwordChecks.hasSpecial, label: "Special (!@#$)" },
                            ].map(({ check, label }) => (
                                <p key={label} className={`text-[11px] font-medium flex items-center gap-1 ${check ? "text-emerald-600" : "text-[#94a3b8]"}`}>
                                    <span>{check ? "✓" : "○"}</span> {label}
                                </p>
                            ))}
                        </div>
                    )}
                    {!password && (
                        <p className="text-[11px] text-[#94a3b8] ml-1 font-medium">Must include uppercase, lowercase, number, and special character</p>
                    )}
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
                        className={`w-full bg-[#f8fbff] border px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all ${password && confirmPassword && !passwordsMatch
                            ? 'border-red-400 focus:ring-red-100 focus:border-red-400'
                            : 'border-[#e2e8f0]'
                            }`}
                        placeholder="••••••••"
                        minLength={8}
                        required
                    />
                    {password && confirmPassword && !passwordsMatch && (
                        <p className="text-xs text-red-500 ml-1 font-medium">Passwords do not match</p>
                    )}
                    {password && confirmPassword && passwordsMatch && (
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
                    disabled={!canSubmit}
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
        </div>
    );
}
