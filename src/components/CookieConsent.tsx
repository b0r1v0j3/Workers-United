"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

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

    useEffect(() => {
        if (typeof window === "undefined") return;

        const root = document.documentElement;
        const syncFloatingUi = () => {
            const isMobile = window.innerWidth < 640;
            const compactOffset = isMobile ? "1rem" : "7rem";
            const defaultOffset = isMobile ? "1rem" : "1.5rem";
            root.style.setProperty("--wu-floating-chat-offset", visible ? compactOffset : defaultOffset);
            root.dataset.wuCookieVisible = visible && isMobile ? "true" : "false";
        };

        syncFloatingUi();
        window.addEventListener("resize", syncFloatingUi);

        return () => {
            window.removeEventListener("resize", syncFloatingUi);
            root.style.removeProperty("--wu-floating-chat-offset");
            delete root.dataset.wuCookieVisible;
        };
    }, [visible]);

    const handleAccept = () => {
        localStorage.setItem("cookie_consent", new Date().toISOString());
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-[9999] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-0 sm:p-4 animate-slideUp">
            <div className="mx-auto w-full max-w-3xl rounded-[22px] border border-[#dddfe2] bg-white p-3 shadow-2xl sm:rounded-[24px] sm:p-5">
                <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                    <Image
                        src="/cookie-icons8.png"
                        alt="Cookie icon"
                        width={56}
                        height={56}
                        className="mt-0.5 h-8 w-8 shrink-0 sm:h-14 sm:w-14"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-4 text-[#475569] sm:text-sm sm:leading-relaxed">
                            We only use essential cookies for sign-in and site functionality. No ads or tracking.
                            {" "}See our{" "}
                            <Link href="/privacy-policy" className="text-[#1877f2] font-semibold hover:underline">
                                Privacy Policy
                            </Link>
                            {" "}for details.
                        </p>
                    </div>
                </div>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={handleAccept}
                        className="min-w-[112px] whitespace-nowrap rounded-xl bg-[#1877f2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1664d9] sm:px-6"
                    >
                        Got it
                    </button>
                </div>
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
