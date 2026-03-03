import Link from "next/link";
import Image from "next/image";
import UnifiedNavbar from "@/components/UnifiedNavbar";
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
                      <span>Already have an offer but not sure if it's safe or fair</span>
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
                    Stability, not just "cheap labour"
                  </h2>
                  <p className="text-[#6c7a89] mb-6 text-lg leading-relaxed">
                    We focus on realistic offers and transparent communication, so you don't have to constantly replace staff.
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

        {/* Footer - Cleaner */}
        <footer className="text-white py-5" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)' }}>
          <div className="max-w-[1120px] mx-auto px-5 pb-2">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="text-left">
                <div className="text-sm text-gray-300 mb-2">© {new Date().getFullYear()} Workers United. All rights reserved.</div>
                <div className="text-sm text-gray-400">
                  <strong>Workers United LLC</strong><br />
                  75 E 3rd St., Sheridan, Wyoming 82801, USA
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-3">
                <div className="flex gap-4 text-sm">
                  <Link href="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="text-gray-300 hover:text-white transition-colors">Terms and Conditions</Link>
                </div>
                <a href="mailto:contact@workersunited.eu" className="text-gray-300 hover:text-white transition-colors text-sm">
                  contact@workersunited.eu
                </a>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="flex justify-center gap-2 sm:gap-3 py-3 flex-wrap border-t border-white/10 max-w-[1120px] mx-auto">
            <a href="https://www.facebook.com/profile.php?id=61585104076725" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="Facebook">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6H16.7V4.9c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7v3h2.8v8h3.7z" /></svg>
            </a>
            <a href="https://www.instagram.com/workersunited.eu/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="Instagram">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm9 2h-9A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9A3.5 3.5 0 0 0 20 16.5v-9A3.5 3.5 0 0 0 16.5 4z" /><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.1A2.9 2.9 0 1 0 12 15a2.9 2.9 0 0 0 0-5.9z" /><path d="M17.6 6.3a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" /></svg>
            </a>
            <a href="https://www.threads.com/@workersunited.eu" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="Threads">
              <Image src="/threads-logo.svg" alt="Threads" width={20} height={20} className="w-5 h-5 invert" />
            </a>
            <a href="https://wa.me/15557839521" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-[#25D366]/60" aria-label="WhatsApp">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12.004 0h-.008C5.478 0 0 5.382 0 12.004c0 2.625.846 5.058 2.284 7.034L.79 23.468l4.59-1.468A11.94 11.94 0 0 0 12.004 24C18.621 24 24 18.621 24 12.004 24 5.382 18.621 0 12.004 0zm7 16.956c-.293.825-1.449 1.509-2.373 1.709-.633.135-1.46.241-4.244-.912-3.564-1.476-5.854-5.082-6.03-5.319-.17-.237-1.412-1.881-1.412-3.588s.891-2.547 1.209-2.897c.293-.321.638-.402.85-.402.213 0 .426.002.612.011.197.009.46-.075.72.549.267.642.909 2.216.988 2.376.081.162.135.351.027.563-.107.213-.16.347-.321.534-.16.186-.337.417-.483.56-.16.16-.328.334-.141.657.188.321.833 1.377 1.788 2.231 1.229 1.098 2.262 1.438 2.584 1.599.321.16.51.135.697-.081.188-.218.804-.936 1.018-1.257.214-.321.427-.267.72-.16.293.107 1.863.879 2.184 1.04.321.16.535.241.615.375.081.133.081.771-.212 1.516z" /></svg>
            </a>
            <a href="https://x.com/WorkersUnitedEU" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="X">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.7 2H21l-6.7 7.6L22 22h-6.1l-4.8-6.2L5.6 22H3.3l7.2-8.2L2 2h6.2l4.3 5.6L18.7 2zm-1.1 18h1.2L6.3 3.9H5.1L17.6 20z" /></svg>
            </a>
            <a href="https://www.tiktok.com/@workersunited.eu" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="TikTok">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M14 2h2.2c.2 1.8 1.2 3.2 3.8 3.6V8c-1.7 0-3.2-.6-4.1-1.4V14c0 4-2.7 6-6 6-2.5 0-4.9-1.7-4.9-4.9 0-3.1 2.4-5 5.4-5 .5 0 1 .1 1.5.2V13c-.4-.2-.9-.3-1.5-.3-1.3 0-2.6.8-2.6 2.4 0 1.5 1.1 2.4 2.5 2.4 1.7 0 2.6-1.1 2.6-3V2z" /></svg>
            </a>
            <a href="https://www.linkedin.com/company/workersunited-eu/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M4.5 3.5A2 2 0 1 1 4.5 7.5a2 2 0 0 1 0-4zM3 9h3v12H3V9zm7 0h2.9v1.6h.1c.4-.8 1.6-1.7 3.2-1.7 3.4 0 4 2.2 4 5.1V21h-3v-6.1c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21h-3V9z" /></svg>
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
