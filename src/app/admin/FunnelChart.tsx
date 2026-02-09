
"use client";

import { useEffect, useState } from "react";

export default function FunnelChart() {
    const [data, setData] = useState({
        total_users: 0,
        completed_profiles: 0,
        uploaded_documents: 0,
        verified: 0,
        job_matched: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/admin/funnel-metrics");
                const json = await res.json();
                if (json.success) setData(json.data);
            } catch (error) {
                console.error("Failed to fetch funnel metrics:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[400px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const steps = [
        { label: "Registered Workers", value: data.total_users || 0, color: "bg-blue-500" },
        { label: "Completed Profile", value: data.completed_profiles || 0, color: "bg-indigo-500" },
        { label: "Uploaded Documents", value: data.uploaded_documents || 0, color: "bg-purple-500" },
        { label: "Verified", value: data.verified || 0, color: "bg-green-500" },
        { label: "Matched / Emailed", value: data.job_matched || 0, color: "bg-emerald-600" }
    ];

    const maxVal = Math.max(...steps.map(s => s.value), 1);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Pipeline Overview</h2>
            <div className="space-y-6">
                {steps.map((step, i) => {
                    const prevValue = i > 0 ? steps[i - 1].value : 0;
                    const conversion = prevValue > 0 ? Math.round((step.value / prevValue) * 100) : 0;

                    return (
                        <div key={i} className="relative group">
                            <div className="flex justify-between text-sm mb-2 items-end">
                                <span className="font-medium text-slate-700">{step.label}</span>
                                <div className="text-right">
                                    <span className="font-bold text-slate-900 text-lg">{step.value}</span>
                                    {i > 0 && (
                                        <span className="text-xs text-slate-400 ml-2 block">
                                            {conversion}% conversion
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${step.color} transition-all duration-1000 ease-out`}
                                    style={{ width: `${(step.value / maxVal) * 100}%` }}
                                />
                            </div>

                            {/* Comparison Line */}
                            {i > 0 && (
                                <div className="absolute top-0 right-0 h-full w-[1px] bg-slate-200 -z-10 group-hover:bg-slate-300 transition-colors" />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Last updated: just now</span>
                <button
                    onClick={() => window.location.reload()}
                    className="hover:text-slate-600 transition-colors"
                >
                    Refresh Data
                </button>
            </div>
        </div>
    );
}
