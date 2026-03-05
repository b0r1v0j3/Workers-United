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
        }
    ];

    return (
        <footer className="bg-[#fafafa] border-t border-gray-200 relative z-10 w-full py-12">
            <div className="max-w-[1120px] mx-auto px-5 lg:px-8 flex flex-col items-center gap-10">

                {/* Centered Large Social Icons */}
                <div className="flex items-center justify-center gap-6 flex-wrap">
                    {socials.map((social) => (
                        <a
                            key={social.label}
                            href={social.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-70 hover:opacity-100 hover:-translate-y-1 hover:scale-110 transition-all duration-300"
                            aria-label={social.label}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={social.src}
                                alt={social.label}
                                className="w-8 h-8 object-contain"
                            />
                        </a>
                    ))}
                </div>

                {/* Bottom Bar: Copyright, Address, Legal */}
                <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 border-t border-gray-200 pt-8 text-sm text-gray-500 font-medium">
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
                        <span>&copy; {year} Workers United LLC</span>
                        <span className="hidden md:inline text-gray-300">•</span>
                        <span className="text-gray-400">75 E 3rd St., Sheridan, WY 82801, USA</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <Link href="/privacy-policy" className="hover:text-black transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-black transition-colors">Terms of Service</Link>
                    </div>
                </div>

            </div>
        </footer>
    );
}
