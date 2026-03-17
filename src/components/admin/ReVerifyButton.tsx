"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReVerifyButton({ documentId }: { documentId: string }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ type: "success" | "warning" | "error"; msg: string } | null>(null);
    const router = useRouter();

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
                const resultType = data.success === false
                    ? data.status === "manual_review"
                        ? "warning"
                        : "error"
                    : data.status === "manual_review"
                        ? "warning"
                    : "success";
                setResult({
                    type: resultType,
                    msg: data.message || "Re-verification complete.",
                });
                router.refresh();
            }
        } catch {
            setResult({ type: "error", msg: "Network error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleReVerify}
                disabled={loading}
                className="w-full rounded-xl border border-[#ddd8cb] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:bg-[#faf8f3] disabled:opacity-50"
            >
                {loading ? "Re-verifying..." : "Run AI re-verification"}
            </button>
            {result && (
                <span className={`text-[11px] font-medium ${result.type === "success"
                    ? "text-emerald-600"
                    : result.type === "warning"
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}>
                    {result.msg}
                </span>
            )}
        </div>
    );
}
