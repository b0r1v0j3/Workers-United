import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UnifiedNavbar from "@/components/UnifiedNavbar";

export const metadata = {
    title: "Terms and Conditions - Workers United",
    description: "Terms and Conditions for Workers United – The terms under which our services are provided.",
};

export default async function TermsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let profileName = "";
    if (user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
        profileName = profile?.full_name || "";
    }

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            <UnifiedNavbar variant="public" user={user} profileName={profileName} />

            {/* Hero Banner */}
            <div className="bg-gradient-to-br from-[#1877f2] to-[#1e5cd6] py-16">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Terms and Conditions</h1>
                            <p className="text-white/70 text-sm mt-1">Last updated: February 2026</p>
                        </div>
                    </div>
                    <p className="text-white/80 max-w-2xl">
                        Please read these terms carefully. By using Workers United, you agree to be bound by the following terms and conditions.
                    </p>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="space-y-6">
                    <TermsSection icon="🍪" title="Cookies">
                        <p className="text-[#65676b] mb-3">
                            We employ the use of cookies. By accessing <a href="https://workersunited.eu" className="text-[#1877f2] font-semibold hover:underline">workersunited.eu</a> you agreed to use cookies in agreement with Workers United LLC&apos;s Privacy Policy.
                        </p>
                        <p className="text-[#65676b]">
                            Most interactive websites use cookies to let us retrieve the user&apos;s details for each visit. Cookies are used by our website to enable the functionality of certain areas to make it easier for people visiting our website.
                        </p>
                    </TermsSection>

                    <TermsSection icon="📜" title="License">
                        <p className="text-[#65676b] mb-3">
                            Unless otherwise stated, Workers United LLC owns the intellectual property rights for all material on this website. All intellectual property rights are reserved. You may access this for your own personal use subject to restrictions set in these terms.
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                            <p className="text-red-800 font-bold text-sm mb-2">You must not:</p>
                            <ul className="space-y-1 text-red-700 text-sm">
                                <li className="flex items-start gap-2"><span>✕</span>Republish material from this website</li>
                                <li className="flex items-start gap-2"><span>✕</span>Sell, rent, or sub-license material</li>
                                <li className="flex items-start gap-2"><span>✕</span>Reproduce, duplicate, or copy material</li>
                                <li className="flex items-start gap-2"><span>✕</span>Redistribute content from this website</li>
                            </ul>
                        </div>
                        <p className="text-[#65676b] mb-3">
                            You warrant and represent that your comments do not invade any intellectual property right and do not contain any defamatory, libelous, offensive, or unlawful material.
                        </p>
                        <p className="text-[#65676b]">
                            You hereby grant Workers United LLC a non-exclusive license to use, reproduce, edit and authorize others to use any of your comments in any and all forms, formats, or media.
                        </p>
                    </TermsSection>

                    <TermsSection icon="🔗" title="Hyperlinking to our Content">
                        <p className="text-[#65676b] font-medium mb-3">The following organizations may link to our website without prior written approval:</p>
                        <ul className="space-y-2 text-[#65676b] mb-4">
                            {["Government agencies", "Search engines", "News organizations", "Online directory distributors", "Accredited businesses"].map((item, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="text-[#1877f2]">✓</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-[#65676b]">
                            These organizations may link to our home page so long as the link is not deceptive, does not falsely imply sponsorship, and fits within the context of the linking party&apos;s site.
                        </p>
                    </TermsSection>

                    <TermsSection
                        icon="🖼️"
                        title="iFrames"
                        content="Without prior approval and written permission, you may not create frames around our webpages that alter in any way the visual presentation or appearance of our website."
                    />

                    <TermsSection
                        icon="📝"
                        title="Content Liability"
                        content="We shall not be held responsible for any content that appears on your website. You agree to protect and defend us against all claims arising on your website. No links should appear on any website that may be interpreted as libelous, obscene, or criminal."
                    />

                    <TermsSection
                        icon="⚖️"
                        title="Reservation of Rights"
                        content="We reserve the right to request that you remove all links or any particular link to our website. You approve to immediately remove all links to our website upon request. We also reserve the right to amend these terms and conditions at any time."
                    />

                    <TermsSection icon="⚠️" title="Disclaimer">
                        <p className="text-[#65676b] mb-3">To the maximum extent permitted by applicable law, we exclude all representations, warranties and conditions relating to our website. Nothing in this disclaimer will:</p>
                        <ul className="space-y-2 text-[#65676b]">
                            {[
                                "Limit or exclude liability for death or personal injury",
                                "Limit or exclude liability for fraud or misrepresentation",
                                "Limit liabilities in any way not permitted under applicable law",
                                "Exclude liabilities that may not be excluded under applicable law"
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="text-amber-500">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </TermsSection>

                    {/* Contact Card */}
                    <div className="bg-gradient-to-br from-[#1877f2] to-[#1e5cd6] rounded-2xl p-8 text-white">
                        <h3 className="text-xl font-bold mb-2">📬 Questions about our terms?</h3>
                        <p className="text-white/80 mb-4">If there are any questions regarding these terms, you may contact us:</p>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
                            <p className="font-bold text-lg">Workers United LLC</p>
                            <p className="text-white/80">75 E 3rd St., Sheridan, Wyoming 82801, USA</p>
                            <a href="mailto:contact@workersunited.eu" className="text-white font-semibold hover:underline mt-2 inline-block">
                                contact@workersunited.eu →
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-[#1e293b] text-white py-8 px-6">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-400">© 2026 Workers United LLC. All rights reserved.</p>
                    <div className="flex gap-6 text-sm">
                        <Link href="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="text-white font-semibold">Terms & Conditions</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function TermsSection({ icon, title, content, children }: { icon: string; title: string; content?: string; children?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-[#dddfe2] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <span className="text-2xl mt-0.5">{icon}</span>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-[#050505] mb-3">{title}</h2>
                    {content ? <p className="text-[#65676b] leading-relaxed">{content}</p> : children}
                </div>
            </div>
        </div>
    );
}
