"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, CheckCircle2, XCircle, Send, Loader2 } from "lucide-react";

interface ReviewDoc {
    user_id: string;
    document_type: string;
    status: string;
    reject_reason: string | null;
    storage_path: string;
    updated_at: string;
    profile?: { full_name: string; email: string };
}

export default function ReviewClient() {
    const supabase = createClient();
    const [docs, setDocs] = useState<ReviewDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewing, setPreviewing] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<Record<string, string>>({});
    const [actioning, setActioning] = useState<string | null>(null);

    useEffect(() => {
        loadDocs();
    }, []);

    async function loadDocs() {
        setLoading(true);
        const { data } = await supabase
            .from("candidate_documents")
            .select("user_id, document_type, status, reject_reason, storage_path, updated_at")
            .eq("status", "manual_review")
            .order("updated_at", { ascending: false });

        if (data && data.length > 0) {
            const userIds = [...new Set(data.map(d => d.user_id))];
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .in("id", userIds);

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));
            const enriched = data.map(d => ({
                ...d,
                profile: profileMap.get(d.user_id) || { full_name: "Unknown", email: "" }
            }));
            setDocs(enriched);
        } else {
            setDocs([]);
        }
        setLoading(false);
    }

    async function previewDoc(doc: ReviewDoc) {
        const key = `${doc.user_id}_${doc.document_type}`;
        if (previewing === key) {
            setPreviewing(null);
            setPreviewUrl(null);
            return;
        }
        setPreviewing(key);
        const { data } = await supabase.storage
            .from("candidate-docs")
            .createSignedUrl(doc.storage_path, 300);
        setPreviewUrl(data?.signedUrl || null);
    }

    async function handleAction(doc: ReviewDoc, action: "approve" | "reject") {
        const key = `${doc.user_id}_${doc.document_type}`;
        if (action === "reject" && !feedback[key]?.trim()) {
            toast.error("Please write a reason before rejecting.");
            return;
        }
        setActioning(key);
        try {
            const res = await fetch("/api/admin/admin-review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: doc.user_id,
                    docType: doc.document_type,
                    action,
                    feedback: feedback[key] || null,
                }),
            });
            if (res.ok) {
                toast.success(action === "approve" ? "Document approved! Email sent to user." : "Rejected with feedback. Email sent to user.");
                setDocs(prev => prev.filter(d => !(d.user_id === doc.user_id && d.document_type === doc.document_type)));
                setPreviewing(null);
            } else {
                toast.error("Failed to process review.");
            }
        } catch {
            toast.error("Error processing review.");
        }
        setActioning(null);
    }

    const docTypeLabels: Record<string, string> = {
        passport: "🛂 Passport",
        biometric_photo: "📷 Biometric Photo",
        diploma: "🎓 Diploma",
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[#1e293b]">📝 Document Review</h1>
                <p className="text-[#64748b] text-sm mt-1">
                    {docs.length} document{docs.length !== 1 ? "s" : ""} waiting for review
                </p>
            </div>

            {docs.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-800">All clear!</h3>
                    <p className="text-green-600 text-sm">No documents waiting for review.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {docs.map((doc) => {
                        const key = `${doc.user_id}_${doc.document_type}`;
                        const isOpen = previewing === key;
                        const isActioning = actioning === key;

                        return (
                            <div key={key} className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
                                {/* Header */}
                                <div className="p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${doc.status === "manual_review"
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-red-100 text-red-700"
                                            }`}>
                                            {doc.status === "manual_review" ? "⏳ Manual Review" : "❌ Rejected"}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[#1e293b]">
                                                {doc.profile?.full_name || "Unknown"}
                                            </p>
                                            <p className="text-xs text-[#64748b]">
                                                {docTypeLabels[doc.document_type] || doc.document_type} · {doc.profile?.email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => previewDoc(doc)}
                                            className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                            {isOpen ? "Hide" : "Preview"}
                                        </button>
                                        <button
                                            onClick={() => handleAction(doc, "approve")}
                                            disabled={isActioning}
                                            className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                                        >
                                            {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                            Approve
                                        </button>
                                    </div>
                                </div>

                                {/* AI Rejection Reason */}
                                {doc.reject_reason && (
                                    <div className="px-5 pb-3">
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <p className="text-xs font-semibold text-red-600 mb-1">AI Rejection Reason:</p>
                                            <p className="text-sm text-red-700">{doc.reject_reason}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Preview */}
                                {isOpen && previewUrl && (
                                    <div className="px-5 pb-4">
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                            <Image
                                                src={previewUrl}
                                                alt={`${doc.document_type} preview`}
                                                width={600}
                                                height={400}
                                                className="rounded-lg mx-auto max-h-[500px] object-contain"
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Reject with feedback */}
                                <div className="px-5 pb-5 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Write rejection reason for user (required to reject)..."
                                        value={feedback[key] || ""}
                                        onChange={(e) => setFeedback(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="flex-1 bg-[#f8fbff] border border-[#e2e8f0] px-4 py-2.5 rounded-lg text-sm text-[#1e293b] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300"
                                    />
                                    <button
                                        onClick={() => handleAction(doc, "reject")}
                                        disabled={isActioning || !feedback[key]?.trim()}
                                        className="flex items-center gap-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                                    >
                                        {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Reject & Send
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
