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
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Workers United logo" width={36} height={36} className="rounded" />
            <span className="font-bold text-lg text-[#183b56]">Workers United</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#6c7a89]">
            <Link href="#how-it-works" className="hover:text-[#183b56] transition-colors">How it works</Link>
            <Link href="#workers" className="hover:text-[#183b56] transition-colors">For workers</Link>
            <Link href="#employers" className="hover:text-[#183b56] transition-colors">For employers</Link>
            {user ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] text-white font-semibold shadow-lg shadow-blue-500/40"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] text-white font-semibold shadow-lg shadow-blue-500/40"
              >
                Log In
              </Link>
            )}
          </nav>
          {/* Mobile menu button - would need client component for toggle */}
          <button className="md:hidden p-2" aria-label="Menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-10 md:py-16">
          <div className="max-w-[1120px] mx-auto px-5">
            <div className="grid md:grid-cols-[1.15fr_0.9fr] gap-8 md:gap-10 items-center">
              {/* Left - Main Card */}
              <div className="bg-gradient-to-br from-[#e4ebff] to-[#f9fbff] rounded-[32px] p-8 md:p-10 shadow-lg border border-[#dde3ec]/90">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/60 rounded-full text-sm text-[#2f6fed] font-medium mb-6 border border-[#2f6fed]/20">
                  <span className="w-2 h-2 bg-[#1dbf73] rounded-full animate-pulse"></span>
                  Safe, legal and personalised support
                </div>
                <h1 className="text-3xl md:text-[38px] font-bold text-[#183b56] leading-tight tracking-tight mb-4">
                  International hiring made simple&nbsp;&amp; legal.
                </h1>
                <p className="text-[#6c7a89] text-lg mb-6 max-w-lg">
                  Workers United connects serious employers with reliable workers worldwide and guides both sides through
                  the full work visa process – without fake promises or hidden conditions.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link
                    href="#workers"
                    className="px-6 py-3 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] text-white font-semibold shadow-lg shadow-blue-500/50 text-center hover:translate-y-[-2px] transition-transform"
                  >
                    For workers
                  </Link>
                  <Link
                    href="#employers"
                    className="px-6 py-3 rounded-full bg-white border border-[#dde3ec] text-[#183b56] font-semibold shadow-sm text-center hover:bg-gray-50 transition-colors"
                  >
                    For employers
                  </Link>
                </div>
                <p className="text-sm text-[#6c7a89]">
                  <strong className="text-[#183b56]">If you have any questions</strong>, please feel free to contact us by phone or email. A member of our team will reply personally.
                </p>
              </div>

              {/* Right - Info Cards */}
              <div className="space-y-5">
                <div className="bg-white rounded-2xl p-6 shadow-md border border-[#dde3ec]/80">
                  <h3 className="font-bold text-[#183b56] mb-4">What you can expect</h3>
                  <ul className="space-y-3 text-sm text-[#1b2430]">
                    <li className="flex items-start gap-3">
                      <span className="text-[#1dbf73] font-bold">✓</span>
                      <span>We carefully explain contracts so you know what you are really signing.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#1dbf73] font-bold">✓</span>
                      <span>We support the full work visa process – not only finding a job.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#1dbf73] font-bold">✓</span>
                      <span>We work only with employers who are ready to follow the law and treat workers fairly.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-md border border-[#dde3ec]/80">
                  <div className="inline-block px-3 py-1 bg-[#f4f6fb] rounded-full text-xs font-semibold text-[#2f6fed] mb-3">
                    Trusted cooperation
                  </div>
                  <p className="text-sm text-[#1b2430]">
                    <strong>We talk to people, not only collect documents.</strong><br />
                    Every worker and employer has direct contact with a real person from our team, before and after arrival.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-16 md:py-20">
          <div className="max-w-[1120px] mx-auto px-5">
            <div className="text-center mb-12">
              <div className="text-sm font-semibold text-[#2f6fed] uppercase tracking-wider mb-2">Step by step</div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#183b56] mb-3">How Workers United process looks</h2>
              <p className="text-[#6c7a89] max-w-xl mx-auto">
                Clear steps for both sides – from first contact until the worker arrives and starts working.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { num: 1, title: "You contact us", text: "Worker or employer sends us a message with basic information. We reply personally – not with automatic messages." },
                { num: 2, title: "We understand your situation", text: "We ask specific questions about the job, salary, accommodation and family situation, to see if everything is realistic and legal." },
                { num: 3, title: "Documents & visa support", text: "We help prepare invitations, contracts and other paperwork for work visa. We also explain what every document means so there are no surprises." },
                { num: 4, title: "Arrival & follow-up", text: "After arrival we remain available to both worker and employer, to solve problems early and keep cooperation stable." }
              ].map((step) => (
                <div key={step.num} className="bg-white rounded-2xl p-6 shadow-md border border-[#dde3ec]/80">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#2f6fed] to-[#1c4dd6] text-white font-bold flex items-center justify-center mb-4">
                    {step.num}
                  </div>
                  <h3 className="font-bold text-[#183b56] mb-2">{step.title}</h3>
                  <p className="text-sm text-[#6c7a89]">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For Workers */}
        <section id="workers" className="py-16 md:py-20 bg-white">
          <div className="max-w-[1120px] mx-auto px-5">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-block px-4 py-1.5 bg-[#f4f6fb] rounded-full text-sm font-semibold text-[#2f6fed] mb-4">
                  For workers
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-[#183b56] mb-4">
                  For workers who want a real chance, not empty promises
                </h2>
                <p className="text-[#6c7a89] mb-6">
                  Many people hear big promises and nice stories, and then the reality is completely different. Our goal is to help you understand what you are signing and what you can really expect when you arrive.
                </p>
                <ul className="space-y-3 text-[#1b2430]">
                  <li className="flex items-start gap-3">
                    <span className="text-[#1dbf73] font-bold">✓</span>
                    <span>We explain your contract and conditions in simple language – salary, working hours, days off, accommodation.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#1dbf73] font-bold">✓</span>
                    <span>We tell you honestly if an offer looks unrealistic or dangerous, even if that means we do not continue the process.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#1dbf73] font-bold">✓</span>
                    <span>We support you with documents for work visa and give clear instructions step by step.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#1dbf73] font-bold">✓</span>
                    <span>You can always ask questions before and after arrival – by call, message or email.</span>
                  </li>
                </ul>
              </div>
              <div className="bg-[#f4f6fb] rounded-2xl p-8 border border-[#dde3ec]/80">
                <h3 className="font-bold text-[#183b56] mb-3">What workers usually ask us</h3>
                <p className="text-sm text-[#6c7a89] mb-4">We most often help workers who:</p>
                <ul className="space-y-2 text-sm text-[#1b2430] mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-[#6c7a89]">•</span>
                    <span>already have an offer but are not sure if it is safe or fair;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6c7a89]">•</span>
                    <span>need help to understand what is written in the contract and visa documents;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6c7a89]">•</span>
                    <span>want someone neutral to check both the employer and the agent before they decide.</span>
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-[#6c7a89] border border-[#dde3ec]">Simple explanations</span>
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-[#6c7a89] border border-[#dde3ec]">Real expectations</span>
                  <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-[#6c7a89] border border-[#dde3ec]">Support before &amp; after</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* For Employers */}
        <section id="employers" className="py-16 md:py-20">
          <div className="max-w-[1120px] mx-auto px-5">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="bg-white rounded-2xl p-8 shadow-md border border-[#dde3ec]/80 order-2 md:order-1">
                <h3 className="font-bold text-[#183b56] mb-3">What serious employers get from us</h3>
                <p className="text-sm text-[#6c7a89] mb-4">
                  We help employers who are ready to respect the law and treat workers fairly – but do not have time or experience to manage the full process alone.
                </p>
                <ul className="space-y-2 text-sm text-[#1b2430] mb-6">
                  <li className="flex items-start gap-2">
                    <span className="text-[#1dbf73] font-bold">✓</span>
                    <span>We speak honestly with workers so they clearly understand pay, duties and life conditions before travelling.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1dbf73] font-bold">✓</span>
                    <span>We help prepare correct invitations, contracts and other documents for work visa applications.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1dbf73] font-bold">✓</span>
                    <span>We reduce misunderstandings and early resignations by aligning expectations on both sides.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1dbf73] font-bold">✓</span>
                    <span>We stay available after arrival to help solve small issues before they become big problems.</span>
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-[#f4f6fb] rounded-full text-xs font-medium text-[#6c7a89] border border-[#dde3ec]">Less risk</span>
                  <span className="px-3 py-1 bg-[#f4f6fb] rounded-full text-xs font-medium text-[#6c7a89] border border-[#dde3ec]">Clear communication</span>
                  <span className="px-3 py-1 bg-[#f4f6fb] rounded-full text-xs font-medium text-[#6c7a89] border border-[#dde3ec]">Stable cooperation</span>
                </div>
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-block px-4 py-1.5 bg-[#f4f6fb] rounded-full text-sm font-semibold text-[#2f6fed] mb-4">
                  For employers
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-[#183b56] mb-4">
                  For employers who want stability, not only &quot;cheap labour&quot;
                </h2>
                <p className="text-[#6c7a89] mb-6">
                  Workers United is not a mass online portal. We focus on realistic offers, transparent communication and long-term cooperation, so you do not have to constantly replace staff.
                </p>
                <ul className="space-y-3 text-[#1b2430]">
                  <li className="flex items-start gap-3">
                    <span className="text-[#6c7a89]">•</span>
                    <span>We speak both &quot;workers language&quot; and &quot;legal language&quot; and help connect them.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#6c7a89]">•</span>
                    <span>We are available in flexible hours, including evenings and weekends when workers can really talk.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-[#6c7a89]">•</span>
                    <span>We build cooperation step by step – starting from a few positions and growing together.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-[1120px] mx-auto px-5">
            <div className="text-center mb-12">
              <div className="text-sm font-semibold text-[#2f6fed] uppercase tracking-wider mb-2">Why choose us</div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#183b56] mb-3">What makes Workers United different</h2>
              <p className="text-[#6c7a89] max-w-xl mx-auto">
                We do not promise &quot;magic solutions&quot;. We focus on honest information, realistic expectations and stable cooperation.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { title: "Real humans, not just online forms", text: "Workers and employers can speak directly with a person who understands both sides – not with a chatbot or anonymous email address." },
                { title: "Safety before speed", text: "It is better to say \"no\" to a bad offer than to send people into problems. We prefer safe and legal processes, even if they are slower." },
                { title: "Clear communication", text: "We explain every important detail: salary, overtime, accommodation, travel costs, paperwork – so everyone knows what to expect." }
              ].map((item, i) => (
                <div key={i} className="bg-[#f4f6fb] rounded-2xl p-6 border border-[#dde3ec]/80">
                  <h3 className="font-bold text-[#183b56] mb-3">{item.title}</h3>
                  <p className="text-sm text-[#6c7a89]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 md:py-20">
          <div className="max-w-[1120px] mx-auto px-5">
            <div className="text-center mb-12">
              <div className="text-sm font-semibold text-[#2f6fed] uppercase tracking-wider mb-2">Questions &amp; answers</div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#183b56] mb-3">Frequently asked questions</h2>
              <p className="text-[#6c7a89] max-w-xl mx-auto">
                If you are not sure, send us a message – it is better to ask now than to regret later.
              </p>
            </div>
            <div className="max-w-3xl mx-auto space-y-4">
              {[
                { q: "Do you charge workers hidden fees?", a: "We are against hidden fees and \"surprise payments\". Before we start any process, we explain clearly if there are any costs and who pays what – worker, employer or both." },
                { q: "Which countries do you work with?", a: "Our focus is on employers in Europe and workers from different regions who want legal work and long-term cooperation. If your country is not sure, write to us and we will tell you honestly if we can help or not." },
                { q: "Do I need to speak English?", a: "Basic communication is always helpful, but we understand that not everyone speaks perfect English. You may send messages in your local language, and we will do our best to understand and respond clearly." },
                { q: "Are you a classic agency or more like an advisor?", a: "We help connect workers and employers, but also act as advisors – especially around documents, contracts and expectations. In practice, our role is to protect both sides from misunderstandings and unsafe situations." }
              ].map((faq, i) => (
                <details key={i} className="bg-white rounded-2xl border border-[#dde3ec]/80 overflow-hidden group">
                  <summary className="px-6 py-4 cursor-pointer font-semibold text-[#183b56] flex items-center justify-between hover:bg-[#f4f6fb]/50 transition-colors">
                    {faq.q}
                    <span className="text-[#2f6fed] text-xl group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <div className="px-6 pb-4 text-sm text-[#6c7a89]">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Get Started CTA */}
        <section id="contact" className="py-16 md:py-20 bg-white">
          <div className="max-w-[1120px] mx-auto px-5">
            <div className="bg-gradient-to-br from-[#183b56] to-[#2f6fed] rounded-3xl p-10 md:p-16 text-center text-white relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
              </div>

              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Ready to start your journey?
                </h2>
                <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
                  Create your free account, complete your profile, and let us find the right job for you.
                  90-day money-back guarantee if we don&apos;t find a match.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                  <Link
                    href="/signup"
                    className="px-8 py-4 rounded-full bg-white text-[#183b56] font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    Create Free Account
                  </Link>
                  <Link
                    href="/login"
                    className="px-8 py-4 rounded-full bg-transparent border-2 border-white/50 text-white font-semibold hover:bg-white/10 transition-all"
                  >
                    Already have an account? Log In
                  </Link>
                </div>

                <div className="flex flex-wrap justify-center gap-6 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> No hidden fees
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> 90-day guarantee
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Real visa support
                  </div>
                </div>
              </div>
            </div>

            {/* Contact info below CTA */}
            <div className="mt-10 text-center">
              <p className="text-[#6c7a89] mb-2">Questions? Contact us directly:</p>
              <a href="mailto:contact@workersunited.eu" className="text-[#2f6fed] font-semibold hover:underline">
                contact@workersunited.eu
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#183b56] text-white py-10">
        <div className="max-w-[1120px] mx-auto px-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <div className="text-sm text-gray-300 mb-2">© {new Date().getFullYear()} Workers United. All rights reserved.</div>
              <div className="text-sm text-gray-400">
                <strong>Workers United LLC</strong> · 75 E 3rd St., Sheridan, Wyoming 82801, USA
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end gap-3">
              <div className="flex gap-4 text-sm">
                <Link href="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="text-gray-300 hover:text-white transition-colors">Terms and Conditions</Link>
              </div>
              <a href="mailto:contact@workersunited.eu" className="text-gray-300 hover:text-white transition-colors text-sm">
                contact@workersunited.eu
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-gray-400">
            Safe • Legal • Transparent
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
