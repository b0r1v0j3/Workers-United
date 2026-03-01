"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { processBiometricPhoto, fixImageOrientation, stitchImages, compressImage } from "@/lib/imageUtils";
import { toast } from "sonner";
import { MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { FileText, BookUser, Camera, GraduationCap } from "lucide-react";
import { logActivity, logError } from "@/lib/activityLogger";

interface FileUpload {
    file: File | null;
    status: "missing" | "uploaded" | "verifying" | "verified" | "rejected" | "error";
    message: string;
}

interface DocumentWizardProps {
    candidateId: string;
    email: string;
    onComplete?: () => void;
}

export default function DocumentWizard({ candidateId, email, onComplete }: DocumentWizardProps) {
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
            const { data: docs } = await supabase
                .from("candidate_documents")
                .select("document_type, status")
                .eq("user_id", candidateId);

            if (docs && docs.length > 0) {
                const updates: Record<string, FileUpload> = { ...uploads };
                let allVerified = true;

                docs.forEach(doc => {
                    if (doc.status === 'verified') {
                        updates[doc.document_type] = {
                            file: null,
                            status: 'verified',
                            message: '✓ Verified'
                        };
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
    }, [candidateId]);

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

            const fileName = `${Date.now()}_${uploadFile.name}`;
            const storagePath = `${candidateId}/${type}/${fileName}`;

            updateStatus(type, "uploaded", "Uploading...", uploadFile);

            // Upload to candidate-docs bucket
            const { error: uploadError } = await supabase.storage
                .from("candidate-docs")
                .upload(storagePath, uploadFile);

            if (uploadError) throw uploadError;

            // Upsert to candidate_documents table
            await supabase.from("candidate_documents").upsert({
                user_id: candidateId,
                document_type: type,
                storage_path: storagePath,
                status: 'uploaded',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,document_type' });

            // Set to verifying
            logActivity("document_uploaded_to_storage", "documents", { doc_type: type, storage_path: storagePath });
            updateStatus(type, "verifying", "Verifying with AI...");

            await supabase.from("candidate_documents").update({
                status: 'verifying',
                updated_at: new Date().toISOString()
            }).eq('user_id', candidateId).eq('document_type', type);

            // Trigger verification
            const response = await fetch('/api/verify-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateId, docType: type })
            });

            const result = await response.json();

            if (result.success) {
                logActivity("document_verified", "documents", { doc_type: type, status: result.status });
                toast.success(`${type.replace('_', ' ')} verified successfully!`);
                setUploads(prev => {
                    const newUploads = {
                        ...prev,
                        [type]: {
                            file: uploadFile,
                            status: result.status,
                            message: result.status === 'verified' ? '✓ Verified' : 'Verification failed.'
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
                logActivity("document_rejected", "documents", { doc_type: type, reason: result.error, quality_issues: result.qualityIssues }, "warning");
                throw new Error(result.error || "Verification failed");
            }

        } catch (err) {
            logError("document_upload_failed", "documents", err, { doc_type: type });
            console.error("Document upload error:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";

            // Provide more specific error messages
            let displayMessage = "Upload failed. Try again.";
            if (errorMessage.includes("storage")) {
                displayMessage = "Storage error. Check bucket permissions.";
            } else if (errorMessage.includes("row-level security") || errorMessage.includes("RLS")) {
                displayMessage = "Permission denied. Please refresh.";
            } else if (errorMessage.includes("verification") || errorMessage.includes("AI")) {
                displayMessage = "Verification failed. Try again.";
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
            case 'error':
            case 'rejected': return '✗';
            default: return '';
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
                    onClick={() => uploads.passport.status === 'missing' && passportInputRef.current?.click()}
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
                                <span className={`text-sm font-medium ${uploads.passport.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                                    {getStatusIcon(uploads.passport.status)} {uploads.passport.message}
                                </span>
                            )}
                            {uploads.passport.status === 'missing' && (
                                <button className="bg-[#2f6fed] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1e5cd6] transition-colors">
                                    Upload
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
                </div>

                {/* Photo */}
                <div
                    className={`rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] duration-200 ${getStatusColor(uploads.biometric_photo.status)}`}
                    onClick={() => uploads.biometric_photo.status === 'missing' && photoInputRef.current?.click()}
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
                                <span className={`text-sm font-medium ${uploads.biometric_photo.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                                    {getStatusIcon(uploads.biometric_photo.status)} {uploads.biometric_photo.message}
                                </span>
                            )}
                            {uploads.biometric_photo.status === 'missing' && (
                                <button className="bg-[#2f6fed] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1e5cd6] transition-colors">
                                    Upload
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
                </div>

                {/* Diploma */}
                <div
                    className={`rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] duration-200 ${getStatusColor(uploads.diploma.status)}`}
                    onClick={() => uploads.diploma.status === 'missing' && diplomaInputRef.current?.click()}
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
                                <span className={`text-sm font-medium ${uploads.diploma.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                                    {getStatusIcon(uploads.diploma.status)} {uploads.diploma.message}
                                </span>
                            )}
                            {uploads.diploma.status === 'missing' && (
                                <button className="bg-[#2f6fed] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1e5cd6] transition-colors">
                                    Upload
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
                </div>
            </div>


        </div>
    );
}
