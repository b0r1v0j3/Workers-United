"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
    const supabase = createClient();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [resetMode, setResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            toast.error(error.message);
            setLoading(false);
        } else {
            toast.success("Welcome back!");
            window.location.href = "/profile";
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter your email address first.");
            return;
        }
        setLoading(true);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        });

        if (error) {
            toast.error(error.message);
        } else {
            setResetSent(true);
            toast.success("Password reset link sent! Check your email inbox.");
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            toast.error(error.message);
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f4f2] font-montserrat px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto flex min-h-screen w-full max-w-[680px] items-center">
                <div className="w-full rounded-[28px] border border-[#e6e6e1] bg-white px-5 py-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.3)] sm:px-7 sm:py-7 lg:px-10 lg:py-9">
                    <div className="mx-auto w-full max-w-[470px]">
                        <div className="mb-8 text-center">
                            <div className="mx-auto mb-4 flex items-center justify-center">
                                <Link href="/" className="inline-flex items-center">
                                    <Image
                                        src="/logo-complete-transparent.png"
                                        alt="Workers United logo"
                                        width={230}
                                        height={230}
                                        className="h-auto w-[184px] object-contain"
                                    />
                                </Link>
                            </div>
                            <h2 className="text-3xl font-semibold tracking-tight text-[#18181b]">
                                {resetMode ? "Reset password" : "Sign In"}
                            </h2>
                            <p className="mt-2 text-[15px] leading-relaxed text-[#52525b]">
                                {resetMode
                                    ? "Enter your email and we will send you a reset link."
                                    : "Enter your email and password to access your account."}
                            </p>
                        </div>

                        {resetMode ? (
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <InputField
                                    id="email"
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={setEmail}
                                    placeholder="you@example.com"
                                />

                                {resetSent && (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                                        Reset link sent. Check your email inbox.
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#111111_0%,#27272a_100%)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <Spinner className="h-4 w-4 text-white" />
                                            Sending...
                                        </>
                                    ) : (
                                        "Send reset link"
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setResetMode(false);
                                        setResetSent(false);
                                    }}
                                    className="w-full text-center text-sm font-semibold text-[#18181b] underline-offset-2 hover:underline"
                                >
                                    Back to Sign In
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={googleLoading}
                                    className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-[#e4e4df] bg-white px-5 py-3.5 text-[15px] font-medium text-[#18181b] shadow-[0_16px_35px_-28px_rgba(15,23,42,0.25)] transition hover:border-[#d2d2cc] hover:bg-[#f8f8f6] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {googleLoading ? (
                                        <Spinner className="h-4 w-4 text-[#71717a]" />
                                    ) : (
                                        <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={18} height={18} className="h-4.5 w-4.5" />
                                    )}
                                    {googleLoading ? "Redirecting..." : "Continue with Google"}
                                </button>

                                <div className="relative py-1">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-[#e4e4df]" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a1a1aa]">Or use email</span>
                                    </div>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-4">
                                    <InputField
                                        id="loginEmail"
                                        label="Email Address"
                                        type="email"
                                        value={email}
                                        onChange={setEmail}
                                        placeholder="you@example.com"
                                    />

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between px-1">
                                            <label htmlFor="loginPassword" className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#52525b]">
                                                Password
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setResetMode(true);
                                                    setResetSent(false);
                                                }}
                                                className="text-xs font-semibold text-[#18181b] underline-offset-2 hover:underline"
                                            >
                                                Forgot password?
                                            </button>
                                        </div>
                                        <input
                                            id="loginPassword"
                                            type="password"
                                            required
                                            placeholder="••••••••"
                                            className="w-full rounded-2xl border border-[#e4e4df] bg-[#f8f8f6] px-4 py-3 text-[15px] text-[#18181b] outline-none transition placeholder:text-[#a1a1aa] focus:border-[#27272a] focus:bg-white focus:ring-2 focus:ring-zinc-100"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#111111_0%,#27272a_100%)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <>
                                                <Spinner className="h-4 w-4 text-white" />
                                                Signing in...
                                            </>
                                        ) : (
                                            "Sign In"
                                        )}
                                    </button>

                                    <div className="rounded-2xl border border-[#e4e4df] bg-white px-4 py-3">
                                        <p className="flex items-start gap-2 text-xs leading-relaxed text-[#71717a]">
                                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3f3f46]" />
                                            Your data is encrypted and used only for account access and service delivery.
                                        </p>
                                    </div>
                                </form>
                            </div>
                        )}

                        <p className="mt-7 text-center text-sm text-[#71717a]">
                            Don&apos;t have an account?{" "}
                            <Link href="/signup" className="font-semibold text-[#18181b] underline-offset-4 hover:underline">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface InputFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: "text" | "email" | "password";
}

function InputField({
    id,
    label,
    value,
    onChange,
    placeholder,
    type = "text",
}: InputFieldProps) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#52525b]">
                {label}
            </label>
            <input
                id={id}
                type={type}
                required
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-2xl border border-[#e4e4df] bg-[#f8f8f6] px-4 py-3 text-[15px] text-[#18181b] outline-none transition placeholder:text-[#a1a1aa] focus:border-[#27272a] focus:bg-white focus:ring-2 focus:ring-zinc-100"
            />
        </div>
    );
}

function Spinner({ className }: { className: string }) {
    return (
        <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}
