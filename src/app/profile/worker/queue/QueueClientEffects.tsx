"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";

export default function QueueClientEffects() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const payment = searchParams.get("payment");
        if (payment === "success") {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            toast.success("Payment successful! You're now in the active queue.");
            // Clean URL without reload
            window.history.replaceState({}, "", "/profile/worker/queue");
        } else if (payment === "cancelled") {
            toast.info("Payment cancelled. You can try again when you're ready.");
            window.history.replaceState({}, "", "/profile/worker/queue");
        }
    }, [searchParams]);

    return null;
}

export function PayToJoinButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handlePay = async () => {
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/stripe/create-checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "entry_fee" }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Something went wrong. Please try again.");
                setLoading(false);
                return;
            }

            // Redirect to Stripe Checkout
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
        } catch {
            setError("Network error. Please check your connection and try again.");
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <button
                onClick={handlePay}
                disabled={loading}
                className="bg-[#1877f2] text-white font-bold py-3 px-8 rounded-lg hover:bg-[#166fe5] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                    </>
                ) : (
                    "Pay $9 to Join Queue"
                )}
            </button>
            {error && (
                <p className="text-red-600 text-sm font-medium bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                    {error}
                </p>
            )}
        </div>
    );
}
