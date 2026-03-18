"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Crop, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";

type CropSelection = {
    x: number;
    y: number;
    width: number;
    height: number;
};

interface DocumentViewerModalProps {
    url: string;
    documentId: string;
    documentType: string;
    status: string;
    isPdf: boolean;
    children: ReactNode;
}

function formatPercent(value: number) {
    return `${value.toFixed(1)}%`;
}

export default function DocumentViewerModal({
    url,
    documentId,
    documentType,
    status,
    isPdf,
    children,
}: DocumentViewerModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [imageVersion, setImageVersion] = useState(0);
    const [cropMode, setCropMode] = useState(false);
    const [cropSelection, setCropSelection] = useState<CropSelection | null>(null);
    const [cropError, setCropError] = useState<string | null>(null);
    const [cropSuccess, setCropSuccess] = useState<string | null>(null);
    const [isSavingCrop, setIsSavingCrop] = useState(false);
    const [isDrawingCrop, setIsDrawingCrop] = useState(false);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const cropStartRef = useRef<{ x: number; y: number } | null>(null);

    const previewUrl = useMemo(() => {
        const separator = url.includes("?") ? "&" : "?";
        return `${url}${separator}preview_ts=${imageVersion}`;
    }, [url, imageVersion]);

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
        if (!cropMode) {
            setIsDrawingCrop(false);
            cropStartRef.current = null;
        }
    }, [cropMode]);

    useEffect(() => {
        if (!isDrawingCrop) {
            return;
        }

        const handleWindowPointerUp = () => {
            setIsDrawingCrop(false);
            cropStartRef.current = null;
        };

        window.addEventListener("pointerup", handleWindowPointerUp);
        return () => {
            window.removeEventListener("pointerup", handleWindowPointerUp);
        };
    }, [isDrawingCrop]);

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

    function resetCropUi() {
        setCropSelection(null);
        setCropError(null);
        setCropSuccess(null);
        setIsDrawingCrop(false);
        cropStartRef.current = null;
    }

    function startCropMode() {
        setZoom(1);
        setRotation(0);
        resetCropUi();
        setCropMode(true);
    }

    function cancelCropMode() {
        resetCropUi();
        setCropMode(false);
    }

    function getRelativePoint(clientX: number, clientY: number) {
        const rect = imageRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        const rawX = ((clientX - rect.left) / rect.width) * 100;
        const rawY = ((clientY - rect.top) / rect.height) * 100;

        return {
            x: Math.max(0, Math.min(100, rawX)),
            y: Math.max(0, Math.min(100, rawY)),
        };
    }

    function updateCropSelection(current: { x: number; y: number }) {
        const start = cropStartRef.current;
        if (!start) {
            return;
        }

        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);

        setCropSelection({ x, y, width, height });
    }

    function handleCropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        const point = getRelativePoint(event.clientX, event.clientY);
        if (!point) {
            return;
        }

        setCropError(null);
        setCropSuccess(null);
        cropStartRef.current = point;
        setCropSelection({ x: point.x, y: point.y, width: 0, height: 0 });
        setIsDrawingCrop(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function handleCropPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (!isDrawingCrop) {
            return;
        }

        const point = getRelativePoint(event.clientX, event.clientY);
        if (!point) {
            return;
        }

        updateCropSelection(point);
    }

    function handleCropPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
        if (!isDrawingCrop) {
            return;
        }

        const point = getRelativePoint(event.clientX, event.clientY);
        if (point) {
            updateCropSelection(point);
        }

        setIsDrawingCrop(false);
        cropStartRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    }

    async function saveManualCrop() {
        if (!cropSelection || isSavingCrop) {
            return;
        }

        if (cropSelection.width < 3 || cropSelection.height < 3) {
            setCropError("Draw a larger crop box before saving.");
            return;
        }

        setIsSavingCrop(true);
        setCropError(null);
        setCropSuccess(null);

        try {
            const response = await fetch(url, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ crop: cropSelection, documentId }),
            });

            const data = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) {
                throw new Error(data?.error || `Crop request failed (${response.status})`);
            }

            setImageVersion(Date.now());
            setCropSuccess("Crop saved. The preview has been refreshed and the original file backup was preserved.");
            setCropMode(false);
            setCropSelection(null);
        } catch (error) {
            setCropError(error instanceof Error ? error.message : "Failed to save the crop.");
        } finally {
            setIsSavingCrop(false);
        }
    }

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
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 animate-in fade-in duration-200 md:flex-row">
            <div className="relative flex h-[60vh] flex-1 flex-col border-b border-white/20 md:h-full md:border-b-0 md:border-r">
                <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
                    <div className="flex gap-1 rounded-lg border border-white/10 bg-black/50 p-1 backdrop-blur-md">
                        {isPdf ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10">
                                Open in New Tab
                            </a>
                        ) : (
                            <>
                                <button
                                    onClick={() => setZoom((value) => Math.min(value + 0.25, 3))}
                                    className="rounded p-1.5 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                                    title="Zoom In"
                                    disabled={cropMode}
                                >
                                    <ZoomIn size={16} />
                                </button>
                                <button
                                    onClick={() => setZoom((value) => Math.max(value - 0.25, 0.5))}
                                    className="rounded p-1.5 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                                    title="Zoom Out"
                                    disabled={cropMode}
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <button
                                    onClick={() => setRotation((value) => value + 90)}
                                    className="rounded p-1.5 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                                    title="Rotate"
                                    disabled={cropMode}
                                >
                                    <RotateCw size={16} />
                                </button>
                                <button
                                    onClick={cropMode ? cancelCropMode : startCropMode}
                                    className={`rounded p-1.5 text-white transition hover:bg-white/20 ${cropMode ? "bg-white/20" : ""}`}
                                    title={cropMode ? "Cancel crop" : "Start manual crop"}
                                >
                                    <Crop size={16} />
                                </button>
                            </>
                        )}
                    </div>
                    <button onClick={() => setIsOpen(false)} className="rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur-md md:hidden">
                        <X size={20} />
                    </button>
                </div>

                <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[#0f172a] p-4">
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
                            <iframe src={`${pdfBlobUrl}#view=FitH`} className="h-full w-full rounded bg-white" title={documentType} />
                        )
                    ) : (
                        <div
                            className="origin-center transition-transform duration-200"
                            style={cropMode ? undefined : { transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                        >
                            <div className="relative inline-block select-none">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    ref={imageRef}
                                    src={previewUrl}
                                    alt={documentType}
                                    className="max-h-[85vh] max-w-full rounded object-contain drop-shadow-2xl"
                                    draggable={false}
                                />

                                {cropMode ? (
                                    <div
                                        className="absolute inset-0 cursor-crosshair touch-none rounded"
                                        onPointerDown={handleCropPointerDown}
                                        onPointerMove={handleCropPointerMove}
                                        onPointerUp={handleCropPointerUp}
                                    >
                                        <div className="absolute inset-0 rounded border border-dashed border-white/35 bg-black/10" />
                                        {cropSelection ? (
                                            <div
                                                className="absolute border-2 border-sky-300 bg-sky-300/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]"
                                                style={{
                                                    left: `${cropSelection.x}%`,
                                                    top: `${cropSelection.y}%`,
                                                    width: `${cropSelection.width}%`,
                                                    height: `${cropSelection.height}%`,
                                                }}
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex h-[40vh] w-full flex-col overflow-y-auto bg-white md:h-full md:w-[420px]">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e7e5e4] bg-white p-5">
                    <div>
                        <h2 className="text-xl font-semibold capitalize text-slate-900">{documentType}</h2>
                        <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                            Status: <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase">{status}</span>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="hidden rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 md:flex">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 flex-col gap-6 p-5">
                    {!isPdf ? (
                        <div className="rounded-[22px] border border-[#dbe7ff] bg-[#f5f9ff] p-4">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3b82f6]">
                                <Crop size={14} />
                                Manual crop tool
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-700">
                                Use this when AI kept extra page content, background, or margins. Draw a box over only the part you want to keep, then save.
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-slate-500">
                                Saving a crop refreshes this preview immediately and keeps an admin backup of the original image in storage.
                            </p>

                            {cropSelection ? (
                                <div className="mt-3 rounded-xl border border-[#d8e6ff] bg-white px-3 py-2 text-xs text-slate-600">
                                    Selection: {formatPercent(cropSelection.width)} wide x {formatPercent(cropSelection.height)} high
                                </div>
                            ) : null}

                            {cropError ? (
                                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                    {cropError}
                                </div>
                            ) : null}

                            {cropSuccess ? (
                                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                                    {cropSuccess}
                                </div>
                            ) : null}

                            <div className="mt-4 flex flex-wrap gap-2">
                                {!cropMode ? (
                                    <button
                                        type="button"
                                        onClick={startCropMode}
                                        className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
                                    >
                                        Start manual crop
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setCropSelection(null)}
                                            className="rounded-xl border border-[#d6d3d1] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                        >
                                            Clear selection
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelCropMode}
                                            className="rounded-xl border border-[#d6d3d1] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveManualCrop}
                                            disabled={!cropSelection || isSavingCrop}
                                            className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
                                        >
                                            {isSavingCrop ? "Saving crop..." : "Save crop"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {children}
                </div>
            </div>
        </div>
    );
}
