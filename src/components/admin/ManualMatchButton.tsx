"use client";

import { useState, useEffect } from "react";

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

export default function ManualMatchButton({ candidateId }: { candidateId: string }) {
    const [open, setOpen] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(false);
    const [matching, setMatching] = useState(false);
    const [result, setResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);

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
                body: JSON.stringify({ candidateId, jobRequestId: jobId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setResult({ type: "error", msg: data.error || "Failed to match" });
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
        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
            <h2 className="font-bold text-[#1e293b] text-xl mb-4">Manual Match</h2>

            {result && (
                <div className={`mb-3 px-3 py-2 rounded-lg text-sm font-medium ${result.type === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                    {result.msg}
                </div>
            )}

            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    className="w-full bg-gradient-to-r from-[#2f6fed] to-[#1e5cd6] text-white py-2.5 rounded-lg font-bold text-sm hover:from-[#1e5cd6] hover:to-[#1550c0] transition-all"
                >
                    🔗 Match to Job
                </button>
            ) : (
                <div className="space-y-2">
                    {loading ? (
                        <div className="text-center py-4 text-[#64748b] text-sm">Loading jobs...</div>
                    ) : jobs.length === 0 ? (
                        <div className="text-center py-4 text-[#94a3b8] italic text-sm">No jobs with open positions</div>
                    ) : (
                        jobs.map(job => (
                            <div
                                key={job.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-[#f1f5f9] hover:border-[#2f6fed] hover:bg-[#f0f7ff] transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-[#1e293b] text-sm truncate">{job.title}</div>
                                    <div className="text-[11px] text-[#64748b] flex gap-2 flex-wrap">
                                        <span>{(job.employer as any)?.company_name || "—"}</span>
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
                                    className="ml-3 shrink-0 bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                >
                                    {matching ? "..." : "Match"}
                                </button>
                            </div>
                        ))
                    )}
                    <button
                        onClick={() => { setOpen(false); setResult(null); }}
                        className="w-full text-[#64748b] py-1.5 text-xs font-medium hover:text-[#1e293b]"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}
