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
        <div className="relative min-h-screen overflow-hidden bg-[#f4f4f2] font-montserrat">
            <div className="relative mx-auto flex min-h-screen w-full max-w-[680px] items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <main className="w-full">
                    <div className="flex w-full items-start justify-center rounded-[28px] border border-[#e6e6e1] bg-white px-5 py-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.3)] sm:px-7 sm:py-7 lg:px-10 lg:py-9">
                        <div className="w-full max-w-[470px]">
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
                                <h2 className="text-3xl font-semibold tracking-tight text-[#18181b]">Create your account</h2>
                                <p className="mt-2 text-[15px] leading-relaxed text-[#52525b]">
                                    Join as {userType === "employer" ? "an employer" : "a worker"} and continue to onboarding.
                                </p>
                            </div>

                            <div className="mb-7 grid grid-cols-2 rounded-2xl border border-[#e4e4df] bg-[#f8f8f6] p-1.5">
                                <Link
                                    href="/signup?type=worker"
                                    className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${userType === "worker"
                                        ? "bg-white text-[#18181b] shadow-[0_8px_24px_-20px_rgba(0,0,0,0.45)]"
                                        : "text-[#71717a] hover:text-[#27272a]"
                                        }`}
                                >
                                    I&apos;m a Worker
                                </Link>
                                <Link
                                    href="/signup?type=employer"
                                    className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${userType === "employer"
                                        ? "bg-white text-[#18181b] shadow-[0_8px_24px_-20px_rgba(0,0,0,0.45)]"
                                        : "text-[#71717a] hover:text-[#27272a]"
                                        }`}
                                >
                                    I&apos;m an Employer
                                </Link>
                            </div>

                            <SignupForm userType={userType} />

                            <p className="mt-7 text-center text-sm text-[#71717a]">
                                Already have an account?{" "}
                                <Link href="/login" className="font-semibold text-[#18181b] underline-offset-4 hover:underline">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
