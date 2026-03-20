"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_PLATFORM_SUPPORT_EMAIL } from "@/lib/platform-contact";
import { toast } from "sonner";

interface AuthErrorState {
    error: string;
    errorCode: string;
    errorDescription: string;
}

export default function AuthCodeErrorClient({ authError }: { authError: AuthErrorState }) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const isSignupProvisioningError =
        authError.error === "server_error" &&
        authError.errorCode === "unexpected_failure" &&
        (authError.errorDescription.includes("saving new user") || authError.errorDescription.includes("creating new user"));

    const pageCopy = isSignupProvisioningError
        ? {
            heroTitle: "We hit a signup issue",
            heroBody: "Your account could not be created on our side. Please try again in a moment.",
            title: "Account creation failed",
            body: "We couldn't finish creating your account. Please go back to sign up and try again. If it keeps happening, contact support and we'll help right away.",
            primaryHref: "/signup",
            primaryLabel: "Back to Sign Up",
            showResendForm: false,
        }
        : {
            heroTitle: "Almost there",
            heroBody: "Your confirmation link may have expired. No worries — just request a new one.",
            title: "Confirmation failed",
            body: "Your email confirmation link has expired or is invalid. Enter your email below and we'll send you a fresh one.",
            primaryHref: "/login",
            primaryLabel: "Back to Sign In",
            showResendForm: true,
        };

    const handleResend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter your email address.");
            return;
        }

        setLoading(true);
        const supabase = createClient();

        const { error } = await supabase.auth.resend({
            type: "signup",
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            toast.error(error.message);
        } else {
            setSent(true);
            toast.success("Confirmation email sent! Check your inbox.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex font-montserrat flex-col lg:flex-row">
            <div
                className="hidden lg:flex w-1/2 text-white p-12 flex-col justify-between relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #2563EB 100%)" }}
            >
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <Link href="/" className="inline-flex items-center mb-24">
                        <Image
                            src="/logo-complete-transparent.png"
                            alt="Workers United logo"
                            width={240}
                            height={240}
                            className="h-auto w-[184px] object-contain invert"
                        />
                    </Link>

                    <h1 className="text-5xl font-bold mb-6 leading-tight">
                        {pageCopy.heroTitle}
                    </h1>
                    <p className="text-blue-100/80 text-lg max-w-md leading-relaxed mb-12">
                        {pageCopy.heroBody}
                    </p>
                </div>

                <div className="relative z-10 flex gap-6 text-[10px] uppercase font-bold tracking-widest text-blue-100/40">
                    <span>Clean Process</span>
                    <span>Safe &amp; Legal</span>
                    <span>Guaranteed Support</span>
                </div>
            </div>

            <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center items-center p-8 lg:p-24 relative">
                <div className="lg:hidden absolute top-6 left-0 right-0 flex justify-center">
                    <Link href="/" className="inline-flex items-center">
                        <Image
                            src="/logo-complete-transparent.png"
                            alt="Workers United logo"
                            width={220}
                            height={220}
                            className="h-auto w-[172px] object-contain"
                        />
                    </Link>
                </div>

                <div className="w-full max-w-[420px] pt-16 lg:pt-0">
                    <div className="flex justify-center lg:justify-start mb-6">
                        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center ring-4 ring-amber-100">
                            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                    </div>

                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-[#1e293b] mb-3 tracking-tight">
                            {pageCopy.title}
                        </h2>
                        <p className="text-[#64748b] font-medium leading-relaxed">
                            {pageCopy.body}
                        </p>
                    </div>

                    {sent ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-100">
                                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-[#1e293b] mb-2">Check your email</h3>
                            <p className="text-[#64748b] text-sm leading-relaxed">
                                We&apos;ve sent a new confirmation link to <strong className="text-[#1e293b]">{email}</strong>.
                                Please click the link to activate your account.
                            </p>
                        </div>
                    ) : pageCopy.showResendForm ? (
                        <form onSubmit={handleResend} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="resendEmail" className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider ml-1">
                                    Email address
                                </label>
                                <input
                                    id="resendEmail"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#f8fbff] border border-[#e2e8f0] px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#1877f2] text-white font-bold py-4 rounded-full shadow-lg shadow-blue-200/50 hover:bg-[#1665d8] transition-all transform hover:translate-y-[-1px] active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Sending...
                                    </span>
                                ) : (
                                    "Resend confirmation email"
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fbff] px-5 py-4 text-sm leading-relaxed text-[#475569]">
                            This was a server-side signup failure, not an expired confirmation link. A fresh confirmation email would not fix it.
                        </div>
                    )}

                    <div className="mt-8 flex flex-col items-center gap-3">
                        <Link
                            href={pageCopy.primaryHref}
                            className="text-[#2f6fed] font-bold text-[15px] hover:underline"
                        >
                            ← {pageCopy.primaryLabel}
                        </Link>
                        {!pageCopy.showResendForm ? (
                            <Link
                                href="/login"
                                className="text-[#64748b] font-semibold text-[15px] hover:text-[#2f6fed] hover:underline"
                            >
                                Go to Sign In
                            </Link>
                        ) : null}
                        <p className="text-[#94a3b8] text-sm font-medium">
                            Need help? Contact{" "}
                            <a href={`mailto:${DEFAULT_PLATFORM_SUPPORT_EMAIL}`} className="text-[#2f6fed] font-semibold hover:underline">
                                {DEFAULT_PLATFORM_SUPPORT_EMAIL}
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
