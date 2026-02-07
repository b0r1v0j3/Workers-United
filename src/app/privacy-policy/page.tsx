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
                        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
                    </div>
                    <p className="text-white/80 max-w-2xl">
                        Your privacy matters to us. This policy explains how Workers United collects, uses, and protects your personal information.
                    </p>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="space-y-6">

                    <PolicyCard icon="👤" title="What personal information do we collect from the people that visit our blog, website or app?">
                        <p>When contacting us on our site, you may be asked to enter your name, email address, phone number or other details to help you with your experience.</p>
                    </PolicyCard>

                    <PolicyCard icon="📋" title="When do we collect information?">
                        <p>We collect information from you when you fill out a form or enter information on our site.</p>
                    </PolicyCard>

                    <PolicyCard icon="🔧" title="How do we use your information?">
                        <p className="mb-3">We may use the information we collect from you when you register, make a purchase, sign up for our newsletter, respond to a survey or marketing communication, surf the website, or use certain other site features in the following ways:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>To personalize user&apos;s experience and to allow us to deliver the type of content and product offerings in which you are most interested.</li>
                            <li>To improve our website in order to better serve you.</li>
                            <li>To allow us to better service you in responding to your customer service requests.</li>
                            <li>To administer a contest, promotion, survey or other site feature.</li>
                            <li>To send periodic emails regarding your order or other products and services.</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🛡️" title="How do we protect visitor information?">
                        <ul className="list-disc pl-6 space-y-2">
                            <li>We do not use vulnerability scanning and/or scanning to PCI standards.</li>
                            <li>We do not use Malware Scanning.</li>
                            <li>We do not use an SSL certificate.</li>
                            <li>We only provide articles and information on our website. Other than your contact information for the specific purposes of responding to your inquiry, we never ask for personal or private information.</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🍪" title="Do we use cookies?">
                        <p className="mb-3">Yes. Cookies are small files that a site or its service provider transfers to your computer&apos;s hard drive through your Web browser (if you allow) that enables the site&apos;s or service provider&apos;s systems to recognize your browser and capture and remember certain information.</p>
                        <p className="font-medium mb-2">We use cookies to:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Understand and save user&apos;s preferences for future visits.</li>
                            <li>Keep track of advertisements.</li>
                            <li>Compile aggregate data about site traffic and site interactions in order to offer better site experiences and tools in the future.</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="⚙️" title="If users disable cookies in their browser:">
                        <p>If you disable cookies off, some features will be disabled. It will turn off some of the features that make your site experience more efficient and some of our services will not function properly.</p>
                    </PolicyCard>

                    <PolicyCard icon="🚫" title="Third Party Disclosure">
                        <p>We do not sell, trade, or otherwise transfer to outside parties your personally identifiable information unless we provide you with advance notice. This does not include website hosting partners and other parties who assist us in operating our website, conducting our business, or servicing you, so long as those parties agree to keep this information confidential.</p>
                    </PolicyCard>

                    <PolicyCard icon="🔗" title="Third party links">
                        <p>Occasionally, at our discretion, we may include or offer third party products or services on our website. These third party sites have separate and independent privacy policies. We therefore have no responsibility or liability for the content and activities of these linked sites.</p>
                    </PolicyCard>

                    <PolicyCard icon="📊" title="Google">
                        <p>We use Google Analytics on our website.</p>
                    </PolicyCard>

                    <PolicyCard icon="🏛️" title="California Online Privacy Protection Act">
                        <p className="mb-3">CalOPPA is the first state law in the nation to require commercial websites and online services to post a privacy policy.</p>
                        <p className="font-bold mb-2">According to CalOPPA we agree to the following:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Users can visit our site anonymously.</li>
                            <li>Once this privacy policy is created, we will add a link to it on our home page.</li>
                            <li>Our Privacy Policy link includes the word &quot;Privacy&quot;, and can be easily be found on the page specified above.</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="👶" title="COPPA (Children Online Privacy Protection Act)">
                        <p>When it comes to the collection of personal information from children under 13, the Children&apos;s Online Privacy Protection Act (COPPA) puts parents in control. We do not specifically market to children under 13.</p>
                    </PolicyCard>

                    <PolicyCard icon="📧" title="CAN SPAM Act">
                        <p className="mb-3">The CAN-SPAM Act is a law that sets the rules for commercial email, establishes requirements for commercial messages, gives recipients the right to have emails stopped from being sent to them.</p>
                        <p className="font-bold mb-2">To be in accordance with CANSPAM we agree to the following:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>NOT use false, or misleading subjects or email addresses</li>
                            <li>Identify the message as an advertisement in some reasonable way</li>
                            <li>Include the physical address of our business or site headquarters</li>
                            <li>Monitor third party email marketing services for compliance, if one is used</li>
                            <li>Honor opt-out/unsubscribe requests quickly</li>
                            <li>Allow users to unsubscribe by using the link at the bottom of each email</li>
                        </ul>
                    </PolicyCard>

                    {/* Contact Card */}
                    <div className="bg-gradient-to-br from-[#1877f2] to-[#1e5cd6] rounded-2xl p-8 text-white">
                        <h3 className="text-xl font-bold mb-2">📬 Contacting Us</h3>
                        <p className="text-white/80 mb-4">If there are any questions regarding this privacy policy you may contact us using the information below.</p>
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
                    <p className="text-sm text-gray-400">© 2024 Workers United LLC. All rights reserved.</p>
                    <div className="flex gap-6 text-sm">
                        <Link href="/privacy-policy" className="text-white font-semibold">Privacy Policy</Link>
                        <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms & Conditions</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function PolicyCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-[#dddfe2] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <span className="text-2xl mt-0.5">{icon}</span>
                <div className="flex-1 text-[#475569] leading-relaxed">
                    <h2 className="text-lg font-bold text-[#050505] mb-3">{title}</h2>
                    {children}
                </div>
            </div>
        </div>
    );
}
