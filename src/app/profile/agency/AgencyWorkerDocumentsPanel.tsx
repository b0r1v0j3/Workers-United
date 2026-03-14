"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Clock3, Loader2, ShieldAlert, Upload } from "lucide-react";
import { MAX_FILE_SIZE_MB } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type AgencyDocType = "passport" | "biometric_photo" | "diploma";

export interface WorkerDocumentState {
    document_type: string;
    status: string | null;
    reject_reason: string | null;
}

export interface AgencyWorkerDocumentsData {
    workerId: string;
    profileId: string | null;
    verifiedDocuments: number;
    documents: WorkerDocumentState[];
}

interface AgencyWorkerDocumentsPanelProps {
    workerId: string;
    initialData?: AgencyWorkerDocumentsData | null;
    readOnlyPreview?: boolean;
    adminTestMode?: boolean;
    inspectProfileId?: string | null;
    className?: string;
    onUpdated?: () => void;
}

const documentDefinitions: Array<{ key: AgencyDocType; label: string; helper: string }> = [
    { key: "passport", label: "Passport", helper: "Upload the main passport photo page." },
    { key: "biometric_photo", label: "Biometric photo", helper: "Clear front-facing photo with a neutral background." },
    { key: "diploma", label: "Diploma", helper: "School or university diploma for visa processing." },
];

function getDocumentLabel(docType: AgencyDocType) {
    if (docType === "biometric_photo") return "Biometric photo";
    if (docType === "diploma") return "Diploma";
    return "Passport";
}

function getDocumentState(status: string | null | undefined) {
    switch (status) {
        case "verified":
            return {
                label: "Verified",
                icon: <CheckCircle2 size={14} />,
                containerClass: "border-emerald-200 bg-emerald-50/70",
                badgeClass: "border-emerald-200 bg-white text-emerald-700",
            };
        case "manual_review":
            return {
                label: "Manual review",
                icon: <Clock3 size={14} />,
                containerClass: "border-amber-200 bg-amber-50/80",
                badgeClass: "border-amber-200 bg-white text-amber-700",
            };
        case "rejected":
            return {
                label: "Rejected",
                icon: <ShieldAlert size={14} />,
                containerClass: "border-rose-200 bg-rose-50/70",
                badgeClass: "border-rose-200 bg-white text-rose-700",
            };
        case "uploaded":
        case "verifying":
            return {
                label: status === "verifying" ? "Verifying" : "Uploaded",
                icon: <Loader2 size={14} className={status === "verifying" ? "animate-spin" : ""} />,
                containerClass: "border-sky-200 bg-sky-50/80",
                badgeClass: "border-sky-200 bg-white text-sky-700",
            };
        default:
            return {
                label: "Not uploaded",
                icon: <CircleAlert size={14} />,
                containerClass: "border-[#e8e3d7] bg-[#faf8f3]",
                badgeClass: "border-[#e8e3d7] bg-white text-[#6b675d]",
            };
    }
}

export default function AgencyWorkerDocumentsPanel({
    workerId,
    initialData = null,
    readOnlyPreview = false,
    adminTestMode = false,
    inspectProfileId = null,
    className,
    onUpdated,
}: AgencyWorkerDocumentsPanelProps) {
    const router = useRouter();
    const [data, setData] = useState<AgencyWorkerDocumentsData | null>(initialData);
    const [loading, setLoading] = useState(!initialData);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [uploadingDocType, setUploadingDocType] = useState<AgencyDocType | null>(null);
    const [reviewingDocType, setReviewingDocType] = useState<AgencyDocType | null>(null);
    const passportInputRef = useRef<HTMLInputElement | null>(null);
    const biometricInputRef = useRef<HTMLInputElement | null>(null);
    const diplomaInputRef = useRef<HTMLInputElement | null>(null);

    const documentsApiHref = useMemo(() => {
        const params = new URLSearchParams();
        if (inspectProfileId) {
            params.set("inspect", inspectProfileId);
        }
        const query = params.toString();
        return `/api/agency/workers/${workerId}/documents${query ? `?${query}` : ""}`;
    }, [inspectProfileId, workerId]);

    const loadDocuments = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setLoadError(null);

        try {
            const response = await fetch(documentsApiHref, {
                method: "GET",
                cache: "no-store",
                signal,
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || "Failed to load worker documents.");
            }

            setData(responseData.worker as AgencyWorkerDocumentsData);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            setLoadError(error instanceof Error ? error.message : "Failed to load worker documents.");
        } finally {
            setLoading(false);
        }
    }, [documentsApiHref]);

    useEffect(() => {
        if (initialData && initialData.workerId === workerId) {
            setData(initialData);
            setLoadError(null);
            setLoading(false);
            return;
        }

        const abortController = new AbortController();
        void loadDocuments(abortController.signal);
        return () => abortController.abort();
    }, [initialData, loadDocuments, workerId]);

    function getDocument(docType: AgencyDocType) {
        return data?.documents.find((document) => document.document_type === docType);
    }

    function getInputRef(docType: AgencyDocType) {
        if (docType === "passport") return passportInputRef;
        if (docType === "biometric_photo") return biometricInputRef;
        return diplomaInputRef;
    }

    async function refreshAfterUpdate() {
        await loadDocuments();
        router.refresh();
        onUpdated?.();
    }

    async function handleDocumentSelected(docType: AgencyDocType, fileList: FileList | null) {
        if (readOnlyPreview) {
            toast.info("Admin preview is read-only.");
            return;
        }

        const file = fileList?.[0] || null;
        const inputRef = getInputRef(docType);
        if (inputRef.current) {
            inputRef.current.value = "";
        }

        if (!file) {
            return;
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
            return;
        }

        setUploadingDocType(docType);
        try {
            const uploadFormData = new FormData();
            uploadFormData.set("docType", docType);
            uploadFormData.set("file", file);

            const uploadResponse = await fetch(`/api/agency/workers/${workerId}/documents`, {
                method: "POST",
                body: uploadFormData,
            });
            const uploadData = await uploadResponse.json();
            if (!uploadResponse.ok) {
                throw new Error(uploadData.error || "Failed to upload document.");
            }

            const verificationWorkerId = data?.profileId || workerId;
            if (adminTestMode) {
                toast.success(uploadData.message || `${getDocumentLabel(docType)} uploaded in sandbox.`);
            } else {
                const verifyResponse = await fetch("/api/verify-document", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workerId: verificationWorkerId, docType }),
                });
                const verifyData = await verifyResponse.json();
                if (!verifyResponse.ok) {
                    throw new Error(verifyData.error || "Failed to verify document.");
                }

                if (verifyData.success) {
                    toast.success(verifyData.message || `${getDocumentLabel(docType)} verified successfully.`);
                } else {
                    toast.error(verifyData.message || verifyData.error || `${getDocumentLabel(docType)} needs attention.`);
                }

                if (verifyData.reviewQueued) {
                    toast.info("All required documents are in. This profile is now waiting for admin review.");
                }
            }

            await refreshAfterUpdate();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to upload document.");
        } finally {
            setUploadingDocType(null);
        }
    }

    async function handleManualReview(docType: AgencyDocType) {
        if (readOnlyPreview) {
            toast.info("Admin preview is read-only.");
            return;
        }

        if (adminTestMode) {
            toast.info("Sandbox uploads are auto-verified, so manual review is not needed here.");
            return;
        }

        setReviewingDocType(docType);
        try {
            const response = await fetch("/api/documents/request-review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workerId: data?.profileId || workerId, docType }),
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || "Could not request manual review.");
            }

            if (responseData.state === "already_pending") {
                toast.info("Manual review was already requested for this document.");
            } else {
                toast.success("Sent for admin review.");
            }

            await refreshAfterUpdate();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not request manual review.");
        } finally {
            setReviewingDocType(null);
        }
    }

    return (
        <section className={cn("rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]", className)}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-[#18181b]">Documents</h2>
                    <p className="mt-1 text-sm text-[#57534e]">Upload, replace, and review the worker documents from the agency workspace.</p>
                </div>
                <div className="rounded-full border border-[#ece7da] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                    {(data?.verifiedDocuments || 0)}/3 verified
                </div>
            </div>

            {loading && !data ? (
                <div className="mt-6 flex items-center justify-center rounded-2xl border border-[#ece7da] bg-[#faf8f3] px-4 py-8 text-sm text-[#6b675d]">
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Loading documents...
                </div>
            ) : loadError ? (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                    <p>{loadError}</p>
                    <button
                        type="button"
                        onClick={() => void loadDocuments()}
                        className="mt-3 inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <div className="mt-4 space-y-3">
                    {documentDefinitions.map((documentDefinition) => {
                        const document = getDocument(documentDefinition.key);
                        const documentState = getDocumentState(document?.status);
                        const isUploading = uploadingDocType === documentDefinition.key;
                        const isReviewing = reviewingDocType === documentDefinition.key;

                        return (
                            <div key={documentDefinition.key} className={`rounded-2xl border px-4 py-4 ${documentState.containerClass}`}>
                                <input
                                    ref={getInputRef(documentDefinition.key)}
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="hidden"
                                    onChange={(event) => void handleDocumentSelected(documentDefinition.key, event.target.files)}
                                />
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-sm font-semibold text-[#18181b]">{documentDefinition.label}</div>
                                        <div className="mt-1 text-sm text-[#57534e]">{documentDefinition.helper}</div>
                                    </div>
                                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${documentState.badgeClass}`}>
                                        {documentState.icon}
                                        {documentState.label}
                                    </div>
                                </div>

                                {document?.reject_reason ? (
                                    <p className="mt-3 rounded-2xl border border-rose-200 bg-white/80 px-3 py-2 text-sm text-rose-800">
                                        {document.reject_reason}
                                    </p>
                                ) : null}

                                {readOnlyPreview ? (
                                    <p className="mt-3 text-sm text-blue-800">Document actions are disabled in admin preview.</p>
                                ) : (
                                    <div className="mt-4 flex flex-col gap-2">
                                        {adminTestMode ? (
                                            <p className="text-sm text-[#7c6f5d]">
                                                Sandbox uploads go into isolated admin test storage and auto-verify immediately for mobile flow testing.
                                            </p>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => getInputRef(documentDefinition.key).current?.click()}
                                            disabled={isUploading || isReviewing}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:bg-[#faf8f3] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                            {isUploading ? "Uploading..." : document ? "Replace document" : "Upload document"}
                                        </button>
                                        {!adminTestMode && document?.status === "rejected" ? (
                                            <button
                                                type="button"
                                                onClick={() => void handleManualReview(documentDefinition.key)}
                                                disabled={isUploading || isReviewing}
                                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#f0d9a8] bg-[#fff8df] px-4 py-3 text-sm font-semibold text-[#7a5b00] transition hover:bg-[#fff3c1] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {isReviewing ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                                                {isReviewing ? "Sending..." : "Request manual review"}
                                            </button>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
