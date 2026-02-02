"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface Document {
    id: string;
    document_type: string;
    file_name: string;
    verification_status: string;
    ai_extracted_data?: Record<string, unknown>;
    ai_confidence_score?: number;
    created_at: string;
}

export default function DocumentsPage() {
    const supabase = createBrowserSupabaseClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [verifying, setVerifying] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [candidateId, setCandidateId] = useState<string | null>(null);

    // Fetch documents on mount
    useState(() => {
        fetchDocuments();
    });

    async function fetchDocuments() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: candidate } = await supabase
                .from("candidates")
                .select("id")
                .eq("profile_id", user.id)
                .single();

            if (candidate) {
                setCandidateId(candidate.id);

                const { data: docs } = await supabase
                    .from("documents")
                    .select("*")
                    .eq("candidate_id", candidate.id)
                    .order("created_at", { ascending: false });

                setDocuments(docs || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpload(documentType: string) {
        const file = fileInputRef.current?.files?.[0];
        if (!file || !candidateId) return;

        setUploading(true);
        setError("");

        try {
            // Upload to Supabase Storage
            const fileName = `${candidateId}/${documentType}_${Date.now()}_${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("documents")
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from("documents")
                .getPublicUrl(fileName);

            // Create document record
            const { data: doc, error: docError } = await supabase
                .from("documents")
                .insert({
                    candidate_id: candidateId,
                    document_type: documentType,
                    file_url: urlData.publicUrl,
                    file_name: file.name,
                    file_size_bytes: file.size,
                    mime_type: file.type,
                    verification_status: "pending",
                })
                .select()
                .single();

            if (docError) throw docError;

            // Refresh list
            await fetchDocuments();

            // If passport, auto-trigger verification
            if (documentType === "passport" && doc) {
                await verifyDocument(doc.id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }

    async function verifyDocument(documentId: string) {
        setVerifying(documentId);
        setError("");

        try {
            const response = await fetch("/api/documents/verify-passport", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Verification failed");
            }

            // Refresh documents
            await fetchDocuments();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed");
        } finally {
            setVerifying(null);
        }
    }

    const passportDoc = documents.find(d => d.document_type === "passport");
    const cvDoc = documents.find(d => d.document_type === "cv");

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Upload</h1>
                <p className="text-gray-600 mb-6">
                    Upload your documents for AI verification. Your passport will be automatically scanned.
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={() => { }}
                />

                {/* Passport Section */}
                <div className="card mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                🛂 Passport
                                <span className="text-red-500 text-sm">*Required</span>
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Upload a clear photo of your passport's data page
                            </p>
                        </div>
                        {passportDoc && (
                            <StatusBadge status={passportDoc.verification_status} />
                        )}
                    </div>

                    {passportDoc ? (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">{passportDoc.file_name}</p>
                                        <p className="text-sm text-gray-500">
                                            Uploaded {new Date(passportDoc.created_at).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {passportDoc.verification_status === "pending" && (
                                        <button
                                            onClick={() => verifyDocument(passportDoc.id)}
                                            disabled={verifying === passportDoc.id}
                                            className="btn btn-primary text-sm"
                                        >
                                            {verifying === passportDoc.id ? "Verifying..." : "Verify Now"}
                                        </button>
                                    )}
                                </div>

                                {/* Show extracted data if verified */}
                                {passportDoc.verification_status === "verified" && passportDoc.ai_extracted_data && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <p className="text-sm font-medium text-green-700 mb-2">✓ AI Verified Data:</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-500">Name:</span>{" "}
                                                <span className="text-gray-900">
                                                    {(passportDoc.ai_extracted_data as Record<string, string>).full_name}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Passport #:</span>{" "}
                                                <span className="text-gray-900">
                                                    {(passportDoc.ai_extracted_data as Record<string, string>).passport_number}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Nationality:</span>{" "}
                                                <span className="text-gray-900">
                                                    {(passportDoc.ai_extracted_data as Record<string, string>).nationality}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Expiry:</span>{" "}
                                                <span className="text-gray-900">
                                                    {(passportDoc.ai_extracted_data as Record<string, string>).expiry_date}
                                                </span>
                                            </div>
                                        </div>
                                        {passportDoc.ai_confidence_score && (
                                            <p className="text-xs text-gray-500 mt-2">
                                                Confidence: {(passportDoc.ai_confidence_score * 100).toFixed(0)}%
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Show manual review message */}
                                {passportDoc.verification_status === "manual_review" && (
                                    <div className="mt-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
                                        <p className="font-medium">⚠️ Manual Review Required</p>
                                        <p className="mt-1">
                                            Our team will review your document within 24 hours.
                                            Possible reasons: blurry image, name mismatch, or unreadable data.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Re-upload option */}
                            <button
                                onClick={() => {
                                    fileInputRef.current?.click();
                                    fileInputRef.current?.addEventListener("change", () => handleUpload("passport"), { once: true });
                                }}
                                disabled={uploading}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Upload a different passport
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                fileInputRef.current?.click();
                                fileInputRef.current?.addEventListener("change", () => handleUpload("passport"), { once: true });
                            }}
                            disabled={uploading}
                            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            {uploading ? (
                                <span className="text-gray-500">Uploading...</span>
                            ) : (
                                <>
                                    <div className="text-4xl mb-2">📤</div>
                                    <p className="text-gray-900 font-medium">Click to upload passport</p>
                                    <p className="text-sm text-gray-500 mt-1">JPG, PNG, or PDF (max 10MB)</p>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* CV Section */}
                <div className="card mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                📄 CV / Resume
                                <span className="text-gray-400 text-sm">Optional</span>
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Upload your CV to improve matching with employers
                            </p>
                        </div>
                        {cvDoc && <StatusBadge status={cvDoc.verification_status} />}
                    </div>

                    {cvDoc ? (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="font-medium text-gray-900">{cvDoc.file_name}</p>
                            <p className="text-sm text-gray-500">
                                Uploaded {new Date(cvDoc.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                fileInputRef.current?.click();
                                fileInputRef.current?.addEventListener("change", () => handleUpload("cv"), { once: true });
                            }}
                            disabled={uploading}
                            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            <p className="text-gray-600">Click to upload CV</p>
                        </button>
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    <p className="font-medium mb-1">🤖 AI-Powered Verification</p>
                    <p>
                        Your passport will be scanned by our AI to extract your name and details.
                        If the extracted data matches your signup information, your document is automatically verified.
                    </p>
                </div>
            </main>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: "bg-gray-100 text-gray-800",
        processing: "bg-blue-100 text-blue-800",
        verified: "bg-green-100 text-green-800",
        manual_review: "bg-amber-100 text-amber-800",
        rejected: "bg-red-100 text-red-800",
    };

    const labels: Record<string, string> = {
        pending: "Pending",
        processing: "Processing...",
        verified: "✓ Verified",
        manual_review: "Manual Review",
        rejected: "Rejected",
    };

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.pending}`}>
            {labels[status] || status}
        </span>
    );
}
