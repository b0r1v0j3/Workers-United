"use client";

// ─── Floating WhatsApp Button ────────────────────────────────────────────────
// Shows on all pages (via layout.tsx). Opens wa.me chat link.
// Hidden on /admin/* pages to keep admin panel clean.

import { usePathname } from "next/navigation";
import { useState } from "react";

const WHATSAPP_NUMBER = "15557839521";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Hi%2C%20I%20have%20a%20question%20about%20Workers%20United`;

export default function WhatsAppButton() {
    const pathname = usePathname();
    const [isHovered, setIsHovered] = useState(false);

    // Hide on admin pages
    if (pathname?.startsWith("/admin")) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-end justify-end flex-col group">
            {/* Hover Tooltip Bubble */}
            <div
                className={`absolute right-full mr-4 mb-2 px-4 py-2 bg-white text-gray-800 text-sm font-semibold rounded-2xl shadow-lg border border-gray-100 whitespace-nowrap transition-all duration-300 origin-right
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
                className="relative flex items-center justify-center w-14 h-14 bg-[#25D366] text-white rounded-full shadow-lg hover:shadow-2xl hover:bg-[#20bd5a] transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-[#25D366]/30"
            >
                {/* WhatsApp Icon */}
                <svg
                    viewBox="0 0 32 32"
                    fill="currentColor"
                    className="w-8 h-8"
                >
                    <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.128 6.744 3.046 9.378L1.054 31.29l6.118-1.958A15.91 15.91 0 0 0 16.004 32C24.826 32 32 24.826 32 16.004 32 7.176 24.826 0 16.004 0zm9.334 22.608c-.39 1.1-1.932 2.012-3.164 2.278-.844.18-1.946.322-5.658-1.216-4.752-1.968-7.806-6.776-8.04-7.092-.226-.316-1.882-2.508-1.882-4.784s1.188-3.396 1.612-3.862c.39-.428.85-.536 1.134-.536.284 0 .568.002.816.014.262.012.614-.1.96.732.356.856 1.212 2.954 1.318 3.168.108.216.18.468.036.75-.142.284-.214.462-.428.712-.214.248-.45.556-.644.746-.214.214-.438.446-.188.876s1.11 1.836 2.384 2.974c1.638 1.464 3.016 1.918 3.446 2.132.43.214.68.18.93-.108.25-.29 1.072-1.248 1.358-1.676.284-.43.568-.356.96-.214.39.142 2.484 1.172 2.912 1.386.428.214.714.322.82.5.108.178.108 1.028-.282 2.128z" />
                </svg>
            </a>
        </div>
    );
}
