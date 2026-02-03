"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

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

                // Check if required docs are verified
                if (updates.passport?.status === 'verified' && updates.biometric_photo?.status === 'verified') {
                    setIsComplete(true);
                }
            }
        }
        loadExistingDocs();
    }, [candidateId]);

    async function handleFileSelect(type: string, file: File | null) {
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("File is too large. Maximum size is 5MB.");
            return;
        }

        setUploads(prev => ({
            ...prev,
            [type]: { file, status: "uploaded", message: "Uploading..." }
        }));

        try {
            const fileName = `${Date.now()}_${file.name}`;
            const storagePath = `${candidateId}/${type}/${fileName}`;

            // Upload to candidate-docs bucket
            const { error: uploadError } = await supabase.storage
                .from("candidate-docs")
                .upload(storagePath, file);

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
            setUploads(prev => ({
                ...prev,
                [type]: { file, status: "verifying", message: "Verifying..." }
            }));

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
                setUploads(prev => {
                    const newUploads = {
                        ...prev,
                        [type]: {
                            file,
                            status: result.status,
                            message: result.status === 'verified' ? '✓ Verified' : 'Verification failed.'
                        }
                    };

                    // Check if complete
                    if (newUploads.passport?.status === 'verified' && newUploads.biometric_photo?.status === 'verified') {
                        setIsComplete(true);
                    }

                    return newUploads;
                });
            } else {
                throw new Error(result.error || "Verification failed");
            }

        } catch (err) {
            console.error(err);
            setUploads(prev => ({
                ...prev,
                [type]: { file: null, status: "error", message: "Upload failed. Try again." }
            }));
        }
    }

    function removeFile(type: string) {
        setUploads(prev => ({
            ...prev,
            [type]: { file: null, status: "missing", message: "" }
        }));
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

    return (
        <div className="bg-gradient-to-br from-[#2f6fed] to-[#1e40af] rounded-2xl p-6 text-white mb-6">
            <div className="mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    📄 Upload Documents
                </h2>
                <p className="text-white/70 text-sm">Upload required documents for visa processing</p>
            </div>

            <div className="grid gap-4">
                {/* Passport */}
                <div
                    className={`rounded-xl p-4 cursor-pointer transition-all ${getStatusColor(uploads.passport.status)}`}
                    onClick={() => uploads.passport.status === 'missing' && passportInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={passportInputRef}
                        accept="image/*,.pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileSelect('passport', e.target.files?.[0] || null)}
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl">🛂</div>
                            <div>
                                <div className="font-semibold text-[#183b56]">Passport Photo Page *</div>
                                <div className="text-xs text-[#64748b]">Clear photo of data page</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {uploads.passport.status !== 'missing' && (
                                <span className={`text-sm font-medium ${uploads.passport.status === 'verified' ? 'text-green-600' : uploads.passport.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
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
                </div>

                {/* Photo */}
                <div
                    className={`rounded-xl p-4 cursor-pointer transition-all ${getStatusColor(uploads.biometric_photo.status)}`}
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
                            <div className="text-2xl">📷</div>
                            <div>
                                <div className="font-semibold text-[#183b56]">Biometric Photo *</div>
                                <div className="text-xs text-[#64748b]">Passport-style, white background</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {uploads.biometric_photo.status !== 'missing' && (
                                <span className={`text-sm font-medium ${uploads.biometric_photo.status === 'verified' ? 'text-green-600' : uploads.biometric_photo.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
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
                </div>

                {/* Diploma */}
                <div
                    className={`rounded-xl p-4 cursor-pointer transition-all ${getStatusColor(uploads.diploma.status)}`}
                    onClick={() => uploads.diploma.status === 'missing' && diplomaInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={diplomaInputRef}
                        accept="image/*,.pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileSelect('diploma', e.target.files?.[0] || null)}
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl">🎓</div>
                            <div>
                                <div className="font-semibold text-[#183b56]">Diploma / Certificate</div>
                                <div className="text-xs text-[#64748b]">Optional - education or training</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {uploads.diploma.status !== 'missing' && (
                                <span className={`text-sm font-medium ${uploads.diploma.status === 'verified' ? 'text-green-600' : uploads.diploma.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
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
                </div>
            </div>

            {isComplete && (
                <div className="mt-4 p-3 bg-green-500/20 rounded-lg text-center">
                    <span className="text-white font-medium">✓ All required documents verified!</span>
                </div>
            )}
        </div>
    );
}
