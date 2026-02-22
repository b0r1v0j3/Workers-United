"use client";



import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
    const supabase = createClient();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resetMode, setResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            window.location.href = "/profile";
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError("Please enter your email address");
            return;
        }
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        });

        if (error) {
            setError(error.message);
        } else {
            setResetSent(true);
        }
        setLoading(false);
    };

    const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) setError(error.message);
    };

    return (
        <div className="min-h-screen flex font-montserrat flex-col lg:flex-row">
            {/* Left Side: Brand/Info Panel */}
            <div className="hidden lg:flex w-1/2 text-white p-12 flex-col justify-between relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #2563EB 100%)' }}
            >
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <Link href="/" className="flex items-center gap-3 mb-24">
                        <Image src="/logo.png" alt="Workers United logo" width={48} height={48} className="drop-shadow-lg lg:brightness-0 lg:invert" />
                        <span className="text-2xl font-bold tracking-tight">Workers United</span>
                    </Link>

                    <h1 className="text-5xl font-bold mb-6 leading-tight">Welcome back</h1>
                    <p className="text-blue-100/80 text-lg max-w-md leading-relaxed mb-12">
                        Sign in to access your profile, track your applications, and manage documents.
                    </p>

                    <div className="space-y-8">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-2">Your gateway to verified employment in Europe</h2>
                            <p className="text-blue-100/60 leading-relaxed">
                                Transparent process. Real opportunities. Full visa support.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex gap-6 text-[10px] uppercase font-bold tracking-widest text-blue-100/40">
                    <span>Clean Process</span>
                    <span>Safe & Legal</span>
                    <span>Guaranteed Support</span>
                </div>
            </div>

            {/* Right Side: Sign In Form */}
            <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center items-center p-8 lg:p-24 relative">
                <div className="w-full max-w-[420px] pt-16 lg:pt-0">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-[#1e293b] mb-3 tracking-tight">
                            {resetMode ? "Reset password" : "Sign in"}
                        </h2>
                        <p className="text-[#64748b] font-medium leading-relaxed">
                            {resetMode
                                ? "Enter your email and we'll send you a reset link."
                                : "Enter your email and password to access your account."
                            }
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-8 font-medium animate-shake">
                            {error}
                        </div>
                    )}

                    {resetSent && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-8 font-medium">
                            ✓ Password reset link sent! Check your email inbox.
                        </div>
                    )}

                    {resetMode ? (
                        <form onSubmit={handleResetPassword} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider ml-1">Email address</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="you@example.com"
                                    className="w-full bg-[#f8fbff] border border-[#e2e8f0] px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#2f6fed] text-white font-bold py-4 rounded-full shadow-lg shadow-blue-100/50 hover:bg-[#1e5bc6] transition-all transform hover:translate-y-[-1px] active:scale-[0.98] disabled:opacity-50 mt-4"
                            >
                                {loading ? "Sending..." : "Send reset link"}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setResetMode(false); setError(null); setResetSent(false); }}
                                className="w-full text-center text-[#2f6fed] font-bold text-[15px] hover:underline mt-2"
                            >
                                ← Back to sign in
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider ml-1">Email address</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="you@example.com"
                                    className="w-full bg-[#f8fbff] border border-[#e2e8f0] px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[13px] font-bold text-[#183b56] uppercase tracking-wider">Password</label>
                                    <button
                                        type="button"
                                        onClick={() => { setResetMode(true); setError(null); }}
                                        className="text-[12px] font-semibold text-[#2f6fed] hover:underline"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-[#f8fbff] border border-[#e2e8f0] px-5 py-3.5 rounded-xl text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#2f6fed] transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#2f6fed] text-white font-bold py-4 rounded-full shadow-lg shadow-blue-100/50 hover:bg-[#1e5bc6] transition-all transform hover:translate-y-[-1px] active:scale-[0.98] disabled:opacity-50 mt-4"
                            >
                                {loading ? "Signing in..." : "Sign in"}
                            </button>
                        </form>
                    )}

                    {!resetMode && process.env.NEXT_PUBLIC_OAUTH_ENABLED === "true" && (
                        <>
                            <div className="relative my-10">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-[#e2e8f0]"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest">
                                    <span className="bg-white px-4 text-[#94a3b8]">Or continue with</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => handleSocialLogin('google')}
                                    className="flex items-center justify-center p-3 rounded-xl border border-[#e2e8f0] hover:bg-gray-50 transition-all hover:translate-y-[-1px]"
                                >
                                    <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={20} height={20} className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleSocialLogin('facebook')}
                                    className="flex items-center justify-center p-3 rounded-xl border border-[#e2e8f0] hover:bg-gray-50 transition-all hover:translate-y-[-1px]"
                                >
                                    <Image src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" alt="Facebook" width={20} height={20} className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleSocialLogin('apple')}
                                    className="flex items-center justify-center p-3 rounded-xl border border-[#e2e8f0] hover:bg-gray-50 transition-all hover:translate-y-[-1px]"
                                >
                                    <Image src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" width={16} height={20} className="w-4 h-5" />
                                </button>
                            </div>
                        </>
                    )}

                    <p className="mt-12 text-center text-[#64748b] text-[15px] font-medium">
                        Don't have an account? <Link href="/signup" className="text-[#2f6fed] font-bold hover:underline">Sign up</Link>
                    </p>
                </div>
            </div>

            {/* Mobile Logo (Absolute Top) */}
            <div className="lg:hidden absolute top-6 left-0 right-0 flex justify-center">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/logo.png" alt="Workers United" width={48} height={48} />
                    <span className="font-bold text-[#1E3A5F] text-lg tracking-tight">Workers United</span>
                </Link>
            </div>
        </div>
    );
}
