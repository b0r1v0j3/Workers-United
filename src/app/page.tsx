import Link from "next/link";
import Image from "next/image";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import Footer from "@/components/Footer";
import { Check, Shield, Globe, Clock, ArrowRight, UserCheck, FileCheck, Briefcase, HeartHandshake } from "lucide-react";

export default function Home() {
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
            logo: "https://workersunited.eu/logo-icon.png",
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
          {/* Hero Section - Clean, centered, impactful */}
          <section className="py-10 md:py-16">
            <div className="max-w-[900px] mx-auto px-5 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">

              <h1 className="text-4xl md:text-6xl font-bold text-[#183b56] leading-tight tracking-tight mb-6">
                International hiring<br />made simple & legal.
              </h1>

              <p className="text-[#6c7a89] text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
                Workers United connects serious employers with reliable workers and guides both sides through
                the full work visa process – without fake promises or hidden conditions.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                <Link
                  href="/signup"
                  className="px-10 py-5 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] font-bold text-lg shadow-lg shadow-blue-500/40 text-center hover:translate-y-[-2px] hover:shadow-xl transition-all"
                  style={{ color: '#ffffff' }}
                >
                  Create Free Account
                </Link>
                <Link
                  href="/login"
                  className="px-10 py-5 rounded-full bg-white border-2 border-[#183b56] text-[#183b56] font-bold text-lg shadow-sm text-center hover:bg-[#f0f4ff] hover:border-[#2f6fed] hover:text-[#2f6fed] transition-all"
                >
                  Sign In
                </Link>
              </div>

              <div className="flex flex-wrap gap-6 justify-center text-sm text-[#6c7a89]">
                <span className="flex items-center gap-2"><Check className="w-5 h-5 text-[#1dbf73]" /> No hidden fees</span>
                <span className="flex items-center gap-2"><Shield className="w-5 h-5 text-[#1dbf73]" /> 90-day guarantee</span>
                <span className="flex items-center gap-2"><Globe className="w-5 h-5 text-[#1dbf73]" /> Real visa support</span>
              </div>
            </div>
          </section>


          {/* How It Works - Streamlined */}
          <section id="how-it-works" className="py-16 md:py-20 bg-white">
            <div className="max-w-[1120px] mx-auto px-5">
              <div className="text-center mb-12">
                <div className="inline-block px-4 py-1.5 bg-[#dbe7ff] rounded-full text-sm font-bold text-[#1a56db] uppercase tracking-wider mb-3">Step by step</div>
                <h2 className="text-2xl md:text-4xl font-bold text-[#183b56] mb-3">How it works</h2>
                <p className="text-[#6c7a89] max-w-xl mx-auto text-lg">
                  Clear steps for both sides – from first contact until the worker arrives.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: UserCheck, title: "Create your profile", text: "Sign up as a worker or employer. It takes less than 2 minutes." },
                  { icon: FileCheck, title: "Upload your documents", text: "Add your passport, CV, and basic information so we can verify you." },
                  { icon: Briefcase, title: "We match you", text: "We review your profile and connect you with suitable jobs or workers." },
                  { icon: HeartHandshake, title: "Visa & arrival support", text: "We help with visa documents and stay available after you start working." }
                ].map((step, i) => (
                  <div key={i} className="bg-[#f4f6fb] rounded-2xl p-6 border border-[#dde3ec]/80 hover:shadow-xl hover:-translate-y-1 hover:border-[#2f6fed]/30 transition-all duration-300 group">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] text-white flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300">
                      <step.icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-[#183b56] mb-2 text-lg">{step.title}</h3>
                    <p className="text-sm text-[#6c7a89] leading-relaxed">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* For Workers - Simplified */}
          <section id="workers" className="py-16 md:py-20">
            <div className="max-w-[1120px] mx-auto px-5">
              <div className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-block px-4 py-1.5 bg-[#1dbf73]/10 rounded-full text-sm font-bold text-[#1dbf73] mb-4">
                    For workers
                  </div>
                  <h2 className="text-2xl md:text-4xl font-bold text-[#183b56] mb-5">
                    Real opportunities, not empty promises
                  </h2>
                  <p className="text-[#6c7a89] mb-6 text-lg leading-relaxed">
                    We help you understand what you are signing and what you can really expect when you arrive.
                  </p>
                  <ul className="space-y-4 text-[#1b2430]">
                    <li className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-[#1dbf73] shrink-0" />
                      <span>We explain your contract in simple language – salary, working hours, accommodation.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-[#1dbf73] shrink-0" />
                      <span>We tell you honestly if an offer looks unrealistic or dangerous.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-[#1dbf73] shrink-0" />
                      <span>We support you with documents for work visa step by step.</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-[#e8fff2] to-[#f9fffb] rounded-2xl p-8 border border-[#1dbf73]/20">
                  <h3 className="font-bold text-[#183b56] mb-4 text-lg">What workers usually ask us</h3>
                  <ul className="space-y-3 text-[#1b2430]">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-5 h-5 text-[#1dbf73] shrink-0 mt-0.5" />
                      <span>Already have an offer but not sure if it&apos;s safe or fair</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-5 h-5 text-[#1dbf73] shrink-0 mt-0.5" />
                      <span>Need help understanding the contract and visa documents</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-5 h-5 text-[#1dbf73] shrink-0 mt-0.5" />
                      <span>Want someone to check the employer before deciding</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* For Employers - Simplified */}
          <section id="employers" className="py-16 md:py-20 bg-white">
            <div className="max-w-[1120px] mx-auto px-5">
              <div className="grid md:grid-cols-2 gap-10 items-center">
                <div className="bg-gradient-to-br from-[#e4ebff] to-[#f9fbff] rounded-2xl p-8 border border-[#2f6fed]/20 order-2 md:order-1">
                  <h3 className="font-bold text-[#183b56] mb-4 text-lg">What serious employers get</h3>
                  <ul className="space-y-3 text-[#1b2430]">
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-[#2f6fed] shrink-0 mt-0.5" />
                      <span>Workers who understand the job before travelling</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-[#2f6fed] shrink-0 mt-0.5" />
                      <span>Correct documents for work visa applications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-[#2f6fed] shrink-0 mt-0.5" />
                      <span>Less misunderstandings and early resignations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-[#2f6fed] shrink-0 mt-0.5" />
                      <span>Support after arrival to solve issues early</span>
                    </li>
                  </ul>
                </div>
                <div className="order-1 md:order-2">
                  <div className="inline-block px-4 py-1.5 bg-[#dbe7ff] rounded-full text-sm font-bold text-[#1a56db] mb-4">
                    For employers
                  </div>
                  <h2 className="text-2xl md:text-4xl font-bold text-[#183b56] mb-5">
                    Stability, not just &quot;cheap labour&quot;
                  </h2>
                  <p className="text-[#6c7a89] mb-6 text-lg leading-relaxed">
                    We focus on realistic offers and transparent communication, so you don&apos;t have to constantly replace staff.
                  </p>
                  <ul className="space-y-4 text-[#1b2430]">
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-[#6c7a89] shrink-0 mt-0.5" />
                      <span>We help connect legal requirements with worker expectations.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-[#6c7a89] shrink-0 mt-0.5" />
                      <span>Available in flexible hours when workers can really talk.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ArrowRight className="w-5 h-5 text-[#6c7a89] shrink-0 mt-0.5" />
                      <span>We build cooperation step by step – starting small and growing.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section - New, impactful */}
          <section className="py-16 md:py-20">
            <div className="max-w-[800px] mx-auto px-5 text-center">
              <h2 className="text-2xl md:text-4xl font-bold text-[#0F172A] mb-5">
                Ready to get started?
              </h2>
              <p className="text-[#6c7a89] text-lg mb-8">
                Create a free account and let us help you with legal work opportunities.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="px-10 py-4 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] font-bold text-lg shadow-lg shadow-blue-500/40 hover:translate-y-[-2px] hover:shadow-xl transition-all"
                  style={{ color: '#ffffff' }}
                >
                  Create Free Account
                </Link>
                <a
                  href="mailto:contact@workersunited.eu"
                  className="px-10 py-4 rounded-full bg-white border-2 border-[#1E3A5F] text-[#1E3A5F] font-bold text-lg hover:bg-blue-50 hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
