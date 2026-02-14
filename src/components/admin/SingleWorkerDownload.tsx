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
        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
            <h2 className="font-bold text-[#1e293b] text-xl mb-4">📦 Download Documents</h2>
            {error && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                    {error}
                </div>
            )}
            <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-2.5 rounded-lg font-bold text-sm hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
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
                    "📥 Download All Docs (ZIP)"
                )}
            </button>
            <p className="text-[11px] text-[#94a3b8] mt-2 text-center">
                Generated DOCX + uploaded passport, photo, diploma
            </p>
        </div>
    );
}
