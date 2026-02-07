import Link from "next/link";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

interface SignupPageProps {
    searchParams: Promise<{ type?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
    const params = await searchParams;
    const userType = params.type === "employer" ? "employer" : "candidate";

    return (
        <div className="min-h-screen flex">
            {/* Left side - Branding */}
            <div
                className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12"
                style={{
                    background: userType === "employer"
                        ? 'linear-gradient(135deg, #14B8A6 0%, #10B981 100%)'
                        : 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #2563EB 100%)'
                }}
            >
                <div className="max-w-md text-center text-white">
                    <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold mb-8">
                        <img src="/logo.png" alt="Workers United" width={64} height={64} className="" />
                        Workers United
                    </Link>

                    <h1 className="text-3xl font-bold mb-4">
                        {userType === "employer"
                            ? "Start hiring globally"
                            : "Start your journey"}
                    </h1>
                    <p className="text-lg opacity-80">
                        {userType === "employer"
                            ? "Access pre-verified international talent and let us handle the visa process. Focus on growing your business."
                            : "Get verified quickly and connect with verified employers across Europe. Find your dream job."}
                    </p>

                    <div className="mt-12 space-y-4 text-left">
                        {userType === "employer" ? (
                            <>
                                <div className="flex items-center gap-3 glass p-3 rounded-lg">
                                    <span className="text-xl">🌍</span>
                                    <span>Access global talent pool</span>
                                </div>
                                <div className="flex items-center gap-3 glass p-3 rounded-lg">
                                    <span className="text-xl">📋</span>
                                    <span>Automated documentation</span>
                                </div>
                                <div className="flex items-center gap-3 glass p-3 rounded-lg">
                                    <span className="text-xl">✅</span>
                                    <span>100% compliance ready</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 glass p-3 rounded-lg">
                                    <span className="text-xl">⚡</span>
                                    <span>Instant verification</span>
                                </div>
                                <div className="flex items-center gap-3 glass p-3 rounded-lg">
                                    <span className="text-xl">🏢</span>
                                    <span>Verified employers only</span>
                                </div>
                                <div className="flex items-center gap-3 glass p-3 rounded-lg">
                                    <span className="text-xl">🛂</span>
                                    <span>Full visa support</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right side - Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-gray-900">
                            <img src="/logo.png" alt="Workers United" width={64} height={64} className="" />
                            Workers United
                        </Link>
                    </div>

                    <div className="card">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h2>
                        <p className="text-gray-600 mb-6">
                            Join as {userType === "employer" ? "an employer" : "a candidate"} to get started.
                        </p>

                        {/* User type toggle */}
                        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                            <Link
                                href="/signup?type=candidate"
                                className={`flex-1 text-center py-2 px-4 rounded-md text-sm font-medium transition-all ${userType === "candidate"
                                    ? "bg-white shadow text-gray-900"
                                    : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                I&apos;m a Candidate
                            </Link>
                            <Link
                                href="/signup?type=employer"
                                className={`flex-1 text-center py-2 px-4 rounded-md text-sm font-medium transition-all ${userType === "employer"
                                    ? "bg-white shadow text-gray-900"
                                    : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                I&apos;m an Employer
                            </Link>
                        </div>

                        <SignupForm userType={userType} />

                        <div className="mt-6 text-center text-sm text-gray-600">
                            Already have an account?{" "}
                            <Link href="/login" className="font-semibold text-blue-600 hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
