"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { processBiometricPhoto, fixImageOrientation, stitchImages, compressImage } from "@/lib/imageUtils";
import { toast } from "sonner";
import { MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { FileText, BookUser, Camera, GraduationCap } from "lucide-react";
import { logActivity, logError } from "@/lib/activityLogger";
import { sanitizeStorageFileName } from "@/lib/workers";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";

interface FileUpload {
    file: File | null;
    status: "missing" | "uploaded" | "verifying" | "verified" | "rejected" | "manual_review" | "error";
    message: string;
}

interface ExistingDocumentStatus {
    document_type: string;
    status: FileUpload["status"] | null;
}

interface DocumentWizardProps {
    workerProfileId: string;
    email: string;
    onComplete?: () => void;
    adminTestMode?: boolean;
}

export default function DocumentWizard({ workerProfileId, email, onComplete, adminTestMode = false }: DocumentWizardProps) {
    const supabase = createClient();
    const [uploads, setUploads] = useState<Record<string, FileUpload>>({
        passport: { file: null, status: "missing", message: "" },
        biometric_photo: { file: null, status: "missing", message: "" },
        diploma: { file: null, status: "missing", message: "" }
    });
    const [isComplete, setIsComplete] = useState(false);

    const passportInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const diplomaInputRef = useRef<HTMLInputElement>(null);

    // Load existing document statuses on mount
    useEffect(() => {
        async function loadExistingDocs() {
            const docs: ExistingDocumentStatus[] = adminTestMode
                ? await fetch("/api/admin/test-personas/worker", { cache: "no-store" })
                    .then(async (response) => {
                        const payload = await response.json();
                        if (!response.ok || !Array.isArray(payload.documents)) {
                            return [] as ExistingDocumentStatus[];
                        }
                        return payload.documents as ExistingDocumentStatus[];
                    })
                : await supabase
                    .from("worker_documents")
                    .select("document_type, status")
                    .eq("user_id", workerProfileId)
                    .then((result) => (result.data as ExistingDocumentStatus[] | null) || []);

            if (docs && docs.length > 0) {
                const updates: Record<string, FileUpload> = { ...uploads };
                let allVerified = true;

                docs.forEach((doc: ExistingDocumentStatus) => {
                    if (doc.status === 'verified') {
                        updates[doc.document_type] = {
                            file: null,
                            status: 'verified',
                            message: '✓ Verified'
                        };
                    } else if (doc.status === 'manual_review') {
                        updates[doc.document_type] = {
                            file: null,
                            status: 'manual_review',
                            message: 'Awaiting admin approval'
                        };
                        allVerified = false;
                    } else if (doc.status === 'uploaded' || doc.status === 'verifying') {
                        updates[doc.document_type] = {
                            file: null,
                            status: doc.status,
                            message: doc.status === 'verifying' ? 'Verifying...' : 'Uploaded'
                        };
                        allVerified = false;
                    } else {
                        allVerified = false;
                    }
                });

                setUploads(updates);

                // Check if ALL required docs are verified (passport, biometric_photo, AND diploma)
                if (updates.passport?.status === 'verified' &&
                    updates.biometric_photo?.status === 'verified' &&
                    updates.diploma?.status === 'verified') {
                    setIsComplete(true);
                }
            }
        }
        loadExistingDocs();
    }, [adminTestMode, workerProfileId]);

    // Update status helper
    const updateStatus = (type: string, status: FileUpload["status"], message: string, file: File | null = null) => {
        setUploads(prev => ({
            ...prev,
            [type]: { file, status, message }
        }));
    };

    // Handle multi-file select for passport/diploma (stitch 2 photos into 1)
    async function handleMultiFileSelect(type: string, files: FileList | null) {
        if (!files || files.length === 0) return;

        // Reset status
        updateStatus(type, "missing", "");

        for (let i = 0; i < files.length; i++) {
            if (files[i].size > MAX_FILE_SIZE_BYTES) {
                logActivity("document_file_too_large", "documents", { doc_type: type, file_size: files[i].size }, "warning");
                updateStatus(type, "error", `File too large. Max ${MAX_FILE_SIZE_MB}MB.`);
                return;
            }
        }

        let file: File;
        if (files.length >= 2) {
            // Stitch 2 photos into 1
            updateStatus(type, "uploaded", "Combining photos...");
            try {
                file = await stitchImages(files[0], files[1]);
            } catch (err) {
                console.error('[Upload] Stitch failed:', err);
                file = files[0]; // fallback to first photo
            }
        } else {
            file = files[0];
        }

        handleFileSelect(type, file);
    }

    async function handleFileSelect(type: string, file: File | null) {
        if (!file) return;

        // Double check size (redundant but safe)
        if (file.size > MAX_FILE_SIZE_BYTES) {
            updateStatus(type, "error", `File too large. Max ${MAX_FILE_SIZE_MB}MB.`);
            return;
        }

        logActivity("document_upload_start", "documents", { doc_type: type, file_name: file.name, file_size: file.size });
        updateStatus(type, "uploaded", "Compressing & Processing...", file);

        try {
            // Client-side image processing
            let uploadFile = file;
            if (file.type.startsWith('image/')) {
                try {
                    // 1. Fix orientation / Crop
                    if (type === 'biometric_photo') {
                        uploadFile = await processBiometricPhoto(file);
                    } else {
                        uploadFile = await fixImageOrientation(file);
                    }

                    // 2. Compress
                    uploadFile = await compressImage(uploadFile);

                } catch (processErr) {
                    console.warn('[Upload] Image processing failed, uploading original:', processErr);
                }
            }

            if (adminTestMode) {
                updateStatus(type, "uploaded", "Uploading to sandbox...", uploadFile);
                const formData = new FormData();
                formData.set("docType", type);
                formData.set("file", uploadFile);

                const response = await fetch("/api/admin/test-personas/worker/documents", {
                    method: "POST",
                    body: formData,
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || "Sandbox upload failed");
                }

                logActivity("document_verified", "documents", { doc_type: type, status: "verified", sandbox: true });
                toast.success(`${type.replace('_', ' ')} verified in sandbox.`);
                setUploads(prev => {
                    const newUploads = {
                        ...prev,
                        [type]: {
                            file: uploadFile,
                            status: "verified" as FileUpload["status"],
                            message: "✓ Verified"
                        }
                    };

                    if (newUploads.passport?.status === 'verified' &&
                        newUploads.biometric_photo?.status === 'verified' &&
                        newUploads.diploma?.status === 'verified') {
                        setIsComplete(true);
                        toast.success("All sandbox documents verified.");

                        // Check if full profile is now 100% and send notifications
                        try {
                            fetch("/api/check-profile-completion", { method: "POST" });
                        } catch {
                            // Non-critical
                        }
                    }

                    return newUploads;
                });
            } else {
                const fileName = `${Date.now()}_${sanitizeStorageFileName(uploadFile.name, type)}`;
                const storagePath = `${workerProfileId}/${type}/${fileName}`;

                updateStatus(type, "uploaded", "Uploading...", uploadFile);

                // Upload to the legacy worker-documents storage bucket
                const { error: uploadError } = await supabase.storage
                    .from(WORKER_DOCUMENTS_BUCKET)
                    .upload(storagePath, uploadFile);

                if (uploadError) throw uploadError;

                // Upsert to the legacy worker-documents table
                await supabase.from("worker_documents").upsert({
                    user_id: workerProfileId,
                    document_type: type,
                    storage_path: storagePath,
                    status: 'uploaded',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,document_type' });

                // Set to verifying
                logActivity("document_uploaded_to_storage", "documents", { doc_type: type, storage_path: storagePath });
                updateStatus(type, "verifying", "Verifying with AI...");

                await supabase.from("worker_documents").update({
                    status: 'verifying',
                    updated_at: new Date().toISOString()
                }).eq('user_id', workerProfileId).eq('document_type', type);

                // Trigger verification
                const response = await fetch('/api/verify-document', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workerId: workerProfileId, docType: type })
                });

                const result = await response.json();

                if (result.success) {
                    logActivity(
                        result.status === "manual_review" ? "document_review_queued" : "document_verified",
                        "documents",
                        { doc_type: type, status: result.status }
                    );
                    const successMessage = result.status === 'manual_review'
                        ? `${type.replace('_', ' ')} uploaded successfully. Our team will review it before approval.`
                        : `${type.replace('_', ' ')} verified successfully!`;
                    toast.success(successMessage);
                    setUploads(prev => {
                        const newUploads = {
                            ...prev,
                            [type]: {
                                file: uploadFile,
                                status: result.status,
                                message: result.status === 'verified'
                                    ? '✓ Verified'
                                    : result.status === 'manual_review'
                                        ? 'Awaiting admin approval'
                                        : 'Uploaded'
                            }
                        };

                        // Check if ALL required docs are verified
                        if (newUploads.passport?.status === 'verified' &&
                            newUploads.biometric_photo?.status === 'verified' &&
                            newUploads.diploma?.status === 'verified') {
                            setIsComplete(true);
                            toast.success("All documents verified! You're ready to proceed.");
                        }

                        return newUploads;
                    });
                } else {
                    // Show specific AI feedback to the user
                    const rejectionMessage = result.message || result.error || "Verification failed";
                    logActivity("document_rejected", "documents", { doc_type: type, reason: rejectionMessage, quality_issues: result.qualityIssues }, "warning");
                    toast.error(rejectionMessage);
                    updateStatus(type, "rejected", rejectionMessage);
                }
            }

        } catch (err) {
            logError("document_upload_failed", "documents", err, { doc_type: type });
            console.error("Document upload error:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";

            // Provide more specific error messages
            let displayMessage = "Upload failed. Please try again.";
            if (errorMessage.includes("storage")) {
                displayMessage = "Storage error. Please try again in a moment.";
            } else if (errorMessage.includes("row-level security") || errorMessage.includes("RLS")) {
                displayMessage = "Permission error. Please refresh the page and try again.";
            } else if (errorMessage.includes("too large") || errorMessage.includes("size")) {
                displayMessage = `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
            }

            toast.error(displayMessage);
            updateStatus(type, "error", displayMessage);
        }
    }

    function removeFile(type: string) {
        updateStatus(type, "missing", "");
    }

    function getStatusColor(status: string) {
        switch (status) {
            case 'verified': return 'border-green-400 bg-green-50';
            case 'verifying': return 'border-blue-400 bg-blue-50';
            case 'uploaded': return 'border-blue-400 bg-blue-50';
            case 'manual_review': return 'border-amber-400 bg-amber-50';
            case 'error':
            case 'rejected': return 'border-red-400 bg-red-50';
            default: return 'border-[#dde3ec] bg-white';
        }
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case 'verified': return '✓';
            case 'verifying': return '⏳';
            case 'uploaded': return '📤';
            case 'manual_review': return '👁';
            case 'error':
            case 'rejected': return '✗';
            default: return '';
        }
    }

    async function requestManualReview(type: string) {
        if (adminTestMode) {
            toast.info("Sandbox documents are already auto-verified.");
            return;
        }
        try {
            const res = await fetch('/api/documents/request-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docType: type }),
            });
            if (res.ok) {
                toast.success('Sent for admin review! We\'ll notify you by email.');
                updateStatus(type, 'manual_review' as FileUpload['status'], 'Awaiting admin approval');
            } else {
                toast.error('Could not request review. Please try again.');
            }
        } catch {
            toast.error('Error requesting review.');
        }
    }

    function ProgressBar({ status }: { status: string }) {
        if (status !== 'uploaded' && status !== 'verifying') return null;
        const width = status === 'verifying' ? '80%' : '40%';
        return (
            <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width, animation: 'pulse 1.5s ease-in-out infinite' }}
                />
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-[#2f6fed] to-[#1e40af] rounded-2xl p-6 text-white mb-6">
            <div className="mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                    <FileText className="w-5 h-5" /> Upload Documents
                </h2>
                <p className="text-white/70 text-sm">Upload required documents for visa processing</p>
            </div>

            <div className="grid gap-4">
                {/* Passport */}
                <div
                    className={`rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] duration-200 ${getStatusColor(uploads.passport.status)}`}
                    onClick={() => (uploads.passport.status === 'missing' || uploads.passport.status === 'rejected' || uploads.passport.status === 'error') && passportInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={passportInputRef}
                        accept="image/*,.pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleMultiFileSelect('passport', e.target.files)}
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100/20 rounded-full text-white/90">
                                <BookUser size={24} />
                            </div>
                            <div>
                                <div className="font-semibold text-[#183b56]">Passport Photo Page *</div>
                                <div className="text-xs text-[#64748b]">Select 1-2 photos (front & back)</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {uploads.passport.status !== 'missing' && uploads.passport.status !== 'verified' && (
                                <span className={`text-sm font-medium ${uploads.passport.status === 'error'
                                    ? 'text-red-600'
                                    : uploads.passport.status === 'manual_review'
                                        ? 'text-amber-700'
                                        : 'text-blue-600'}`}>
                                    {getStatusIcon(uploads.passport.status)} {uploads.passport.message}
                                </span>
                            )}
                            {uploads.passport.status === 'missing' && (
                                <button className="bg-[#2f6fed] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1e5cd6] transition-colors">
                                    Upload
                                </button>
                            )}
                            {(uploads.passport.status === 'rejected' || uploads.passport.status === 'error') && (
                                <button className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
                                    Retry
                                </button>
                            )}
                            {uploads.passport.status !== 'missing' && uploads.passport.status !== 'verifying' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFile('passport'); }}
                                    className="text-gray-400 hover:text-red-500 ml-2"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <ProgressBar status={uploads.passport.status} />
                    {uploads.passport.status === 'manual_review' && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700">👁 Under admin review — we&apos;ll email you once it is approved or needs changes</p>
                        </div>
                    )}
                    {(uploads.passport.status === 'rejected' || uploads.passport.status === 'error') && uploads.passport.message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-700">{uploads.passport.message}</p>
                            {uploads.passport.status === 'rejected' && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); requestManualReview('passport'); }}
                                    className="mt-2 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600 transition-colors"
                                >
                                    I sent the correct document — Request Review
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Photo */}
                <div
                    className={`rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] duration-200 ${getStatusColor(uploads.biometric_photo.status)}`}
                    onClick={() => (uploads.biometric_photo.status === 'missing' || uploads.biometric_photo.status === 'rejected' || uploads.biometric_photo.status === 'error') && photoInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={photoInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileSelect('biometric_photo', e.target.files?.[0] || null)}
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100/20 rounded-full text-white/90">
                                <Camera size={24} />
                            </div>
                            <div>
                                <div className="font-semibold text-[#183b56]">Biometric Photo *</div>
                                <div className="text-xs text-[#64748b]">Passport-style, white background</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {uploads.biometric_photo.status !== 'missing' && uploads.biometric_photo.status !== 'verified' && (
                                <span className={`text-sm font-medium ${uploads.biometric_photo.status === 'error'
                                    ? 'text-red-600'
                                    : uploads.biometric_photo.status === 'manual_review'
                                        ? 'text-amber-700'
                                        : 'text-blue-600'}`}>
                                    {getStatusIcon(uploads.biometric_photo.status)} {uploads.biometric_photo.message}
                                </span>
                            )}
                            {uploads.biometric_photo.status === 'missing' && (
                                <button className="bg-[#2f6fed] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1e5cd6] transition-colors">
                                    Upload
                                </button>
                            )}
                            {(uploads.biometric_photo.status === 'rejected' || uploads.biometric_photo.status === 'error') && (
                                <button className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
                                    Retry
                                </button>
                            )}
                            {uploads.biometric_photo.status !== 'missing' && uploads.biometric_photo.status !== 'verifying' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFile('biometric_photo'); }}
                                    className="text-gray-400 hover:text-red-500 ml-2"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <ProgressBar status={uploads.biometric_photo.status} />
                    {uploads.biometric_photo.status === 'manual_review' && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700">👁 Under admin review — we&apos;ll email you once it is approved or needs changes</p>
                        </div>
                    )}
                    {(uploads.biometric_photo.status === 'rejected' || uploads.biometric_photo.status === 'error') && uploads.biometric_photo.message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-700">{uploads.biometric_photo.message}</p>
                            {uploads.biometric_photo.status === 'rejected' && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); requestManualReview('biometric_photo'); }}
                                    className="mt-2 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600 transition-colors"
                                >
                                    I sent the correct document — Request Review
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Diploma */}
                <div
                    className={`rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] duration-200 ${getStatusColor(uploads.diploma.status)}`}
                    onClick={() => (uploads.diploma.status === 'missing' || uploads.diploma.status === 'rejected' || uploads.diploma.status === 'error') && diplomaInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={diplomaInputRef}
                        accept="image/*,.pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleMultiFileSelect('diploma', e.target.files)}
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100/20 rounded-full text-white/90">
                                <GraduationCap size={24} />
                            </div>
                            <div>
                                <div className="font-semibold text-[#183b56]">Diploma / Certificate *</div>
                                <div className="text-xs text-[#64748b]">Select 1-2 photos (front & back)</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {uploads.diploma.status !== 'missing' && uploads.diploma.status !== 'verified' && (
                                <span className={`text-sm font-medium ${uploads.diploma.status === 'error'
                                    ? 'text-red-600'
                                    : uploads.diploma.status === 'manual_review'
                                        ? 'text-amber-700'
                                        : 'text-blue-600'}`}>
                                    {getStatusIcon(uploads.diploma.status)} {uploads.diploma.message}
                                </span>
                            )}
                            {uploads.diploma.status === 'missing' && (
                                <button className="bg-[#2f6fed] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1e5cd6] transition-colors">
                                    Upload
                                </button>
                            )}
                            {(uploads.diploma.status === 'rejected' || uploads.diploma.status === 'error') && (
                                <button className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
                                    Retry
                                </button>
                            )}
                            {uploads.diploma.status !== 'missing' && uploads.diploma.status !== 'verifying' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFile('diploma'); }}
                                    className="text-gray-400 hover:text-red-500 ml-2"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <ProgressBar status={uploads.diploma.status} />
                    {uploads.diploma.status === 'manual_review' && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700">👁 Under admin review — we&apos;ll email you once it is approved or needs changes</p>
                        </div>
                    )}
                    {(uploads.diploma.status === 'rejected' || uploads.diploma.status === 'error') && uploads.diploma.message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-700">{uploads.diploma.message}</p>
                            {uploads.diploma.status === 'rejected' && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); requestManualReview('diploma'); }}
                                    className="mt-2 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600 transition-colors"
                                >
                                    I sent the correct document — Request Review
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>


        </div>
    );
}
