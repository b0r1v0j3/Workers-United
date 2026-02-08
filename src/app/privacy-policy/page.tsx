import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UnifiedNavbar from "@/components/UnifiedNavbar";

export const metadata = {
    title: "Privacy Policy - Workers United",
    description: "Privacy Policy for Workers United – How we collect, use, and protect your personal data in compliance with GDPR.",
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
                        Your privacy is important to us. This policy explains how Workers United collects, uses, stores, and protects your personal data in accordance with the General Data Protection Regulation (GDPR).
                    </p>
                    <p className="text-white/60 text-sm mt-3">Last updated: 8 February 2026</p>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="space-y-6">

                    <PolicyCard icon="🏢" title="1. Data Controller">
                        <p className="mb-3">The data controller responsible for your personal data is:</p>
                        <div className="bg-[#f0f2f5] rounded-xl p-4">
                            <p className="font-bold text-[#050505]">Workers United LLC</p>
                            <p>75 E 3rd St., Sheridan, Wyoming 82801, USA</p>
                            <p>Email: <a href="mailto:contact@workersunited.eu" className="text-[#1877f2] font-semibold hover:underline">contact@workersunited.eu</a></p>
                        </div>
                        <p className="mt-3">For any privacy-related inquiries or to exercise your rights, please contact us at the email address above.</p>
                    </PolicyCard>

                    <PolicyCard icon="📋" title="2. What Personal Data We Collect">
                        <p className="mb-3">We collect the following categories of personal data:</p>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2">Account Information</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Full name, email address, password (encrypted)</li>
                            <li>Phone number (WhatsApp)</li>
                            <li>Account type (worker or employer)</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2">Worker Profile Data</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Date of birth, gender, marital status, nationality, citizenship</li>
                            <li>Country and city of birth</li>
                            <li>Family information (spouse, children — names and dates of birth)</li>
                            <li>Father&apos;s and mother&apos;s names, maiden name</li>
                            <li>Preferred job type, languages spoken, work experience</li>
                            <li>Passport details (number, issue/expiry dates, issuing authority)</li>
                            <li>Previous visa history</li>
                            <li>Digital signature</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2">Identity Documents</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Passport scan/photo</li>
                            <li>Biometric photograph</li>
                            <li>Diploma or educational certificate</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2">Employer Profile Data</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Company name, registration/tax number</li>
                            <li>Company address, country, industry</li>
                            <li>Contact person name</li>
                            <li>Job posting details (positions, salaries, requirements)</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2">Payment Data</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Payment transaction records (processed by Stripe — we do not store your card details)</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2">Contact Form Data</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Name, email, phone number, country, message content</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="⚖️" title="3. Legal Basis for Processing">
                        <p className="mb-3">We process your personal data based on the following legal grounds under the GDPR:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Consent (Article 6(1)(a)):</strong> When you create an account and explicitly consent to the processing of your personal data. You may withdraw consent at any time.</li>
                            <li><strong>Contract Performance (Article 6(1)(b)):</strong> Processing necessary to provide our visa facilitation services, including matching workers with employers and processing applications.</li>
                            <li><strong>Legal Obligation (Article 6(1)(c)):</strong> Retaining payment and transaction records as required by tax and financial regulations.</li>
                            <li><strong>Legitimate Interest (Article 6(1)(f)):</strong> Improving our platform, preventing fraud, and ensuring security of our services.</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🔧" title="4. How We Use Your Data">
                        <p className="mb-3">We use your personal data for the following purposes:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Account management:</strong> Creating and managing your account, authenticating your identity</li>
                            <li><strong>Visa application processing:</strong> Preparing and submitting work visa applications on your behalf</li>
                            <li><strong>Document verification:</strong> Using AI (Google Gemini) to verify the authenticity and quality of uploaded documents</li>
                            <li><strong>Worker-employer matching:</strong> Matching verified worker profiles with employer job requirements</li>
                            <li><strong>Payment processing:</strong> Processing entry fees and placement fees through Stripe</li>
                            <li><strong>Communication:</strong> Sending service-related notifications, profile reminders, and responding to inquiries</li>
                            <li><strong>Platform improvement:</strong> Analysing usage patterns to improve our services</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🤝" title="5. Data Sharing and Third Parties">
                        <p className="mb-3">We share your personal data with the following categories of recipients:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Supabase (database &amp; storage):</strong> Stores your account data, profile information, and uploaded documents. Servers located in the EU.</li>
                            <li><strong>Stripe (payment processing):</strong> Processes your payments securely. Stripe is certified under the EU-US Data Privacy Framework.</li>
                            <li><strong>Google / Gemini AI (document verification):</strong> Your uploaded documents are processed by Google&apos;s AI to verify authenticity. Google is certified under the EU-US Data Privacy Framework.</li>
                            <li><strong>Google Workspace (email):</strong> Used to send and receive emails. Google is certified under the EU-US Data Privacy Framework.</li>
                            <li><strong>Vercel (hosting):</strong> Hosts our website. Vercel complies with GDPR requirements.</li>
                            <li><strong>European employers:</strong> Your profile data is shared with matched employers <strong>only after you have been matched and the visa process has been initiated</strong>. We will never share your data with employers without your knowledge.</li>
                        </ul>
                        <p className="mt-3 font-semibold text-[#050505]">We do not sell, rent, or trade your personal data to any third party.</p>
                    </PolicyCard>

                    <PolicyCard icon="🌍" title="6. International Data Transfers">
                        <p>Some of our service providers (Stripe, Google, Vercel) are based in the United States. These transfers are protected by appropriate safeguards including the EU-US Data Privacy Framework and Standard Contractual Clauses (SCCs) as required by GDPR. Your data is treated with the same level of protection regardless of where it is processed.</p>
                    </PolicyCard>

                    <PolicyCard icon="🗄️" title="7. Data Retention">
                        <p className="mb-3">We retain your personal data for the following periods:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Active accounts:</strong> Data is retained for as long as your account is active and you maintain a relationship with us.</li>
                            <li><strong>Deleted accounts:</strong> When you delete your account, all personal data including uploaded documents is permanently deleted within 30 days.</li>
                            <li><strong>Payment records:</strong> Transaction records are retained for 7 years to comply with tax and financial reporting obligations.</li>
                            <li><strong>Contact form messages:</strong> Retained for 12 months after the inquiry is resolved, then deleted.</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🛡️" title="8. Your Rights Under GDPR">
                        <p className="mb-3">Under the GDPR, you have the following rights regarding your personal data:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Right of Access (Article 15):</strong> You can request a copy of all personal data we hold about you.</li>
                            <li><strong>Right to Rectification (Article 16):</strong> You can correct inaccurate or incomplete personal data through your profile settings.</li>
                            <li><strong>Right to Erasure (Article 17):</strong> You can delete your account and all associated data at any time through your account settings.</li>
                            <li><strong>Right to Data Portability (Article 20):</strong> You can download all your personal data in a machine-readable format (JSON) from your account settings.</li>
                            <li><strong>Right to Restrict Processing (Article 18):</strong> You can request that we limit how we process your data in certain circumstances.</li>
                            <li><strong>Right to Object (Article 21):</strong> You can object to the processing of your data based on legitimate interest.</li>
                            <li><strong>Right to Withdraw Consent:</strong> You can withdraw your consent at any time by deleting your account. This does not affect the lawfulness of processing before withdrawal.</li>
                        </ul>
                        <p className="mt-3">To exercise any of these rights, please contact us at <a href="mailto:contact@workersunited.eu" className="text-[#1877f2] font-semibold hover:underline">contact@workersunited.eu</a> or use the self-service options in your account settings.</p>
                    </PolicyCard>

                    <PolicyCard icon="🔒" title="9. Data Security">
                        <p className="mb-3">We take the security of your personal data seriously and implement appropriate technical and organisational measures, including:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>All data transmitted between your browser and our servers is encrypted using TLS/SSL (HTTPS)</li>
                            <li>Passwords are securely hashed and never stored in plain text</li>
                            <li>Documents are stored in encrypted cloud storage with access controls</li>
                            <li>Administrative access is restricted and monitored</li>
                            <li>Regular security reviews of our infrastructure and code</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🍪" title="10. Cookies">
                        <p className="mb-3">We use only <strong>essential cookies</strong> that are strictly necessary for the functioning of our website:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Authentication cookies:</strong> Used to keep you logged in and maintain your session (set by Supabase Auth)</li>
                            <li><strong>Cookie consent:</strong> Remembers whether you have acknowledged this cookie notice</li>
                        </ul>
                        <p className="mt-3">We do <strong>not</strong> use tracking cookies, advertising cookies, or any third-party analytics cookies. Since we only use essential cookies, consent is not required under GDPR, but we inform you of their use for transparency.</p>
                    </PolicyCard>

                    <PolicyCard icon="👶" title="11. Children&apos;s Privacy">
                        <p>Our services are not intended for individuals under the age of 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us immediately and we will take steps to delete it.</p>
                    </PolicyCard>

                    <PolicyCard icon="📊" title="12. Non-Personal Information">
                        <p className="mb-3">When you visit our website, we may automatically collect certain non-personal information from your browser, such as your browser type, operating system, and referring website. This information cannot identify you personally.</p>
                        <p>Non-personal information may be used to analyse trends, administer the site, and gather broad demographic information for aggregate use. This data is never linked to any personal information.</p>
                    </PolicyCard>

                    <PolicyCard icon="🔗" title="13. Links to Other Sites">
                        <p>Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of these external sites. We encourage you to read the privacy policy of any website you visit. This Privacy Policy applies only to information collected by Workers United through our Platform.</p>
                    </PolicyCard>

                    <PolicyCard icon="📝" title="14. Changes to This Policy">
                        <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by email or through a notice on our website. The &quot;Last updated&quot; date at the top of this policy indicates when it was last revised. We encourage you to review this policy periodically.</p>
                    </PolicyCard>

                    <PolicyCard icon="🏛️" title="15. Right to Lodge a Complaint">
                        <p className="mb-3">If you believe we have not handled your personal data properly, you have the right to lodge a complaint with a data protection supervisory authority. You may contact the supervisory authority in the EU member state where you reside, work, or where the alleged infringement occurred.</p>
                        <p>You can also contact us directly at <a href="mailto:contact@workersunited.eu" className="text-[#1877f2] font-semibold hover:underline">contact@workersunited.eu</a> and we will do our best to resolve your concern.</p>
                    </PolicyCard>

                    {/* Contact Card */}
                    <div className="bg-gradient-to-br from-[#1877f2] to-[#1e5cd6] rounded-2xl p-8 text-white">
                        <h3 className="text-xl font-bold mb-2">📬 Contact Us</h3>
                        <p className="text-white/80 mb-4">If you have any questions about this Privacy Policy or wish to exercise your data protection rights, please contact us:</p>
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
                        <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms &amp; Conditions</Link>
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
