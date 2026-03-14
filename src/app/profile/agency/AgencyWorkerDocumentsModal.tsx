"use client";

import { createPortal } from "react-dom";
import { FileCheck2, X } from "lucide-react";
import AgencyWorkerDocumentsPanel from "./AgencyWorkerDocumentsPanel";

interface AgencyWorkerDocumentsModalProps {
    open: boolean;
    workerId: string | null;
    workerLabel: string | null;
    readOnlyPreview: boolean;
    adminTestMode?: boolean;
    inspectProfileId?: string | null;
    onClose: () => void;
    onUpdated?: () => void;
}

export default function AgencyWorkerDocumentsModal({
    open,
    workerId,
    workerLabel,
    readOnlyPreview,
    adminTestMode = false,
    inspectProfileId = null,
    onClose,
    onUpdated,
}: AgencyWorkerDocumentsModalProps) {
    if (!open || !workerId || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[130] flex items-stretch justify-center overflow-x-hidden bg-[rgba(15,23,42,0.12)] px-0 py-0 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-5"
            onClick={onClose}
        >
            <div
                className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl min-w-0 flex-col overflow-hidden rounded-none border border-[#e5e7eb] bg-white shadow-[0_44px_140px_-64px_rgba(15,23,42,0.35)] sm:h-[86vh] sm:max-h-[86vh] sm:rounded-[34px]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-[#ececec] px-5 py-4 sm:px-6 sm:py-5">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#ece7da] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                            <FileCheck2 size={13} />
                            Documents
                        </div>
                        <h2 className="mt-3 text-xl font-semibold tracking-tight text-[#111827]">
                            {workerLabel || "Worker documents"}
                        </h2>
                        <p className="mt-1 text-sm text-[#6b7280]">
                            Upload and review required worker documents without opening the full profile editor.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#111827] transition hover:bg-[#fafafa]"
                        aria-label="Close documents"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-6 sm:py-6">
                    <AgencyWorkerDocumentsPanel
                        workerId={workerId}
                        readOnlyPreview={readOnlyPreview}
                        adminTestMode={adminTestMode}
                        inspectProfileId={inspectProfileId}
                        className="rounded-none border-0 p-0 shadow-none"
                        onUpdated={onUpdated}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
}
