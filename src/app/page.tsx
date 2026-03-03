import Link from "next/link";
import Image from "next/image";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import { Check, Shield, Globe, ArrowRight, UserCheck, FileCheck, Briefcase, HeartHandshake, Sparkles, CheckCircle2 } from "lucide-react";

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
            logo: "https://workersunited.eu/logo.png",
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
      <div className="min-h-screen bg-[#FAFAFA] font-sans text-[#0F172A] selection:bg-blue-100 selection:text-blue-900">
        <UnifiedNavbar variant="public" />

        <main>
          {/* Hero Section - Apple/Notion Style: Clean, minimal, tight typography */}
          <section className="pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden">
            {/* Subtle background element */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none rounded-full blur-3xl opacity-50"></div>

            <div className="max-w-[900px] mx-auto px-6 text-center relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-8 text-sm font-medium text-slate-600">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                Connecting workers & EU employers
              </div>

              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#0F172A] leading-[1.1] mb-6">
                International hiring <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900">made simple.</span>
              </h1>

              <p className="text-slate-500 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed font-light">
                We guide real employers and reliable workers through the full visa process.
                No fake promises. Just legal, transparent hiring.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link
                  href="/signup"
                  className="px-8 py-4 rounded-full bg-[#0F172A] text-white font-medium text-lg shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  Create free account <ArrowRight className="w-5 h-5" strokeWidth={2} />
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-4 rounded-full bg-white border border-slate-200 text-slate-700 font-medium text-lg shadow-sm hover:bg-slate-50 hover:text-slate-900 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Sign In
                </Link>
              </div>

              <div className="flex flex-wrap gap-8 justify-center text-sm font-medium text-slate-500">
                <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500" strokeWidth={2} /> No hidden fees</span>
                <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-500" strokeWidth={2} /> 90-day guarantee</span>
                <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-emerald-500" strokeWidth={2} /> Real visa support</span>
              </div>
            </div>
          </section>


          {/* How It Works - Cards with soft shadows */}
          <section id="how-it-works" className="py-20 bg-white border-y border-slate-100">
            <div className="max-w-[1200px] mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-[#0F172A] tracking-tight mb-4">How it works</h2>
                <p className="text-slate-500 max-w-xl mx-auto text-lg font-light">
                  Clear steps for both sides — from first contact until the worker arrives safely.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: UserCheck, title: "Create profile", text: "Sign up as a worker or employer. It takes less than 2 minutes." },
                  { icon: FileCheck, title: "Upload docs", text: "Add your passport, CV, and basic information so we can verify you." },
                  { icon: Briefcase, title: "We match you", text: "We review your profile and connect you with suitable jobs or workers." },
                  { icon: HeartHandshake, title: "Visa support", text: "We help with visa documents and stay available after you start working." }
                ].map((step, i) => (
                  <div key={i} className="bg-white rounded-[24px] p-8 border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-700 flex items-center justify-center mb-6 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors duration-300 border border-slate-100">
                      <step.icon className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-semibold text-[#0F172A] mb-3 text-lg tracking-tight">{step.title}</h3>
                    <p className="text-slate-500 leading-relaxed font-light text-sm">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* For Workers & Employers - Split layout */}
          <section className="py-24">
            <div className="max-w-[1200px] mx-auto px-6 space-y-8">

              {/* Workers Block */}
              <div id="workers" className="bg-white rounded-[32px] p-10 lg:p-14 border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold tracking-wide uppercase mb-6">
                    For Workers
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-[#0F172A] mb-6">
                    Real opportunities, <br />not empty promises.
                  </h2>
                  <p className="text-slate-500 mb-8 text-lg font-light leading-relaxed">
                    We help you understand what you are signing and what you can really expect when you arrive in the EU.
                  </p>
                  <ul className="space-y-5">
                    {[
                      "We explain your contract in simple language.",
                      "We tell you honestly if an offer looks suspicious.",
                      "We support you with documents for the work visa."
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <div className="mt-1 bg-emerald-100 text-emerald-600 rounded-full p-1"><Check className="w-4 h-4" strokeWidth={2.5} /></div>
                        <span className="text-slate-700 font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-[24px] p-8 border border-slate-100">
                  <h3 className="font-semibold text-[#0F172A] mb-6 text-lg tracking-tight">Common Worker Questions</h3>
                  <ul className="space-y-4">
                    {[
                      "Is my current offer safe and fair?",
                      "How do I understand the visa documents?",
                      "Can someone verify the employer first?"
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-slate-600 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="bg-slate-100 p-1.5 rounded-lg text-slate-400"><HeartHandshake className="w-4 h-4" strokeWidth={1.5} /></div>
                        <span className="text-sm font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Employers Block */}
              <div id="employers" className="bg-[#0F172A] rounded-[32px] p-10 lg:p-14 border border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)] grid lg:grid-cols-2 gap-12 items-center">
                <div className="order-2 lg:order-1 bg-slate-800/50 rounded-[24px] p-8 border border-slate-700 backdrop-blur-sm">
                  <h3 className="font-semibold text-white mb-6 text-lg tracking-tight">What Serious Employers Get</h3>
                  <ul className="space-y-4">
                    {[
                      "Workers who understand the job before travelling",
                      "Correct documents for visa applications",
                      "Fewer misunderstandings & early resignations",
                      "Post-arrival support to solve issues"
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-slate-300">
                        <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" strokeWidth={1.5} />
                        <span className="text-sm font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="inline-block px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-semibold tracking-wide uppercase border border-blue-500/20 mb-6">
                    For Employers
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-6">
                    Stability, not just <br />"cheap labour".
                  </h2>
                  <p className="text-slate-400 mb-8 text-lg font-light leading-relaxed">
                    We focus on realistic offers and transparent communication, so you don't have to constantly replace staff.
                  </p>
                  <ul className="space-y-5 text-slate-300">
                    <li className="flex items-start gap-4">
                      <div className="mt-1 text-slate-500"><ArrowRight className="w-5 h-5" strokeWidth={1.5} /></div>
                      <span className="font-medium text-sm">We connect legal requirements with worker expectations.</span>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="mt-1 text-slate-500"><ArrowRight className="w-5 h-5" strokeWidth={1.5} /></div>
                      <span className="font-medium text-sm">We build cooperation step by step — starting small.</span>
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          </section>

          {/* CTA Section */}
          <section className="py-24 border-t border-slate-200/60 bg-white">
            <div className="max-w-[600px] mx-auto px-6 text-center">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm scale-110">
                <Globe className="w-8 h-8 text-slate-800" strokeWidth={1} />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-[#0F172A] tracking-tight mb-6">
                Ready to start?
              </h2>
              <p className="text-slate-500 text-lg mb-10 font-light">
                Join our platform today. We make international hiring legal, transparent, and fair.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="px-8 py-4 rounded-full bg-[#0F172A] text-white font-medium text-lg shadow-lg shadow-slate-900/10 hover:shadow-xl hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-200"
                >
                  Create free account
                </Link>
                <a
                  href="mailto:contact@workersunited.eu"
                  className="px-8 py-4 rounded-full bg-white border border-slate-200 text-slate-700 font-medium text-lg hover:bg-slate-50 transition-all duration-200"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </section>
        </main>

        {/* Minimal Footer */}
        <footer className="bg-white border-t border-slate-200 py-12">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">

              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                  <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">WU</span>
                  </div>
                  <span className="font-bold text-slate-900 tracking-tight">Workers United</span>
                </div>
                <div className="text-sm text-slate-500 mb-1">© {new Date().getFullYear()} Workers United LLC.</div>
                <div className="text-sm text-slate-400">75 E 3rd St., Sheridan, WY 82801, USA</div>
              </div>

              <div className="flex flex-col items-center md:items-end gap-4">
                <div className="flex gap-6 text-sm font-medium text-slate-500">
                  <Link href="/privacy-policy" className="hover:text-slate-900 transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms</Link>
                  <a href="mailto:contact@workersunited.eu" className="hover:text-slate-900 transition-colors">Contact</a>
                </div>

                {/* Socials */}
                <div className="flex gap-4">
                  <a href="https://wa.me/15557839521" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#25D366] transition-colors" aria-label="WhatsApp">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12.004 0h-.008C5.478 0 0 5.382 0 12.004c0 2.625.846 5.058 2.284 7.034L.79 23.468l4.59-1.468A11.94 11.94 0 0 0 12.004 24C18.621 24 24 18.621 24 12.004 24 5.382 18.621 0 12.004 0zm7 16.956c-.293.825-1.449 1.509-2.373 1.709-.633.135-1.46.241-4.244-.912-3.564-1.476-5.854-5.082-6.03-5.319-.17-.237-1.412-1.881-1.412-3.588s.891-2.547 1.209-2.897c.293-.321.638-.402.85-.402.213 0 .426.002.612.011.197.009.46-.075.72.549.267.642.909 2.216.988 2.376.081.162.135.351.027.563-.107.213-.16.347-.321.534-.16.186-.337.417-.483.56-.16.16-.328.334-.141.657.188.321.833 1.377 1.788 2.231 1.229 1.098 2.262 1.438 2.584 1.599.321.16.51.135.697-.081.188-.218.804-.936 1.018-1.257.214-.321.427-.267.72-.16.293.107 1.863.879 2.184 1.04.321.16.535.241.615.375.081.133.081.771-.212 1.516z" /></svg>
                  </a>
                  <a href="https://www.facebook.com/profile.php?id=61585104076725" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#1877F2] transition-colors" aria-label="Facebook">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6H16.7V4.9c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7v3h2.8v8h3.7z" /></svg>
                  </a>
                  <a href="https://www.instagram.com/workersunited.eu/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#E4405F] transition-colors" aria-label="Instagram">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm9 2h-9A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9A3.5 3.5 0 0 0 20 16.5v-9A3.5 3.5 0 0 0 16.5 4z" /><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.1A2.9 2.9 0 1 0 12 15a2.9 2.9 0 0 0 0-5.9z" /><path d="M17.6 6.3a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" /></svg>
                  </a>
                  <a href="https://www.linkedin.com/company/workersunited-eu/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#0A66C2] transition-colors" aria-label="LinkedIn">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M4.5 3.5A2 2 0 1 1 4.5 7.5a2 2 0 0 1 0-4zM3 9h3v12H3V9zm7 0h2.9v1.6h.1c.4-.8 1.6-1.7 3.2-1.7 3.4 0 4 2.2 4 5.1V21h-3v-6.1c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21h-3V9z" /></svg>
                  </a>
                </div>
              </div>

            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
