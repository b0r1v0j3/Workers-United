"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface FileUpload {
    file: File | null;
    status: "missing" | "uploaded" | "verifying" | "verified" | "rejected" | "error";
    message: string;
}

const STEPS = [
    { id: 1, label: "Passport" },
    { id: 2, label: "Photo" },
    { id: 3, label: "Diploma" },
    { id: 4, label: "Done" }
];

interface DocumentWizardProps {
    candidateId: string;
    email: string;
    onComplete?: () => void;
}

export default function DocumentWizard({ candidateId, email, onComplete }: DocumentWizardProps) {
    const supabase = createClient();
    const [currentStep, setCurrentStep] = useState(1);
    const [uploads, setUploads] = useState<Record<string, FileUpload>>({
        passport: { file: null, status: "missing", message: "" },
        biometric_photo: { file: null, status: "missing", message: "" },
        diploma: { file: null, status: "missing", message: "" }
    });

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
                let maxVerifiedStep = 0;

                docs.forEach(doc => {
                    if (doc.status === 'verified') {
                        updates[doc.document_type] = {
                            file: null,
                            status: 'verified',
                            message: 'Document verified!'
                        };
                        // Determine which step is verified
                        if (doc.document_type === 'passport') maxVerifiedStep = Math.max(maxVerifiedStep, 1);
                        if (doc.document_type === 'biometric_photo') maxVerifiedStep = Math.max(maxVerifiedStep, 2);
                        if (doc.document_type === 'diploma') maxVerifiedStep = Math.max(maxVerifiedStep, 3);
                    }
                });

                setUploads(updates);
                // Move to next unverified step
                if (maxVerifiedStep > 0 && maxVerifiedStep < 3) {
                    setCurrentStep(maxVerifiedStep + 1);
                } else if (maxVerifiedStep === 3) {
                    setCurrentStep(4); // All done
                }
            }
        }
        loadExistingDocs();
    }, [candidateId]);

    const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100;

    function nextStep() {
        if (currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1);
        }
    }

    function prevStep() {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    }

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
                [type]: { file, status: "verifying", message: "Verifying document..." }
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
                setUploads(prev => ({
                    ...prev,
                    [type]: {
                        file,
                        status: result.status,
                        message: result.status === 'verified' ? "Document verified!" : "Verification failed."
                    }
                }));
            } else {
                throw new Error(result.error || "Verification failed");
            }

        } catch (err) {
            console.error(err);
            setUploads(prev => ({
                ...prev,
                [type]: { file: null, status: "error", message: "Upload failed. Please try again." }
            }));
        }
    }

    function removeFile(type: string) {
        setUploads(prev => ({
            ...prev,
            [type]: { file: null, status: "missing", message: "" }
        }));
    }

    async function submitAll() {
        setCurrentStep(4);
        onComplete?.();
    }

    return (
        <div className="wizard-container">
            <div className="wizard-header">
                <h1>📄 Upload Documents</h1>
                <p>Upload required documents for visa processing</p>
            </div>

            <div className="progress-container">
                <div className="progress-steps">
                    <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                    {STEPS.map((step) => (
                        <div key={step.id} className="step-indicator">
                            <div className={`step-circle ${step.id < currentStep ? "completed" : step.id === currentStep ? "active" : ""}`} data-step={step.id}>
                                {step.id < currentStep ? "✓" : step.id}
                            </div>
                            <span className="step-label">{step.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="wizard-content">
                {/* Step 1: Passport */}
                <div className={`step-content ${currentStep === 1 ? "active" : ""}`} data-step="1">
                    <h2 className="step-title">🛂 Upload Your Passport</h2>
                    <div className="requirements-list">
                        <h4>📋 Requirements</h4>
                        <div className="req-item"><span className="check">✓</span> Valid for at least 6 months</div>
                        <div className="req-item"><span className="check">✓</span> Clear photo of data page</div>
                        <div className="req-item"><span className="check">✓</span> All text readable, no glare</div>
                    </div>

                    <div className={`upload-zone ${uploads.passport.status !== 'missing' ? 'has-file' : ''}`} onClick={() => passportInputRef.current?.click()}>
                        <input type="file" ref={passportInputRef} accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => handleFileSelect('passport', e.target.files?.[0] || null)} />
                        <div className="upload-icon">🛂</div>
                        <div className="upload-text">Click or drag passport photo here</div>
                        <div className="upload-hint">JPG, PNG or PDF • Max 5MB</div>
                    </div>

                    <div className={`file-preview ${uploads.passport.file ? 'visible' : ''}`}>
                        <span className="file-icon">📄</span>
                        <span className="file-name">{uploads.passport.file?.name}</span>
                        <button className="remove-btn" onClick={() => removeFile('passport')}>✕</button>
                    </div>

                    <div className={`verification-status ${uploads.passport.status === 'verifying' ? 'verifying visible' : uploads.passport.status === 'verified' ? 'success visible' : (uploads.passport.status === 'error' || uploads.passport.status === 'rejected') ? 'error visible' : ''}`}>
                        {uploads.passport.status === 'verifying' && <div className="spinner"></div>}
                        <span>{uploads.passport.message}</span>
                    </div>

                    <div className="wizard-buttons">
                        <div></div>
                        <button className="btn btn-primary" onClick={nextStep} disabled={uploads.passport.status !== 'verified'}>Continue to Photo →</button>
                    </div>
                </div>

                {/* Step 2: Biometric Photo */}
                <div className={`step-content ${currentStep === 2 ? "active" : ""}`} data-step="2">
                    <h2 className="step-title">📷 Upload Biometric Photo</h2>
                    <div className="requirements-list">
                        <h4>📋 Requirements</h4>
                        <div className="req-item"><span className="check">✓</span> Passport-style photo (35mm x 45mm)</div>
                        <div className="req-item"><span className="check">✓</span> White or light gray background</div>
                        <div className="req-item"><span className="check">✓</span> Face clearly visible, eyes open</div>
                    </div>

                    <div className={`upload-zone ${uploads.biometric_photo.status !== 'missing' ? 'has-file' : ''}`} onClick={() => photoInputRef.current?.click()}>
                        <input type="file" ref={photoInputRef} accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileSelect('biometric_photo', e.target.files?.[0] || null)} />
                        <div className="upload-icon">📷</div>
                        <div className="upload-text">Click or drag photo here</div>
                        <div className="upload-hint">JPG or PNG • Max 5MB</div>
                    </div>

                    <div className={`file-preview ${uploads.biometric_photo.file ? 'visible' : ''}`}>
                        <span className="file-icon">📸</span>
                        <span className="file-name">{uploads.biometric_photo.file?.name}</span>
                        <button className="remove-btn" onClick={() => removeFile('biometric_photo')}>✕</button>
                    </div>

                    <div className={`verification-status ${uploads.biometric_photo.status === 'verifying' ? 'verifying visible' : (uploads.biometric_photo.status === 'verified') ? 'success visible' : (uploads.biometric_photo.status === 'rejected') ? 'error visible' : ''}`}>
                        {uploads.biometric_photo.status === 'verifying' && <div className="spinner"></div>}
                        <span>{uploads.biometric_photo.message}</span>
                    </div>

                    <div className="wizard-buttons">
                        <button className="btn btn-secondary" onClick={prevStep}>← Back</button>
                        <button className="btn btn-primary" onClick={nextStep} disabled={uploads.biometric_photo.status !== 'verified'}>Continue to Diploma →</button>
                    </div>
                </div>

                {/* Step 3: Diploma */}
                <div className={`step-content ${currentStep === 3 ? "active" : ""}`} data-step="3">
                    <h2 className="step-title">🎓 Upload Diploma (Optional)</h2>
                    <div className="requirements-list">
                        <h4>📋 Accepted Documents</h4>
                        <div className="req-item"><span className="check">✓</span> Education diploma or degree</div>
                        <div className="req-item"><span className="check">✓</span> Professional certificate</div>
                        <div className="req-item"><span className="check">✓</span> Skip if you don't have one</div>
                    </div>

                    <div className={`upload-zone ${uploads.diploma.status !== 'missing' ? 'has-file' : ''}`} onClick={() => diplomaInputRef.current?.click()}>
                        <input type="file" ref={diplomaInputRef} accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => handleFileSelect('diploma', e.target.files?.[0] || null)} />
                        <div className="upload-icon">🎓</div>
                        <div className="upload-text">Click or drag diploma here</div>
                        <div className="upload-hint">JPG, PNG or PDF • Max 5MB</div>
                    </div>

                    <div className={`file-preview ${uploads.diploma.file ? 'visible' : ''}`}>
                        <span className="file-icon">📜</span>
                        <span className="file-name">{uploads.diploma.file?.name}</span>
                        <button className="remove-btn" onClick={() => removeFile('diploma')}>✕</button>
                    </div>

                    <div className={`verification-status ${uploads.diploma.status === 'verifying' ? 'verifying visible' : uploads.diploma.status === 'verified' ? 'success visible' : (uploads.diploma.status === 'error' || uploads.diploma.status === 'rejected') ? 'error visible' : ''}`}>
                        {uploads.diploma.status === 'verifying' && <div className="spinner"></div>}
                        <span>{uploads.diploma.message}</span>
                    </div>

                    <div className="wizard-buttons">
                        <button className="btn btn-secondary" onClick={prevStep}>← Back</button>
                        <button className="btn btn-success" onClick={submitAll}>
                            {uploads.diploma.status === 'verified' ? 'Submit Application ✓' : 'Skip & Finish'}
                        </button>
                    </div>
                </div>

                {/* Step 4: Done */}
                <div className={`step-content ${currentStep === 4 ? "active" : ""}`} data-step="4">
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
                        <h2 style={{ color: '#10b981', marginBottom: '12px', fontSize: '22px' }}>Documents Submitted!</h2>
                        <p style={{ color: '#64748b', maxWidth: '380px', margin: '0 auto 24px', fontSize: '14px', lineHeight: '1.6' }}>
                            Your documents are being processed. We'll notify you once verification is complete.
                        </p>
                        <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', textAlign: 'left', maxWidth: '320px', margin: '0 auto' }}>
                            <h4 style={{ color: '#065f46', margin: '0 0 10px 0', fontSize: '13px' }}>📋 Uploaded</h4>
                            <div style={{ color: '#166534', fontSize: '13px', lineHeight: '1.8' }}>
                                {uploads.passport.status === 'verified' && <>✅ Passport<br /></>}
                                {uploads.biometric_photo.status === 'verified' && <>✅ Biometric Photo<br /></>}
                                {uploads.diploma.status === 'verified' && <>✅ Diploma/Certificate</>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
