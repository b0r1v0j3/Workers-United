import Link from "next/link";
import { SignupForm } from "./signup-form";
import Image from "next/image";
import { BriefcaseBusiness, CheckCircle2, FileText, Globe, Sparkles, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

interface SignupPageProps {
    searchParams: Promise<{ type?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
    const params = await searchParams;
    const userType = params.type === "employer" ? "employer" : "worker";

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#f4f4f2] font-montserrat">
            <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-stretch lg:gap-6 lg:px-8 lg:py-8">
                <aside className="order-2 rounded-[28px] border border-[#e6e6e1] bg-[#f7f7f4] px-6 py-6 text-[#18181b] shadow-[0_24px_70px_-44px_rgba(15,23,42,0.35)] lg:order-1 lg:w-[46%] lg:px-10 lg:py-10">
                    <Link href="/" className="inline-flex items-center">
                        <Image
                            src="/logo-complete-transparent.png"
                            alt="Workers United logo"
                            width={260}
                            height={260}
                            className="h-auto w-[208px] object-contain"
                        />
                    </Link>

                    <div className="mt-8 lg:mt-12">
                        <span className="inline-flex items-center gap-2 rounded-full border border-[#dbdbd4] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#52525b]">
                            <Sparkles className="h-3.5 w-3.5" />
                            End-to-end process
                        </span>
                        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-[#18181b] lg:text-[40px] lg:leading-[1.1]">
                            {userType === "employer"
                                ? "Hire international workers, without visa friction."
                                : "Launch your work journey with a clean, guided flow."}
                        </h1>
                        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#52525b] lg:text-[17px]">
                            {userType === "employer"
                                ? "Create your account in minutes. We handle documentation, matching, and visa process operations for your company."
                                : "Create your profile, upload documents, and move into verification with full operational support from our team."}
                        </p>
                    </div>

                    <div className="mt-7 space-y-3 lg:mt-10">
                        {userType === "employer" ? (
                            <>
                                <Feature icon={<Globe className="h-5 w-5 text-[#3f3f46]" />} text="Access a verified international talent pipeline" />
                                <Feature icon={<FileText className="h-5 w-5 text-[#3f3f46]" />} text="Documentation and visa workflow managed by us" />
                                <Feature icon={<CheckCircle2 className="h-5 w-5 text-[#3f3f46]" />} text="Operationally compliant and ready for scaling" />
                            </>
                        ) : (
                            <>
                                <Feature icon={<Zap className="h-5 w-5 text-[#3f3f46]" />} text="Fast signup and streamlined document verification" />
                                <Feature icon={<BriefcaseBusiness className="h-5 w-5 text-[#3f3f46]" />} text="Only verified employers inside the platform" />
                                <Feature icon={<CheckCircle2 className="h-5 w-5 text-[#3f3f46]" />} text="Clear visa support from profile to placement" />
                            </>
                        )}
                    </div>

                    <div className="mt-7 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#71717a] lg:mt-10">
                        <span className="rounded-full border border-[#dbdbd4] bg-white px-3 py-1.5">Safe & legal</span>
                        <span className="rounded-full border border-[#dbdbd4] bg-white px-3 py-1.5">No hidden steps</span>
                        <span className="rounded-full border border-[#dbdbd4] bg-white px-3 py-1.5">Human support</span>
                    </div>
                </aside>

                <main className="order-1 flex lg:order-2 lg:w-[54%]">
                    <div className="flex w-full items-start justify-center rounded-[28px] border border-[#e6e6e1] bg-white px-5 py-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.3)] sm:px-7 sm:py-7 lg:px-10 lg:py-9">
                        <div className="w-full max-w-[470px]">
                            <div className="mb-8 text-center">
                                <div className="mx-auto mb-4 flex items-center justify-center">
                                    <Image
                                        src="/logo-complete-transparent.png"
                                        alt="Workers United logo"
                                        width={230}
                                        height={230}
                                        className="h-auto w-[184px] object-contain"
                                    />
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

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-[#dbdbd4] bg-white px-3.5 py-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4f4f0]">{icon}</span>
            <span className="text-sm font-medium leading-relaxed text-[#3f3f46]">{text}</span>
        </div>
    );
}
