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
                        <h1 className="text-3xl font-bold text-white">Terms and Conditions</h1>
                    </div>
                    <p className="text-white/80 max-w-2xl">
                        Please read these terms carefully. By using Workers United, you agree to be bound by the following terms and conditions.
                    </p>
                    <p className="text-white/60 text-sm mt-3">Last updated: 8 February 2026</p>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="space-y-6">

                    <TermsCard icon="📌" title="1. Agreement to Terms">
                        <p className="mb-3">By accessing or using <a href="https://workersunited.eu" className="text-[#1877f2] font-semibold hover:underline">https://workersunited.eu</a> (&quot;the Platform&quot;), you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the Platform.</p>
                        <p>These Terms apply to all users of the Platform, including workers (candidates), employers, and visitors.</p>
                    </TermsCard>

                    <TermsCard icon="🏢" title="2. About Workers United">
                        <p className="mb-3">Workers United LLC (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides a visa facilitation service that connects international workers with European employers. We handle the complete process including documentation, visa application, and placement.</p>
                        <p className="font-semibold mb-2">Key points:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>We are <strong>not</strong> a job board — we provide a full-service visa and placement solution</li>
                            <li>Workers and employers do not interact directly until the visa is approved</li>
                            <li>Our services for employers are free of charge</li>
                            <li>We do not guarantee employment outcomes, but we do offer a 90-day refund on the entry fee if no match is found</li>
                        </ul>
                    </TermsCard>

                    <TermsCard icon="👤" title="3. User Accounts">
                        <p className="font-semibold mb-2">By creating an account, you agree that:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>You are at least 18 years of age</li>
                            <li>All information you provide is accurate, truthful, and complete</li>
                            <li>You will keep your account credentials secure and not share them</li>
                            <li>You are responsible for all activity under your account</li>
                            <li>You have consented to the processing of your personal data as described in our <Link href="/privacy-policy" className="text-[#1877f2] font-semibold hover:underline">Privacy Policy</Link></li>
                        </ul>
                        <p className="mt-3">We reserve the right to suspend or terminate accounts that violate these Terms or provide false information.</p>
                    </TermsCard>

                    <TermsCard icon="💰" title="4. Fees and Payments">
                        <p className="font-semibold mb-2">The following fees apply:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Entry fee:</strong> $9 USD — paid by the worker to enter the matching queue</li>
                            <li><strong>Placement fee:</strong> Varies by country — paid by the worker only when a position is matched. The exact amount will be displayed before payment.</li>
                            <li><strong>Employer fees:</strong> None — our services are free for employers</li>
                        </ul>
                        <p className="mt-3"><strong>Refund policy:</strong> If a worker is not matched with an employer within 90 days of paying the entry fee, the $9 entry fee will be refunded in full. Placement fees are non-refundable once the visa process has begun.</p>
                        <p className="mt-2">All payments are processed securely by Stripe. We do not store your payment card details.</p>
                    </TermsCard>

                    <TermsCard icon="📄" title="5. Documents and Verification">
                        <p className="mb-3">Workers are required to upload certain documents (passport, biometric photo, diploma) for identity verification and visa processing.</p>
                        <p className="font-semibold mb-2">By uploading documents, you confirm that:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>The documents are genuine and belong to you</li>
                            <li>You authorise us to use AI-powered verification to check document authenticity</li>
                            <li>You consent to sharing these documents with relevant authorities as part of the visa application process</li>
                            <li>Providing fraudulent documents will result in immediate account termination</li>
                        </ul>
                    </TermsCard>

                    <TermsCard icon="🔒" title="6. Data Protection and GDPR">
                        <p className="mb-3">We are committed to protecting your personal data in accordance with the General Data Protection Regulation (GDPR) and other applicable data protection laws.</p>
                        <p className="font-semibold mb-2">Your rights include:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Right of access:</strong> Request a copy of your personal data</li>
                            <li><strong>Right to rectification:</strong> Correct inaccurate data via your profile settings</li>
                            <li><strong>Right to erasure:</strong> Delete your account and all associated data through your account settings</li>
                            <li><strong>Right to data portability:</strong> Download your data in a machine-readable format</li>
                            <li><strong>Right to withdraw consent:</strong> Withdraw consent at any time without affecting prior processing</li>
                        </ul>
                        <p className="mt-3">For full details on how we process your data, please read our <Link href="/privacy-policy" className="text-[#1877f2] font-semibold hover:underline">Privacy Policy</Link>.</p>
                    </TermsCard>

                    <TermsCard icon="🍪" title="7. Cookies">
                        <p>We use only essential cookies required for authentication and site functionality. We do not use tracking or advertising cookies. For more information, see our <Link href="/privacy-policy" className="text-[#1877f2] font-semibold hover:underline">Privacy Policy</Link>.</p>
                    </TermsCard>

                    <TermsCard icon="📜" title="8. Intellectual Property">
                        <p className="mb-3">All content on the Platform, including text, graphics, logos, and software, is the property of Workers United LLC and is protected by intellectual property laws.</p>
                        <p className="font-semibold mb-2">You must not:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Reproduce, duplicate, or copy material from the Platform</li>
                            <li>Sell, rent, or sub-license material from the Platform</li>
                            <li>Redistribute content from the Platform without prior written permission</li>
                        </ul>
                    </TermsCard>

                    <TermsCard icon="🚫" title="9. Prohibited Activities">
                        <p className="font-semibold mb-2">You agree not to:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Provide false, misleading, or fraudulent information</li>
                            <li>Upload forged or tampered documents</li>
                            <li>Use the Platform for any illegal purpose</li>
                            <li>Attempt to access other users&apos; accounts or data</li>
                            <li>Interfere with the security or functionality of the Platform</li>
                            <li>Create multiple accounts for the same person</li>
                        </ul>
                    </TermsCard>

                    <TermsCard icon="📢" title="10. Disclaimers and Warranties">
                        <p className="mb-3 uppercase font-bold text-[#050505] text-xs leading-relaxed tracking-wide">
                            THE PLATFORM AND ALL MATERIALS, INFORMATION, PRODUCTS AND SERVICES AVAILABLE THROUGH THE PLATFORM ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMISSIBLE PURSUANT TO APPLICABLE LAW, WORKERS UNITED LLC DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
                        </p>
                        <p className="mb-3 uppercase font-bold text-[#050505] text-xs leading-relaxed tracking-wide">
                            WE DO NOT WARRANT THAT THE PLATFORM OR ANY OF ITS FUNCTIONS WILL BE UNINTERRUPTED OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT THE PLATFORM OR THE SERVERS THAT MAKE IT AVAILABLE ARE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
                        </p>
                        <p className="uppercase font-bold text-[#050505] text-xs leading-relaxed tracking-wide">
                            WE DO NOT WARRANT OR MAKE ANY REPRESENTATIONS REGARDING THE USE OR THE RESULTS OF THE USE OF THE PLATFORM IN TERMS OF CORRECTNESS, ACCURACY, TIMELINESS, RELIABILITY OR OTHERWISE. WE DO NOT GUARANTEE THAT A WORKER WILL BE MATCHED WITH AN EMPLOYER OR THAT A VISA APPLICATION WILL BE APPROVED. VISA DECISIONS ARE MADE SOLELY BY IMMIGRATION AUTHORITIES AND ARE OUTSIDE OUR CONTROL.
                        </p>
                    </TermsCard>

                    <TermsCard icon="🛡️" title="11. Indemnification">
                        <p>You agree to defend, indemnify and hold harmless Workers United LLC, its affiliates, officers, directors, employees, agents, successors and assigns from and against any and all claims, damages, liabilities, costs and expenses (including reasonable legal fees) arising out of or related to: (a) your use of the Platform; (b) your breach of these Terms; (c) any information or documents you have provided to us; or (d) your violation of any law or the rights of any third party.</p>
                    </TermsCard>

                    <TermsCard icon="🔗" title="12. Third-Party Links">
                        <p>The Platform may contain links to third-party websites or services that are not owned or controlled by Workers United. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services. You acknowledge and agree that Workers United shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of any such content, goods, or services available on or through any such websites or services.</p>
                    </TermsCard>

                    <TermsCard icon="💸" title="13. Refund Policy">
                        <p className="mb-3">Our refund policy is as follows:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Entry fee ($9 USD):</strong> Fully refundable if a worker is not matched with an employer within 90 days of payment.</li>
                            <li><strong>Placement fee:</strong> Non-refundable once the visa application process has been initiated, as costs are incurred for document preparation and government fees.</li>
                        </ul>
                        <p className="mt-3">Refund requests should be directed to <a href="mailto:contact@workersunited.eu" className="text-[#1877f2] font-semibold hover:underline">contact@workersunited.eu</a>. Approved refunds will be processed within 10 business days to the original payment method.</p>
                    </TermsCard>

                    <TermsCard icon="⚠️" title="14. Limitation of Liability">
                        <p className="mb-3 uppercase font-bold text-[#050505] text-xs leading-relaxed tracking-wide">
                            UNDER NO CIRCUMSTANCES, INCLUDING BUT NOT LIMITED TO NEGLIGENCE, SHALL WORKERS UNITED LLC, ITS AFFILIATES, OR ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR EXEMPLARY DAMAGES THAT RESULT FROM THE USE OF, OR THE INABILITY TO USE, THE PLATFORM OR OUR SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                        </p>
                        <p className="mb-3">Our total liability shall not exceed the amount paid by you for our services.</p>
                        <p>Nothing in these Terms excludes or limits our liability for death or personal injury caused by negligence, fraud, or any liability that cannot be excluded or limited by applicable law. For users in the European Union, nothing in these Terms affects your statutory rights as a consumer.</p>
                    </TermsCard>

                    <TermsCard icon="🚪" title="15. Termination">
                        <p className="mb-3">We may suspend or terminate your access to the Platform at any time, without prior notice, for conduct that we believe violates these Terms, is harmful to other users, or is otherwise objectionable.</p>
                        <p>Upon termination, your right to use the Platform will immediately cease. The disclaimers, limitations of liability, indemnification, and other provisions of these Terms that by their nature should survive shall survive termination.</p>
                    </TermsCard>

                    <TermsCard icon="⚖️" title="16. Governing Law and Disputes">
                        <p className="mb-3">These Terms are governed by and construed in accordance with the laws of the State of Wyoming, USA, without regard to its conflict of law provisions. Any dispute arising from these Terms shall be subject to the exclusive jurisdiction of the courts of the State of Wyoming.</p>
                        <p className="mb-3">For users within the European Union, nothing in these Terms affects your rights under mandatory consumer protection laws of your country of residence.</p>
                        <p>If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision shall be deemed severable and shall not affect the validity and enforceability of the remaining provisions.</p>
                    </TermsCard>

                    <TermsCard icon="📝" title="17. Changes to These Terms">
                        <p>We reserve the right to modify these Terms at any time. Material changes will be communicated via email or a notice on the Platform. Your continued use of the Platform after such changes constitutes acceptance of the updated Terms.</p>
                    </TermsCard>

                    {/* Contact Card */}
                    <div className="bg-gradient-to-br from-[#1877f2] to-[#1e5cd6] rounded-2xl p-8 text-white">
                        <h3 className="text-xl font-bold mb-2">📬 Contact Us</h3>
                        <p className="text-white/80 mb-4">If there are any questions regarding these terms you may contact us using the information below.</p>
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
                        <Link href="/terms" className="text-white font-semibold">Terms &amp; Conditions</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function TermsCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
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
