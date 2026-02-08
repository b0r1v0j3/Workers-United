import Link from "next/link";
import { SignupForm } from "./signup-form";
import Image from "next/image";

export const dynamic = "force-dynamic";

interface SignupPageProps {
    searchParams: Promise<{ type?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
    const params = await searchParams;
    const userType = params.type === "employer" ? "employer" : "worker";

    return (
        <div className="min-h-screen flex font-montserrat flex-col lg:flex-row">
            {/* Left Side: Brand Panel */}
            <div className="hidden lg:flex w-1/2 text-white p-12 flex-col justify-between relative overflow-hidden"
                style={{
                    background: userType === "employer"
                        ? 'linear-gradient(135deg, #0d9488 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #2563EB 100%)'
                }}
            >
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <Link href="/" className="flex items-center gap-3 mb-20">
                        <Image src="/logo.png" alt="Workers United logo" width={48} height={48} className="drop-shadow-lg brightness-0 invert" />
                        <span className="text-2xl font-bold tracking-tight">Workers United</span>
                    </Link>

                    <h1 className="text-5xl font-bold mb-6 leading-tight">
                        {userType === "employer"
                            ? "Start hiring globally"
                            : "Start your journey"}
                    </h1>
                    <p className="text-white/70 text-lg max-w-md leading-relaxed mb-12">
                        {userType === "employer"
                            ? "Access pre-verified international talent and let us handle the visa process."
                            : "Get verified quickly and connect with verified employers across Europe."}
                    </p>

                    <div className="space-y-4">
                        {userType === "employer" ? (
                            <>
                                <Feature icon="🌍" text="Access global talent pool" />
                                <Feature icon="📋" text="Automated documentation" />
                                <Feature icon="✅" text="100% compliance ready" />
                            </>
                        ) : (
                            <>
                                <Feature icon="⚡" text="Instant document verification" />
                                <Feature icon="🏢" text="Verified employers only" />
                                <Feature icon="🛂" text="Full visa support included" />
                            </>
                        )}
                    </div>
                </div>

                <div className="relative z-10 flex gap-6 text-[10px] uppercase font-bold tracking-widest text-white/30">
                    <span>Clean Process</span>
                    <span>Safe & Legal</span>
                    <span>Guaranteed Support</span>
                </div>
            </div>

            {/* Right Side: Sign Up Form */}
            <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center items-center p-8 lg:p-24 relative">
                {/* Mobile Logo */}
                <div className="lg:hidden absolute top-6 left-0 right-0 flex justify-center">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src="/logo.png" alt="Workers United" width={48} height={48} />
                        <span className="font-bold text-[#1877f2] text-lg tracking-tight">Workers United</span>
                    </Link>
                </div>

                <div className="w-full max-w-[420px] mt-16 lg:mt-0">
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-[#1e293b] mb-3 tracking-tight">Create your account</h2>
                        <p className="text-[#64748b] font-medium leading-relaxed">
                            Join as {userType === "employer" ? "an employer" : "a worker"} to get started.
                        </p>
                    </div>

                    {/* User type toggle */}
                    <div className="flex bg-[#f0f2f5] rounded-xl p-1 mb-8">
                        <Link
                            href="/signup?type=worker"
                            className={`flex-1 text-center py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${userType === "worker"
                                ? "bg-white shadow-sm text-[#1877f2]"
                                : "text-[#65676b] hover:text-[#050505]"
                                }`}
                        >
                            I&apos;m a Worker
                        </Link>
                        <Link
                            href="/signup?type=employer"
                            className={`flex-1 text-center py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${userType === "employer"
                                ? "bg-white shadow-sm text-[#1877f2]"
                                : "text-[#65676b] hover:text-[#050505]"
                                }`}
                        >
                            I&apos;m an Employer
                        </Link>
                    </div>

                    <SignupForm userType={userType} />

                    <p className="mt-8 text-center text-[#64748b] text-[15px] font-medium">
                        Already have an account? <Link href="/login" className="text-[#1877f2] font-bold hover:underline">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

function Feature({ icon, text }: { icon: string; text: string }) {
    return (
        <div className="flex items-center gap-3 bg-white/10 p-3.5 rounded-xl backdrop-blur-sm">
            <span className="text-xl">{icon}</span>
            <span className="font-medium">{text}</span>
        </div>
    );
}
