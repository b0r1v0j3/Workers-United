"use client";

import DocumentWizard from "@/components/DocumentWizard";
import { CheckCircle2, AlertCircle, Loader2, Upload, Clock, FileText } from "lucide-react";

interface DocumentsClientProps {
    workerProfileId: string;
    email: string;
    documents: any[];
    readOnlyPreview?: boolean;
    adminTestMode?: boolean;
}

const surfaceClass = "relative rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-xl sm:border sm:border-gray-200 sm:bg-white sm:p-8 sm:shadow-sm sm:before:hidden";
const previewSurfaceClass = "relative rounded-none border-0 bg-transparent px-1 pt-5 text-sm text-blue-900 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#dbeafe] sm:rounded-xl sm:border sm:border-blue-200 sm:bg-blue-50 sm:p-6 sm:before:hidden";

export default function DocumentsClient({ workerProfileId, email, documents, readOnlyPreview = false, adminTestMode = false }: DocumentsClientProps) {

    const getDocStatus = (type: string) => {
        const doc = documents.find(d => d.document_type === type);
        if (!doc) return { status: "missing", label: "Not uploaded", color: "gray", icon: Upload };
        if (doc.status === "verified") return { status: "verified", label: "Verified", color: "emerald", icon: CheckCircle2 };
        if (doc.status === "manual_review") return { status: "manual_review", label: "Awaiting review", color: "amber", icon: Clock };
        if (doc.status === "rejected") return { status: "rejected", label: "Rejected", color: "red", icon: AlertCircle };
        if (doc.status === "verifying") return { status: "verifying", label: "Verifying...", color: "amber", icon: Loader2 };
        return { status: "uploaded", label: "Uploaded", color: "blue", icon: Clock };
    };

    const hasAllDocs = documents.length >= 3;

    return (
        <div className="w-full space-y-6">
            {readOnlyPreview ? (
                <div className={previewSurfaceClass}>
                    Admin preview is read-only. Document upload is disabled here.
                </div>
            ) : !hasAllDocs && (
                <div className={surfaceClass}>
                    <div className="mb-6">
                        <h3 className="font-semibold text-gray-900 text-xl">Upload Documents</h3>
                        <p className="text-gray-500 mt-1">
                            {adminTestMode
                                ? "Sandbox uploads are auto-verified so you can inspect the mobile document flow quickly."
                                : "Please ensure all documents are clear and readable."}
                        </p>
                    </div>
                    <DocumentWizard workerProfileId={workerProfileId} email={email} adminTestMode={adminTestMode} />
                </div>
            )}

            <div className={surfaceClass}>
                <h3 className="font-semibold text-gray-900 text-xl mb-6">Document Status</h3>
                <div className="space-y-4">
                    <DocumentRow label="Passport" type="passport" status={getDocStatus("passport")} />
                    <DocumentRow label="Biometric Photo" type="biometric_photo" status={getDocStatus("biometric_photo")} />
                    <DocumentRow label="Diploma / Certificate" type="diploma" status={getDocStatus("diploma")} />
                </div>
            </div>
        </div>
    );
}

function DocumentRow({ label, type, status }: { label: string, type: string, status: any }) {
    const IconComponent = status.icon;
    const colorMap: Record<string, string> = {
        emerald: "text-emerald-700 bg-emerald-50 border-emerald-100",
        red: "text-red-700 bg-red-50 border-red-100",
        amber: "text-amber-700 bg-amber-50 border-amber-100",
        blue: "text-blue-700 bg-blue-50 border-blue-100",
        gray: "text-gray-600 bg-gray-50 border-gray-200",
    };

    return (
        <div className={`flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${colorMap[status.color] || colorMap.gray}`}>
            <div className="flex min-w-0 items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center border border-current/10">
                    <FileText size={18} className="opacity-80" />
                </div>
                <div className="min-w-0">
                    <h4 className="font-semibold text-sm">{label}</h4>
                    <p className="text-xs opacity-70 font-medium mt-0.5">{type.replace(/_/g, ' ')}</p>
                </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-white/60 border border-current/10`}>
                    {status.label}
                </span>
                <IconComponent size={18} className={status.color === 'amber' ? 'animate-spin' : ''} />
            </div>
        </div>
    );
}
