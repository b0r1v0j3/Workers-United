"use client";

import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface DocumentViewerModalProps {
    url: string;
    documentType: string;
    status: string;
    isPdf: boolean;
    children: React.ReactNode;
}

export default function DocumentViewerModal({ url, documentType, status, isPdf, children }: DocumentViewerModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    // Prevent scrolling on body when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
        return () => {
            document.body.style.overflow = "auto";
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !isPdf) {
            setPdfLoading(false);
            setPdfError(null);
            setPdfBlobUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return null;
            });
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        async function loadPdfPreview() {
            try {
                setPdfLoading(true);
                setPdfError(null);

                const response = await fetch(url, {
                    method: "GET",
                    credentials: "same-origin",
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Preview request failed (${response.status})`);
                }

                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);

                if (cancelled) {
                    URL.revokeObjectURL(objectUrl);
                    return;
                }

                setPdfBlobUrl((current) => {
                    if (current) URL.revokeObjectURL(current);
                    return objectUrl;
                });
            } catch (error) {
                if (cancelled || controller.signal.aborted) return;
                setPdfError(error instanceof Error ? error.message : "Failed to load PDF preview");
            } finally {
                if (!cancelled) {
                    setPdfLoading(false);
                }
            }
        }

        void loadPdfPreview();

        return () => {
            cancelled = true;
            controller.abort();
            setPdfBlobUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return null;
            });
        };
    }, [isOpen, isPdf, url]);

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#ddd8cb] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:bg-[#faf8f3]"
            >
                Open document review
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col md:flex-row animate-in fade-in duration-200">
            {/* Left/Top: Document Viewer */}
            <div className="flex-1 relative flex flex-col h-[60vh] md:h-full border-b md:border-b-0 md:border-r border-white/20">
                {/* Toolbar */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
                    <div className="flex bg-black/50 backdrop-blur-md rounded-lg p-1 gap-1 border border-white/10">
                        {isPdf ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-white text-xs px-3 py-1.5 font-medium hover:bg-white/10 rounded">
                                Open in New Tab
                            </a>
                        ) : (
                            <>
                                <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} className="p-1.5 text-white hover:bg-white/20 rounded" title="Zoom In"><ZoomIn size={16} /></button>
                                <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="p-1.5 text-white hover:bg-white/20 rounded" title="Zoom Out"><ZoomOut size={16} /></button>
                                <button onClick={() => setRotation(r => r + 90)} className="p-1.5 text-white hover:bg-white/20 rounded" title="Rotate"><RotateCw size={16} /></button>
                            </>
                        )}
                    </div>
                    {/* Mobile Close Button */}
                    <button onClick={() => setIsOpen(false)} className="md:hidden bg-white/10 text-white p-2 rounded-full backdrop-blur-md border border-white/20">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto flex items-center justify-center bg-[#0f172a] p-4 relative">
                    {isPdf ? (
                        pdfError ? (
                            <div className="flex max-w-md flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-white">
                                <p className="text-sm font-semibold">PDF preview could not be loaded inline.</p>
                                <p className="mt-2 text-sm text-white/75">{pdfError}</p>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#18181b] transition hover:bg-[#f5f5f5]"
                                >
                                    Open document in new tab
                                </a>
                            </div>
                        ) : pdfLoading || !pdfBlobUrl ? (
                            <div className="flex flex-col items-center justify-center text-center text-white">
                                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                <p className="mt-4 text-sm font-medium text-white/80">Loading PDF preview...</p>
                            </div>
                        ) : (
                            <iframe src={`${pdfBlobUrl}#view=FitH`} className="w-full h-full rounded bg-white" title={documentType} />
                        )
                    ) : (
                        <div
                            className="transition-transform duration-200 origin-center"
                            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt={documentType}
                                className="max-w-full max-h-full object-contain rounded drop-shadow-2xl"
                                style={{ maxHeight: '85vh' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Right/Bottom: Actions Sidebar */}
            <div className="w-full md:w-[420px] bg-white flex flex-col h-[40vh] md:h-full overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e7e5e4] bg-white p-5">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 capitalize">{documentType}</h2>
                        <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                            Status: <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase">{status}</span>
                        </div>
                    </div>
                    {/* Desktop Close Button */}
                    <button onClick={() => setIsOpen(false)} className="hidden md:flex bg-slate-100 text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 flex-1 flex flex-col gap-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
