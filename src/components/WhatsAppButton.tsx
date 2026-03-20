"use client";

// ─── Floating WhatsApp Button ────────────────────────────────────────────────
// Shows on all pages (via layout.tsx). Opens wa.me chat link.
// Hidden on /admin/* pages to keep admin panel clean.

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buildPlatformWhatsAppUrl } from "@/lib/platform-contact";

const WHATSAPP_URL = buildPlatformWhatsAppUrl(undefined, "Hi, I have a question about Workers United");

export default function WhatsAppButton() {
    const pathname = usePathname();
    const [isHovered, setIsHovered] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [cookieVisible, setCookieVisible] = useState(false);
    const isCompactLayout = pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname?.startsWith("/auth/");

    useEffect(() => {
        if (typeof window === "undefined") return;

        const root = document.documentElement;
        const syncFloatingState = () => {
            setIsMobileViewport(window.innerWidth < 640);
            setCookieVisible(root.dataset.wuCookieVisible === "true");
        };

        syncFloatingState();

        const observer = new MutationObserver(syncFloatingState);
        observer.observe(root, {
            attributes: true,
            attributeFilter: ["data-wu-cookie-visible"],
        });

        window.addEventListener("resize", syncFloatingState);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", syncFloatingState);
        };
    }, []);

    const hideWhileCookieBannerIsVisible = isMobileViewport && cookieVisible;

    // Hide on admin pages
    if (pathname?.startsWith("/admin")) return null;

    return (
        <div
            className={`fixed right-3 z-[9999] flex flex-col items-end justify-end transition-all duration-300 sm:right-6 group ${
                hideWhileCookieBannerIsVisible ? "pointer-events-none translate-y-3 opacity-0" : "opacity-100"
            }`}
            style={{ bottom: "var(--wu-floating-chat-offset, 1.5rem)" }}
        >
            {/* Hover Tooltip Bubble */}
            <div
                className={`absolute right-full mr-4 mb-2 hidden whitespace-nowrap rounded-2xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-lg transition-all duration-300 origin-right sm:block
                ${isHovered ? 'scale-100 opacity-100 translate-x-0' : 'scale-90 opacity-0 translate-x-2 pointer-events-none'}`}
            >
                Need help? Chat with us!
                {/* Pointer Arrow */}
                <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-gray-100 transform rotate-45"></div>
            </div>

            {/* Main Button */}
            <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with us on WhatsApp"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`relative flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#25D366]/30 hover:bg-[#20bd5a] sm:hover:-translate-y-1 sm:hover:shadow-2xl ${
                    isCompactLayout ? "h-11 w-11 sm:h-14 sm:w-14" : "h-12 w-12 sm:h-14 sm:w-14"
                }`}
            >
                {/* WhatsApp Icon */}
                <svg
                    viewBox="0 0 24 24"
                    fill="white"
                    className={`${isCompactLayout ? "h-6 w-6 sm:h-8 sm:w-8" : "h-7 w-7 sm:h-8 sm:w-8"}`}
                >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
            </a>
        </div>
    );
}
