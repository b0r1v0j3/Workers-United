"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Search, ChevronRight, Globe, Phone, FileText, CheckCircle2, Clock, Hourglass } from "lucide-react";
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
            let valA = a[sortField];
            let valB = b[sortField];

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
                                        <img src={worker.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
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
                                <td className="px-4 py-3 w-48">
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
                                    {new Date(worker.created_at).toLocaleDateString('en-GB')}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/admin/workers/${worker.id}`}
                                            className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-100"
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
