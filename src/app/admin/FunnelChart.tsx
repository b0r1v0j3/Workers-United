
"use client";

import { useEffect, useState } from "react";
import { TrendingDown } from "lucide-react";

export default function FunnelChart() {
    const [data, setData] = useState({
        total_users: 0,
        completed_profiles: 0,
        uploaded_documents: 0,
        verified: 0,
        job_matched: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/admin/funnel-metrics");
                const json = await res.json();
                if (!res.ok) {
                    setError(json.error || `HTTP ${res.status}`);
                    return;
                }
                if (json.success) {
                    setData(json.data);
                } else {
                    setError("API returned unsuccessful response");
                }
            } catch (err) {
                console.error("Failed to fetch funnel metrics:", err);
                setError("Network error");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 h-[360px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-indigo-600" />
                    <span className="text-xs text-slate-400">Loading pipeline...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl border border-slate-200/80 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-2">Pipeline Overview</h2>
                <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-red-600 text-sm">⚠️ Error loading metrics: {error}</p>
                </div>
            </div>
        );
    }

    const steps = [
        { label: "Registered", value: data.total_users || 0, color: "from-blue-500 to-blue-600", bgColor: "bg-blue-50", textColor: "text-blue-600" },
        { label: "Profile Done", value: data.completed_profiles || 0, color: "from-indigo-500 to-indigo-600", bgColor: "bg-indigo-50", textColor: "text-indigo-600" },
        { label: "Docs Uploaded", value: data.uploaded_documents || 0, color: "from-violet-500 to-purple-600", bgColor: "bg-violet-50", textColor: "text-violet-600" },
        { label: "Verified", value: data.verified || 0, color: "from-emerald-500 to-emerald-600", bgColor: "bg-emerald-50", textColor: "text-emerald-600" },
        { label: "Job Matched", value: data.job_matched || 0, color: "from-amber-500 to-orange-500", bgColor: "bg-amber-50", textColor: "text-amber-600" }
    ];

    const maxVal = Math.max(...steps.map(s => s.value), 1);

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <TrendingDown size={18} className="text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800">Pipeline Overview</h2>
                        <p className="text-[11px] text-slate-400">Worker journey conversion funnel</p>
                    </div>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Funnel Steps */}
            <div className="p-5 space-y-4">
                {steps.map((step, i) => {
                    const prevValue = i > 0 ? steps[i - 1].value : 0;
                    const conversion = prevValue > 0 ? Math.round((step.value / prevValue) * 100) : 0;
                    const widthPercent = Math.max((step.value / maxVal) * 100, 2); // min 2% so it's always visible

                    return (
                        <div key={i} className="group">
                            {/* Conversion arrow between steps */}
                            {i > 0 && (
                                <div className="flex items-center justify-center -mt-1 mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conversion >= 70 ? "bg-emerald-50 text-emerald-600" :
                                            conversion >= 40 ? "bg-amber-50 text-amber-600" :
                                                "bg-red-50 text-red-600"
                                        }`}>
                                        ↓ {conversion}%
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                {/* Step number */}
                                <div className={`w-8 h-8 rounded-full ${step.bgColor} ${step.textColor} flex items-center justify-center text-xs font-bold shrink-0`}>
                                    {i + 1}
                                </div>

                                {/* Bar + labels */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1.5">
                                        <span className="text-sm font-medium text-slate-700">{step.label}</span>
                                        <span className="text-lg font-bold text-slate-900 tabular-nums">{step.value}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${step.color} transition-all duration-1000 ease-out`}
                                            style={{ width: `${widthPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
