import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  let user = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("Supabase client failed to initialize:", err);
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] font-montserrat">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#f4f6fb]/90 border-b border-[#dde3ec]/70">
        <div className="max-w-[1120px] mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Workers United logo" width={48} height={48} className="rounded" />
            <span className="font-bold text-xl text-[#183b56]">Workers United</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#6c7a89]">
            <Link href="#how-it-works" className="hover:text-[#183b56] transition-colors">How it works</Link>
            <Link href="#workers" className="hover:text-[#183b56] transition-colors">For workers</Link>
            <Link href="#employers" className="hover:text-[#183b56] transition-colors">For employers</Link>
            {user ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#1dbf73] to-[#17a864] font-bold shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all"
                style={{ color: '#ffffff' }}
              >
                ✓ Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] text-white font-semibold shadow-lg shadow-blue-500/40"
              >
                Log In
              </Link>
            )}
          </nav>
          {/* Mobile menu button */}
          <button className="md:hidden p-2" aria-label="Menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      <main>
        {/* Hero Section - Clean, centered, impactful */}
        <section className="py-16 md:py-24">
          <div className="max-w-[900px] mx-auto px-5 text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e4ebff] to-[#f0f4ff] rounded-full text-sm text-[#2f6fed] font-semibold mb-8 border border-[#2f6fed]/20 shadow-sm">
              <span className="w-2.5 h-2.5 bg-[#1dbf73] rounded-full animate-pulse"></span>
              Safe, legal and transparent
            </div>

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
                className="px-10 py-5 rounded-full bg-white border-2 border-[#183b56] text-[#183b56] font-bold text-lg shadow-sm text-center hover:bg-[#183b56] hover:text-white transition-all"
              >
                Log In
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 justify-center text-sm text-[#6c7a89]">
              <span className="flex items-center gap-2"><span className="text-[#1dbf73] text-lg">✓</span> No hidden fees</span>
              <span className="flex items-center gap-2"><span className="text-[#1dbf73] text-lg">✓</span> 90-day guarantee</span>
              <span className="flex items-center gap-2"><span className="text-[#1dbf73] text-lg">✓</span> Real visa support</span>
            </div>
          </div>
        </section>


        {/* How It Works - Streamlined */}
        <section id="how-it-works" className="py-16 md:py-20 bg-white">
          <div className="max-w-[1120px] mx-auto px-5">
            <div className="text-center mb-12">
              <div className="inline-block px-4 py-1.5 bg-[#2f6fed]/10 rounded-full text-sm font-bold text-[#2f6fed] uppercase tracking-wider mb-3">Step by step</div>
              <h2 className="text-2xl md:text-4xl font-bold text-[#183b56] mb-3">How it works</h2>
              <p className="text-[#6c7a89] max-w-xl mx-auto text-lg">
                Clear steps for both sides – from first contact until the worker arrives.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { num: 1, title: "Create your profile", text: "Sign up as a worker or employer. It takes less than 2 minutes." },
                { num: 2, title: "Upload your documents", text: "Add your passport, CV, and basic information so we can verify you." },
                { num: 3, title: "We match you with opportunities", text: "We review your profile and connect you with suitable jobs or workers." },
                { num: 4, title: "Visa & arrival support", text: "We help with visa documents and stay available after you start working." }
              ].map((step) => (
                <div key={step.num} className="bg-[#f4f6fb] rounded-2xl p-6 border border-[#dde3ec]/80 hover:shadow-lg hover:border-[#2f6fed]/30 transition-all">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] text-white font-bold text-lg flex items-center justify-center mb-4 shadow-md">
                    {step.num}
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
                    <span className="text-[#1dbf73] font-bold text-lg">✓</span>
                    <span>We explain your contract in simple language – salary, working hours, accommodation.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#1dbf73] font-bold text-lg">✓</span>
                    <span>We tell you honestly if an offer looks unrealistic or dangerous.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#1dbf73] font-bold text-lg">✓</span>
                    <span>We support you with documents for work visa step by step.</span>
                  </li>
                </ul>
              </div>
              <div className="bg-gradient-to-br from-[#e8fff2] to-[#f9fffb] rounded-2xl p-8 border border-[#1dbf73]/20">
                <h3 className="font-bold text-[#183b56] mb-4 text-lg">What workers usually ask us</h3>
                <ul className="space-y-3 text-[#1b2430]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#1dbf73]">•</span>
                    <span>Already have an offer but not sure if it's safe or fair</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1dbf73]">•</span>
                    <span>Need help understanding the contract and visa documents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1dbf73]">•</span>
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
                    <span className="text-[#2f6fed] font-bold">✓</span>
                    <span>Workers who understand the job before travelling</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2f6fed] font-bold">✓</span>
                    <span>Correct documents for work visa applications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2f6fed] font-bold">✓</span>
                    <span>Less misunderstandings and early resignations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2f6fed] font-bold">✓</span>
                    <span>Support after arrival to solve issues early</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-block px-4 py-1.5 bg-[#2f6fed]/10 rounded-full text-sm font-bold text-[#2f6fed] mb-4">
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
                    <span className="text-[#6c7a89]">•</span>
                    <span>We help connect legal requirements with worker expectations.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#6c7a89]">•</span>
                    <span>Available in flexible hours when workers can really talk.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#6c7a89]">•</span>
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
            <h2 className="text-2xl md:text-4xl font-bold text-[#183b56] mb-5">
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
                className="px-10 py-4 rounded-full bg-white border-2 border-[#183b56] text-[#183b56] font-bold text-lg hover:bg-[#183b56] hover:text-white transition-all"
              >
                Contact Us
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Cleaner */}
      <footer className="bg-[#183b56] text-white py-10">
        <div className="max-w-[1120px] mx-auto px-5 pb-16">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-[#183b56] px-4 py-2 rounded-full shadow-lg border border-white/10">
          <a href="https://www.facebook.com/profile.php?id=61585104076725" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors" aria-label="Facebook">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6H16.7V4.9c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7v3h2.8v8h3.7z" /></svg>
          </a>
          <a href="https://www.instagram.com/workersunited.eu/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors" aria-label="Instagram">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm9 2h-9A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9A3.5 3.5 0 0 0 20 16.5v-9A3.5 3.5 0 0 0 16.5 4z" /><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.1A2.9 2.9 0 1 0 12 15a2.9 2.9 0 0 0 0-5.9z" /><path d="M17.6 6.3a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" /></svg>
          </a>
          <a href="https://www.linkedin.com/company/workersunited-eu/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M4.5 3.5A2 2 0 1 1 4.5 7.5a2 2 0 0 1 0-4zM3 9h3v12H3V9zm7 0h2.9v1.6h.1c.4-.8 1.6-1.7 3.2-1.7 3.4 0 4 2.2 4 5.1V21h-3v-6.1c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21h-3V9z" /></svg>
          </a>
          <a href="https://x.com/WorkersUnitedEU" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors" aria-label="X">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.7 2H21l-6.7 7.6L22 22h-6.1l-4.8-6.2L5.6 22H3.3l7.2-8.2L2 2h6.2l4.3 5.6L18.7 2zm-1.1 18h1.2L6.3 3.9H5.1L17.6 20z" /></svg>
          </a>
          <a href="https://www.tiktok.com/@www.workersunited.eu" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors" aria-label="TikTok">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M14 2h2.2c.2 1.8 1.2 3.2 3.8 3.6V8c-1.7 0-3.2-.6-4.1-1.4V14c0 4-2.7 6-6 6-2.5 0-4.9-1.7-4.9-4.9 0-3.1 2.4-5 5.4-5 .5 0 1 .1 1.5.2V13c-.4-.2-.9-.3-1.5-.3-1.3 0-2.6.8-2.6 2.4 0 1.5 1.1 2.4 2.5 2.4 1.7 0 2.6-1.1 2.6-3V2z" /></svg>
          </a>
        </div>
      </footer>
    </div>
  );
}
