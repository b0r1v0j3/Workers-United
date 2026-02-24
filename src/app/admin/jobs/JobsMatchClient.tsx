"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Briefcase, Globe, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function JobsMatchClient({ jobs, queue }: { jobs: any[], queue: any[] }) {
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isMatching, setIsMatching] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const selectedJob = jobs.find(j => j.id === selectedJobId);

    // Calculate matches for the selected job
    const matches = useMemo(() => {
        if (!selectedJob) return [];

        return queue.map(candidate => {
            let score = 0;
            const reasons: string[] = [];

            // 1. Industry / Job Title Match
            if (candidate.preferred_job && selectedJob.industry) {
                if (selectedJob.industry.toLowerCase().includes(candidate.preferred_job.toLowerCase()) ||
                    candidate.preferred_job.toLowerCase().includes(selectedJob.industry.toLowerCase())) {
                    score += 50;
                    reasons.push("Industry Match");
                }
            }

            // 2. Queue Time (priority to those waiting longer)
            if (candidate.queue_joined_at) {
                const daysInQueue = Math.floor((Date.now() - new Date(candidate.queue_joined_at).getTime()) / (1000 * 60 * 60 * 24));
                score += Math.min(daysInQueue, 30); // Max 30 points for time
                if (daysInQueue > 14) reasons.push("Waiting > 14 days");
            }

            // 3. Completeness constraint
            // E.g., if you only want people with all docs verified, check that.
            // For now, they are in IN_QUEUE, which implies they are verified.

            return {
                ...candidate,
                score,
                reasons
            };
        }).sort((a, b) => b.score - a.score).filter(c => c.score > 0); // Only show relevant matches
    }, [selectedJob, queue]);

    const handleGenerateOffer = async (candidateId: string) => {
        if (!selectedJob) return;
        setIsMatching(true);
        try {
            // Note: in a real scenario, this would call /api/admin/manual-match
            const res = await fetch("/api/admin/manual-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobRequestId: selectedJob.id,
                    employerId: selectedJob.employer_id, // ensure this is the profile_id of employer
                    candidateId: candidateId
                })
            });
            if (res.ok) {
                alert("Match created successfully!");
                window.location.reload();
            } else {
                alert("Failed to create match.");
            }
        } catch (e) {
            console.error(e);
            alert("Error creating match.");
        } finally {
            setIsMatching(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Left side: Jobs Table */}
            <div className={`transition-all duration-300 ${selectedJobId ? 'lg:w-1/2' : 'w-full'}`}>
                <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden border border-slate-200">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Job Request</th>
                                {!selectedJobId && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Employer</th>}
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {jobs.map(job => (
                                <tr
                                    key={job.id}
                                    className={`cursor-pointer transition-colors ${selectedJobId === job.id ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-slate-50/80'} group`}
                                    onClick={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{job.title}</span>
                                            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                <Briefcase size={10} /> {job.industry}
                                                {job.destination_country && (
                                                    <>
                                                        <span className="text-slate-300">•</span>
                                                        <Globe size={10} /> {job.destination_country}
                                                    </>
                                                )}
                                            </span>
                                            <div className="mt-1 flex items-center gap-1">
                                                <div className="flex-1 bg-slate-200 h-1 rounded-full overflow-hidden max-w-[80px]">
                                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(job.positions_filled / job.positions_count) * 100}%` }}></div>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-bold">{job.positions_filled}/{job.positions_count} filled</span>
                                            </div>
                                        </div>
                                    </td>
                                    {!selectedJobId && (
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-slate-800">{job.employers?.company_name}</div>
                                            <div className="text-[11px] text-slate-500">{job.employers?.profiles?.email}</div>
                                        </td>
                                    )}
                                    <td className="px-4 py-3">
                                        <JobStatusBadge status={job.status} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end items-center">
                                            <div className={`p-1.5 rounded-lg transition-colors ${selectedJobId === job.id ? 'bg-blue-100 text-blue-600' : 'text-slate-400 group-hover:bg-slate-100 group-hover:text-blue-500'}`}>
                                                <ChevronRight size={16} className={`transition-transform duration-200 ${selectedJobId === job.id ? 'rotate-90' : ''}`} />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {jobs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                                        No job requests available.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right side: Smart Match Panel */}
            {selectedJobId && (
                <div className="lg:w-1/2 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-blue-100 overflow-hidden flex flex-col h-[calc(100vh-200px)] sticky top-24 animate-fade-in-up">
                    <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Smart Match</h3>
                                <h2 className="text-xl font-bold text-slate-900">{selectedJob?.title}</h2>
                                <p className="text-sm text-slate-600">{selectedJob?.employers?.company_name}</p>
                            </div>
                            <JobStatusBadge status={selectedJob?.status || "open"} />
                        </div>
                        <p className="text-xs text-slate-500 bg-white inline-block px-2 py-1 rounded border border-slate-100 mt-2 shadow-sm">
                            Searching for <strong className="text-slate-800">{selectedJob?.industry}</strong> experts.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
                        {matches.length > 0 ? (
                            <div className="space-y-2">
                                {matches.map((match, idx) => (
                                    <div key={match.id} className="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors shadow-sm flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="text-center w-8">
                                                <div className="text-xs font-bold text-blue-600">#{idx + 1}</div>
                                                <div className="text-[10px] text-slate-400 font-bold">{match.score}pts</div>
                                            </div>
                                            <img src={match.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${match.profiles?.full_name?.replace(' ', '+') || "Worker"}`} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-sm leading-tight">
                                                    <Link href={`/admin/workers/${match.profile_id}`} className="hover:text-blue-600 transition-colors">
                                                        {match.profiles?.full_name || match.profiles?.email}
                                                    </Link>
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {match.preferred_job || "No job specified"}
                                                    </span>
                                                    {match.nationality && (
                                                        <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                                                            <Globe size={10} /> {match.nationality}
                                                        </span>
                                                    )}
                                                </div>
                                                {match.reasons.length > 0 && (
                                                    <div className="flex gap-1 mt-1.5">
                                                        {match.reasons.map((r: string, i: number) => (
                                                            <span key={i} className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 rounded-sm flex items-center gap-0.5">
                                                                <CheckCircle2 size={8} /> {r}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleGenerateOffer(match.profile_id)}
                                            disabled={isMatching || selectedJob?.status !== 'open'}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
                                        >
                                            {isMatching ? "Matching..." : "Match"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center h-full">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 mx-auto">
                                    <AlertCircle size={32} />
                                </div>
                                <h4 className="text-slate-800 font-bold mb-1">No Matches Found</h4>
                                <p className="text-sm text-slate-500 max-w-[250px]">
                                    There are currently no workers in the queue matching the industry "{selectedJob?.industry}".
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function JobStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        open: "bg-green-100 text-green-800",
        matching: "bg-amber-100 text-amber-800",
        filled: "bg-blue-100 text-blue-800",
        closed: "bg-slate-100 text-slate-800",
        cancelled: "bg-red-100 text-red-800",
    };

    return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${styles[status] || "bg-slate-100 text-slate-800"}`}>
            {status}
        </span>
    );
}
