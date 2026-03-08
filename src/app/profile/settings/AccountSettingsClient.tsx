"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
    AlertTriangle,
    Download,
    FileText,
    ShieldCheck,
    Trash2,
} from "lucide-react";

const sectionClass = "rounded-[26px] border border-[#e5e7eb] bg-white p-6 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.22)]";

export default function AccountSettingsClient() {
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

            router.push("/?deleted=true");
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred.");
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

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `workers-united-data-export-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setExportError(err instanceof Error ? err.message : "An error occurred.");
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-[900px] space-y-6">
            <section className="relative overflow-hidden rounded-[28px] border border-[#e5e7eb] bg-white p-6 shadow-[0_30px_70px_-52px_rgba(15,23,42,0.22)]">
                <div className="relative z-10">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                        <ShieldCheck size={14} />
                        Account & Privacy
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">Account Settings</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#52525b]">
                        Manage your data export, privacy documents, and irreversible account actions without leaving your workspace.
                    </p>
                </div>
                <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[#111111]/5 blur-3xl" />
            </section>

            <section className={sectionClass}>
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Download size={20} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-[#18181b]">Download Your Data</h2>
                        <p className="mt-1 text-sm leading-relaxed text-[#52525b]">
                            Under GDPR Article 20, you have the right to receive a portable copy of your personal data, profile details, uploaded document metadata, and account information.
                        </p>
                        <button
                            onClick={handleExportData}
                            disabled={exportLoading}
                            className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#1877f2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1664d9] disabled:opacity-50"
                        >
                            {exportLoading ? "Preparing download..." : "Download My Data (JSON)"}
                        </button>
                        {exportError && (
                            <p className="mt-2 text-sm text-red-600">{exportError}</p>
                        )}
                    </div>
                </div>
            </section>

            <section className={sectionClass}>
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <FileText size={20} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-[#18181b]">Privacy & Legal</h2>
                        <div className="mt-4 space-y-3">
                            <Link href="/privacy-policy" className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 transition hover:border-[#d4d4d8] hover:bg-white">
                                <ShieldCheck size={18} className="text-[#1877f2]" />
                                <div>
                                    <p className="text-sm font-semibold text-[#18181b]">Privacy Policy</p>
                                    <p className="text-xs text-[#71717a]">How we collect, use, and protect your data.</p>
                                </div>
                            </Link>
                            <Link href="/terms" className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 transition hover:border-[#d4d4d8] hover:bg-white">
                                <FileText size={18} className="text-[#18181b]" />
                                <div>
                                    <p className="text-sm font-semibold text-[#18181b]">Terms of Service</p>
                                    <p className="text-xs text-[#71717a]">The terms under which our services are provided.</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-[26px] border border-red-200 bg-white p-6 shadow-[0_20px_45px_-36px_rgba(127,29,29,0.15)]">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-red-600">Delete Account</h2>
                        <p className="mt-1 text-sm leading-relaxed text-[#52525b]">
                            Permanently delete your account and all associated data. This action cannot be undone and removes your profile, uploaded documents, signature, and account history.
                        </p>

                        {!showDeleteConfirm ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                            >
                                <Trash2 size={16} />
                                Delete My Account
                            </button>
                        ) : (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
                                <p className="text-sm font-semibold text-red-700">
                                    Are you absolutely sure? This permanently deletes:
                                </p>
                                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-600">
                                    <li>Your profile and personal information</li>
                                    <li>All uploaded documents</li>
                                    <li>Your digital signature</li>
                                    <li>Your account and login credentials</li>
                                </ul>

                                {error && (
                                    <div className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-3 text-sm text-red-700">
                                        {error}
                                    </div>
                                )}

                                <div className="mt-4">
                                    <label className="mb-1.5 block text-sm font-semibold text-red-700">
                                        Type <span className="rounded bg-white px-1.5 py-0.5 font-mono">DELETE</span> to confirm:
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        className="w-full rounded-xl border border-red-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none"
                                        placeholder="Type DELETE here"
                                    />
                                </div>

                                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={deleteLoading || confirmText !== "DELETE"}
                                        className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {deleteLoading ? "Deleting..." : "Permanently Delete My Account"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setConfirmText("");
                                            setError(null);
                                        }}
                                        className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#18181b] transition hover:bg-[#f5f5f5]"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-[22px] border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-relaxed text-blue-800">
                <strong>Your GDPR rights:</strong> You have the right to access, rectify, delete, and export your personal data at any time. For privacy-related questions, contact{" "}
                <a href="mailto:contact@workersunited.eu" className="font-semibold underline-offset-2 hover:underline">
                    contact@workersunited.eu
                </a>
                .
            </section>
        </div>
    );
}
