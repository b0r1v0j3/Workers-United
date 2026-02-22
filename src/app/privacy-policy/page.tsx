import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import {
    Users, FileText, CheckCircle, Eye, Globe, Map, Clock, Sliders, Shield, Cookie, Baby, Laptop, Link as LinkIcon, Edit, Flag
} from 'lucide-react';

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
        <div className="min-h-screen bg-white font-montserrat flex flex-col selection:bg-blue-100">
            <UnifiedNavbar variant="public" user={user} profileName={profileName} />

            {/* Hero Banner - Clean Apple Style */}
            <div className="pt-32 pb-16 px-6 text-center bg-white">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-[#1D1D1F] mb-6">
                        Privacy Policy
                    </h1>
                    <p className="text-[#86868B] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
                        Your privacy is important to us. This policy explains how Workers United collects, uses, stores, and protects your personal data in accordance with the GDPR.
                    </p>
                    <p className="text-[#86868B] text-sm mt-8 pb-8 border-b border-slate-100">
                        Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Content */}
            <main className="flex-grow max-w-3xl mx-auto px-6 py-8 w-full">
                <div className="space-y-12">

                    <PolicySection title="1. Data Controller" icon={Users} colorClass="bg-indigo-50 text-indigo-600">
                        <p className="mb-4">The data controller responsible for your personal data is:</p>
                        <div className="bg-[#F5F5F7] rounded-2xl p-6 mb-2">
                            <p className="font-semibold text-[#1D1D1F] text-lg">Workers United LLC</p>
                            <p className="text-[#424245] mb-1">75 E 3rd St., Sheridan, Wyoming 82801, USA</p>
                            <p className="text-[#424245]">Email: <a href="mailto:contact@workersunited.eu" className="text-[#0066CC] hover:underline">contact@workersunited.eu</a></p>
                        </div>
                        <p className="mt-4">For any privacy-related inquiries or to exercise your rights, please contact us at the email address above.</p>
                    </PolicySection>

                    <PolicySection title="2. What Personal Data We Collect" icon={FileText} colorClass="bg-blue-50 text-blue-600">
                        <p className="mb-6">We collect the following categories of personal data:</p>

                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-[#1D1D1F] text-lg mb-2">Account Information</h3>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#86868B]">
                                    <li>Full name, email address, password (encrypted)</li>
                                    <li>Phone number (WhatsApp)</li>
                                    <li>Account type (worker or employer)</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-semibold text-[#1D1D1F] text-lg mb-2">Worker Profile Data</h3>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#86868B]">
                                    <li>Date of birth, gender, marital status, nationality, citizenship</li>
                                    <li>Country and city of birth</li>
                                    <li>Family information (spouse, children — names and dates of birth)</li>
                                    <li>Father&apos;s and mother&apos;s names, maiden name</li>
                                    <li>Preferred job type, languages spoken, work experience</li>
                                    <li>Passport details (number, issue/expiry dates, issuing authority)</li>
                                    <li>Previous visa history</li>
                                    <li>Digital signature</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-semibold text-[#1D1D1F] text-lg mb-2">Identity Documents</h3>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#86868B]">
                                    <li>Passport scan/photo</li>
                                    <li>Biometric photograph</li>
                                    <li>Diploma or educational certificate</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-semibold text-[#1D1D1F] text-lg mb-2">Employer Profile Data</h3>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#86868B]">
                                    <li>Company name, registration/tax number</li>
                                    <li>Company address, country, industry</li>
                                    <li>Contact person name</li>
                                    <li>Job posting details (positions, salaries, requirements)</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-semibold text-[#1D1D1F] text-lg mb-2">Payment Data</h3>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#86868B]">
                                    <li>Payment transaction records (processed by Stripe — we do not store your card details)</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-semibold text-[#1D1D1F] text-lg mb-2">Contact Form Data</h3>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-[#86868B]">
                                    <li>Name, email, phone number, country, message content</li>
                                </ul>
                            </div>
                        </div>
                    </PolicySection>

                    <PolicySection title="3. Legal Basis for Processing" icon={CheckCircle} colorClass="bg-emerald-50 text-emerald-600">
                        <p className="mb-4">We process your personal data based on the following legal grounds under the GDPR:</p>
                        <ul className="list-disc pl-5 space-y-3 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F]">Consent (Article 6(1)(a)):</strong> When you create an account and explicitly consent to the processing of your personal data. You may withdraw consent at any time.</li>
                            <li><strong className="text-[#1D1D1F]">Contract Performance (Article 6(1)(b)):</strong> Processing necessary to provide our visa facilitation services, including matching workers with employers and processing applications.</li>
                            <li><strong className="text-[#1D1D1F]">Legal Obligation (Article 6(1)(c)):</strong> Retaining payment and transaction records as required by tax and financial regulations.</li>
                            <li><strong className="text-[#1D1D1F]">Legitimate Interest (Article 6(1)(f)):</strong> Improving our platform, preventing fraud, and ensuring security of our services.</li>
                        </ul>
                    </PolicySection>

                    <PolicySection title="4. How We Use Your Data" icon={Eye} colorClass="bg-sky-50 text-sky-600">
                        <p className="mb-4">We use your personal data for the following purposes:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F] font-medium">Account management:</strong> Creating and managing your account, authenticating your identity</li>
                            <li><strong className="text-[#1D1D1F] font-medium">Visa application processing:</strong> Preparing and submitting work visa applications on your behalf</li>
                            <li><strong className="text-[#1D1D1F] font-medium">Document verification:</strong> Using AI (Google Gemini) to verify the authenticity and quality of uploaded documents</li>
                            <li><strong className="text-[#1D1D1F] font-medium">Worker-employer matching:</strong> Matching verified worker profiles with employer job requirements</li>
                            <li><strong className="text-[#1D1D1F] font-medium">Payment processing:</strong> Processing entry fees and placement fees through Stripe</li>
                            <li><strong className="text-[#1D1D1F] font-medium">Communication:</strong> Sending service-related notifications, profile reminders, and responding to inquiries</li>
                            <li><strong className="text-[#1D1D1F] font-medium">Platform improvement:</strong> Analysing usage patterns to improve our services</li>
                        </ul>
                    </PolicySection>

                    <PolicySection title="5. Data Sharing and Third Parties" icon={Globe} colorClass="bg-violet-50 text-violet-600">
                        <p className="mb-4">We share your personal data with the following categories of recipients:</p>
                        <ul className="list-disc pl-5 space-y-3 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F]">Supabase (database &amp; storage):</strong> Stores your account data, profile information, and uploaded documents. Servers located in the EU.</li>
                            <li><strong className="text-[#1D1D1F]">Stripe (payment processing):</strong> Processes your payments securely. Stripe is certified under the EU-US Data Privacy Framework.</li>
                            <li><strong className="text-[#1D1D1F]">Google / Gemini AI (document verification):</strong> Your uploaded documents are processed by Google&apos;s AI to verify authenticity. Google is certified under the EU-US Data Privacy Framework.</li>
                            <li><strong className="text-[#1D1D1F]">Google Workspace (email):</strong> Used to send and receive emails. Google is certified under the EU-US Data Privacy Framework.</li>
                            <li><strong className="text-[#1D1D1F]">Vercel (hosting):</strong> Hosts our website. Vercel complies with GDPR requirements.</li>
                            <li><strong className="text-[#1D1D1F]">European employers:</strong> Your profile data is shared with matched employers <strong className="text-[#1D1D1F]">only after you have been matched and the visa process has been initiated</strong>. We will never share your data with employers without your knowledge.</li>
                        </ul>
                        <p className="mt-6 font-semibold text-[#1D1D1F]">We do not sell, rent, or trade your personal data to any third party.</p>
                    </PolicySection>

                    <PolicySection title="6. International Data Transfers" icon={Map} colorClass="bg-emerald-50 text-emerald-600">
                        <p>Some of our service providers (Stripe, Google, Vercel) are based in the United States. These transfers are protected by appropriate safeguards including the EU-US Data Privacy Framework and Standard Contractual Clauses (SCCs) as required by GDPR. Your data is treated with the same level of protection regardless of where it is processed.</p>
                    </PolicySection>

                    <PolicySection title="7. Data Retention" icon={Clock} colorClass="bg-amber-50 text-amber-600">
                        <p className="mb-4">We retain your personal data for the following periods:</p>
                        <ul className="list-disc pl-5 space-y-3 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F]">Active accounts:</strong> Data is retained for as long as your account is active and you maintain a relationship with us.</li>
                            <li><strong className="text-[#1D1D1F]">Deleted accounts:</strong> When you delete your account, all personal data including uploaded documents is permanently deleted within 30 days.</li>
                            <li><strong className="text-[#1D1D1F]">Payment records:</strong> Transaction records are retained for 7 years to comply with tax and financial reporting obligations.</li>
                            <li><strong className="text-[#1D1D1F]">Contact form messages:</strong> Retained for 12 months after the inquiry is resolved, then deleted.</li>
                        </ul>
                    </PolicySection>

                    <PolicySection title="8. Your Rights Under GDPR" icon={Sliders} colorClass="bg-purple-50 text-purple-600">
                        <p className="mb-4">Under the GDPR, you have the following rights regarding your personal data:</p>
                        <ul className="list-disc pl-5 space-y-3 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F]">Right of Access (Article 15):</strong> You can request a copy of all personal data we hold about you.</li>
                            <li><strong className="text-[#1D1D1F]">Right to Rectification (Article 16):</strong> You can correct inaccurate or incomplete personal data through your profile settings.</li>
                            <li><strong className="text-[#1D1D1F]">Right to Erasure (Article 17):</strong> You can delete your account and all associated data at any time through your account settings.</li>
                            <li><strong className="text-[#1D1D1F]">Right to Data Portability (Article 20):</strong> You can download all your personal data in a machine-readable format (JSON) from your account settings.</li>
                            <li><strong className="text-[#1D1D1F]">Right to Restrict Processing (Article 18):</strong> You can request that we limit how we process your data in certain circumstances.</li>
                            <li><strong className="text-[#1D1D1F]">Right to Object (Article 21):</strong> You can object to the processing of your data based on legitimate interest.</li>
                            <li><strong className="text-[#1D1D1F]">Right to Withdraw Consent:</strong> You can withdraw your consent at any time by deleting your account. This does not affect the lawfulness of processing before withdrawal.</li>
                        </ul>
                        <p className="mt-6">To exercise any of these rights, please contact us at <a href="mailto:contact@workersunited.eu" className="text-[#0066CC] hover:underline">contact@workersunited.eu</a> or use the self-service options in your account settings.</p>
                    </PolicySection>

                    <PolicySection title="9. Data Security" icon={Shield} colorClass="bg-slate-100 text-slate-600">
                        <p className="mb-4">We take the security of your personal data seriously and implement appropriate technical and organisational measures, including:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li>All data transmitted between your browser and our servers is encrypted using TLS/SSL (HTTPS)</li>
                            <li>Passwords are securely hashed and never stored in plain text</li>
                            <li>Documents are stored in encrypted cloud storage with access controls</li>
                            <li>Administrative access is restricted and monitored</li>
                            <li>Regular security reviews of our infrastructure and code</li>
                        </ul>
                    </PolicySection>

                    <PolicySection title="10. Cookies" icon={Cookie} colorClass="bg-orange-50 text-orange-600">
                        <p className="mb-4">We use only <strong className="text-[#1D1D1F]">essential cookies</strong> that are strictly necessary for the functioning of our website:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F] font-medium">Authentication cookies:</strong> Used to keep you logged in and maintain your session (set by Supabase Auth)</li>
                            <li><strong className="text-[#1D1D1F] font-medium">Cookie consent:</strong> Remembers whether you have acknowledged this cookie notice</li>
                        </ul>
                        <p className="mt-6">We do <strong className="text-[#1D1D1F]">not</strong> use tracking cookies, advertising cookies, or any third-party analytics cookies. Since we only use essential cookies, consent is not required under GDPR, but we inform you of their use for transparency.</p>
                    </PolicySection>

                    <PolicySection title="11. Children's Privacy" icon={Baby} colorClass="bg-blue-50 text-blue-600">
                        <p>Our services are not intended for individuals under the age of 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us immediately and we will take steps to delete it.</p>
                    </PolicySection>

                    <PolicySection title="12. Non-Personal Information" icon={Laptop} colorClass="bg-slate-100 text-slate-600">
                        <p className="mb-4">When you visit our website, we may automatically collect certain non-personal information from your browser, such as your browser type, operating system, and referring website. This information cannot identify you personally.</p>
                        <p>Non-personal information may be used to analyse trends, administer the site, and gather broad demographic information for aggregate use. This data is never linked to any personal information.</p>
                    </PolicySection>

                    <PolicySection title="13. Links to Other Sites" icon={LinkIcon} colorClass="bg-indigo-50 text-indigo-600">
                        <p>Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of these external sites. We encourage you to read the privacy policy of any website you visit. This Privacy Policy applies only to information collected by Workers United through our Platform.</p>
                    </PolicySection>

                    <PolicySection title="14. Changes to This Policy" icon={Edit} colorClass="bg-sky-50 text-sky-600">
                        <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by email or through a notice on the Platform. The &quot;Last updated&quot; date at the top of this policy indicates when it was last revised. We encourage you to review this policy periodically.</p>
                    </PolicySection>

                    <PolicySection title="15. Right to Lodge a Complaint" icon={Flag} colorClass="bg-red-50 text-red-600">
                        <p className="mb-4">If you believe we have not handled your personal data properly, you have the right to lodge a complaint with a data protection supervisory authority. You may contact the supervisory authority in the EU member state where you reside, work, or where the alleged infringement occurred.</p>
                        <p>You can also contact us directly at <a href="mailto:contact@workersunited.eu" className="text-[#0066CC] hover:underline">contact@workersunited.eu</a> and we will do our best to resolve your concern.</p>
                    </PolicySection>

                    {/* Contact Section */}
                    <div className="pt-12 pb-8 border-t border-slate-100 mt-16">
                        <h2 className="text-2xl font-bold text-[#1D1D1F] mb-4 tracking-tight">Contact Us</h2>
                        <p className="text-[#424245] mb-6 text-lg">If you have any questions about this Privacy Policy or wish to exercise your data protection rights, please contact us:</p>
                        <div className="bg-[#F5F5F7] rounded-3xl p-8">
                            <p className="font-semibold text-[#1D1D1F] text-xl mb-2">Workers United LLC</p>
                            <p className="text-[#424245] mb-6 text-lg">75 E 3rd St., Sheridan, Wyoming 82801, USA</p>
                            <a href="mailto:contact@workersunited.eu" className="inline-flex items-center gap-2 text-[#0066CC] font-medium text-lg hover:underline">
                                <span>contact@workersunited.eu</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer - Same as Homepage */}
            <footer className="text-white py-5 mt-10 w-full relative z-10" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)' }}>
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
                                <span className="text-white font-semibold">Privacy Policy</span>
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

function PolicySection({ title, icon: Icon, colorClass, children }: { title: string; icon: any; colorClass: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col md:flex-row gap-4 md:gap-6">
            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass}`}>
                <Icon className="w-6 h-6" strokeWidth={2} />
            </div>
            <div className="flex-1 text-[#424245] text-lg leading-relaxed pt-1">
                <h2 className="text-2xl font-bold text-[#1D1D1F] mb-3 tracking-tight">{title}</h2>
                {children}
            </div>
        </section>
    );
}
