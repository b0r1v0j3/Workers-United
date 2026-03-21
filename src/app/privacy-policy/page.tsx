import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PLATFORM_SUPPORT_EMAIL } from "@/lib/platform-contact";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import Footer from "@/components/Footer";
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
                        Last updated: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
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
                            <p className="text-[#424245]">Email: <a href={`mailto:${DEFAULT_PLATFORM_SUPPORT_EMAIL}`} className="text-[#0066CC] hover:underline">{DEFAULT_PLATFORM_SUPPORT_EMAIL}</a></p>
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
                                    <li>Final school, university, or formal vocational diploma</li>
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
                            <li><strong className="text-[#1D1D1F] font-medium">Payment processing:</strong> Processing Job Finder service charges and placement fees through Stripe</li>
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
                        <p className="mt-6">To exercise any of these rights, please contact us at <a href={`mailto:${DEFAULT_PLATFORM_SUPPORT_EMAIL}`} className="text-[#0066CC] hover:underline">{DEFAULT_PLATFORM_SUPPORT_EMAIL}</a> or use the self-service options in your account settings.</p>
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
                        <p>You can also contact us directly at <a href={`mailto:${DEFAULT_PLATFORM_SUPPORT_EMAIL}`} className="text-[#0066CC] hover:underline">{DEFAULT_PLATFORM_SUPPORT_EMAIL}</a> and we will do our best to resolve your concern.</p>
                    </PolicySection>

                    {/* Contact Section */}
                    <div className="pt-12 pb-8 border-t border-slate-100 mt-16">
                        <h2 className="text-2xl font-bold text-[#1D1D1F] mb-4 tracking-tight">Contact Us</h2>
                        <p className="text-[#424245] mb-6 text-lg">If you have any questions about this Privacy Policy or wish to exercise your data protection rights, please contact us:</p>
                        <div className="bg-[#F5F5F7] rounded-3xl p-8">
                            <p className="font-semibold text-[#1D1D1F] text-xl mb-2">Workers United LLC</p>
                            <p className="text-[#424245] mb-6 text-lg">75 E 3rd St., Sheridan, Wyoming 82801, USA</p>
                            <a href={`mailto:${DEFAULT_PLATFORM_SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 text-[#0066CC] font-medium text-lg hover:underline">
                                <span>{DEFAULT_PLATFORM_SUPPORT_EMAIL}</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
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
