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
        <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(1200px_700px_at_20%_-10%,#dbeafe_0%,transparent_55%),radial-gradient(900px_500px_at_85%_8%,#d1fae5_0%,transparent_50%),#f8fafc] font-montserrat">
            <div className="pointer-events-none absolute -left-28 top-8 h-64 w-64 rounded-full bg-[#93c5fd]/25 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#bfdbfe]/30 blur-3xl" />

            <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-stretch lg:gap-6 lg:px-8 lg:py-8">
                <aside className={`order-2 rounded-[28px] border px-6 py-6 text-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.65)] lg:order-1 lg:w-[46%] lg:px-10 lg:py-10 ${userType === "employer"
                    ? "border-emerald-300/30 bg-[linear-gradient(145deg,#0f766e_0%,#065f46_52%,#022c22_100%)]"
                    : "border-blue-300/25 bg-[linear-gradient(145deg,#0f172a_0%,#1e3a5f_55%,#1d4ed8_100%)]"
                    }`}
                >
                    <Link href="/" className="inline-flex items-center">
                        <Image
                            src="/logo-centered.png"
                            alt="Workers United logo"
                            width={128}
                            height={128}
                            className="h-auto w-[110px] object-contain"
                        />
                    </Link>

                    <div className="mt-8 lg:mt-12">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                            <Sparkles className="h-3.5 w-3.5" />
                            End-to-end process
                        </span>
                        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight lg:text-[40px] lg:leading-[1.1]">
                            {userType === "employer"
                                ? "Hire international workers, without visa friction."
                                : "Launch your work journey with a clean, guided flow."}
                        </h1>
                        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/75 lg:text-[17px]">
                            {userType === "employer"
                                ? "Create your account in minutes. We handle documentation, matching, and visa process operations for your company."
                                : "Create your profile, upload documents, and move into verification with full operational support from our team."}
                        </p>
                    </div>

                    <div className="mt-7 space-y-3 lg:mt-10">
                        {userType === "employer" ? (
                            <>
                                <Feature icon={<Globe className="h-5 w-5 text-emerald-100" />} text="Access a verified international talent pipeline" />
                                <Feature icon={<FileText className="h-5 w-5 text-emerald-100" />} text="Documentation and visa workflow managed by us" />
                                <Feature icon={<CheckCircle2 className="h-5 w-5 text-emerald-100" />} text="Operationally compliant and ready for scaling" />
                            </>
                        ) : (
                            <>
                                <Feature icon={<Zap className="h-5 w-5 text-blue-100" />} text="Fast signup and streamlined document verification" />
                                <Feature icon={<BriefcaseBusiness className="h-5 w-5 text-blue-100" />} text="Only verified employers inside the platform" />
                                <Feature icon={<CheckCircle2 className="h-5 w-5 text-blue-100" />} text="Clear visa support from profile to placement" />
                            </>
                        )}
                    </div>

                    <div className="mt-7 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55 lg:mt-10">
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Safe & legal</span>
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">No hidden steps</span>
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Human support</span>
                    </div>
                </aside>

                <main className="order-1 flex lg:order-2 lg:w-[54%]">
                    <div className="flex w-full items-start justify-center rounded-[28px] border border-[#d9e2ef] bg-white/95 px-5 py-5 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.35)] backdrop-blur-sm sm:px-7 sm:py-7 lg:px-10 lg:py-9">
                        <div className="w-full max-w-[470px]">
                            <div className="mb-8 text-center">
                                <div className="mx-auto mb-4 flex items-center justify-center">
                                    <Image
                                        src="/logo-centered.png"
                                        alt="Workers United logo"
                                        width={110}
                                        height={110}
                                        className="h-auto w-[94px] object-contain"
                                    />
                                </div>
                                <h2 className="text-3xl font-semibold tracking-tight text-[#0f172a]">Create your account</h2>
                                <p className="mt-2 text-[15px] leading-relaxed text-[#64748b]">
                                    Join as {userType === "employer" ? "an employer" : "a worker"} and continue to onboarding.
                                </p>
                            </div>

                            <div className="mb-7 grid grid-cols-2 rounded-2xl border border-[#dbe5f3] bg-[#f8fafc] p-1.5">
                                <Link
                                    href="/signup?type=worker"
                                    className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${userType === "worker"
                                        ? "bg-white text-[#0f172a] shadow-[0_8px_24px_-18px_rgba(37,99,235,0.6)]"
                                        : "text-[#64748b] hover:text-[#0f172a]"
                                        }`}
                                >
                                    I&apos;m a Worker
                                </Link>
                                <Link
                                    href="/signup?type=employer"
                                    className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${userType === "employer"
                                        ? "bg-white text-[#0f172a] shadow-[0_8px_24px_-18px_rgba(37,99,235,0.6)]"
                                        : "text-[#64748b] hover:text-[#0f172a]"
                                        }`}
                                >
                                    I&apos;m an Employer
                                </Link>
                            </div>

                            <SignupForm userType={userType} />

                            <p className="mt-7 text-center text-sm text-[#64748b]">
                                Already have an account?{" "}
                                <Link href="/login" className="font-semibold text-[#0f172a] underline-offset-4 hover:underline">
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
        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 backdrop-blur-sm">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">{icon}</span>
            <span className="text-sm font-medium leading-relaxed text-white/90">{text}</span>
        </div>
    );
}
