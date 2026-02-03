"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface FileUpload {
    file: File | null;
    status: "missing" | "uploaded" | "verifying" | "verified" | "rejected" | "error";
    message: string;
}

const STEPS = [
    { id: 1, label: "Info" },
    { id: 2, label: "Passport" },
    { id: 3, label: "Biometric Photo" },
    { id: 4, label: "Diploma" },
    { id: 5, label: "Done" }
];

interface DocumentWizardProps {
    candidateId: string;
    email: string;
    onComplete?: () => void;
}

export default function DocumentWizard({ candidateId, email, onComplete }: DocumentWizardProps) {
    const supabase = createClient();
    const [currentStep, setCurrentStep] = useState(1);
    const [candidateData, setCandidateData] = useState({
        fullName: "",
        dob: "",
        nationality: "",
        address: "",
        preferredJob: ""
    });
    const [uploads, setUploads] = useState<Record<string, FileUpload>>({
        passport: { file: null, status: "missing", message: "" },
        biometric_photo: { file: null, status: "missing", message: "" },
        diploma: { file: null, status: "missing", message: "" }
    });

    const passportInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const diplomaInputRef = useRef<HTMLInputElement>(null);

    const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100;

    function nextStep() {
        if (currentStep === 1) {
            if (!candidateData.fullName || !candidateData.dob || !candidateData.nationality || !candidateData.address || !candidateData.preferredJob) {
                alert("Please fill in all required fields.");
                return;
            }
        }
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
            // Set status=uploaded
            await supabase.from("candidate_documents").upsert({
                user_id: candidateId,
                document_type: type,
                storage_path: storagePath,
                status: 'uploaded',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,document_type' });

            // Automatically set to verifying
            setUploads(prev => ({
                ...prev,
                [type]: { file, status: "verifying", message: "Verifying document..." }
            }));

            await supabase.from("candidate_documents").update({
                status: 'verifying',
                updated_at: new Date().toISOString()
            }).eq('user_id', candidateId).eq('document_type', type);

            // Trigger server-side verification pipeline
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
                [type]: { file: null, status: "error", message: "Verification failed." }
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
        try {
            await supabase.from("profiles").update({
                full_name: candidateData.fullName,
                updated_at: new Date().toISOString()
            }).eq("id", candidateId);

            setCurrentStep(5);
            onComplete?.();
        } catch (err) {
            alert("Submission failed.");
        }
    }

    return (
        <div className="wizard-container">
            <div className="wizard-header">
                <h1>📄 Document Submission</h1>
                <p>Complete your application by uploading required documents</p>
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
                {/* Step 1: Info */}
                <div className={`step-content ${currentStep === 1 ? "active" : ""}`} data-step="1">
                    <h2 className="step-title">👤 Confirm Your Information</h2>
                    <p style={{ color: "#64748b", marginBottom: "20px" }}>Please verify these details match your passport exactly.</p>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Full Name (as on passport) *</label>
                            <input
                                type="text"
                                required
                                placeholder="John Smith"
                                value={candidateData.fullName}
                                onChange={(e) => setCandidateData({ ...candidateData, fullName: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Date of Birth *</label>
                            <input
                                type="date"
                                required
                                value={candidateData.dob}
                                onChange={(e) => setCandidateData({ ...candidateData, dob: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Nationality *</label>
                            <input
                                type="text"
                                required
                                placeholder="Nigerian"
                                value={candidateData.nationality}
                                onChange={(e) => setCandidateData({ ...candidateData, nationality: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Current Address *</label>
                            <input
                                type="text"
                                required
                                placeholder="123 Main St, Lagos"
                                value={candidateData.address}
                                onChange={(e) => setCandidateData({ ...candidateData, address: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email (for updates) *</label>
                        <input type="email" value={email} readOnly disabled />
                    </div>

                    <div className="form-group">
                        <label>Preferred Job / Industry *</label>
                        <select
                            required
                            value={candidateData.preferredJob}
                            onChange={(e) => setCandidateData({ ...candidateData, preferredJob: e.target.value })}
                        >
                            <option value="">-- Select a job category --</option>
                            <option value="Manufacturing">Manufacturing / Factory Work</option>
                            <option value="Construction">Construction / Building</option>
                            <option value="Warehouse">Warehouse / Logistics</option>
                            <option value="Agriculture">Agriculture / Farming</option>
                            <option value="Hospitality">Hospitality / Hotels / Restaurants</option>
                            <option value="Healthcare">Healthcare / Caregiving</option>
                            <option value="IT">IT / Technology</option>
                            <option value="Driving">Driving / Transportation</option>
                            <option value="Cleaning">Cleaning / Housekeeping</option>
                            <option value="Any">Any Job (I'm open to all options)</option>
                        </select>
                    </div>

                    <div className="wizard-buttons">
                        <button className="btn btn-primary" onClick={nextStep}>Continue to Passport →</button>
                    </div>
                </div>

                {/* Step 2: Passport */}
                <div className={`step-content ${currentStep === 2 ? "active" : ""}`} data-step="2">
                    <h2 className="step-title">🛂 Upload Your Passport</h2>
                    <div className="requirements-list">
                        <h4>📋 Passport Requirements</h4>
                        <div className="req-item"><span className="check">✓</span> Valid for at least 6 months</div>
                        <div className="req-item"><span className="check">✓</span> Clear photo of data page</div>
                        <div className="req-item"><span className="check">✓</span> All text readable</div>
                        <div className="req-item"><span className="check">✓</span> No glare or shadows</div>
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
                        <button className="btn btn-secondary" onClick={prevStep}>← Back</button>
                        <button className="btn btn-primary" onClick={nextStep} disabled={uploads.passport.status !== 'verified'}>Continue to Photo →</button>
                    </div>
                </div>

                {/* Step 3: Biometric Photo */}
                <div className={`step-content ${currentStep === 3 ? "active" : ""}`} data-step="3">
                    <h2 className="step-title">📷 Upload Biometric Photo</h2>
                    <div className="requirements-list">
                        <h4>📋 Photo Requirements</h4>
                        <div className="req-item"><span className="check">✓</span> Size: 35mm x 45mm (passport size)</div>
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

                {/* Step 4: Diploma */}
                <div className={`step-content ${currentStep === 4 ? "active" : ""}`} data-step="4">
                    <h2 className="step-title">🎓 Upload Diploma or Certificate</h2>
                    <div className="requirements-list">
                        <h4>📋 Accepted Documents</h4>
                        <div className="req-item"><span className="check">✓</span> University degree / diploma</div>
                        <div className="req-item"><span className="check">✓</span> Professional certificate</div>
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
                        <button className="btn btn-success" onClick={submitAll} disabled={uploads.diploma.status !== 'verified'}>Submit Application ✓</button>
                    </div>
                </div>

                {/* Step 5: Done */}
                <div className={`step-content ${currentStep === 5 ? "active" : ""}`} data-step="5">
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎉</div>
                        <h2 style={{ color: '#10b981', marginBottom: '15px' }}>Application Complete!</h2>
                        <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto 30px' }}>
                            All your documents have been received and verified. Our team will review your application and contact you within 24-48 hours.
                        </p>
                        <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '20px', textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
                            <h4 style={{ color: '#065f46', margin: '0 0 10px 0' }}>📋 Documents Submitted</h4>
                            <div style={{ color: '#166534', fontSize: '14px', lineHeight: '1.8' }}>
                                ✅ Personal Information<br />
                                ✅ Passport<br />
                                ✅ Photo<br />
                                ✅ Diploma/Certificate
                            </div>
                        </div>
                        <a href="/" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '30px', textDecoration: 'none' }}>
                            Return to Homepage
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
