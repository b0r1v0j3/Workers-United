"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AccountSettingsPage() {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [confirmText, setConfirmText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleDeleteAccount = async () => {
        if (confirmText !== "DELETE") {
            setError("Please type DELETE to confirm.");
            return;
        }

        setDeleteLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/account/delete", {
                method: "DELETE",
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Failed to delete account.");
                return;
            }

            // Redirect to homepage after successful deletion
            router.push("/?deleted=true");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "An error occurred.");
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleExportData = async () => {
        setExportLoading(true);
        setExportError(null);

        try {
            const response = await fetch("/api/account/export");

            if (!response.ok) {
                const data = await response.json();
                setExportError(data.error || "Failed to export data.");
                return;
            }

            // Download the JSON file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `workers-united-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setExportError(err instanceof Error ? err.message : "An error occurred.");
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* Navbar */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[700px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/profile" className="text-[#65676b] hover:text-[#050505] text-sm font-semibold flex items-center gap-2">
                        ← Back to Profile
                    </Link>
                    <Link href="/" className="flex items-center gap-2">
                        <img src="/logo.png" alt="Workers United" className="h-[60px] w-auto object-contain" />
                        <span className="font-bold text-[#1E3A5F] text-xl hidden sm:inline">Workers United</span>
                    </Link>
                    <div className="w-[120px]" />
                </div>
            </nav>

            <div className="max-w-[700px] mx-auto px-4 py-6">
                <h1 className="text-2xl font-bold text-[#050505] mb-1">Account Settings</h1>
                <p className="text-[#65676b] text-sm mb-6">Manage your account, data, and privacy.</p>

                {/* Data Portability Section */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-[#e7f3ff] rounded-full flex items-center justify-center text-xl flex-shrink-0">
                            📥
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-[#050505] mb-1">Download Your Data</h2>
                            <p className="text-sm text-[#65676b] mb-4">
                                Under GDPR Article 20, you have the right to receive a copy of your personal data in a portable format.
                                This includes your profile information, uploaded document metadata, and account details.
                            </p>
                            <button
                                onClick={handleExportData}
                                disabled={exportLoading}
                                className="px-5 py-2.5 rounded-lg bg-[#1877f2] text-white font-semibold text-sm hover:bg-[#1664d9] transition-colors disabled:opacity-50"
                            >
                                {exportLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Preparing download...
                                    </span>
                                ) : (
                                    "Download My Data (JSON)"
                                )}
                            </button>
                            {exportError && (
                                <p className="text-sm text-red-600 mt-2">{exportError}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Privacy Links */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-[#e7f3ff] rounded-full flex items-center justify-center text-xl flex-shrink-0">
                            📜
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-[#050505] mb-3">Privacy & Legal</h2>
                            <div className="space-y-3">
                                <Link href="/privacy-policy" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#f0f2f5] transition-colors group">
                                    <span className="text-lg">🛡️</span>
                                    <div>
                                        <p className="text-sm font-semibold text-[#050505] group-hover:text-[#1877f2]">Privacy Policy</p>
                                        <p className="text-xs text-[#65676b]">How we collect, use, and protect your data</p>
                                    </div>
                                </Link>
                                <Link href="/terms" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#f0f2f5] transition-colors group">
                                    <span className="text-lg">📋</span>
                                    <div>
                                        <p className="text-sm font-semibold text-[#050505] group-hover:text-[#1877f2]">Terms of Service</p>
                                        <p className="text-xs text-[#65676b]">The terms under which our services are provided</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Danger Zone - Delete Account */}
                <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                            ⚠️
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-red-600 mb-1">Delete Account</h2>
                            <p className="text-sm text-[#65676b] mb-4">
                                Permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.
                                All your personal information, uploaded documents, and account history will be permanently removed.
                            </p>

                            {!showDeleteConfirm ? (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="px-5 py-2.5 rounded-lg border border-red-300 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors"
                                >
                                    Delete My Account
                                </button>
                            ) : (
                                <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                                    <p className="text-sm font-semibold text-red-700 mb-3">
                                        Are you absolutely sure? This will permanently delete:
                                    </p>
                                    <ul className="list-disc pl-5 text-sm text-red-600 space-y-1 mb-4">
                                        <li>Your profile and all personal information</li>
                                        <li>All uploaded documents (passport, photo, diploma)</li>
                                        <li>Your digital signature</li>
                                        <li>Your account and login credentials</li>
                                    </ul>

                                    {error && (
                                        <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <label className="block text-sm font-semibold text-red-700 mb-1.5">
                                            Type <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded">DELETE</span> to confirm:
                                        </label>
                                        <input
                                            type="text"
                                            value={confirmText}
                                            onChange={(e) => setConfirmText(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-lg border border-red-300 focus:border-red-500 focus:outline-none text-sm"
                                            placeholder="Type DELETE here"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleDeleteAccount}
                                            disabled={deleteLoading || confirmText !== "DELETE"}
                                            className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {deleteLoading ? (
                                                <span className="flex items-center gap-2">
                                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Deleting...
                                                </span>
                                            ) : (
                                                "Permanently Delete My Account"
                                            )}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowDeleteConfirm(false);
                                                setConfirmText("");
                                                setError(null);
                                            }}
                                            className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* GDPR Notice */}
                <div className="mt-6 p-4 bg-[#e7f3ff] rounded-xl border border-[#b3d4fc]">
                    <p className="text-xs text-[#1877f2] leading-relaxed">
                        <strong>Your rights under GDPR:</strong> You have the right to access, rectify, delete, and export your personal data at any time.
                        For any privacy-related questions, contact us at{" "}
                        <a href="mailto:contact@workersunited.eu" className="font-semibold hover:underline">contact@workersunited.eu</a>.
                    </p>
                </div>
            </div>
        </div>
    );
}
