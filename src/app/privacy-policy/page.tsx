import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UnifiedNavbar from "@/components/UnifiedNavbar";

export const metadata = {
    title: "Privacy Policy - Workers United",
    description: "Privacy Policy for Workers United – How we collect, use, and protect your personal information.",
};

export default async function PrivacyPolicyPage() {
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
                            <p className="text-white/70 text-sm mt-1">Last updated: February 2026</p>
                        </div>
                    </div>
                    <p className="text-white/80 max-w-2xl">
                        Your privacy matters to us. This policy explains how Workers United collects, uses, and protects your personal information.
                    </p>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="space-y-6">
                    <PolicySection
                        icon="👤"
                        title="What personal information do we collect?"
                        content="When contacting us on our site, you may be asked to enter your name, email address, phone number or other details to help you with your experience."
                    />

                    <PolicySection
                        icon="📋"
                        title="When do we collect information?"
                        content="We collect information from you when you fill out a form or enter information on our site."
                    />

                    <PolicySection icon="🔧" title="How do we use your information?">
                        <p className="text-[#65676b] mb-3">We may use the information we collect from you in the following ways:</p>
                        <ul className="space-y-2">
                            {[
                                "To personalize your experience and deliver content you're interested in",
                                "To improve our website in order to better serve you",
                                "To better service your customer requests",
                                "To administer contests, promotions, or surveys",
                                "To send periodic emails regarding your services"
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-[#65676b]">
                                    <span className="text-[#1877f2] mt-1">✓</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </PolicySection>

                    <PolicySection icon="🛡️" title="How do we protect visitor information?">
                        <ul className="space-y-2 text-[#65676b]">
                            <li className="flex items-start gap-3"><span className="text-[#1877f2]">•</span>We use SSL encryption for all data transfers</li>
                            <li className="flex items-start gap-3"><span className="text-[#1877f2]">•</span>Your data is stored securely and never shared without consent</li>
                            <li className="flex items-start gap-3"><span className="text-[#1877f2]">•</span>We only collect information necessary for our services</li>
                        </ul>
                    </PolicySection>

                    <PolicySection icon="🍪" title="Do we use cookies?">
                        <p className="text-[#65676b] mb-3">
                            Yes. Cookies are small files that a site transfers to your computer&apos;s hard drive through your web browser that enables us to recognize your browser and remember certain information.
                        </p>
                        <p className="text-[#65676b] font-medium mb-2">We use cookies to:</p>
                        <ul className="space-y-2 text-[#65676b]">
                            <li className="flex items-start gap-3"><span className="text-[#1877f2]">✓</span>Save your preferences for future visits</li>
                            <li className="flex items-start gap-3"><span className="text-[#1877f2]">✓</span>Keep track of analytics</li>
                            <li className="flex items-start gap-3"><span className="text-[#1877f2]">✓</span>Offer better site experiences and tools</li>
                        </ul>
                    </PolicySection>

                    <PolicySection
                        icon="🚫"
                        title="Third Party Disclosure"
                        content="We do not sell, trade, or otherwise transfer to outside parties your personally identifiable information unless we provide you with advance notice. This does not include website hosting partners and other parties who assist us in operating our website, conducting our business, or servicing you, so long as those parties agree to keep this information confidential."
                    />

                    <PolicySection
                        icon="🔗"
                        title="Third Party Links"
                        content="Occasionally, at our discretion, we may include or offer third party products or services on our website. These third party sites have separate and independent privacy policies. We therefore have no responsibility or liability for the content and activities of these linked sites."
                    />

                    <PolicySection
                        icon="👶"
                        title="Children's Privacy (COPPA)"
                        content="When it comes to the collection of personal information from children under 13, the Children's Online Privacy Protection Act (COPPA) puts parents in control. We do not specifically market to children under 13."
                    />

                    {/* Contact Card */}
                    <div className="bg-gradient-to-br from-[#1877f2] to-[#1e5cd6] rounded-2xl p-8 text-white">
                        <h3 className="text-xl font-bold mb-2">📬 Questions about our privacy policy?</h3>
                        <p className="text-white/80 mb-4">If there are any questions regarding this privacy policy, you may contact us:</p>
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
                        <Link href="/privacy-policy" className="text-white font-semibold">Privacy Policy</Link>
                        <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms & Conditions</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function PolicySection({ icon, title, content, children }: { icon: string; title: string; content?: string; children?: React.ReactNode }) {
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
