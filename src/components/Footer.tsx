import Link from "next/link";

export default function Footer() {
    const year = new Date().getFullYear();

    const socials = [
        {
            href: "https://www.facebook.com/profile.php?id=61585104076725",
            label: "Facebook",
            src: "https://img.icons8.com/fluency/48/facebook-new.png"
        },
        {
            href: "https://www.instagram.com/workersunited.eu/",
            label: "Instagram",
            src: "https://img.icons8.com/fluency/48/instagram-new.png"
        },
        {
            href: "https://www.threads.net/@workersunited.eu",
            label: "Threads",
            src: "https://img.icons8.com/ios-filled/50/threads.png"
        },
        {
            href: "https://wa.me/15557839521",
            label: "WhatsApp",
            src: "https://img.icons8.com/fluency/48/whatsapp.png"
        },
        {
            href: "https://x.com/WorkersUnitedEU",
            label: "X",
            src: "https://img.icons8.com/ios-filled/50/twitterx.png"
        },
        {
            href: "https://www.tiktok.com/@workersunited.eu",
            label: "TikTok",
            src: "https://img.icons8.com/fluency/48/tiktok.png"
        },
        {
            href: "https://www.linkedin.com/company/workersunited-eu/",
            label: "LinkedIn",
            src: "https://img.icons8.com/fluency/48/linkedin.png"
        },
        {
            href: "mailto:contact@workersunited.eu",
            label: "Email",
            src: "https://img.icons8.com/color/48/mail.png"
        }
    ];

    return (
        <footer className="bg-[#fafafa] border-t border-gray-200 mt-20 relative z-10 w-full">
            <div className="max-w-[1120px] mx-auto px-5 lg:px-8 py-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">

                    {/* Left: Copyright & Legal */}
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6 text-sm text-gray-500 font-medium">
                        <span>&copy; {year} Workers United LLC</span>
                        <span className="hidden md:inline text-gray-300">•</span>
                        <div className="flex gap-4">
                            <Link href="/privacy-policy" className="hover:text-black transition-colors">Privacy</Link>
                            <Link href="/terms" className="hover:text-black transition-colors">Terms</Link>
                        </div>
                    </div>

                    {/* Right: Address & Socials */}
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                        <span className="text-sm text-gray-400">75 E 3rd St., Sheridan, WY 82801, USA</span>

                        <div className="flex items-center gap-3">
                            {socials.map((social) => (
                                <a
                                    key={social.label}
                                    href={social.href}
                                    target={social.label === "Email" ? undefined : "_blank"}
                                    rel={social.label === "Email" ? undefined : "noopener noreferrer"}
                                    className="opacity-70 hover:opacity-100 hover:-translate-y-0.5 hover:scale-110 transition-all duration-200"
                                    aria-label={social.label}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={social.src}
                                        alt={social.label}
                                        className="w-[22px] h-[22px] object-contain"
                                    />
                                </a>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </footer>
    );
}
