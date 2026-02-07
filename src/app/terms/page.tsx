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
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="space-y-6">

                    <TermsCard icon="🍪" title="Cookies">
                        <p className="mb-3">We employ the use of cookies. By accessing <a href="https://workersunited.eu" className="text-[#1877f2] font-semibold hover:underline">https://workersunited.eu</a> you agreed to use cookies in agreement with the Workers United LLC&apos;s Privacy Policy.</p>
                        <p>Most interactive websites use cookies to let us retrieve the user&apos;s details for each visit. Cookies are used by our website to enable the functionality of certain areas to make it easier for people visiting our website. Some of our affiliate/advertising partners may also use cookies.</p>
                    </TermsCard>

                    <TermsCard icon="📜" title="License">
                        <p className="mb-3">Unless otherwise stated, Workers United LLC and/or its licensors own the intellectual property rights for all material on <a href="https://workersunited.eu" className="text-[#1877f2] font-semibold hover:underline">https://workersunited.eu</a>. All intellectual property rights are reserved. You may access this from https://workersunited.eu for your own personal use subjected to restrictions set in these terms and conditions.</p>
                        <p className="font-semibold mb-2">You must not:</p>
                        <ul className="list-disc pl-6 space-y-2 mb-4">
                            <li>Republish material from https://workersunited.eu</li>
                            <li>Sell, rent or sub-license material from https://workersunited.eu</li>
                            <li>Reproduce, duplicate or copy material from https://workersunited.eu</li>
                            <li>Redistribute content from https://workersunited.eu</li>
                        </ul>
                        <p className="mb-3">This Agreement shall begin on the date hereof.</p>
                        <p className="mb-3">Parts of this website offer an opportunity for users to post and exchange opinions and information in certain areas of the website. Workers United LLC does not filter, edit, publish or review Comments prior to their presence on the website. Comments do not reflect the views and opinions of Workers United LLC, its agents and/or affiliates.</p>
                        <p className="font-semibold mb-2">You warrant and represent that:</p>
                        <ul className="list-disc pl-6 space-y-2 mb-4">
                            <li>You are entitled to post the Comments on our website and have all necessary licenses and consents to do so;</li>
                            <li>The Comments do not invade any intellectual property right, including without limitation copyright, patent or trademark of any third party;</li>
                            <li>The Comments do not contain any defamatory, libelous, offensive, indecent or otherwise unlawful material which is an invasion of privacy;</li>
                            <li>The Comments will not be used to solicit or promote business or custom or present commercial activities or unlawful activity.</li>
                        </ul>
                        <p>You hereby grant Workers United LLC a non-exclusive license to use, reproduce, edit and authorize others to use, reproduce and edit any of your Comments in any and all forms, formats or media.</p>
                    </TermsCard>

                    <TermsCard icon="🔗" title="Hyperlinking to our Content">
                        <p className="font-semibold mb-2">The following organizations may link to our Website without prior written approval:</p>
                        <ul className="list-disc pl-6 space-y-2 mb-4">
                            <li>Government agencies;</li>
                            <li>Search engines;</li>
                            <li>News organizations;</li>
                            <li>Online directory distributors may link to our Website in the same manner as they hyperlink to the Websites of other listed businesses; and</li>
                            <li>System wide Accredited Businesses except soliciting non-profit organizations, charity shopping malls, and charity fundraising groups which may not hyperlink to our Web site.</li>
                        </ul>
                        <p>These organizations may link to our home page, to publications or to other Website information so long as the link: (a) is not in any way deceptive; (b) does not falsely imply sponsorship, endorsement or approval of the linking party and its products and/or services; and (c) fits within the context of the linking party&apos;s site.</p>
                    </TermsCard>

                    <TermsCard icon="🖼️" title="iFrames">
                        <p>Without prior approval and written permission, you may not create frames around our Webpages that alter in any way the visual presentation or appearance of our Website.</p>
                    </TermsCard>

                    <TermsCard icon="📝" title="Content Liability">
                        <p>We shall not be hold responsible for any content that appears on your Website. You agree to protect and defend us against all claims that is rising on your Website. No link(s) should appear on any Website that may be interpreted as libelous, obscene or criminal, or which infringes, otherwise violates, or advocates the infringement or other violation of, any third party rights.</p>
                    </TermsCard>

                    <TermsCard icon="⚖️" title="Reservation of Rights">
                        <p>We reserve the right to request that you remove all links or any particular link to our Website. You approve to immediately remove all links to our Website upon request. We also reserve the right to amend these terms and conditions and it&apos;s linking policy at any time. By continuously linking to our Website, you agree to be bound to and follow these linking terms and conditions.</p>
                    </TermsCard>

                    <TermsCard icon="🗑️" title="Removal of links from our website">
                        <p className="mb-3">If you find any link on our Website that is offensive for any reason, you are free to contact and inform us any moment. We will consider requests to remove links but we are not obligated to or so or to respond to you directly.</p>
                        <p>We do not ensure that the information on this website is correct, we do not warrant its completeness or accuracy; nor do we promise to ensure that the website remains available or that the material on the website is kept up to date.</p>
                    </TermsCard>

                    <TermsCard icon="⚠️" title="Disclaimer">
                        <p className="mb-3">To the maximum extent permitted by applicable law, we exclude all representations, warranties and conditions relating to our website and the use of this website. Nothing in this disclaimer will:</p>
                        <ul className="list-disc pl-6 space-y-2 mb-4">
                            <li>limit or exclude our or your liability for death or personal injury;</li>
                            <li>limit or exclude our or your liability for fraud or fraudulent misrepresentation;</li>
                            <li>limit any of our or your liabilities in any way that is not permitted under applicable law; or</li>
                            <li>exclude any of our or your liabilities that may not be excluded under applicable law.</li>
                        </ul>
                        <p className="mb-3">The limitations and prohibitions of liability set in this Section and elsewhere in this disclaimer: (a) are subject to the preceding paragraph; and (b) govern all liabilities arising under the disclaimer, including liabilities arising in contract, in tort and for breach of statutory duty.</p>
                        <p>As long as the website and the information and services on the website are provided free of charge, we will not be liable for any loss or damage of any nature.</p>
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
                    <p className="text-sm text-gray-400">© 2024 Workers United LLC. All rights reserved.</p>
                    <div className="flex gap-6 text-sm">
                        <Link href="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="text-white font-semibold">Terms & Conditions</Link>
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
