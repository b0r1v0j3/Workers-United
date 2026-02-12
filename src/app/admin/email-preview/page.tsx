"use client";

import { useState } from "react";
import { Mail, Eye, ChevronDown } from "lucide-react";

// ─── Mock data for each email template ──────────────────────────

const MOCK_DATA: Record<string, Record<string, string>> = {
    welcome: { name: "Marko Petrović" },
    profile_complete: { name: "Marko Petrović" },
    payment_success: { name: "Marko Petrović", amount: "$9" },
    job_offer: {
        name: "Marko Petrović",
        companyName: "TechCorp GmbH",
        jobTitle: "Construction Worker",
        country: "Germany",
        offerLink: "https://workersunited.eu/profile/worker/offers/123",
    },
    offer_reminder: {
        name: "Marko Petrović",
        offerLink: "https://workersunited.eu/profile/worker/offers/123",
    },
    refund_approved: { name: "Marko Petrović", amount: "$9" },
    document_expiring: {
        name: "Marko Petrović",
        documentType: "PASSPORT",
        expirationDate: "15/08/2026",
    },
    job_match: {
        name: "Marko Petrović",
        jobTitle: "Warehouse Operative",
        location: "Munich, Germany",
        salary: "€2,200/month",
        industry: "Logistics",
        offerLink: "https://workersunited.eu/profile/worker/offers/456",
    },
    admin_update: {
        name: "Marko Petrović",
        subject: "Your document has been verified",
        title: "Passport Verified",
        message: "Your passport has been reviewed and verified by our team. You can now proceed to the next step.",
    },
    announcement: {
        name: "Marko Petrović",
        subject: "New Feature: Job Matching is Live!",
        title: "🎉 Job Matching is Now Live",
        message: "We are excited to announce that our AI-powered job matching system is now live. Your profile will be automatically matched with suitable employers across Europe.",
        actionLink: "https://workersunited.eu/profile/worker",
        actionText: "View Your Matches",
    },
    profile_incomplete: {
        name: "Marko Petrović",
        subject: "Action Required: Your profile is 63% complete",
        missingFields: "• Phone Number<br>• Passport Number<br>• Biometric Photo<br>• Date of Birth<br>• Birth City<br>• Passport Document",
        completion: "63",
    },
};

const EMAIL_LABELS: Record<string, string> = {
    welcome: "Welcome",
    profile_complete: "Profile Complete",
    payment_success: "Payment Success",
    job_offer: "Job Offer",
    offer_reminder: "Offer Reminder",
    refund_approved: "Refund Approved",
    document_expiring: "Document Expiring",
    job_match: "Job Match",
    admin_update: "Admin Update",
    announcement: "Announcement",
    profile_incomplete: "Profile Incomplete",
};

export default function EmailPreviewPage() {
    const [selectedType, setSelectedType] = useState("welcome");
    const [htmlContent, setHtmlContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPreview = async (type: string) => {
        setLoading(true);
        setError(null);
        setSelectedType(type);

        try {
            const res = await fetch("/api/admin/email-preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, data: MOCK_DATA[type] || {} }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setHtmlContent(json.html);
        } catch (err: any) {
            setError(err.message || "Failed to load preview");
            setHtmlContent("");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f0f2f5] p-6">
            <div className="max-w-[1200px] mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-[#1877f2] flex items-center justify-center text-white">
                            <Mail size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-[#050505]">Email Template Preview</h1>
                            <p className="text-sm text-[#65676b]">Preview all email templates with mock data — no deploy needed</p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-4 mb-6 flex-wrap">
                    <div className="relative">
                        <select
                            value={selectedType}
                            onChange={(e) => loadPreview(e.target.value)}
                            className="appearance-none bg-white border border-[#dddfe2] rounded-lg px-4 py-2.5 pr-10 text-sm font-semibold text-[#050505] cursor-pointer focus:ring-2 focus:ring-[#1877f2] focus:outline-none"
                        >
                            {Object.entries(EMAIL_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#65676b] pointer-events-none" />
                    </div>

                    <button
                        onClick={() => loadPreview(selectedType)}
                        disabled={loading}
                        className="bg-[#1877f2] text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#166fe5] transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Eye size={16} />
                        {loading ? "Loading..." : "Load Preview"}
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 text-sm">
                        {error}
                    </div>
                )}

                {/* Preview */}
                {htmlContent ? (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden">
                        <div className="bg-[#f7f8fa] border-b border-[#dddfe2] px-4 py-2.5 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <div className="w-3 h-3 rounded-full bg-yellow-400" />
                            <div className="w-3 h-3 rounded-full bg-green-400" />
                            <span className="ml-4 text-xs text-[#65676b] font-mono">
                                {EMAIL_LABELS[selectedType]} — Preview
                            </span>
                        </div>
                        <iframe
                            srcDoc={htmlContent}
                            title="Email Preview"
                            className="w-full border-0"
                            style={{ height: "800px" }}
                            sandbox="allow-same-origin"
                        />
                    </div>
                ) : !loading && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-16 text-center">
                        <Mail size={48} className="mx-auto text-[#bcc0c4] mb-4" />
                        <p className="text-[#65676b]">Select a template and click "Load Preview" to see it</p>
                    </div>
                )}
            </div>
        </div>
    );
}
