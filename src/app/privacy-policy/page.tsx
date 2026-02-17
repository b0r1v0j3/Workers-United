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
        <div className="min-h-screen bg-[#F8FAFC] font-montserrat flex flex-col">
            <UnifiedNavbar variant="public" user={user} profileName={profileName} />

            {/* Hero Banner - Premium Gradient */}
            <div className="relative overflow-hidden py-24 text-white" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #2563EB 100%)' }}>
                {/* Decorative Elements */}
                <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-white/5 rounded-full blur-[80px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-black/10 rounded-full blur-[80px]" />

                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center justify-center p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl mb-6">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4 drop-shadow-md">Privacy Policy</h1>
                    <p className="text-blue-100/90 text-lg max-w-2xl mx-auto leading-relaxed">
                        Your privacy is important to us. This policy explains how Workers United collects, uses, stores, and protects your personal data in accordance with the General Data Protection Regulation (GDPR).
                    </p>
                </div>
            </div>

            {/* Content */}
            <main className="flex-grow max-w-4xl mx-auto px-6 py-12 -mt-10 relative z-20">
                <div className="space-y-6">

                    <PolicyCard icon="🏢" title="1. Data Controller">
                        <p className="mb-3">The data controller responsible for your personal data is:</p>
                        <div className="bg-[#f0f2f5] rounded-xl p-6 border border-slate-200">
                            <p className="font-bold text-[#050505] text-lg">Workers United LLC</p>
                            <p className="text-slate-600 mb-1">75 E 3rd St., Sheridan, Wyoming 82801, USA</p>
                            <p className="text-slate-600">Email: <a href="mailto:contact@workersunited.eu" className="text-blue-600 font-semibold hover:underline">contact@workersunited.eu</a></p>
                        </div>
                        <p className="mt-3">For any privacy-related inquiries or to exercise your rights, please contact us at the email address above.</p>
                    </PolicyCard>

                    <PolicyCard icon="📋" title="2. What Personal Data We Collect">
                        <p className="mb-3">We collect the following categories of personal data:</p>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2 text-lg">Account Information</h3>
                        <ul className="list-disc pl-6 space-y-1 marker:text-blue-500">
                            <li>Full name, email address, password (encrypted)</li>
                            <li>Phone number (WhatsApp)</li>
                            <li>Account type (worker or employer)</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2 text-lg">Worker Profile Data</h3>
                        <ul className="list-disc pl-6 space-y-1 marker:text-blue-500">
                            <li>Date of birth, gender, marital status, nationality, citizenship</li>
                            <li>Country and city of birth</li>
                            <li>Family information (spouse, children — names and dates of birth)</li>
                            <li>Father&apos;s and mother&apos;s names, maiden name</li>
                            <li>Preferred job type, languages spoken, work experience</li>
                            <li>Passport details (number, issue/expiry dates, issuing authority)</li>
                            <li>Previous visa history</li>
                            <li>Digital signature</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2 text-lg">Identity Documents</h3>
                        <ul className="list-disc pl-6 space-y-1 marker:text-blue-500">
                            <li>Passport scan/photo</li>
                            <li>Biometric photograph</li>
                            <li>Diploma or educational certificate</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2 text-lg">Employer Profile Data</h3>
                        <ul className="list-disc pl-6 space-y-1 marker:text-blue-500">
                            <li>Company name, registration/tax number</li>
                            <li>Company address, country, industry</li>
                            <li>Contact person name</li>
                            <li>Job posting details (positions, salaries, requirements)</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2 text-lg">Payment Data</h3>
                        <ul className="list-disc pl-6 space-y-1 marker:text-blue-500">
                            <li>Payment transaction records (processed by Stripe — we do not store your card details)</li>
                        </ul>

                        <h3 className="font-bold text-[#050505] mt-4 mb-2 text-lg">Contact Form Data</h3>
                        <ul className="list-disc pl-6 space-y-1 marker:text-blue-500">
                            <li>Name, email, phone number, country, message content</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="⚖️" title="3. Legal Basis for Processing">
                        <p className="mb-3">We process your personal data based on the following legal grounds under the GDPR:</p>
                        <ul className="list-disc pl-6 space-y-2 marker:text-blue-500">
                            <li><strong>Consent (Article 6(1)(a)):</strong> When you create an account and explicitly consent to the processing of your personal data. You may withdraw consent at any time.</li>
                            <li><strong>Contract Performance (Article 6(1)(b)):</strong> Processing necessary to provide our visa facilitation services, including matching workers with employers and processing applications.</li>
                            <li><strong>Legal Obligation (Article 6(1)(c)):</strong> Retaining payment and transaction records as required by tax and financial regulations.</li>
                            <li><strong>Legitimate Interest (Article 6(1)(f)):</strong> Improving our platform, preventing fraud, and ensuring security of our services.</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🔧" title="4. How We Use Your Data">
                        <p className="mb-3">We use your personal data for the following purposes:</p>
                        <ul className="list-disc pl-6 space-y-2 marker:text-blue-500">
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
                        <ul className="list-disc pl-6 space-y-2 marker:text-blue-500">
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
                        <ul className="list-disc pl-6 space-y-2 marker:text-blue-500">
                            <li><strong>Active accounts:</strong> Data is retained for as long as your account is active and you maintain a relationship with us.</li>
                            <li><strong>Deleted accounts:</strong> When you delete your account, all personal data including uploaded documents is permanently deleted within 30 days.</li>
                            <li><strong>Payment records:</strong> Transaction records are retained for 7 years to comply with tax and financial reporting obligations.</li>
                            <li><strong>Contact form messages:</strong> Retained for 12 months after the inquiry is resolved, then deleted.</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🛡️" title="8. Your Rights Under GDPR">
                        <p className="mb-3">Under the GDPR, you have the following rights regarding your personal data:</p>
                        <ul className="list-disc pl-6 space-y-2 marker:text-blue-500">
                            <li><strong>Right of Access (Article 15):</strong> You can request a copy of all personal data we hold about you.</li>
                            <li><strong>Right to Rectification (Article 16):</strong> You can correct inaccurate or incomplete personal data through your profile settings.</li>
                            <li><strong>Right to Erasure (Article 17):</strong> You can delete your account and all associated data at any time through your account settings.</li>
                            <li><strong>Right to Data Portability (Article 20):</strong> You can download all your personal data in a machine-readable format (JSON) from your account settings.</li>
                            <li><strong>Right to Restrict Processing (Article 18):</strong> You can request that we limit how we process your data in certain circumstances.</li>
                            <li><strong>Right to Object (Article 21):</strong> You can object to the processing of your data based on legitimate interest.</li>
                            <li><strong>Right to Withdraw Consent:</strong> You can withdraw your consent at any time by deleting your account. This does not affect the lawfulness of processing before withdrawal.</li>
                        </ul>
                        <p className="mt-3">To exercise any of these rights, please contact us at <a href="mailto:contact@workersunited.eu" className="text-blue-600 font-semibold hover:underline">contact@workersunited.eu</a> or use the self-service options in your account settings.</p>
                    </PolicyCard>

                    <PolicyCard icon="🔒" title="9. Data Security">
                        <p className="mb-3">We take the security of your personal data seriously and implement appropriate technical and organisational measures, including:</p>
                        <ul className="list-disc pl-6 space-y-2 marker:text-blue-500">
                            <li>All data transmitted between your browser and our servers is encrypted using TLS/SSL (HTTPS)</li>
                            <li>Passwords are securely hashed and never stored in plain text</li>
                            <li>Documents are stored in encrypted cloud storage with access controls</li>
                            <li>Administrative access is restricted and monitored</li>
                            <li>Regular security reviews of our infrastructure and code</li>
                        </ul>
                    </PolicyCard>

                    <PolicyCard icon="🍪" title="10. Cookies">
                        <p className="mb-3">We use only <strong>essential cookies</strong> that are strictly necessary for the functioning of our website:</p>
                        <ul className="list-disc pl-6 space-y-2 marker:text-blue-500">
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
                        <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by email or through a notice on the Platform. The &quot;Last updated&quot; date at the top of this policy indicates when it was last revised. We encourage you to review this policy periodically.</p>
                    </PolicyCard>

                    <PolicyCard icon="🏛️" title="15. Right to Lodge a Complaint">
                        <p className="mb-3">If you believe we have not handled your personal data properly, you have the right to lodge a complaint with a data protection supervisory authority. You may contact the supervisory authority in the EU member state where you reside, work, or where the alleged infringement occurred.</p>
                        <p>You can also contact us directly at <a href="mailto:contact@workersunited.eu" className="text-blue-600 font-semibold hover:underline">contact@workersunited.eu</a> and we will do our best to resolve your concern.</p>
                    </PolicyCard>

                    {/* Contact Card */}
                    <div className="bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] rounded-2xl p-8 text-white shadow-xl shadow-blue-900/10">
                        <h3 className="text-xl font-bold mb-2">📬 Contact Us</h3>
                        <p className="text-blue-100/80 mb-6">If you have any questions about this Privacy Policy or wish to exercise your data protection rights, please contact us:</p>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-6">
                            <p className="font-bold text-lg mb-1">Workers United LLC</p>
                            <p className="text-blue-100/70 mb-3">75 E 3rd St., Sheridan, Wyoming 82801, USA</p>
                            <a href="mailto:contact@workersunited.eu" className="flex items-center gap-2 text-white font-semibold hover:text-blue-200 transition-colors">
                                <span>contact@workersunited.eu</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer - Consistent with Homepage */}
            <footer className="text-white py-10 mt-auto" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)' }}>
                <div className="max-w-[1120px] mx-auto px-5 pb-4 md:pb-16">
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
                                <Link href="/privacy-policy" className="text-white font-semibold shadow-sm border-b border-white/30 pb-0.5">Privacy Policy</Link>
                                <Link href="/terms" className="text-gray-300 hover:text-white transition-colors">Terms and Conditions</Link>
                            </div>
                            <a href="mailto:contact@workersunited.eu" className="text-gray-300 hover:text-white transition-colors text-sm">
                                contact@workersunited.eu
                            </a>
                        </div>
                    </div>
                </div>

                {/* Social Links */}
                <div className="flex justify-center gap-2 sm:gap-3 py-4 flex-wrap">
                    <a href="https://www.facebook.com/profile.php?id=61585104076725" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="Facebook">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6H16.7V4.9c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7v3h2.8v8h3.7z" /></svg>
                    </a>
                    <a href="https://www.instagram.com/workersunited.eu/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="Instagram">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm9 2h-9A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9A3.5 3.5 0 0 0 20 16.5v-9A3.5 3.5 0 0 0 16.5 4z" /><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.1A2.9 2.9 0 1 0 12 15a2.9 2.9 0 0 0 0-5.9z" /><path d="M17.6 6.3a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" /></svg>
                    </a>
                    <a href="https://www.threads.com/@workersunited.eu" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="Threads">
                        <img src="/threads-logo.svg" alt="Threads" className="w-5 h-5 invert" />
                    </a>
                    <a href="https://www.reddit.com/r/WorkersUnitedEU/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-full bg-white/10 hover:bg-white/20" aria-label="Reddit">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.498 1.199-.498a1.7 1.7 0 0 1 1.698 1.698c0 .648-.37 1.2-.91 1.48.024.19.039.38.039.57 0 2.899-3.376 5.253-7.544 5.253-4.168 0-7.544-2.354-7.544-5.253 0-.19.014-.38.04-.57a1.7 1.7 0 0 1-.91-1.48 1.7 1.7 0 0 1 1.698-1.698c.47 0 .891.19 1.198.498 1.195-.856 2.85-1.417 4.674-1.488l.8-3.747 2.597.547a1.25 1.25 0 0 1 1.136-.739zM8.5 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6.74 4.26c-.19.19-.19.51 0 .7 1.07 1.07 3.41 1.16 3.24 1.16s2.17-.09 3.24-1.16a.49.49 0 0 0 0-.7.49.49 0 0 0-.7 0c-.67.68-2.06.93-2.54.93s-1.87-.25-2.54-.93a.49.49 0 0 0-.7 0z" /></svg>
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
    );
}

function PolicyCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-blue-100 p-8 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.1)] transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-start gap-5">
                <span className="text-3xl mt-0.5 filter drop-shadow-sm">{icon}</span>
                <div className="flex-1 text-[#475569] leading-relaxed">
                    <h2 className="text-lg font-bold text-[#0F172A] mb-3">{title}</h2>
                    <div className="text-[15px]">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
