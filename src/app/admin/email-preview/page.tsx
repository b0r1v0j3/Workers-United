"use client";

import { useState, useEffect } from "react";
import { Mail, Monitor, Smartphone, CheckCircle, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";

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
    profile_reminder: {
        name: "Marko Petrović",
        todoList: '<li style="padding: 6px 0;">Upload Passport</li><li style="padding: 6px 0;">Add Phone Number</li><li style="padding: 6px 0;">Set Date of Birth</li>',
    },
    profile_warning: {
        name: "Marko Petrović",
        todoList: '<li style="padding: 6px 0;">Upload Passport</li><li style="padding: 6px 0;">Add Phone Number</li>',
        daysLeft: "3",
    },
    profile_deletion: {
        name: "Marko Petrović",
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
    profile_reminder: "Profile Reminder",
    profile_warning: "Profile Warning",
    profile_deletion: "Profile Deletion",
};

export default function EmailPreviewPage() {
    const [selectedType, setSelectedType] = useState("welcome");
    const [htmlContent, setHtmlContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

    // Load preview on mount
    useEffect(() => {
        loadPreview(selectedType);
    }, []);

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
        <div className="min-h-screen bg-[#f0f2f5] p-6 font-montserrat">
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1877f2] flex items-center justify-center text-white shadow-sm">
                            <Mail size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-[#050505]">Email Templates</h1>
                            <p className="text-sm text-[#65676b]">Preview and test all system emails</p>
                        </div>
                    </div>

                    {/* View Controls */}
                    <div className="flex items-center bg-white border border-[#dddfe2] rounded-lg overflow-hidden shadow-sm self-start md:self-auto">
                        <button
                            onClick={() => setViewMode("desktop")}
                            className={`px-4 py-2 flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === "desktop"
                                ? "bg-[#1877f2] text-white"
                                : "text-[#65676b] hover:bg-[#f0f2f5]"
                                }`}
                        >
                            <Monitor size={16} />
                            <span className="hidden sm:inline">Desktop</span>
                        </button>
                        <div className="w-[1px] bg-[#dddfe2] h-full" />
                        <button
                            onClick={() => setViewMode("mobile")}
                            className={`px-4 py-2 flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === "mobile"
                                ? "bg-[#1877f2] text-white"
                                : "text-[#65676b] hover:bg-[#f0f2f5]"
                                }`}
                        >
                            <Smartphone size={16} />
                            <span className="hidden sm:inline">Mobile</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Sidebar List */}
                    <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden sticky top-6">
                        <div className="p-4 border-b border-[#dddfe2] bg-gray-50 flex justify-between items-center">
                            <h2 className="font-semibold text-gray-700 text-xs uppercase tracking-wide">Select Template</h2>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                {Object.keys(EMAIL_LABELS).length}
                            </span>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[calc(100vh-200px)] overflow-y-auto">
                            {Object.entries(EMAIL_LABELS).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => loadPreview(key)}
                                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-all flex items-center justify-between group ${selectedType === key
                                            ? "bg-blue-50 text-[#1877f2] border-l-4 border-[#1877f2]"
                                            : "text-gray-600 hover:bg-gray-50 border-l-4 border-transparent hover:pl-5"
                                        }`}
                                >
                                    <span>{label}</span>
                                    {selectedType === key && <ChevronRight size={16} className="text-[#1877f2]" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="lg:col-span-9">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 text-sm flex items-center gap-2">
                                <AlertCircle size={18} />
                                <span className="font-bold">Error:</span> {error}
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden min-h-[800px] flex flex-col transition-all duration-300">
                            {/* Preview Toolbar */}
                            <div className="bg-[#f7f8fa] border-b border-[#dddfe2] px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                        <div className="w-3 h-3 rounded-full bg-red-400 shadow-sm" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm" />
                                        <div className="w-3 h-3 rounded-full bg-green-400 shadow-sm" />
                                    </div>
                                    <div className="w-[1px] h-4 bg-gray-300 mx-2" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-gray-700">{EMAIL_LABELS[selectedType]}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{selectedType}.html</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => loadPreview(selectedType)}
                                    disabled={loading}
                                    className="text-xs font-semibold text-gray-600 hover:text-[#1877f2] disabled:opacity-50 flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                                    Refresh
                                </button>
                            </div>

                            {/* Iframe Container */}
                            <div className={`flex-1 bg-[#e5e7eb] p-4 flex justify-center items-start overflow-auto transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
                                {htmlContent ? (
                                    <iframe
                                        srcDoc={htmlContent}
                                        title="Email Preview"
                                        className="border-0 bg-white transition-all duration-500 shadow-lg"
                                        style={{
                                            width: viewMode === "mobile" ? "375px" : "100%",
                                            maxWidth: "1000px",
                                            height: "100%",
                                            minHeight: "800px",
                                            borderRadius: viewMode === "mobile" ? "20px" : "4px",
                                        }}
                                        sandbox="allow-same-origin"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full mt-20 text-center">
                                        {loading ? (
                                            <>
                                                <div className="w-10 h-10 border-4 border-[#1877f2] border-t-transparent rounded-full animate-spin mb-4" />
                                                <p className="text-gray-500 text-sm font-medium">Generating preview...</p>
                                            </>
                                        ) : (
                                            <>
                                                <Mail size={48} className="text-gray-300 mb-4" />
                                                <p className="text-gray-500 font-medium">Select a template to view preview</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
