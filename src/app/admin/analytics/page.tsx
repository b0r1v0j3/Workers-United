"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, FileCheck, Briefcase, Shield } from "lucide-react";

interface FunnelData {
    total_users: number;
    completed_profiles: number;
    uploaded_documents: number;
    verified: number;
    job_matched: number;
}

export default function AnalyticsPage() {
    const [data, setData] = useState<FunnelData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/admin/funnel-metrics")
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setData(json.data);
                else setError(json.error || "Failed to load");
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-48" />
                    <div className="grid grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-32 bg-gray-200 rounded-xl" />
                        ))}
                    </div>
                    <div className="h-64 bg-gray-200 rounded-xl" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
                    {error || "Failed to load analytics"}
                </div>
            </div>
        );
    }

    const steps = [
        { label: "Registered", value: data.total_users, icon: <Users size={20} />, color: "#1877f2" },
        { label: "Profile 100%", value: data.completed_profiles, icon: <FileCheck size={20} />, color: "#0d9488" },
        { label: "Docs Uploaded", value: data.uploaded_documents, icon: <BarChart3 size={20} />, color: "#7c3aed" },
        { label: "Verified", value: data.verified, icon: <Shield size={20} />, color: "#059669" },
        { label: "Job Matched", value: data.job_matched, icon: <Briefcase size={20} />, color: "#d97706" },
    ];

    const maxVal = Math.max(...steps.map((s) => s.value), 1);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1877f2] flex items-center justify-center text-white">
                    <TrendingUp size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[#050505]">Analytics Dashboard</h1>
                    <p className="text-sm text-[#65676b]">Conversion funnel — from signup to job match</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {steps.map((step, i) => {
                    const rate = i === 0 ? 100 : data.total_users > 0
                        ? Math.round((step.value / data.total_users) * 100)
                        : 0;
                    return (
                        <div key={step.label} className="bg-white rounded-xl border border-[#dddfe2] p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                                    style={{ backgroundColor: step.color }}
                                >
                                    {step.icon}
                                </div>
                                <span className="text-xs font-semibold text-[#65676b] uppercase tracking-wider">
                                    {step.label}
                                </span>
                            </div>
                            <div className="text-2xl font-bold text-[#050505]">{step.value}</div>
                            <div className="text-xs text-[#65676b] mt-1">{rate}% of total</div>
                        </div>
                    );
                })}
            </div>

            {/* Funnel Visualization */}
            <div className="bg-white rounded-xl border border-[#dddfe2] p-6 shadow-sm">
                <h2 className="text-lg font-bold text-[#050505] mb-6">Conversion Funnel</h2>
                <div className="space-y-4">
                    {steps.map((step, i) => {
                        const width = Math.max((step.value / maxVal) * 100, 4);
                        const dropoff = i > 0
                            ? steps[i - 1].value > 0
                                ? Math.round(((steps[i - 1].value - step.value) / steps[i - 1].value) * 100)
                                : 0
                            : 0;
                        return (
                            <div key={step.label}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-[#050505]">{step.label}</span>
                                        {i > 0 && dropoff > 0 && (
                                            <span className="text-xs text-red-500 font-medium">-{dropoff}%</span>
                                        )}
                                    </div>
                                    <span className="text-sm font-bold text-[#050505]">{step.value}</span>
                                </div>
                                <div className="h-8 bg-[#f0f2f5] rounded-lg overflow-hidden">
                                    <div
                                        className="h-full rounded-lg transition-all duration-700 ease-out flex items-center px-3"
                                        style={{
                                            width: `${width}%`,
                                            backgroundColor: step.color,
                                        }}
                                    >
                                        {step.value > 0 && (
                                            <span className="text-white text-xs font-bold">{step.value}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Drop-off Summary */}
            <div className="bg-white rounded-xl border border-[#dddfe2] p-6 shadow-sm">
                <h2 className="text-lg font-bold text-[#050505] mb-4">Drop-off Analysis</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {steps.slice(1).map((step, i) => {
                        const prev = steps[i];
                        const converted = prev.value > 0 ? Math.round((step.value / prev.value) * 100) : 0;
                        return (
                            <div key={step.label} className="bg-[#f7f8fa] rounded-xl p-4 text-center">
                                <div className="text-xs text-[#65676b] mb-1">
                                    {prev.label} → {step.label}
                                </div>
                                <div className={`text-2xl font-bold ${converted >= 50 ? 'text-green-600' : converted >= 25 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {converted}%
                                </div>
                                <div className="text-xs text-[#65676b] mt-1">conversion rate</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
