import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PLATFORM_SUPPORT_EMAIL, DEFAULT_PLATFORM_WEBSITE_URL } from "@/lib/platform-contact";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import Footer from "@/components/Footer";
import {
    FileText, Info, User, DollarSign, Fingerprint, ShieldCheck, Cookie, Copyright, Ban, AlertCircle, Shield, Link as LinkIcon, RefreshCcw, AlertTriangle, UserX, Scale, RefreshCw
} from 'lucide-react';

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
        <div className="min-h-screen bg-white font-montserrat flex flex-col selection:bg-blue-100">
            <UnifiedNavbar variant="public" user={user} profileName={profileName} />

            {/* Hero Banner - Clean Apple Style */}
            <div className="pt-32 pb-16 px-6 text-center bg-white">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-[#1D1D1F] mb-6">
                        Terms and Conditions
                    </h1>
                    <p className="text-[#86868B] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
                        Please read these terms carefully. By using Workers United, you agree to be bound by the following terms and conditions.
                    </p>
                    <p className="text-[#86868B] text-sm mt-8 pb-8 border-b border-slate-100">
                        Last updated: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Content */}
            <main className="flex-grow max-w-3xl mx-auto px-6 py-8 w-full">
                <div className="space-y-12">

                    <TermsSection title="1. Agreement to Terms" icon={FileText} colorClass="bg-blue-50 text-blue-600">
                        <p className="mb-4">By accessing or using <a href={DEFAULT_PLATFORM_WEBSITE_URL} className="text-[#0066CC] hover:underline">{DEFAULT_PLATFORM_WEBSITE_URL}</a> (&quot;the Platform&quot;), you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the Platform.</p>
                        <p>These Terms apply to all users of the Platform, including workers, employers, and visitors.</p>
                    </TermsSection>

                    <TermsSection title="2. About Workers United" icon={Info} colorClass="bg-slate-100 text-slate-600">
                        <p className="mb-4">Workers United LLC (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides a visa facilitation service that connects international workers with European employers. We handle the complete process including documentation, visa application, and placement.</p>
                        <p className="font-semibold text-[#1D1D1F] mb-2">Key points:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li>We are <strong className="text-[#1D1D1F]">not</strong> a job board — we provide a full-service visa and placement solution</li>
                            <li>Workers and employers do not interact directly until the visa is approved</li>
                            <li>Our services for employers are free of charge</li>
                            <li>We do not guarantee employment outcomes, but we do offer a 90-day refund on the entry fee if no match is found</li>
                        </ul>
                    </TermsSection>

                    <TermsSection title="3. User Accounts" icon={User} colorClass="bg-indigo-50 text-indigo-600">
                        <p className="font-semibold text-[#1D1D1F] mb-2">By creating an account, you agree that:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li>You are at least 18 years of age</li>
                            <li>All information you provide is accurate, truthful, and complete</li>
                            <li>You will keep your account credentials secure and not share them</li>
                            <li>You are responsible for all activity under your account</li>
                            <li>You have consented to the processing of your personal data as described in our <Link href="/privacy-policy" className="text-[#0066CC] hover:underline">Privacy Policy</Link></li>
                        </ul>
                        <p className="mt-4">We reserve the right to suspend or terminate accounts that violate these Terms or provide false information.</p>
                    </TermsSection>

                    <TermsSection title="4. Fees and Payments" icon={DollarSign} colorClass="bg-emerald-50 text-emerald-600">
                        <p className="font-semibold text-[#1D1D1F] mb-2">The following fees apply:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F]">Entry fee:</strong> $9 USD — paid by the worker to enter the matching queue</li>
                            <li><strong className="text-[#1D1D1F]">Placement fee:</strong> Varies by country — paid by the worker only when a position is matched. The exact amount will be displayed before payment.</li>
                            <li><strong className="text-[#1D1D1F]">Employer fees:</strong> None — our services are free for employers</li>
                        </ul>
                        <p className="mt-4"><strong className="text-[#1D1D1F]">Refund policy:</strong> If a worker is not matched with an employer within 90 days of paying the entry fee, the $9 entry fee will be refunded in full. Placement fees are non-refundable once the visa process has begun.</p>
                        <p className="mt-2 text-[#86868B]">All payments are processed securely by Stripe. We do not store your payment card details.</p>
                    </TermsSection>

                    <TermsSection title="5. Documents and Verification" icon={Fingerprint} colorClass="bg-violet-50 text-violet-600">
                        <p className="mb-4">Workers are required to upload certain documents (passport, biometric photo, diploma) for identity verification and visa processing.</p>
                        <p className="font-semibold text-[#1D1D1F] mb-2">By uploading documents, you confirm that:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li>The documents are genuine and belong to you</li>
                            <li>You authorise us to use AI-powered verification to check document authenticity</li>
                            <li>You consent to sharing these documents with relevant authorities as part of the visa application process</li>
                            <li>Providing fraudulent documents will result in immediate account termination</li>
                        </ul>
                    </TermsSection>

                    <TermsSection title="6. Data Protection and GDPR" icon={ShieldCheck} colorClass="bg-sky-50 text-sky-600">
                        <p className="mb-4">We are committed to protecting your personal data in accordance with the General Data Protection Regulation (GDPR) and other applicable data protection laws.</p>
                        <p className="font-semibold text-[#1D1D1F] mb-2">Your rights include:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F]">Right of access:</strong> Request a copy of your personal data</li>
                            <li><strong className="text-[#1D1D1F]">Right to rectification:</strong> Correct inaccurate data via your profile settings</li>
                            <li><strong className="text-[#1D1D1F]">Right to erasure:</strong> Delete your account and all associated data through your account settings</li>
                            <li><strong className="text-[#1D1D1F]">Right to data portability:</strong> Download your data in a machine-readable format</li>
                            <li><strong className="text-[#1D1D1F]">Right to withdraw consent:</strong> Withdraw consent at any time without affecting prior processing</li>
                        </ul>
                        <p className="mt-4">For full details on how we process your data, please read our <Link href="/privacy-policy" className="text-[#0066CC] hover:underline">Privacy Policy</Link>.</p>
                    </TermsSection>

                    <TermsSection title="7. Cookies" icon={Cookie} colorClass="bg-amber-50 text-amber-600">
                        <p>We use only essential cookies required for authentication and site functionality. We do not use tracking or advertising cookies. For more information, see our <Link href="/privacy-policy" className="text-[#0066CC] hover:underline">Privacy Policy</Link>.</p>
                    </TermsSection>

                    <TermsSection title="8. Intellectual Property" icon={Copyright} colorClass="bg-rose-50 text-rose-600">
                        <p className="mb-4">All content on the Platform, including text, graphics, logos, and software, is the property of Workers United LLC and is protected by intellectual property laws.</p>
                        <p className="font-semibold text-[#1D1D1F] mb-2">You must not:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li>Reproduce, duplicate, or copy material from the Platform</li>
                            <li>Sell, rent, or sub-license material from the Platform</li>
                            <li>Redistribute content from the Platform without prior written permission</li>
                        </ul>
                    </TermsSection>

                    <TermsSection title="9. Prohibited Activities" icon={Ban} colorClass="bg-red-50 text-red-600">
                        <p className="font-semibold text-[#1D1D1F] mb-2">You agree not to:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li>Provide false, misleading, or fraudulent information</li>
                            <li>Upload forged or tampered documents</li>
                            <li>Use the Platform for any illegal purpose</li>
                            <li>Attempt to access other users&apos; accounts or data</li>
                            <li>Interfere with the security or functionality of the Platform</li>
                            <li>Create multiple accounts for the same person</li>
                        </ul>
                    </TermsSection>

                    <TermsSection title="10. Disclaimers and Warranties" icon={AlertCircle} colorClass="bg-orange-50 text-orange-600">
                        <p className="mb-4 uppercase font-bold text-[#1D1D1F] text-xs leading-relaxed tracking-wide">
                            THE PLATFORM AND ALL MATERIALS, INFORMATION, PRODUCTS AND SERVICES AVAILABLE THROUGH THE PLATFORM ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMISSIBLE PURSUANT TO APPLICABLE LAW, WORKERS UNITED LLC DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
                        </p>
                        <p className="mb-4 uppercase font-bold text-[#1D1D1F] text-xs leading-relaxed tracking-wide">
                            WE DO NOT WARRANT THAT THE PLATFORM OR ANY OF ITS FUNCTIONS WILL BE UNINTERRUPTED OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT THE PLATFORM OR THE SERVERS THAT MAKE IT AVAILABLE ARE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
                        </p>
                        <p className="uppercase font-bold text-[#1D1D1F] text-xs leading-relaxed tracking-wide">
                            WE DO NOT WARRANT OR MAKE ANY REPRESENTATIONS REGARDING THE USE OR THE RESULTS OF THE USE OF THE PLATFORM IN TERMS OF CORRECTNESS, ACCURACY, TIMELINESS, RELIABILITY OR OTHERWISE. WE DO NOT GUARANTEE THAT A WORKER WILL BE MATCHED WITH AN EMPLOYER OR THAT A VISA APPLICATION WILL BE APPROVED. VISA DECISIONS ARE MADE SOLELY BY IMMIGRATION AUTHORITIES AND ARE OUTSIDE OUR CONTROL.
                        </p>
                    </TermsSection>

                    <TermsSection title="11. Indemnification" icon={Shield} colorClass="bg-slate-100 text-slate-600">
                        <p>You agree to defend, indemnify and hold harmless Workers United LLC, its affiliates, officers, directors, employees, agents, successors and assigns from and against any and all claims, damages, liabilities, costs and expenses (including reasonable legal fees) arising out of or related to: (a) your use of the Platform; (b) your breach of these Terms; (c) any information or documents you have provided to us; or (d) your violation of any law or the rights of any third party.</p>
                    </TermsSection>

                    <TermsSection title="12. Third-Party Links" icon={LinkIcon} colorClass="bg-blue-50 text-blue-600">
                        <p>The Platform may contain links to third-party websites or services that are not owned or controlled by Workers United. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services. You acknowledge and agree that Workers United shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of any such content, goods, or services available on or through any such websites or services.</p>
                    </TermsSection>

                    <TermsSection title="13. Refund Policy" icon={RefreshCcw} colorClass="bg-emerald-50 text-emerald-600">
                        <p className="mb-4">Our refund policy is as follows:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-[#86868B]">
                            <li><strong className="text-[#1D1D1F]">Entry fee ($9 USD):</strong> Fully refundable if a worker is not matched with an employer within 90 days of payment.</li>
                            <li><strong className="text-[#1D1D1F]">Placement fee:</strong> Non-refundable once the visa application process has been initiated, as costs are incurred for document preparation and government fees.</li>
                        </ul>
                        <p className="mt-4">Refund requests should be directed to <a href={`mailto:${DEFAULT_PLATFORM_SUPPORT_EMAIL}`} className="text-[#0066CC] hover:underline">{DEFAULT_PLATFORM_SUPPORT_EMAIL}</a>. Approved refunds will be processed within 10 business days to the original payment method.</p>
                    </TermsSection>

                    <TermsSection title="14. Limitation of Liability" icon={AlertTriangle} colorClass="bg-red-50 text-red-600">
                        <p className="mb-4 uppercase font-bold text-[#1D1D1F] text-xs leading-relaxed tracking-wide">
                            UNDER NO CIRCUMSTANCES, INCLUDING BUT NOT LIMITED TO NEGLIGENCE, SHALL WORKERS UNITED LLC, ITS AFFILIATES, OR ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR EXEMPLARY DAMAGES THAT RESULT FROM THE USE OF, OR THE INABILITY TO USE, THE PLATFORM OR OUR SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                        </p>
                        <p className="mb-4">Our total liability shall not exceed the amount paid by you for our services.</p>
                        <p>Nothing in these Terms excludes or limits our liability for death or personal injury caused by negligence, fraud, or any liability that cannot be excluded or limited by applicable law. For users in the European Union, nothing in these Terms affects your statutory rights as a consumer.</p>
                    </TermsSection>

                    <TermsSection title="15. Termination" icon={UserX} colorClass="bg-rose-50 text-rose-600">
                        <p className="mb-4">We may suspend or terminate your access to the Platform at any time, without prior notice, for conduct that we believe violates these Terms, is harmful to other users, or is otherwise objectionable.</p>
                        <p>Upon termination, your right to use the Platform will immediately cease. The disclaimers, limitations of liability, indemnification, and other provisions of these Terms that by their nature should survive shall survive termination.</p>
                    </TermsSection>

                    <TermsSection title="16. Governing Law and Disputes" icon={Scale} colorClass="bg-indigo-50 text-indigo-600">
                        <p className="mb-4">These Terms are governed by and construed in accordance with the laws of the State of Wyoming, USA, without regard to its conflict of law provisions. Any dispute arising from these Terms shall be subject to the exclusive jurisdiction of the courts of the State of Wyoming.</p>
                        <p className="mb-4">For users within the European Union, nothing in these Terms affects your rights under mandatory consumer protection laws of your country of residence.</p>
                        <p>If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision shall be deemed severable and shall not affect the validity and enforceability of the remaining provisions.</p>
                    </TermsSection>

                    <TermsSection title="17. Changes to These Terms" icon={RefreshCw} colorClass="bg-sky-50 text-sky-600">
                        <p>We reserve the right to modify these Terms at any time. Material changes will be communicated via email or a notice on the Platform. Your continued use of the Platform after such changes constitutes acceptance of the updated Terms.</p>
                    </TermsSection>

                    {/* Contact Section */}
                    <div className="pt-12 pb-8 border-t border-slate-100 mt-16">
                        <h2 className="text-2xl font-bold text-[#1D1D1F] mb-4 tracking-tight">Questions or Concerns?</h2>
                        <p className="text-[#424245] mb-6 text-lg">If there are any questions regarding these terms you may contact us using the information below.</p>
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

function TermsSection({ title, icon: Icon, colorClass, children }: { title: string; icon: any; colorClass: string; children: React.ReactNode }) {
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
