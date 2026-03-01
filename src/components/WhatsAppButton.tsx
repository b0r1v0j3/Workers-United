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
        <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: "fixed",
                bottom: "24px",
                right: "24px",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                gap: isHovered ? "10px" : "0px",
                background: "#25D366",
                color: "white",
                borderRadius: "50px",
                padding: isHovered ? "14px 22px 14px 16px" : "14px",
                boxShadow: "0 4px 16px rgba(37, 211, 102, 0.4)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                transform: isHovered ? "scale(1.05)" : "scale(1)",
                textDecoration: "none",
            }}
        >
            {/* WhatsApp Icon */}
            <svg
                viewBox="0 0 32 32"
                fill="white"
                width="28"
                height="28"
                style={{ flexShrink: 0 }}
            >
                <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.128 6.744 3.046 9.378L1.054 31.29l6.118-1.958A15.91 15.91 0 0 0 16.004 32C24.826 32 32 24.826 32 16.004 32 7.176 24.826 0 16.004 0zm9.334 22.608c-.39 1.1-1.932 2.012-3.164 2.278-.844.18-1.946.322-5.658-1.216-4.752-1.968-7.806-6.776-8.04-7.092-.226-.316-1.882-2.508-1.882-4.784s1.188-3.396 1.612-3.862c.39-.428.85-.536 1.134-.536.284 0 .568.002.816.014.262.012.614-.1.96.732.356.856 1.212 2.954 1.318 3.168.108.216.18.468.036.75-.142.284-.214.462-.428.712-.214.248-.45.556-.644.746-.214.214-.438.446-.188.876s1.11 1.836 2.384 2.974c1.638 1.464 3.016 1.918 3.446 2.132.43.214.68.18.93-.108.25-.29 1.072-1.248 1.358-1.676.284-.43.568-.356.96-.214.39.142 2.484 1.172 2.912 1.386.428.214.714.322.82.5.108.178.108 1.028-.282 2.128z" />
            </svg>

            {/* Tooltip text on hover */}
            <span
                style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    maxWidth: isHovered ? "200px" : "0px",
                    opacity: isHovered ? 1 : 0,
                    transition: "all 0.3s ease",
                }}
            >
                Chat with us
            </span>
        </a>
    );
}
