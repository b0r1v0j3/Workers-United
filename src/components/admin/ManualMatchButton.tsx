"use client";

import { useState, useEffect } from "react";
import { getManualMatchFailureFeedback } from "@/lib/manual-match-feedback";

interface Job {
    id: string;
    title: string;
    industry: string;
    positions_count: number;
    positions_filled: number;
    destination_country: string;
    salary_rsd: number | null;
    employer: { company_name: string } | null;
}

export default function ManualMatchButton({ workerRecordId }: { workerRecordId: string }) {
    const [open, setOpen] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(false);
    const [matching, setMatching] = useState(false);
    const [result, setResult] = useState<{ type: "success" | "error"; msg: string; detail?: string | null } | null>(null);

    useEffect(() => {
        if (open && jobs.length === 0) {
            setLoading(true);
            fetch("/api/admin/manual-match")
                .then(r => r.json())
                .then(data => setJobs(data.jobs || []))
                .catch(() => setJobs([]))
                .finally(() => setLoading(false));
        }
    }, [open, jobs.length]);

    const handleMatch = async (jobId: string) => {
        if (matching) return;
        setMatching(true);
        setResult(null);

        try {
            const res = await fetch("/api/admin/manual-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workerId: workerRecordId, jobRequestId: jobId }),
            });
            const data = await res.json();
            if (!res.ok) {
                const feedback = getManualMatchFailureFeedback(data, "Failed to match.");
                setResult({
                    type: "error",
                    msg: feedback.message,
                    detail: feedback.detail,
                });
            } else {
                setResult({ type: "success", msg: data.message || "Matched!" });
                // Remove from available jobs
                setJobs(prev => prev.filter(j => j.id !== jobId));
            }
        } catch {
            setResult({ type: "error", msg: "Network error" });
        } finally {
            setMatching(false);
        }
    };

    return (
        <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className="mb-5">
                <div className="inline-flex rounded-full border border-[#e3ded2] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                    Matching
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#18181b]">Manual match</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#57534e]">
                    Use this only when you want to attach the worker to a specific open job manually.
                </p>
            </div>

            {result && (
                <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${result.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                    }`}>
                    <div>{result.msg}</div>
                    {result.detail ? (
                        <div className="mt-1 text-xs leading-relaxed text-red-700/90">
                            {result.detail}
                        </div>
                    ) : null}
                </div>
            )}

            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    className="w-full rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
                >
                    Open available jobs
                </button>
            ) : (
                <div className="space-y-2">
                    {loading ? (
                        <div className="space-y-3 py-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[#f1f5f9] animate-pulse">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                        <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                                    </div>
                                    <div className="ml-3 shrink-0 h-8 w-16 bg-slate-200 rounded-lg"></div>
                                </div>
                            ))}
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="rounded-[22px] border border-dashed border-[#d6d3d1] bg-[#faf8f3] px-4 py-8 text-center text-sm text-[#78716c]">
                            No jobs with open positions.
                        </div>
                    ) : (
                        jobs.map(job => (
                            <div
                                key={job.id}
                                className="flex items-center justify-between gap-3 rounded-[22px] border border-[#ece8dd] bg-[#fcfbf8] p-4 transition hover:border-[#cfc8ba] hover:bg-white"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-[#18181b] text-sm truncate">{job.title}</div>
                                    <div className="text-[11px] text-[#71717a] flex gap-2 flex-wrap">
                                        <span>{job.employer?.company_name || "—"}</span>
                                        <span>•</span>
                                        <span>{job.industry}</span>
                                        <span>•</span>
                                        <span>{job.positions_filled}/{job.positions_count} filled</span>
                                        {job.salary_rsd && <span>• {Number(job.salary_rsd).toLocaleString()} RSD</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleMatch(job.id)}
                                    disabled={matching}
                                    className="ml-3 shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {matching ? "..." : "Match"}
                                </button>
                            </div>
                        ))
                    )}
                    <button
                        onClick={() => { setOpen(false); setResult(null); }}
                        className="w-full py-2 text-xs font-medium text-[#71717a] transition hover:text-[#18181b]"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}
