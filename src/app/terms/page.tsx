import Link from "next/link";
import Image from "next/image";

export const metadata = {
    title: "Terms and Conditions - Workers United",
    description: "Terms and Conditions for Workers United – The terms under which our services are provided.",
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#f8fbff] font-montserrat">
            {/* Header */}
            <header className="fixed top-0 w-full z-50 bg-[#f8fbff]/80 backdrop-blur-md px-6 py-4 lg:px-12 flex justify-between items-center">
                <Link href="/" className="flex items-center gap-3 group">
                    <Image src="/logo.png" alt="Workers United logo" width={56} height={56} className="rounded transition-transform group-hover:scale-105" />
                    <span className="font-bold text-[#183b56] text-xl tracking-tight">Workers United</span>
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
                    <h1 className="text-4xl font-bold text-[#1e293b] mb-8">Terms and Conditions</h1>

                    <div className="prose prose-lg max-w-none text-[#475569]">
                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Cookies</h2>
                            <p>We employ the use of cookies. By accessing <a href="https://workersunited.eu" className="text-[#2f6fed] hover:underline">https://workersunited.eu</a> you agreed to use cookies in agreement with the Workers United LLC&apos;s Privacy Policy.</p>
                            <p className="mt-4">Most interactive websites use cookies to let us retrieve the user&apos;s details for each visit. Cookies are used by our website to enable the functionality of certain areas to make it easier for people visiting our website. Some of our affiliate/advertising partners may also use cookies.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">License</h2>
                            <p>Unless otherwise stated, Workers United LLC and/or its licensors own the intellectual property rights for all material on <a href="https://workersunited.eu" className="text-[#2f6fed] hover:underline">https://workersunited.eu</a>. All intellectual property rights are reserved. You may access this from https://workersunited.eu for your own personal use subjected to restrictions set in these terms and conditions.</p>
                            <p className="mt-4 font-semibold">You must not:</p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Republish material from https://workersunited.eu</li>
                                <li>Sell, rent or sub-license material from https://workersunited.eu</li>
                                <li>Reproduce, duplicate or copy material from https://workersunited.eu</li>
                                <li>Redistribute content from https://workersunited.eu</li>
                            </ul>
                            <p className="mt-4">This Agreement shall begin on the date hereof.</p>
                            <p className="mt-4">Parts of this website offer an opportunity for users to post and exchange opinions and information in certain areas of the website. Workers United LLC does not filter, edit, publish or review Comments prior to their presence on the website. Comments do not reflect the views and opinions of Workers United LLC, its agents and/or affiliates.</p>
                            <p className="mt-4 font-semibold">You warrant and represent that:</p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>You are entitled to post the Comments on our website and have all necessary licenses and consents to do so;</li>
                                <li>The Comments do not invade any intellectual property right, including without limitation copyright, patent or trademark of any third party;</li>
                                <li>The Comments do not contain any defamatory, libelous, offensive, indecent or otherwise unlawful material which is an invasion of privacy;</li>
                                <li>The Comments will not be used to solicit or promote business or custom or present commercial activities or unlawful activity.</li>
                            </ul>
                            <p className="mt-4">You hereby grant Workers United LLC a non-exclusive license to use, reproduce, edit and authorize others to use, reproduce and edit any of your Comments in any and all forms, formats or media.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Hyperlinking to our Content</h2>
                            <p className="font-semibold">The following organizations may link to our Website without prior written approval:</p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Government agencies;</li>
                                <li>Search engines;</li>
                                <li>News organizations;</li>
                                <li>Online directory distributors may link to our Website in the same manner as they hyperlink to the Websites of other listed businesses; and</li>
                                <li>System wide Accredited Businesses except soliciting non-profit organizations, charity shopping malls, and charity fundraising groups which may not hyperlink to our Web site.</li>
                            </ul>
                            <p className="mt-4">These organizations may link to our home page, to publications or to other Website information so long as the link: (a) is not in any way deceptive; (b) does not falsely imply sponsorship, endorsement or approval of the linking party and its products and/or services; and (c) fits within the context of the linking party&apos;s site.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">iFrames</h2>
                            <p>Without prior approval and written permission, you may not create frames around our Webpages that alter in any way the visual presentation or appearance of our Website.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Content Liability</h2>
                            <p>We shall not be hold responsible for any content that appears on your Website. You agree to protect and defend us against all claims that is rising on your Website. No link(s) should appear on any Website that may be interpreted as libelous, obscene or criminal, or which infringes, otherwise violates, or advocates the infringement or other violation of, any third party rights.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Reservation of Rights</h2>
                            <p>We reserve the right to request that you remove all links or any particular link to our Website. You approve to immediately remove all links to our Website upon request. We also reserve the right to amend these terms and conditions and it&apos;s linking policy at any time. By continuously linking to our Website, you agree to be bound to and follow these linking terms and conditions.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Removal of links from our website</h2>
                            <p>If you find any link on our Website that is offensive for any reason, you are free to contact and inform us any moment. We will consider requests to remove links but we are not obligated to or so or to respond to you directly.</p>
                            <p className="mt-4">We do not ensure that the information on this website is correct, we do not warrant its completeness or accuracy; nor do we promise to ensure that the website remains available or that the material on the website is kept up to date.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Disclaimer</h2>
                            <p>To the maximum extent permitted by applicable law, we exclude all representations, warranties and conditions relating to our website and the use of this website. Nothing in this disclaimer will:</p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>limit or exclude our or your liability for death or personal injury;</li>
                                <li>limit or exclude our or your liability for fraud or fraudulent misrepresentation;</li>
                                <li>limit any of our or your liabilities in any way that is not permitted under applicable law; or</li>
                                <li>exclude any of our or your liabilities that may not be excluded under applicable law.</li>
                            </ul>
                            <p className="mt-4">The limitations and prohibitions of liability set in this Section and elsewhere in this disclaimer: (a) are subject to the preceding paragraph; and (b) govern all liabilities arising under the disclaimer, including liabilities arising in contract, in tort and for breach of statutory duty.</p>
                            <p className="mt-4">As long as the website and the information and services on the website are provided free of charge, we will not be liable for any loss or damage of any nature.</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-[#1e293b] mb-4">Contact Us</h2>
                            <div className="p-6 bg-white rounded-xl border border-[#e2e8f0]">
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
