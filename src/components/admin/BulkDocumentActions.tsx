"use client";

import { useState, useEffect, useCallback } from "react";

interface WorkerStatus {
    matchId: string;
    profileId: string | null;
    name: string;
    email: string | null;
    generatedAt: string | null;
    generatedDocsCount: number;
    uploadedDocsTotal: number;
    uploadedDocsVerified: number;
    isReady: boolean;
}

export default function BulkDocumentActions() {
    const [generating, setGenerating] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [genResult, setGenResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [workers, setWorkers] = useState<WorkerStatus[]>([]);
    const [loadingWorkers, setLoadingWorkers] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showPreview, setShowPreview] = useState(false);

    const fetchWorkers = useCallback(async () => {
        setLoadingWorkers(true);
        try {
            const res = await fetch("/api/admin/document-status");
            const data = await res.json();
            setWorkers(data.workers || []);
            // Auto-select all ready workers
            const readyIds = new Set(
                (data.workers || [])
                    .filter((w: WorkerStatus) => w.isReady)
                    .map((w: WorkerStatus) => w.profileId)
                    .filter(Boolean) as string[]
            );
            setSelected(readyIds);
        } catch {
            setWorkers([]);
        } finally {
            setLoadingWorkers(false);
        }
    }, []);

    useEffect(() => {
        if (showPreview && workers.length === 0) {
            fetchWorkers();
        }
    }, [showPreview, workers.length, fetchWorkers]);

    const toggleWorker = (profileId: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(profileId)) {
                next.delete(profileId);
            } else {
                next.add(profileId);
            }
            return next;
        });
    };

    const selectAll = () => {
        const readyIds = workers
            .filter(w => w.isReady && w.profileId)
            .map(w => w.profileId!);
        setSelected(new Set(readyIds));
    };

    const selectNone = () => setSelected(new Set());

    const handleBulkGenerate = async (forceRegenerate = false) => {
        if (generating) return;
        setGenerating(true);
        setGenResult(null);
        setError(null);

        try {
            const res = await fetch("/api/contracts/generate-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ forceRegenerate }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Generation failed");
            } else {
                setGenResult(data);
                // Refresh preview if it's open
                if (showPreview) {
                    setWorkers([]);
                    fetchWorkers();
                }
            }
        } catch {
            setError("Network error during generation");
        } finally {
            setGenerating(false);
        }
    };

    const handleBulkDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        setError(null);

        const workerIds = Array.from(selected);

        try {
            const res = await fetch("/api/contracts/download-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workerIds: workerIds.length > 0 ? workerIds : undefined }),
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
            a.download = `WorkersUnited_Documents_${new Date().toISOString().split("T")[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            setError("Network error during download");
        } finally {
            setDownloading(false);
        }
    };

    const readyWorkers = workers.filter(w => w.isReady);
    const notReadyWorkers = workers.filter(w => !w.isReady);

    return (
        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
            <h2 className="font-bold text-[#1e293b] text-xl mb-1">📄 Bulk Document Actions</h2>
            <p className="text-[#64748b] text-sm mb-4">Generate and download all visa documents</p>

            {error && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                    {error}
                </div>
            )}

            {genResult && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <div className="font-bold">✅ {genResult.message}</div>
                    {genResult.errors?.length > 0 && (
                        <ul className="mt-1 text-xs list-disc pl-4">
                            {genResult.errors.map((e: any, i: number) => (
                                <li key={i} className="text-amber-700">
                                    {e.worker}: {e.error}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Generation Buttons */}
            <div className="flex flex-wrap gap-3 mb-4">
                <button
                    onClick={() => handleBulkGenerate(false)}
                    disabled={generating}
                    className="flex-1 min-w-[180px] bg-gradient-to-r from-[#2f6fed] to-[#1e5cd6] text-white py-3 rounded-lg font-bold text-sm hover:from-[#1e5cd6] hover:to-[#1550c0] disabled:opacity-50 transition-all"
                >
                    {generating ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating...
                        </span>
                    ) : (
                        "📝 Generate New Documents"
                    )}
                </button>

                <button
                    onClick={() => handleBulkGenerate(true)}
                    disabled={generating}
                    className="bg-amber-500 text-white py-3 px-4 rounded-lg font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    title="Regenerate all, including already generated"
                >
                    🔄 Regenerate All
                </button>
            </div>

            {/* Preview / Select Toggle */}
            <div className="border-t border-[#f1f5f9] pt-4">
                <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-[#2f6fed] font-bold text-sm hover:underline mb-3"
                >
                    {showPreview ? "▼ Hide Worker List" : "▶ Show Workers & Select for Download"}
                </button>

                {showPreview && (
                    <div className="space-y-3">
                        {loadingWorkers ? (
                            <div className="text-center py-4 text-[#64748b] text-sm">Loading workers...</div>
                        ) : workers.length === 0 ? (
                            <div className="text-center py-4 text-[#94a3b8] italic text-sm">
                                No matched workers with contract data found
                            </div>
                        ) : (
                            <>
                                {/* Select All / None */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-[#64748b] font-medium">
                                        {selected.size} of {readyWorkers.length} ready workers selected
                                    </span>
                                    <div className="flex gap-2">
                                        <button onClick={selectAll} className="text-xs text-[#2f6fed] font-bold hover:underline">Select All</button>
                                        <span className="text-[#dde3ec]">|</span>
                                        <button onClick={selectNone} className="text-xs text-[#64748b] font-bold hover:underline">None</button>
                                    </div>
                                </div>

                                {/* Ready workers */}
                                {readyWorkers.length > 0 && (
                                    <div className="space-y-1">
                                        {readyWorkers.map(w => (
                                            <label
                                                key={w.matchId}
                                                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selected.has(w.profileId!)
                                                        ? "border-[#2f6fed] bg-[#f0f7ff]"
                                                        : "border-[#f1f5f9] hover:border-[#dde3ec]"
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(w.profileId!)}
                                                    onChange={() => toggleWorker(w.profileId!)}
                                                    className="rounded border-slate-300 text-[#2f6fed] focus:ring-[#2f6fed]"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-[#1e293b] text-sm truncate">{w.name}</div>
                                                    <div className="text-[11px] text-[#64748b]">
                                                        {w.generatedDocsCount} docs generated
                                                        {w.generatedAt && ` · ${new Date(w.generatedAt).toLocaleDateString("en-GB")}`}
                                                    </div>
                                                </div>
                                                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700">
                                                    ✓ Ready
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {/* Not ready workers */}
                                {notReadyWorkers.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[11px] text-[#94a3b8] font-bold uppercase mt-2">Not Ready</div>
                                        {notReadyWorkers.map(w => (
                                            <div
                                                key={w.matchId}
                                                className="flex items-center gap-3 p-2.5 rounded-lg border border-[#f1f5f9] opacity-60"
                                            >
                                                <input type="checkbox" disabled className="rounded border-slate-300" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-[#1e293b] text-sm truncate">{w.name}</div>
                                                    <div className="text-[11px] text-[#64748b]">
                                                        {w.generatedDocsCount}/4 docs · {w.uploadedDocsVerified} verified uploads
                                                    </div>
                                                </div>
                                                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700">
                                                    Pending
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Download Button */}
                <button
                    onClick={handleBulkDownload}
                    disabled={downloading || (showPreview && selected.size === 0)}
                    className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 rounded-lg font-bold text-sm hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
                >
                    {downloading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Preparing ZIP...
                        </span>
                    ) : showPreview ? (
                        `📦 Download Selected (${selected.size} workers)`
                    ) : (
                        "📦 Download All (ZIP)"
                    )}
                </button>
            </div>
        </div>
    );
}
