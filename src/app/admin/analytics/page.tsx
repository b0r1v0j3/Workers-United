"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, FileCheck, Briefcase, Shield, Calendar, CreditCard, ExternalLink } from "lucide-react";
import AdaptiveSelect from "@/components/forms/AdaptiveSelect";
import { RegistrationsChart, RevenueChart } from "@/components/admin/AnalyticsCharts";

interface FunnelData {
    total_users: number;
    completed_profiles: number;
    uploaded_documents: number;
    verified: number;
    job_matched: number;
    payment_quality?: {
        paid: number;
        active: number;
        expired: number;
        abandoned: number;
        bank_declined: number;
        stripe_blocked: number;
        worker_countries?: Array<{ country: string; count: number }>;
        billing_countries?: Array<{ country: string; count: number }>;
        recent_issues: Array<{
            profile_id: string;
            full_name: string;
            email: string;
            worker_status: string;
            outcome: string;
            outcome_label: string;
            outcome_detail: string;
            worker_country: string | null;
            billing_country: string | null;
            card_country: string | null;
            hours_since_checkout: number | null;
            last_event_at: string | null;
            workspace_href: string;
            case_href: string;
        }>;
    };
    supply_demand?: { industry: string; supply: number; demand: number }[];
    time_series?: { date: string; workers: number; employers: number; revenue: number }[];
}

type Period = "all" | "7d" | "30d" | "this_month" | "last_month";

function getDateRange(period: Period): { from?: string; to?: string } {
    const now = new Date();
    switch (period) {
        case "7d": {
            const from = new Date(now);
            from.setDate(from.getDate() - 7);
            return { from: from.toISOString().split("T")[0] };
        }
        case "30d": {
            const from = new Date(now);
            from.setDate(from.getDate() - 30);
            return { from: from.toISOString().split("T")[0] };
        }
        case "this_month": {
            const from = new Date(now.getFullYear(), now.getMonth(), 1);
            return { from: from.toISOString().split("T")[0] };
        }
        case "last_month": {
            const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const to = new Date(now.getFullYear(), now.getMonth(), 0);
            return {
                from: from.toISOString().split("T")[0],
                to: to.toISOString().split("T")[0],
            };
        }
        default:
            return {};
    }
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "—";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "—";
    }

    return parsed.toLocaleString("en-GB");
}

export default function AnalyticsPage() {
    const [data, setData] = useState<FunnelData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<Period>("all");
    const [paymentOutcomeFilter, setPaymentOutcomeFilter] = useState("all");
    const [workerCountryFilter, setWorkerCountryFilter] = useState("all");
    const [billingCountryFilter, setBillingCountryFilter] = useState("all");

    const loadData = (p: Period) => {
        setLoading(true);
        setError(null);
        const range = getDateRange(p);
        const params = new URLSearchParams();
        if (range.from) params.set("from", range.from);
        if (range.to) params.set("to", range.to);
        const qs = params.toString();
        fetch(`/api/admin/funnel-metrics${qs ? `?${qs}` : ""}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setData(json.data);
                else setError(json.error || "Failed to load");
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            loadData(period);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [period]);

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

    const PERIOD_LABELS: Record<Period, string> = {
        all: "All Time",
        "7d": "Last 7 Days",
        "30d": "Last 30 Days",
        this_month: "This Month",
        last_month: "Last Month",
    };
    const paymentIssues = data.payment_quality?.recent_issues || [];
    const workerCountryOptions = [
        "all",
        ...Array.from(new Set(paymentIssues.map((issue) => issue.worker_country).filter(Boolean) as string[])).sort(),
    ];
    const billingCountryOptions = [
        "all",
        ...Array.from(new Set(paymentIssues.map((issue) => issue.billing_country).filter(Boolean) as string[])).sort(),
    ];
    const filteredPaymentIssues = paymentIssues.filter((issue) => {
        if (paymentOutcomeFilter !== "all" && issue.outcome !== paymentOutcomeFilter) {
            return false;
        }
        if (workerCountryFilter !== "all" && issue.worker_country !== workerCountryFilter) {
            return false;
        }
        if (billingCountryFilter !== "all" && issue.billing_country !== billingCountryFilter) {
            return false;
        }
        return true;
    });

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1877f2] flex items-center justify-center text-white">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[#050505]">Analytics Dashboard</h1>
                        <p className="text-sm text-[#65676b]">Conversion funnel — from signup to job match</p>
                    </div>
                </div>

                {/* Period Filter */}
                <div className="flex items-center gap-2 bg-white border border-[#dddfe2] rounded-lg px-3 py-2">
                    <Calendar size={16} className="text-[#65676b]" />
                    <AdaptiveSelect
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as Period)}
                        className="text-sm font-medium text-[#050505] bg-transparent border-none outline-none cursor-pointer"
                        desktopSearchThreshold={999}
                    >
                        {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </AdaptiveSelect>
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

            {/* Charts Section */}
            {data.time_series && data.time_series.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-xl border border-[#dddfe2] p-6 shadow-sm">
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-[#050505]">User Growth</h2>
                            <p className="text-sm text-[#65676b]">New worker and employer signups over time</p>
                        </div>
                        <RegistrationsChart data={data.time_series} />
                    </div>
                    <div className="bg-white rounded-xl border border-[#dddfe2] p-6 shadow-sm">
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-[#050505]">Revenue</h2>
                            <p className="text-sm text-[#65676b]">Gross entry and placement fees</p>
                        </div>
                        <RevenueChart data={data.time_series} />
                    </div>
                </div>
            )}

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

            {/* Payment Quality */}
            <div className="bg-white rounded-xl border border-[#dddfe2] p-6 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-[#050505]">Payment Quality</h2>
                        <p className="text-sm text-[#65676b]">
                            Latest $9 Job Finder checkout attempt per worker, split between clean payments, active windows,
                            expired sessions, bank declines, and Stripe risk blocks.
                        </p>
                    </div>
                    <Link
                        href="/internal/ops#payment-quality"
                        className="inline-flex items-center gap-2 rounded-lg border border-[#dddfe2] bg-white px-4 py-2 text-sm font-semibold text-[#050505] hover:bg-[#f7f8fa]"
                    >
                        Open internal ops
                        <ExternalLink size={14} />
                    </Link>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
                    {[
                        { label: "Paid", value: data.payment_quality?.paid || 0, color: "#059669" },
                        { label: "Active", value: data.payment_quality?.active || 0, color: "#2563eb" },
                        { label: "Expired", value: data.payment_quality?.expired || 0, color: "#d97706" },
                        { label: "Abandoned", value: data.payment_quality?.abandoned || 0, color: "#b45309" },
                        { label: "Bank Declined", value: data.payment_quality?.bank_declined || 0, color: "#dc2626" },
                        { label: "Stripe Blocked", value: data.payment_quality?.stripe_blocked || 0, color: "#7c3aed" },
                    ].map((metric) => (
                        <div key={metric.label} className="rounded-xl border border-[#dddfe2] bg-[#fcfcfd] p-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ backgroundColor: metric.color }}>
                                    <CreditCard size={16} />
                                </div>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#65676b]">
                                    {metric.label}
                                </span>
                            </div>
                            <div className="mt-3 text-2xl font-bold text-[#050505]">{metric.value}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-[#dddfe2] bg-[#fcfcfd] p-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#65676b]">Top worker countries</div>
                        <div className="mt-3 space-y-2">
                            {(data.payment_quality?.worker_countries || []).slice(0, 5).map((entry) => (
                                <div key={`worker-country-${entry.country}`} className="flex items-center justify-between text-sm">
                                    <span className="text-[#050505]">{entry.country}</span>
                                    <span className="font-semibold text-[#2563eb]">{entry.count}</span>
                                </div>
                            ))}
                            {(data.payment_quality?.worker_countries || []).length === 0 && (
                                <div className="text-sm italic text-slate-400">No worker-country signal yet.</div>
                            )}
                        </div>
                    </div>
                    <div className="rounded-xl border border-[#dddfe2] bg-[#fcfcfd] p-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#65676b]">Top billing countries</div>
                        <div className="mt-3 space-y-2">
                            {(data.payment_quality?.billing_countries || []).slice(0, 5).map((entry) => (
                                <div key={`billing-country-${entry.country}`} className="flex items-center justify-between text-sm">
                                    <span className="text-[#050505]">{entry.country}</span>
                                    <span className="font-semibold text-[#7c3aed]">{entry.count}</span>
                                </div>
                            ))}
                            {(data.payment_quality?.billing_countries || []).length === 0 && (
                                <div className="text-sm italic text-slate-400">No billing-country signal yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#65676b]">Recent payment issues</h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <AdaptiveSelect
                                value={paymentOutcomeFilter}
                                onChange={(event) => setPaymentOutcomeFilter(event.target.value)}
                                className="min-w-[170px] rounded-lg border border-[#dddfe2] bg-white px-3 py-2 text-sm font-medium text-[#050505]"
                                desktopSearchThreshold={999}
                            >
                                <option value="all">All issue types</option>
                                <option value="issuer_declined">Bank declined</option>
                                <option value="stripe_blocked">Stripe blocked</option>
                                <option value="expired">Checkout expired</option>
                                <option value="abandoned">Abandoned</option>
                            </AdaptiveSelect>
                            <AdaptiveSelect
                                value={workerCountryFilter}
                                onChange={(event) => setWorkerCountryFilter(event.target.value)}
                                className="min-w-[170px] rounded-lg border border-[#dddfe2] bg-white px-3 py-2 text-sm font-medium text-[#050505]"
                                desktopSearchThreshold={999}
                            >
                                <option value="all">All worker countries</option>
                                {workerCountryOptions.filter((value) => value !== "all").map((value) => (
                                    <option key={`worker-filter-${value}`} value={value}>{value}</option>
                                ))}
                            </AdaptiveSelect>
                            <AdaptiveSelect
                                value={billingCountryFilter}
                                onChange={(event) => setBillingCountryFilter(event.target.value)}
                                className="min-w-[170px] rounded-lg border border-[#dddfe2] bg-white px-3 py-2 text-sm font-medium text-[#050505]"
                                desktopSearchThreshold={999}
                            >
                                <option value="all">All billing countries</option>
                                {billingCountryOptions.filter((value) => value !== "all").map((value) => (
                                    <option key={`billing-filter-${value}`} value={value}>{value}</option>
                                ))}
                            </AdaptiveSelect>
                        </div>
                    </div>
                    {filteredPaymentIssues.length ? (
                        filteredPaymentIssues.slice(0, 6).map((issue) => (
                            <div key={`${issue.profile_id}-${issue.outcome}-${issue.last_event_at || "unknown"}`} className="rounded-xl border border-[#e6e6e1] bg-[#fcfcfb] p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-[#050505]">{issue.full_name}</div>
                                        <div className="mt-1 text-sm text-[#65676b]">
                                            {issue.email}
                                            {issue.hours_since_checkout ? ` • ${issue.hours_since_checkout}h since checkout` : ""}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className="rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#57534e]">
                                                {issue.worker_status.replace(/_/g, " ")}
                                            </span>
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                                {issue.outcome_label}
                                            </span>
                                            {issue.worker_country && (
                                                <span className="rounded-full border border-[#dbeafe] bg-[#eff6ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">
                                                    Worker {issue.worker_country}
                                                </span>
                                            )}
                                            {issue.billing_country && (
                                                <span className="rounded-full border border-[#ede9fe] bg-[#f5f3ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d28d9]">
                                                    Billing {issue.billing_country}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 text-xs text-[#71717a]">
                                            {issue.outcome_detail}
                                            {issue.last_event_at ? ` • last event ${formatDateTime(issue.last_event_at)}` : ""}
                                        </div>
                                    </div>
                                    <div className="flex w-full flex-col gap-2 lg:w-[220px]">
                                        <Link
                                            href={issue.workspace_href}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:border-[#cfc9bf] hover:bg-[#fafaf9]"
                                        >
                                            <ExternalLink size={16} />
                                            Inspect worker
                                        </Link>
                                        <Link
                                            href={issue.case_href}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm font-semibold text-[#18181b] transition hover:border-[#cfc9bf] hover:bg-[#fafaf9]"
                                        >
                                            <Shield size={16} />
                                            Open case
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-xl border border-dashed border-[#dddfe2] bg-[#fafaf9] p-8 text-center text-sm italic text-slate-400">
                            No recent bank declines, Stripe blocks, or expired checkout sessions in the selected period.
                        </div>
                    )}
                </div>
            </div>

            {/* Supply vs Demand */}
            {data.supply_demand && data.supply_demand.length > 0 && (
                <div className="bg-white rounded-xl border border-[#dddfe2] p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-[#050505]">Supply vs Demand (IN_QUEUE)</h2>
                            <p className="text-sm text-[#65676b]">Comparing available workers against open job positions by industry</p>
                        </div>
                        <div className="flex gap-4 text-xs font-semibold">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-blue-500"></div> Supply (Available Workers)
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-orange-500"></div> Demand (Open Jobs)
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {data.supply_demand.map((item, idx) => {
                            const maxVal = Math.max(item.supply, item.demand, 1);
                            const supplyPct = (item.supply / maxVal) * 100;
                            const demandPct = (item.demand / maxVal) * 100;

                            return (
                                <div key={idx}>
                                    <div className="flex justify-between text-sm font-semibold text-[#050505] mb-1.5">
                                        <span>{item.industry}</span>
                                        <div className="flex gap-4">
                                            <span className="text-blue-600 font-bold">{item.supply} workers</span>
                                            <span className="text-orange-600 font-bold">{item.demand} jobs</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {/* Supply Bar */}
                                        <div className="h-2.5 bg-[#f0f2f5] rounded-full overflow-hidden w-full">
                                            <div className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.max(supplyPct, 1)}%` }}></div>
                                        </div>
                                        {/* Demand Bar */}
                                        <div className="h-2.5 bg-[#f0f2f5] rounded-full overflow-hidden w-full">
                                            <div className="h-full bg-orange-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.max(demandPct, 1)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
