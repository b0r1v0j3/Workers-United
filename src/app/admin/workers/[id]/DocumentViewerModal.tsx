"use client";

import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import Image from "next/image";

interface DocumentViewerModalProps {
    url: string;
    documentType: string;
    status: string;
    children: React.ReactNode;
}

export default function DocumentViewerModal({ url, documentType, status, children }: DocumentViewerModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const isPdf = url.toLowerCase().includes('.pdf');

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

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="w-full mt-3 bg-[#f8fbff] text-[#2f6fed] border border-[#2f6fed]/20 px-4 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
                Review Document
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
                        <iframe src={`${url}#view=FitH`} className="w-full h-full rounded bg-white" title={documentType} />
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
                <div className="p-5 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 capitalize">{documentType}</h2>
                        <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                            Status: <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded-full bg-slate-100">{status}</span>
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
