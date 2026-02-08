"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Check if consent was already given
        const consent = localStorage.getItem("cookie_consent");
        if (!consent) {
            // Small delay so it doesn't flash on page load
            const timer = setTimeout(() => setVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem("cookie_consent", new Date().toISOString());
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-slideUp">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-[#dddfe2] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl mt-0.5">🍪</span>
                    <p className="text-sm text-[#475569] leading-relaxed">
                        We use essential cookies for authentication and site functionality. No tracking or advertising cookies are used.
                        See our{" "}
                        <Link href="/privacy-policy" className="text-[#1877f2] font-semibold hover:underline">
                            Privacy Policy
                        </Link>
                        {" "}for details.
                    </p>
                </div>
                <button
                    onClick={handleAccept}
                    className="whitespace-nowrap px-6 py-2.5 rounded-lg bg-[#1877f2] text-white font-semibold text-sm hover:bg-[#1664d9] transition-colors shadow-sm"
                >
                    Got it
                </button>
            </div>

            <style jsx>{`
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .animate-slideUp {
                    animation: slideUp 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
