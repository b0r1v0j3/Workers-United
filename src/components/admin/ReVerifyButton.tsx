"use client";

import { useState } from "react";

export default function ReVerifyButton({ documentId }: { documentId: string }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);

    const handleReVerify = async () => {
        if (loading) return;
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch("/api/admin/re-verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId }),
            });

            const data = await res.json();

            if (!res.ok) {
                setResult({ type: "error", msg: data.error || "Verification failed" });
            } else {
                setResult({ type: "success", msg: "Re-verification complete! Refresh to see results." });
            }
        } catch {
            setResult({ type: "error", msg: "Network error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="inline-flex flex-col">
            <button
                onClick={handleReVerify}
                disabled={loading}
                className="bg-purple-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-purple-600 disabled:opacity-50 transition-colors"
            >
                {loading ? "🔄 Verifying..." : "🤖 Re-Verify"}
            </button>
            {result && (
                <span className={`mt-1 text-[10px] font-medium ${result.type === "success" ? "text-emerald-600" : "text-red-600"
                    }`}>
                    {result.msg}
                </span>
            )}
        </div>
    );
}
