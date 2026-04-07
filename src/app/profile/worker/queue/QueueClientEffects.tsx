"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Loader2, Gem } from "lucide-react";
import { getQueuePaymentReturnMode } from "@/lib/queue-payment-return";

export default function QueueClientEffects() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const payment = searchParams.get("payment");
        const sessionId = searchParams.get("session_id");
        const returnMode = getQueuePaymentReturnMode(payment, sessionId);

        let cancelled = false;

        const handleSuccess = async () => {
            if (returnMode === "ignore" || returnMode === "sandbox_success" || returnMode === "cancelled") return;

            if (returnMode === "confirm_session" && sessionId) {
                try {
                    const res = await fetch("/api/stripe/confirm-session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionId }),
                    });
                    const data = await res.json();

                    if (cancelled) return;

                    if (res.ok && data.state === "paid") {
                        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
                        toast.success("Payment verified. You are now active in the queue.");
                    } else if (data.state === "pending") {
                        toast.info("Payment is still processing. Refresh in a few seconds.");
                    } else {
                        toast.warning(data.error || "Payment was detected, but final activation is pending.");
                    }
                } catch {
                    if (!cancelled) {
                        toast.warning("Payment return detected. Verification is still in progress.");
                    }
                }
            } else {
                toast.warning("Payment return detected, but final verification is still pending.");
            }

            // Clean URL without reload
            window.history.replaceState({}, "", "/profile/worker/queue");
        };

        void handleSuccess();

        if (returnMode === "sandbox_success") {
            confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
            toast.success("Sandbox payment completed. Queue state is now active.");
            window.history.replaceState({}, "", "/profile/worker/queue");
        }

        if (returnMode === "cancelled") {
            toast.info("Payment cancelled. You can try again when you're ready.");
            window.history.replaceState({}, "", "/profile/worker/queue");
        }

        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    return null;
}

export function PayToJoinButton({
    displayName,
    source = "queue_page",
    redirectPath = "/profile/worker/queue",
    adminTestMode = false,
}: {
    displayName: string;
    source?: string;
    redirectPath?: string;
    adminTestMode?: boolean;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handlePay = async () => {
        setLoading(true);
        setError("");

        // Track the payment click
        if (!adminTestMode) {
            fetch("/api/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "payment_click", category: "funnel", details: { type: "entry_fee", source } }),
            }).catch(() => { });
        }

        try {
            const res = await fetch("/api/stripe/create-checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "entry_fee",
                    source,
                    successPath: redirectPath,
                    cancelPath: redirectPath,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (typeof data.error === "string" && data.error.toLowerCase().includes("already paid")) {
                    toast.success("Payment already confirmed. Refreshing queue status.");
                    window.location.href = redirectPath;
                    return;
                }
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
        <div className="flex flex-col items-center gap-3 w-full sm:w-[280px] mx-auto">
            <button
                onClick={handlePay}
                disabled={loading}
                className="group relative overflow-hidden shrink-0 bg-gradient-to-tr from-[#111111] to-[#2a2a2a] text-white w-full h-[160px] rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:scale-100 flex flex-col justify-between p-5 text-left border border-[#333333]"
            >
                {/* Glossy overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />

                {/* Top row: Chip and Label */}
                <div className="flex justify-between items-start relative z-10">
                    <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-200 to-yellow-500 opacity-90 flex items-center justify-center shadow-inner">
                        <div className="w-full h-[1px] bg-black/20 absolute" />
                        <div className="h-full w-[1px] bg-black/20 absolute" />
                        <Gem size={12} className="text-yellow-900/40 relative z-10" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Priority</span>
                </div>

                {/* Middle: Value & Status */}
                <div className="relative z-10 space-y-1 mt-2">
                    {loading ? (
                        <div className="flex items-center gap-2 text-white"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Processing...</span></div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-xl tracking-tight font-semibold">Pay $9.00</span>
                            <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/90 font-medium group-hover:bg-white/20 transition-colors">Start Search</span>
                        </div>
                    )}
                </div>

                {/* Bottom: Name */}
                <div className="relative z-10 pt-2 border-t border-white/10 flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">Cardholder Name</span>
                        <span className="text-xs font-medium tracking-wide truncate max-w-[150px] text-white/80 uppercase">
                            {displayName.substring(0, 22)}
                        </span>
                    </div>
                    <div className="flex -space-x-1.5 opacity-80">
                        <div className="w-5 h-5 rounded-full bg-red-400 mix-blend-multiply" />
                        <div className="w-5 h-5 rounded-full bg-yellow-400 mix-blend-multiply" />
                    </div>
                </div>

                {/* Decorative background circle */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors duration-500 pointer-events-none" />
            </button>
            {error && (
                <p className="text-red-600 text-sm font-medium bg-red-50 px-4 py-2 rounded-lg border border-red-200 text-center w-full">
                    {error}
                </p>
            )}
        </div>
    );
}
