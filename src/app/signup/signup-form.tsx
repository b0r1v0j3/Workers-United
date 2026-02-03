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
    const [phone, setPhone] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
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
                        phone: phone,
                        company_name: userType === "employer" ? companyName : null,
                        user_type: userType,
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

            // If auto-confirmed, redirect to appropriate dashboard
            router.push(userType === "employer" ? "/employer/profile" : "/dashboard/profile");
            router.refresh();
        } catch {
            setError("An unexpected error occurred. Please try again.");
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
                <label htmlFor="phone" className="label">
                    Phone (WhatsApp) <span className="text-red-500">*</span>
                </label>
                <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                    placeholder="+1 234 567 8900"
                    required
                />
                <p className="mt-1 text-xs text-gray-500">We may contact you via WhatsApp for faster communication</p>
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

            <button
                type="submit"
                disabled={loading}
                className={`btn w-full ${userType === "employer" ? "btn-teal" : "btn-primary"}`}
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

            <p className="text-xs text-gray-500 text-center mt-4">
                By creating an account, you agree to our{" "}
                <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
                {" "}and{" "}
                <a href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a>.
            </p>
        </form>
    );
}
