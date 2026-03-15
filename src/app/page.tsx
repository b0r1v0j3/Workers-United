import Link from "next/link";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import Footer from "@/components/Footer";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Files,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export default function Home() {
  const processSteps = [
    "Create your account and complete the essentials so we can open your case properly.",
    "We search for the right employer match and stay ready for the next real opening.",
    "When we secure the job, we handle contracts, documents, and the full visa submission process.",
    "After visa approval, we coordinate your travel and prepare the final handover.",
    "We welcome you on arrival and take you directly to the employer.",
    "We stay with you through onboarding, legal stay, and residence extensions.",
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Workers United",
            url: "https://workersunited.eu",
            logo: "https://workersunited.eu/logo-complete-transparent.png",
            description: "Workers United connects serious employers with reliable workers worldwide and guides both sides through the full work visa process.",
            address: {
              "@type": "PostalAddress",
              streetAddress: "75 E 3rd St.",
              addressLocality: "Sheridan",
              addressRegion: "WY",
              postalCode: "82801",
              addressCountry: "US",
            },
            contactPoint: {
              "@type": "ContactPoint",
              email: "contact@workersunited.eu",
              contactType: "customer service",
            },
            sameAs: [
              "https://www.facebook.com/WorkersUnitedEU",
              "https://www.instagram.com/workersunited.eu",
              "https://www.linkedin.com/company/workers-united-eu",
              "https://www.tiktok.com/@workersunited.eu",
              "https://wa.me/15557839521",
            ],
          }),
        }}
      />
      <div className="min-h-screen bg-[var(--bg)] font-montserrat">
        <UnifiedNavbar variant="public" />

        <main>
          {/* Hero */}
          <section className="relative overflow-hidden border-b border-[#e5e7eb] bg-white py-12 md:py-16">
            <div className="mx-auto grid max-w-[1180px] gap-10 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="animate-in fade-in slide-in-from-left-5 duration-700">
                <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-[#141414] md:text-6xl">
                  We run hiring like a clean stack of documents, not chaos.
                </h1>
                <div className="relative mt-5 h-[340px] w-full md:hidden">
                  <article className="absolute left-0 top-0 w-[78%] rotate-[-5deg] rounded-3xl border border-[#e2d8cd] bg-[#fff7ee] p-4 shadow-[0_22px_35px_-28px_rgba(15,23,42,0.18)]">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">Worker_Profile.md</p>
                    <h3 className="text-base font-semibold text-[#111827]">Identity + readiness</h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-[#4b5563]">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Passport verified</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Profile completion tracked</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Queue eligibility clear</li>
                    </ul>
                  </article>

                  <article className="absolute right-0 top-[110px] z-10 w-[78%] rotate-[4deg] rounded-3xl border border-[#d8eadf] bg-[#f5fbf6] p-4 shadow-[0_20px_35px_-28px_rgba(15,23,42,0.16)]">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4b5563]">Employer_Request.doc</p>
                    <h3 className="text-base font-semibold text-[#111827]">Role requirements</h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#4b5563]">Position count, salary, schedule, and legal conditions aligned before matching.</p>
                  </article>

                  <article className="absolute bottom-0 left-[11%] z-20 w-[78%] rotate-[-2deg] rounded-3xl border border-[#bdd4f4] bg-[#e7f0ff] p-4 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.18)]">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Visa_File.pdf</p>
                    <h3 className="text-base font-semibold text-[#111827]">Operational handover</h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#475569]">
                      Once confirmed, we handle the document workflow to move from match to legal arrival.
                    </p>
                  </article>
                </div>

                <div className="mt-5 hidden flex-row flex-wrap items-center gap-3 text-sm text-[#4b5563] md:flex">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    Verified process
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5">
                    <Clock3 className="h-4 w-4 text-amber-600" />
                    Fast onboarding
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5">
                    <ShieldCheck className="h-4 w-4 text-sky-700" />
                    90-day guarantee
                  </span>
                </div>
                <p className="mt-9 max-w-[620px] text-base leading-relaxed text-[#52525b] md:mt-8 md:text-lg">
                  Workers United connects workers and employers through verified profiles, clear legal steps, and full visa operations.
                  You always know what happens next.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#151515] px-7 py-4 text-base font-semibold !text-white transition hover:-translate-y-0.5 hover:bg-[#252525] hover:!text-white"
                  >
                    Get started
                    <ArrowRight className="h-4 w-4 text-white" />
                  </Link>
                  <Link
                    href="#how-it-works"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#d1d5db] bg-white px-7 py-4 text-base font-semibold text-[#1c1c1c] transition hover:bg-[#f4f4f5]"
                  >
                    How it works
                  </Link>
                </div>
              </div>

              <div className="relative hidden h-[480px] animate-in fade-in slide-in-from-right-5 duration-700 md:block">
                <article className="absolute left-0 top-0 w-[82%] rotate-[-5deg] rounded-3xl border border-[#e2d8cd] bg-[#fff7ee] p-6 shadow-[0_22px_35px_-28px_rgba(15,23,42,0.18)]">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">Worker_Profile.md</p>
                  <h3 className="text-xl font-semibold text-[#111827]">Identity + readiness</h3>
                  <ul className="mt-3 space-y-2 text-sm text-[#4b5563]">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Passport verified</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Profile completion tracked</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Queue eligibility clear</li>
                  </ul>
                </article>

                <article className="absolute right-0 top-[160px] z-10 w-[82%] rotate-[4deg] rounded-3xl border border-[#d8eadf] bg-[#f5fbf6] p-6 shadow-[0_20px_35px_-28px_rgba(15,23,42,0.16)]">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4b5563]">Employer_Request.doc</p>
                  <h3 className="text-xl font-semibold text-[#111827]">Role requirements</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">Position count, salary, schedule, and legal conditions aligned before matching.</p>
                </article>

                <article className="absolute bottom-0 left-[9%] z-20 w-[82%] rotate-[-2deg] rounded-3xl border border-[#bdd4f4] bg-[#e7f0ff] p-6 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.18)]">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Visa_File.pdf</p>
                  <h3 className="text-xl font-semibold text-[#111827]">Operational handover</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                    Once confirmed, we handle the document workflow to move from match to legal arrival.
                  </p>
                </article>
              </div>

            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" className="border-b border-[#e5e7eb] bg-[#f8fafc] py-16 md:py-20">
            <div className="mx-auto max-w-[1020px] px-5">
              <div className="rounded-[30px] border border-[#e5e7eb] bg-white p-6 shadow-[0_30px_60px_-55px_rgba(15,23,42,0.18)] md:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f4f5] text-[#52525b]">
                    <Files className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">Full-service path</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-[#191919] md:text-3xl">What happens after you join</h2>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {processSteps.map((step, idx) => (
                    <div key={step} className="flex items-start gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] text-xs font-semibold text-[#52525b]">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-[#4b5563]">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Workers / Employers */}
          <section className="border-b border-[#e5e7eb] bg-white py-16 md:py-20">
            <div className="mx-auto grid max-w-[1180px] gap-6 px-5 md:grid-cols-2">
              <article id="workers" className="rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.12)]">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                  <UserRound className="h-3.5 w-3.5" />
                  For workers
                </div>
                <h3 className="text-2xl font-semibold text-[#191919]">Transparent path to legal work</h3>
                <ul className="mt-4 space-y-3 text-sm text-[#4b5563]">
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Clear checklist of what is required.</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Verified employers only inside the flow.</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Visa process starts after confirmation.</li>
                </ul>
              </article>
              <article id="employers" className="rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.12)]">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  For employers
                </div>
                <h3 className="text-2xl font-semibold text-[#191919]">Structured hiring with fewer surprises</h3>
                <ul className="mt-4 space-y-3 text-sm text-[#4b5563]">
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Role requirements captured upfront.</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Matching against verified worker readiness.</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Ongoing support through onboarding.</li>
                </ul>
              </article>
            </div>
          </section>

          {/* Pricing note */}
          <section className="border-b border-[#e5e7eb] bg-[#f8fafc] py-16 md:py-20">
            <div className="mx-auto max-w-[980px] px-5">
              <article className="rounded-[30px] border border-[#e5e7eb] bg-white p-6 shadow-[0_24px_55px_-42px_rgba(15,23,42,0.14)] md:p-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
                  <CircleDollarSign className="h-3.5 w-3.5" />
                  Pricing note
                </div>
                <h2 className="text-2xl font-semibold text-[#171717] md:text-3xl">Simple pricing with a clear refund promise</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#52525b] md:text-base">
                  Once your profile is complete and approved, you can activate Job Finder with a one-time <strong>$9 fee</strong>.
                  If we do not find you a job within <strong> 90 days</strong>, you receive a <strong>full refund</strong>.
                </p>
                <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
                    <p className="text-[#6b7280]">Job Finder</p>
                    <p className="mt-1 text-2xl font-semibold text-[#161616]">$9 one-time</p>
                  </div>
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
                    <p className="text-[#6b7280]">Refund promise</p>
                    <p className="mt-1 text-2xl font-semibold text-[#161616]">100% refund</p>
                  </div>
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
                    <p className="text-[#6b7280]">Refund window</p>
                    <p className="mt-1 text-2xl font-semibold text-[#161616]">No match in 90 days</p>
                  </div>
                </div>
              </article>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-white py-16 md:py-20">
            <div className="mx-auto max-w-[840px] px-5 text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-[#171717] md:text-4xl">
                Start your profile in minutes
              </h2>
              <p className="mt-4 text-base text-[#52525b] md:text-lg">
                Choose your path and we will handle the operational side of the process.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href="/signup?type=worker"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#d1d5db] bg-white px-7 py-4 text-base font-semibold !text-[#1c1c1c] transition hover:bg-[#f4f4f5]"
                  >
                    Join as Worker
                  </Link>
                  <Link
                    href="/signup?type=employer"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#d1d5db] bg-white px-7 py-4 text-base font-semibold !text-[#1c1c1c] transition hover:bg-[#f4f4f5]"
                  >
                    Join as Employer
                  </Link>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
