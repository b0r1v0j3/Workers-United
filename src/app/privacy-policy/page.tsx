import Link from "next/link";
import Image from "next/image";

export const metadata = {
    title: "Privacy Policy - Workers United",
    description: "Privacy Policy for Workers United – How we collect, use, and protect your personal information.",
};

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-[#f8fbff] font-montserrat">
            {/* Header */}
            <header className="fixed top-0 w-full z-50 bg-[#f8fbff]/80 backdrop-blur-md px-6 py-4 lg:px-12 flex justify-between items-center">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 bg-[#1e293b] rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
                        <Image src="/logo.png" alt="Logo" width={20} height={20} className="brightness-0 invert" />
                    </div>
                    <span className="font-bold text-[#1e293b] text-xl tracking-tight">Workers United</span>
                </Link>
                <Link
                    href="/login"
                    className="bg-white text-[#1e293b] border border-[#e2e8f0] px-6 py-2 rounded-full font-bold text-sm shadow-sm hover:bg-gray-50 transition-all"
                >
                    Sign In
                </Link>
            </header>

            {/* Content */}
            <main className="pt-28 pb-20 px-6 lg:px-12">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-bold text-[#1e293b] mb-8">Privacy Policy</h1>

                    <div className="prose prose-lg max-w-none text-[#475569]">
                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">What personal information do we collect from the people that visit our blog, website or app?</h2>
                            <p>When contacting us on our site, you may be asked to enter your name, email address, phone number or other details to help you with your experience.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">When do we collect information?</h2>
                            <p>We collect information from you when you fill out a form or enter information on our site.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">How do we use your information?</h2>
                            <p>We may use the information we collect from you when you register, make a purchase, sign up for our newsletter, respond to a survey or marketing communication, surf the website, or use certain other site features in the following ways:</p>
                            <ul className="list-disc pl-6 mt-4 space-y-2">
                                <li>To personalize user&apos;s experience and to allow us to deliver the type of content and product offerings in which you are most interested.</li>
                                <li>To improve our website in order to better serve you.</li>
                                <li>To allow us to better service you in responding to your customer service requests.</li>
                                <li>To administer a contest, promotion, survey or other site feature.</li>
                                <li>To send periodic emails regarding your order or other products and services.</li>
                            </ul>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">How do we protect visitor information?</h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>We do not use vulnerability scanning and/or scanning to PCI standards.</li>
                                <li>We do not use Malware Scanning.</li>
                                <li>We do not use an SSL certificate.</li>
                                <li>We only provide articles and information on our website. Other than your contact information for the specific purposes of responding to your inquiry, we never ask for personal or private information.</li>
                            </ul>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Do we use cookies?</h2>
                            <p>Yes. Cookies are small files that a site or its service provider transfers to your computer&apos;s hard drive through your Web browser (if you allow) that enables the site&apos;s or service provider&apos;s systems to recognize your browser and capture and remember certain information.</p>
                            <p className="mt-4">We use cookies to:</p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Understand and save user&apos;s preferences for future visits.</li>
                                <li>Keep track of advertisements.</li>
                                <li>Compile aggregate data about site traffic and site interactions in order to offer better site experiences and tools in the future.</li>
                            </ul>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">If users disable cookies in their browser:</h2>
                            <p>If you disable cookies off, some features will be disabled. It will turn off some of the features that make your site experience more efficient and some of our services will not function properly.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Third Party Disclosure</h2>
                            <p>We do not sell, trade, or otherwise transfer to outside parties your personally identifiable information unless we provide you with advance notice. This does not include website hosting partners and other parties who assist us in operating our website, conducting our business, or servicing you, so long as those parties agree to keep this information confidential.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Third party links</h2>
                            <p>Occasionally, at our discretion, we may include or offer third party products or services on our website. These third party sites have separate and independent privacy policies. We therefore have no responsibility or liability for the content and activities of these linked sites.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Google</h2>
                            <p>We use Google Analytics on our website.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">California Online Privacy Protection Act</h2>
                            <p>CalOPPA is the first state law in the nation to require commercial websites and online services to post a privacy policy.</p>
                            <h3 className="text-xl font-bold text-[#1e293b] mt-4 mb-2">According to CalOPPA we agree to the following:</h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Users can visit our site anonymously.</li>
                                <li>Once this privacy policy is created, we will add a link to it on our home page.</li>
                                <li>Our Privacy Policy link includes the word &quot;Privacy&quot;, and can be easily be found on the page specified above.</li>
                            </ul>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">COPPA (Children Online Privacy Protection Act)</h2>
                            <p>When it comes to the collection of personal information from children under 13, the Children&apos;s Online Privacy Protection Act (COPPA) puts parents in control. We do not specifically market to children under 13.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">CAN SPAM Act</h2>
                            <p>The CAN-SPAM Act is a law that sets the rules for commercial email, establishes requirements for commercial messages, gives recipients the right to have emails stopped from being sent to them.</p>
                            <h3 className="text-xl font-bold text-[#1e293b] mt-4 mb-2">To be in accordance with CANSPAM we agree to the following:</h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>NOT use false, or misleading subjects or email addresses</li>
                                <li>Identify the message as an advertisement in some reasonable way</li>
                                <li>Include the physical address of our business or site headquarters</li>
                                <li>Monitor third party email marketing services for compliance, if one is used</li>
                                <li>Honor opt-out/unsubscribe requests quickly</li>
                                <li>Allow users to unsubscribe by using the link at the bottom of each email</li>
                            </ul>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Contacting Us</h2>
                            <p>If there are any questions regarding this privacy policy you may contact us using the information below.</p>
                            <div className="mt-4 p-6 bg-white rounded-xl border border-[#e2e8f0]">
                                <p className="font-bold text-[#1e293b]">Workers United LLC</p>
                                <p>75 E 3rd St., Sheridan, Wyoming 82801, USA</p>
                                <p className="mt-2">
                                    <a href="mailto:contact@workersunited.eu" className="text-[#2f6fed] hover:underline">contact@workersunited.eu</a>
                                </p>
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-[#1e293b] text-white py-8 px-6 lg:px-12">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-400">© 2024 Workers United LLC. All rights reserved.</p>
                    <div className="flex gap-6 text-sm">
                        <Link href="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms & Conditions</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
