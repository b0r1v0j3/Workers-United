import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex">
            {/* Left side - Branding */}
            <div
                className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12"
                style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #2563EB 100%)' }}
            >
                <div className="max-w-md text-center text-white">
                    <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold mb-8">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        Workers United
                    </Link>

                    <h1 className="text-3xl font-bold mb-4">Welcome back</h1>
                    <p className="text-lg opacity-80">
                        Log in to access your dashboard, track your applications,
                        and manage your profile.
                    </p>

                    <div className="mt-12 grid grid-cols-3 gap-4 text-sm opacity-70">
                        <div className="glass p-4 rounded-lg">
                            <div className="text-2xl font-bold">5K+</div>
                            <div>Candidates</div>
                        </div>
                        <div className="glass p-4 rounded-lg">
                            <div className="text-2xl font-bold">200+</div>
                            <div>Employers</div>
                        </div>
                        <div className="glass p-4 rounded-lg">
                            <div className="text-2xl font-bold">98%</div>
                            <div>Success</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side - Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-gray-900">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M2 12h20" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            Workers United
                        </Link>
                    </div>

                    <div className="card">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h2>
                        <p className="text-gray-600 mb-6">
                            Enter your email and password to access your account.
                        </p>

                        <LoginForm />

                        <div className="mt-6 text-center text-sm text-gray-600">
                            Don&apos;t have an account?{" "}
                            <Link href="/signup" className="font-semibold text-blue-600 hover:underline">
                                Sign up
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
