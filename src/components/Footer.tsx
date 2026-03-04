import Link from "next/link";
import Image from "next/image";

export default function Footer() {
    const year = new Date().getFullYear();

    const socials = [
        {
            href: "https://www.facebook.com/profile.php?id=61585104076725",
            label: "Facebook",
            icon: <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6H16.7V4.9c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7v3h2.8v8h3.7z" />,
        },
        {
            href: "https://www.instagram.com/workersunited.eu/",
            label: "Instagram",
            icon: <><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm9 2h-9A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9A3.5 3.5 0 0 0 20 16.5v-9A3.5 3.5 0 0 0 16.5 4z" /><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.1A2.9 2.9 0 1 0 12 15a2.9 2.9 0 0 0 0-5.9z" /><path d="M17.6 6.3a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" /></>,
        },
        {
            href: "https://www.threads.com/@workersunited.eu",
            label: "Threads",
            isImage: true,
        },
        {
            href: "https://wa.me/15557839521",
            label: "WhatsApp",
            icon: <path d="M12.004 0h-.008C5.478 0 0 5.382 0 12.004c0 2.625.846 5.058 2.284 7.034L.79 23.468l4.59-1.468A11.94 11.94 0 0 0 12.004 24C18.621 24 24 18.621 24 12.004 24 5.382 18.621 0 12.004 0zm7 16.956c-.293.825-1.449 1.509-2.373 1.709-.633.135-1.46.241-4.244-.912-3.564-1.476-5.854-5.082-6.03-5.319-.17-.237-1.412-1.881-1.412-3.588s.891-2.547 1.209-2.897c.293-.321.638-.402.85-.402.213 0 .426.002.612.011.197.009.46-.075.72.549.267.642.909 2.216.988 2.376.081.162.135.351.027.563-.107.213-.16.347-.321.534-.16.186-.337.417-.483.56-.16.16-.328.334-.141.657.188.321.833 1.377 1.788 2.231 1.229 1.098 2.262 1.438 2.584 1.599.321.16.51.135.697-.081.188-.218.804-.936 1.018-1.257.214-.321.427-.267.72-.16.293.107 1.863.879 2.184 1.04.321.16.535.241.615.375.081.133.081.771-.212 1.516z" />,
        },
        {
            href: "https://www.linkedin.com/company/workersunited-eu/",
            label: "LinkedIn",
            icon: <path d="M4.5 3.5A2 2 0 1 1 4.5 7.5a2 2 0 0 1 0-4zM3 9h3v12H3V9zm7 0h2.9v1.6h.1c.4-.8 1.6-1.7 3.2-1.7 3.4 0 4 2.2 4 5.1V21h-3v-6.1c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21h-3V9z" />,
        },
        {
            href: "https://www.tiktok.com/@workersunited.eu",
            label: "TikTok",
            icon: <path d="M14 2h2.2c.2 1.8 1.2 3.2 3.8 3.6V8c-1.7 0-3.2-.6-4.1-1.4V14c0 4-2.7 6-6 6-2.5 0-4.9-1.7-4.9-4.9 0-3.1 2.4-5 5.4-5 .5 0 1 .1 1.5.2V13c-.4-.2-.9-.3-1.5-.3-1.3 0-2.6.8-2.6 2.4 0 1.5 1.1 2.4 2.5 2.4 1.7 0 2.6-1.1 2.6-3V2z" />,
        },
        {
            href: "https://x.com/WorkersUnitedEU",
            label: "X",
            icon: <path d="M18.7 2H21l-6.7 7.6L22 22h-6.1l-4.8-6.2L5.6 22H3.3l7.2-8.2L2 2h6.2l4.3 5.6L18.7 2zm-1.1 18h1.2L6.3 3.9H5.1L17.6 20z" />,
        },
        {
            href: "mailto:contact@workersunited.eu",
            label: "Email",
            icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 6l-10 7L2 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>,
            noFill: true,
        },
    ];

    return (
        <footer className="bg-[#0b1120] text-slate-400 py-16 lg:py-20 border-t border-slate-800 relative overflow-hidden z-10 w-full">
            {/* Subtle Top Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#2f6fed]/30 to-transparent"></div>

            <div className="max-w-[1120px] mx-auto px-5 lg:px-8">
                <div className="xl:grid xl:grid-cols-3 xl:gap-12">
                    {/* Brand & Intro */}
                    <div className="flex flex-col space-y-8 xl:col-span-1">
                        <Link href="/" className="flex items-center gap-3 w-fit group">
                            <div className="bg-white/5 p-2 rounded-xl group-hover:bg-white/10 transition-colors">
                                <Image
                                    src="/logo-icon.png"
                                    alt="Workers United"
                                    width={40}
                                    height={40}
                                    className="w-8 h-8 object-contain brightness-0 invert"
                                />
                            </div>
                            <span className="text-white text-xl font-bold tracking-tight">Workers United</span>
                        </Link>
                        <p className="text-sm leading-relaxed text-slate-400 max-w-sm">
                            International hiring made simple & legal. Connecting serious employers with reliable workers across Europe.
                        </p>

                        {/* Social Icons 4x2 Grid */}
                        <div className="grid grid-cols-4 gap-3 w-fit mt-4 flex-wrap">
                            {socials.map((social) => (
                                <a
                                    key={social.label}
                                    href={social.href}
                                    target={social.label === "Email" ? undefined : "_blank"}
                                    rel={social.label === "Email" ? undefined : "noopener noreferrer"}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-[#2f6fed] hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-[#2f6fed]/20 group"
                                    aria-label={social.label}
                                >
                                    {social.isImage ? (
                                        <Image src="/threads-logo.svg" alt="Threads" width={18} height={18} className="w-[18px] h-[18px] brightness-0 invert opacity-70 group-hover:opacity-100 transition-all" />
                                    ) : (
                                        <svg viewBox="0 0 24 24" className={`w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity ${social.noFill ? '' : 'fill-current'}`}>{social.icon}</svg>
                                    )}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links Grid */}
                    <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
                        <div className="md:grid md:grid-cols-2 md:gap-8">
                            <div>
                                <h3 className="text-sm font-semibold leading-6 text-white tracking-wider uppercase">Platform</h3>
                                <ul role="list" className="mt-6 space-y-4">
                                    <li><Link href="/#how-it-works" className="text-sm leading-6 hover:text-white transition-colors">How it works</Link></li>
                                    <li><Link href="/#workers" className="text-sm leading-6 hover:text-white transition-colors">For Workers</Link></li>
                                    <li><Link href="/#employers" className="text-sm leading-6 hover:text-white transition-colors">For Employers</Link></li>
                                </ul>
                            </div>
                            <div className="mt-10 md:mt-0">
                                <h3 className="text-sm font-semibold leading-6 text-white tracking-wider uppercase">Company</h3>
                                <ul role="list" className="mt-6 space-y-4">
                                    {/* Link removed "href=/about" for about as it doesn't currently exist, returning contact instead */}
                                    <li><a href="mailto:contact@workersunited.eu" className="text-sm leading-6 hover:text-white transition-colors">Contact Us</a></li>
                                </ul>
                            </div>
                        </div>
                        <div className="md:grid md:grid-cols-2 md:gap-8">
                            <div>
                                <h3 className="text-sm font-semibold leading-6 text-white tracking-wider uppercase">Legal</h3>
                                <ul role="list" className="mt-6 space-y-4">
                                    <li><Link href="/privacy-policy" className="text-sm leading-6 hover:text-white transition-colors">Privacy Policy</Link></li>
                                    <li><Link href="/terms" className="text-sm leading-6 hover:text-white transition-colors">Terms of Service</Link></li>
                                </ul>
                            </div>
                            <div className="mt-10 md:mt-0">
                                <h3 className="text-sm font-semibold leading-6 text-white tracking-wider uppercase">US Office</h3>
                                <ul role="list" className="mt-6 space-y-4 text-sm leading-6 text-slate-500">
                                    <li>Workers United LLC</li>
                                    <li>75 E 3rd St.</li>
                                    <li>Sheridan, WY 82801</li>
                                    <li>USA</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-[1120px] mx-auto mt-16 sm:mt-20 lg:mt-24 border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs leading-5 text-slate-500 text-center md:text-left">
                        &copy; {year} Workers United. All rights reserved.
                    </p>
                    <div className="flex gap-4 items-center opacity-60">
                        {/* Tiny Trust Badges */}
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-slate-400">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Secure
                        </div>
                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-slate-400">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            Privacy
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
