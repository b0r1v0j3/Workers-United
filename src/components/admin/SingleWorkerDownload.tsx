"use client";

import { useState } from "react";

export default function SingleWorkerDownload({ profileId, workerName }: { profileId: string; workerName: string }) {
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        setError(null);

        try {
            const res = await fetch("/api/contracts/download-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workerIds: [profileId] }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Download failed");
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const safeName = workerName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
            a.download = `${safeName}_Documents.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            setError("Network error");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className="mb-5">
                <div className="inline-flex rounded-full border border-[#e3ded2] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                    Export
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#18181b]">Worker document bundle</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#57534e]">
                    Download the generated PDF set together with the uploaded worker files in a single ZIP.
                </p>
            </div>
            {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                </div>
            )}
            <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full rounded-xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#27272a] disabled:opacity-50"
            >
                {downloading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Preparing...
                    </span>
                ) : (
                    "Download full ZIP"
                )}
            </button>
            <p className="mt-3 text-center text-[11px] text-[#8a8479]">
                Includes generated PDFs plus passport, biometric photo, and diploma
            </p>
        </div>
    );
}
