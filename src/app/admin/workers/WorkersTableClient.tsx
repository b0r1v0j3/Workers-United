"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Search, ChevronRight, Globe, Phone, FileText, CheckCircle2, Clock, Hourglass, Trash2 } from "lucide-react";
import { DeleteUserButton } from "@/components/DeleteUserButton";

export type WorkerTableRow = {
    id: string;
    profile_id: string;
    name: string;
    email: string;
    avatar_url: string;
    created_at: string;
    status: string;
    phone: string;
    nationality: string;
    job: string;
    completion: number;
    docsCount: number;
    verifiedDocs: number;
    adminApproved: boolean;
    isCurrentUser: boolean;
    daysUntilDeletion: number | null;
    entryFeePaid: boolean;
    authProvider: string;
};

export default function WorkersTableClient({ data, currentFilter }: { data: WorkerTableRow[], currentFilter: string }) {
    const [search, setSearch] = useState("");
    const [sortField, setSortField] = useState<keyof WorkerTableRow>("created_at");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // Local filter state
    const [jobFilter, setJobFilter] = useState("all");
    const [countryFilter, setCountryFilter] = useState("all");

    // Extract unique jobs and countries for dropdowns
    const uniqueJobs = useMemo(() => Array.from(new Set(data.map(w => w.job).filter(Boolean))).sort(), [data]);
    const uniqueCountries = useMemo(() => Array.from(new Set(data.map(w => w.nationality).filter(Boolean))).sort(), [data]);

    const handleSort = (field: keyof WorkerTableRow) => {
        if (sortField === field) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("desc");
        }
    };

    const filteredAndSortedData = useMemo(() => {
        let result = data;

        // Search
        if (search) {
            const lowerSearch = search.toLowerCase();
            result = result.filter(w =>
                w.name.toLowerCase().includes(lowerSearch) ||
                w.email.toLowerCase().includes(lowerSearch)
            );
        }

        // Job Filter
        if (jobFilter !== "all") {
            result = result.filter(w => w.job === jobFilter);
        }

        // Country Filter
        if (countryFilter !== "all") {
            result = result.filter(w => w.nationality === countryFilter);
        }

        // Sort
        result = [...result].sort((a, b) => {
            let valA: string | number | boolean = a[sortField] ?? "";
            let valB: string | number | boolean = b[sortField] ?? "";

            // Handle string comparisons
            if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortDir === "asc" ? -1 : 1;
            if (valA > valB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [data, search, jobFilter, countryFilter, sortField, sortDir]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-6">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search workers..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        value={countryFilter}
                        onChange={e => setCountryFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm w-full md:w-auto"
                    >
                        <option value="all">All Countries</option>
                        {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                        value={jobFilter}
                        onChange={e => setJobFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm w-full md:w-auto"
                    >
                        <option value="all">All Jobs</option>
                        {uniqueJobs.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">Name {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                <div className="flex items-center gap-1">Status {sortField === 'status' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('completion')}>
                                <div className="flex items-center gap-1">Progress {sortField === 'completion' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('job')}>
                                <div className="flex items-center gap-1">Details {sortField === 'job' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('created_at')}>
                                <div className="flex items-center gap-1">Joined {sortField === 'created_at' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</div>
                            </th>
                            <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredAndSortedData.map((worker) => (
                            <tr key={worker.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-shrink-0">
                                            {worker.authProvider === 'google' ? (
                                                /* Google user — show Google profile pic with G badge */
                                                <div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden bg-white flex items-center justify-center">
                                                    {worker.avatar_url && !worker.avatar_url.includes('ui-avatars.com') ? (
                                                        <img
                                                            src={worker.avatar_url}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                            {worker.name?.charAt(0) || '?'}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                /* Email user — show initials */
                                                <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                        {worker.name?.split(' ').map(n => n.charAt(0)).join('').slice(0, 2) || '?'}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Auth provider badge */}
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center ${worker.authProvider === 'google' ? 'bg-white shadow-sm' : 'bg-slate-200'
                                                }`}>
                                                {worker.authProvider === 'google' ? (
                                                    <svg width="10" height="10" viewBox="0 0 24 24">
                                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                    </svg>
                                                ) : (
                                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                                                {worker.name}
                                                {worker.isCurrentUser && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">You</span>}
                                            </p>
                                            <p className="text-xs text-slate-500">{worker.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1 items-start">
                                        <StatusBadge status={worker.status} />
                                        {worker.completion === 100 && !worker.adminApproved && (
                                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-700">
                                                <Hourglass size={10} /> Needs Appr
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 w-36">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${worker.completion === 100 ? 'bg-emerald-500' : worker.completion >= 50 ? 'bg-blue-500' : worker.completion > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}
                                                style={{ width: `${worker.completion}%` }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-bold ${worker.completion === 100 ? 'text-emerald-600' : worker.completion >= 50 ? 'text-blue-600' : worker.completion > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                            {worker.completion}%
                                        </span>
                                    </div>
                                    <div className="mt-1">
                                        {worker.docsCount > 0 ? (
                                            <span className={`flex items-center gap-1 text-[10px] font-bold ${worker.verifiedDocs >= 3 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {worker.verifiedDocs >= 3 ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                                                {worker.verifiedDocs}/3 Docs
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                <FileText size={10} /> No Docs
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                                        {worker.job && <span className="font-medium text-slate-800">{worker.job}</span>}
                                        {worker.nationality && (
                                            <span className="flex items-center gap-1"><Globe size={10} /> {worker.nationality}</span>
                                        )}
                                        {worker.phone && (
                                            <span className="flex items-center gap-1"><Phone size={10} /> {worker.phone}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                    <div>{new Date(worker.created_at).toLocaleDateString('en-GB')}</div>
                                    {worker.daysUntilDeletion !== null && !worker.entryFeePaid && (
                                        <div className={`mt-1 flex items-center gap-1 text-[10px] font-bold ${worker.daysUntilDeletion <= 3 ? 'text-red-600' : worker.daysUntilDeletion <= 7 ? 'text-amber-600' : 'text-slate-400'
                                            }`}>
                                            <Trash2 size={10} />
                                            {worker.daysUntilDeletion <= 0 ? 'Deleting...' : `${worker.daysUntilDeletion}d left`}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/profile/worker?inspect=${worker.profile_id}`}
                                            className="text-xs font-bold text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-md transition-colors border border-transparent hover:border-emerald-100"
                                        >
                                            Workspace
                                        </Link>
                                        <Link
                                            href={`/admin/workers/${worker.id}`}
                                            className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors border border-transparent hover:border-blue-100"
                                        >
                                            View
                                        </Link>
                                        {!worker.isCurrentUser && (
                                            <DeleteUserButton userId={worker.id} userName={worker.name} />
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredAndSortedData.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                                    {data.length === 0 ? "No workers found." : "No workers match the current filters."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 font-medium text-center">
                Showing {filteredAndSortedData.length} of {data.length} workers in this view
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        NEW: "bg-slate-100 text-slate-600",
        PROFILE_COMPLETE: "bg-blue-100 text-blue-700",
        PENDING_APPROVAL: "bg-indigo-100 text-indigo-700",
        VERIFIED: "bg-emerald-100 text-emerald-700",
        APPROVED: "bg-emerald-100 text-emerald-700",
        IN_QUEUE: "bg-amber-100 text-amber-700",
        OFFER_PENDING: "bg-orange-100 text-orange-700",
        OFFER_ACCEPTED: "bg-orange-100 text-orange-700",
        VISA_PROCESS_STARTED: "bg-green-100 text-green-700",
        VISA_APPROVED: "bg-green-100 text-green-700",
        PLACED: "bg-green-100 text-green-800",
        REJECTED: "bg-red-100 text-red-700",
        REFUND_FLAGGED: "bg-rose-100 text-rose-700",
    };
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
            {status?.replace(/_/g, ' ') || 'UNKNOWN'}
        </span>
    );
}
