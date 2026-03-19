"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Monitor, Smartphone, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";
import type { EmailType } from "@/lib/email-templates";
import {
    isAdminEmailPreviewType,
    parseAdminEmailPreviewData,
    type EmailPreviewData,
} from "@/lib/admin-email-preview";
import { buildWorkerPaymentUnlockedEmailData } from "@/lib/worker-approval-notifications";

const DEFAULT_EMAIL_TYPE: EmailType = "welcome";
const paymentUnlockedPreview = buildWorkerPaymentUnlockedEmailData();

const MOCK_DATA: Record<EmailType, EmailPreviewData> = {
    welcome: { name: "Marko Petrović" },
    profile_complete: { name: "Marko Petrović" },
    payment_success: { name: "Marko Petrović", amount: "$9" },
    checkout_recovery: { name: "Marko Petrović", amount: "$9", recoveryStep: 3 },
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
    offer_expired: {
        name: "Marko Petrović",
        jobTitle: "Construction Worker",
        queuePosition: 12,
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
        subject: paymentUnlockedPreview.subject || "Job Finder Is Now Unlocked",
        title: paymentUnlockedPreview.title || "Profile Approved",
        message: paymentUnlockedPreview.message || "Your profile has been approved by our team.",
        actionText: paymentUnlockedPreview.actionText || "Open Job Finder",
        actionLink: paymentUnlockedPreview.actionLink || "https://workersunited.eu/profile/worker",
    },
    announcement: {
        name: "Marko Petrović",
        subject: "New Feature: Job Matching is Live!",
        title: "Job Matching is Now Live",
        message: "We are excited to announce that our job matching system is now live. Your profile will be automatically matched with suitable employers across Europe.",
        actionLink: "https://workersunited.eu/profile/worker",
        actionText: "View Your Matches",
    },
    profile_incomplete: {
        name: "Marko Petrović",
        subject: "Action Required: Your profile is 63% complete",
        missingFields: "• Phone Number<br>• Passport Number<br>• Biometric Photo<br>• Date of Birth<br>• Birth City<br>• Passport Document",
        completion: "63",
    },
    document_review_result: {
        name: "Marko Petrović",
        approved: true,
        docType: "Biometric Photo",
        feedback: "",
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
    announcement_document_fix: {
        name: "Marko Petrović",
    },
};

const EMAIL_LABELS: Record<EmailType, string> = {
    welcome: "Welcome",
    profile_complete: "Profile Complete",
    payment_success: "Payment Success",
    checkout_recovery: "Checkout Recovery",
    job_offer: "Job Offer",
    offer_reminder: "Offer Reminder",
    offer_expired: "Offer Expired",
    refund_approved: "Refund Approved",
    document_expiring: "Document Expiring",
    job_match: "Job Match",
    admin_update: "Admin Update",
    announcement: "Announcement",
    profile_incomplete: "Profile Incomplete",
    document_review_result: "Document Review Result",
    profile_reminder: "Profile Reminder",
    profile_warning: "Profile Warning",
    profile_deletion: "Profile Deletion",
    announcement_document_fix: "Document Fix Announcement",
};

type EmailPreviewCategory =
    | "all"
    | "profile"
    | "documents"
    | "payments"
    | "offers"
    | "announcements";

const EMAIL_CATEGORY_LABELS: Record<EmailPreviewCategory, string> = {
    all: "All",
    profile: "Profile",
    documents: "Documents",
    payments: "Payments",
    offers: "Offers",
    announcements: "Updates",
};

const EMAIL_CATEGORY_BY_TYPE: Record<EmailType, EmailPreviewCategory> = {
    welcome: "profile",
    profile_complete: "profile",
    payment_success: "payments",
    checkout_recovery: "payments",
    job_offer: "offers",
    offer_reminder: "offers",
    offer_expired: "offers",
    refund_approved: "payments",
    document_expiring: "documents",
    job_match: "offers",
    admin_update: "announcements",
    announcement: "announcements",
    profile_incomplete: "profile",
    document_review_result: "documents",
    profile_reminder: "profile",
    profile_warning: "profile",
    profile_deletion: "profile",
    announcement_document_fix: "documents",
};

export default function EmailPreviewWorkspace() {
    const searchParams = useSearchParams();
    const [selectedType, setSelectedType] = useState<EmailType>(DEFAULT_EMAIL_TYPE);
    const [activeCategory, setActiveCategory] = useState<EmailPreviewCategory>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [htmlContent, setHtmlContent] = useState("");
    const [emailSubject, setEmailSubject] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
    const queryType = searchParams.get("type");
    const queryDataRaw = searchParams.get("data");

    const resolvePreviewData = useCallback((type: EmailType): EmailPreviewData => {
        if (isAdminEmailPreviewType(queryType) && queryType === type) {
            const parsedData = parseAdminEmailPreviewData(queryDataRaw);
            if (parsedData) {
                return {
                    ...(MOCK_DATA[type] || {}),
                    ...parsedData,
                };
            }
        }

        return MOCK_DATA[type] || {};
    }, [queryDataRaw, queryType]);

    const loadPreview = useCallback(async (type: EmailType, data: EmailPreviewData) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/admin/email-preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, data }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setEmailSubject(json.subject || "");
            setHtmlContent(json.html);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load preview");
            setEmailSubject("");
            setHtmlContent("");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdminEmailPreviewType(queryType)) {
            setSelectedType(queryType);
        }
    }, [queryType]);

    useEffect(() => {
        void loadPreview(selectedType, resolvePreviewData(selectedType));
    }, [loadPreview, resolvePreviewData, selectedType]);

    const hasQueryDrivenPreview = isAdminEmailPreviewType(queryType) && queryType === selectedType && !!parseAdminEmailPreviewData(queryDataRaw);
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredTemplates = (Object.entries(EMAIL_LABELS) as Array<[EmailType, string]>).filter(([type, label]) => {
        const categoryMatches = activeCategory === "all" || EMAIL_CATEGORY_BY_TYPE[type] === activeCategory;
        if (!categoryMatches) {
            return false;
        }

        if (!normalizedSearch) {
            return true;
        }

        const searchableText = [
            label,
            type,
            EMAIL_CATEGORY_LABELS[EMAIL_CATEGORY_BY_TYPE[type]],
        ].join(" ").toLowerCase();

        return searchableText.includes(normalizedSearch);
    });

    useEffect(() => {
        if (!filteredTemplates.some(([type]) => type === selectedType) && filteredTemplates[0]) {
            setSelectedType(filteredTemplates[0][0]);
        }
    }, [filteredTemplates, selectedType]);

    return (
        <div className="space-y-5">
            <section className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] text-white shadow-sm">
                            <Mail size={19} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-[#18181b]">Email Preview</h1>
                            <p className="mt-1 text-sm text-[#57534e]">
                                Pregled svih sistemskih mejlova iz admina, sa realnim subject-om i live payload preview podrškom kada dolaziš iz worker akcije.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center self-start overflow-hidden rounded-xl border border-[#dddfe2] bg-white shadow-sm md:self-auto">
                        <button
                            onClick={() => setViewMode("desktop")}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                                viewMode === "desktop"
                                    ? "bg-[#111111] text-white"
                                    : "text-[#65676b] hover:bg-[#f5f5f4]"
                            }`}
                        >
                            <Monitor size={16} />
                            <span className="hidden sm:inline">Desktop</span>
                        </button>
                        <div className="h-full w-px bg-[#dddfe2]" />
                        <button
                            onClick={() => setViewMode("mobile")}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                                viewMode === "mobile"
                                    ? "bg-[#111111] text-white"
                                    : "text-[#65676b] hover:bg-[#f5f5f4]"
                            }`}
                        >
                            <Smartphone size={16} />
                            <span className="hidden sm:inline">Mobile</span>
                        </button>
                    </div>
                </div>
            </section>

            {error && (
                <div className="flex items-center gap-2 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={18} />
                    <span className="font-semibold">Error:</span> {error}
                </div>
            )}

            {hasQueryDrivenPreview ? (
                <div className="rounded-[22px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Ovaj preview koristi stvarni payload iz admin akcije, ne samo generički mock primer.
                </div>
            ) : null}

            <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <section className="overflow-hidden rounded-[28px] border border-[#e6e6e1] bg-white shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)] xl:sticky xl:top-6">
                    <div className="border-b border-[#ebe7dd] bg-[#faf8f3] px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">All Templates</div>
                                <div className="mt-1 text-sm text-[#57534e]">Izaberi mejl koji želiš da pregledaš.</div>
                            </div>
                            <span className="rounded-full bg-[#111111] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                                {Object.keys(EMAIL_LABELS).length}
                            </span>
                        </div>
                        <div className="mt-4">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search templates..."
                                className="w-full rounded-xl border border-[#ddd8cb] bg-white px-3 py-2.5 text-sm text-[#18181b] outline-none transition focus:border-[#a8a29e] focus:ring-2 focus:ring-[#efece3]"
                            />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(Object.entries(EMAIL_CATEGORY_LABELS) as Array<[EmailPreviewCategory, string]>).map(([category, label]) => {
                                const count = category === "all"
                                    ? Object.keys(EMAIL_LABELS).length
                                    : Object.values(EMAIL_CATEGORY_BY_TYPE).filter((value) => value === category).length;
                                const isActive = activeCategory === category;
                                return (
                                    <button
                                        key={category}
                                        onClick={() => setActiveCategory(category)}
                                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                            isActive
                                                ? "border-[#111111] bg-[#111111] text-white"
                                                : "border-[#ddd8cb] bg-white text-[#57534e] hover:border-[#bdb6aa] hover:text-[#18181b]"
                                        }`}
                                    >
                                        <span>{label}</span>
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                            isActive ? "bg-white/15 text-white" : "bg-[#f5f5f4] text-[#78716c]"
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="max-h-[70vh] divide-y divide-[#f1ede4] overflow-y-auto">
                        {filteredTemplates.length === 0 ? (
                            <div className="px-5 py-6 text-sm text-[#78716c]">
                                Nema mejlova za ovaj filter. Promeni kategoriju ili search.
                            </div>
                        ) : filteredTemplates.map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setSelectedType(key)}
                                className={`flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium transition ${
                                    selectedType === key
                                        ? "border-l-4 border-[#111111] bg-[#f5f5f4] pl-4 text-[#18181b]"
                                        : "border-l-4 border-transparent text-[#57534e] hover:bg-[#faf8f3] hover:text-[#18181b]"
                                }`}
                            >
                                <div>
                                    <div>{label}</div>
                                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#8a8479]">
                                        {EMAIL_CATEGORY_LABELS[EMAIL_CATEGORY_BY_TYPE[key]]}
                                    </div>
                                </div>
                                {selectedType === key ? <ChevronRight size={16} className="text-[#111111]" /> : null}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="overflow-hidden rounded-[28px] border border-[#e6e6e1] bg-white shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="flex items-center justify-between border-b border-[#ebe7dd] bg-[#faf8f3] px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1.5 opacity-60">
                                <div className="h-3 w-3 rounded-full bg-red-400" />
                                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                                <div className="h-3 w-3 rounded-full bg-green-400" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-[#18181b]">{EMAIL_LABELS[selectedType]}</div>
                                <div className="mt-0.5 text-[11px] font-mono text-[#8a8479]">{selectedType}.html</div>
                                {emailSubject ? (
                                    <div className="mt-1 text-[11px] text-[#57534e]">Subject: {emailSubject}</div>
                                ) : null}
                            </div>
                        </div>
                        <button
                            onClick={() => loadPreview(selectedType, resolvePreviewData(selectedType))}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#dddfe2] bg-white px-3 py-1.5 text-xs font-semibold text-[#57534e] transition hover:bg-[#f5f5f4] hover:text-[#18181b] disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>

                    <div className={`flex min-h-[820px] items-start justify-center overflow-auto bg-[#e7e5e4] p-4 transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
                        {htmlContent ? (
                            <iframe
                                srcDoc={htmlContent}
                                title="Email Preview"
                                className="border-0 bg-white shadow-lg transition-all duration-500"
                                style={{
                                    width: viewMode === "mobile" ? "375px" : "100%",
                                    maxWidth: "1000px",
                                    height: "100%",
                                    minHeight: "820px",
                                    borderRadius: viewMode === "mobile" ? "20px" : "8px",
                                }}
                                sandbox="allow-same-origin"
                            />
                        ) : (
                            <div className="mt-20 flex h-full flex-col items-center justify-center text-center">
                                {loading ? (
                                    <>
                                        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#111111] border-t-transparent" />
                                        <p className="text-sm font-medium text-[#57534e]">Generating preview...</p>
                                    </>
                                ) : (
                                    <>
                                        <Mail size={48} className="mb-4 text-[#c4bfb4]" />
                                        <p className="font-medium text-[#57534e]">Select a template to view preview</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
