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
            window.location.href = "/dashboard";
        }
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
            <div className="hidden lg:flex w-1/2 bg-[#183b56] text-white p-12 flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-[#1e3a8a]/20 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <Link href="/" className="flex items-center gap-3 mb-24">
                        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center p-2 backdrop-blur-md">
                            <Image src="/logo.png" alt="Logo" width={24} height={24} className="brightness-0 invert" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">Workers United</span>
                    </Link>

                    <h1 className="text-5xl font-bold mb-6 leading-tight">Welcome back</h1>
                    <p className="text-blue-100/80 text-lg max-w-md leading-relaxed mb-12">
                        Log in to access your dashboard, track your applications, and manage your profile.
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
                <div className="w-full max-w-[420px]">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-[#1e293b] mb-3 tracking-tight">Sign in</h2>
                        <p className="text-[#64748b] font-medium leading-relaxed">
                            Enter your email and password to access your account.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-8 font-medium animate-shake">
                            {error}
                        </div>
                    )}

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
                                <Link href="#" className="text-[12px] font-bold text-[#2f6fed] hover:underline">Forgot password?</Link>
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

                    {process.env.NEXT_PUBLIC_OAUTH_ENABLED === "true" && (
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
                                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleSocialLogin('facebook')}
                                    className="flex items-center justify-center p-3 rounded-xl border border-[#e2e8f0] hover:bg-gray-50 transition-all hover:translate-y-[-1px]"
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" alt="Facebook" className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleSocialLogin('apple')}
                                    className="flex items-center justify-center p-3 rounded-xl border border-[#e2e8f0] hover:bg-gray-50 transition-all hover:translate-y-[-1px]"
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" className="w-4 h-5" />
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
            <div className="lg:hidden absolute top-8 left-8">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#183b56] rounded-lg p-1.5 shadow-md">
                        <Image src="/logo.png" alt="Logo" width={20} height={20} className="brightness-0 invert" />
                    </div>
                </Link>
            </div>
        </div>
    );
}
