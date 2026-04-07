"use client";

import type { ReactNode } from "react";

export const profileSurfaceClass =
    "relative rounded-none border-0 bg-transparent px-1 pt-5 shadow-none before:absolute before:left-3 before:right-3 before:top-0 before:h-px before:bg-[#e5e7eb] sm:rounded-2xl sm:border sm:border-[#e5e7eb] sm:bg-white sm:p-6 sm:shadow-[0_20px_45px_-36px_rgba(15,23,42,0.18)] sm:before:hidden";

export const profileHeroSurfaceClass =
    "relative overflow-visible rounded-none border-0 bg-transparent px-1 py-0 shadow-none sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#e5e7eb] sm:bg-white sm:p-6 sm:shadow-[0_30px_70px_-52px_rgba(15,23,42,0.18)]";

export type WorkspaceHeroMetric = {
    label: string;
    value: string | number;
    icon?: ReactNode;
    className?: string;
};

export function WorkspaceMetricCard({ label, value, icon, className = "" }: WorkspaceHeroMetric) {
    return (
        <div
            className={`rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 shadow-[0_18px_35px_-32px_rgba(15,23,42,0.18)] ${className}`.trim()}
        >
            <div className={icon ? "mb-2 flex items-center justify-between text-[#9ca3af]" : ""}>
                {icon ? <span className="text-[#9ca3af]">{icon}</span> : null}
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca3af]">{label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-[#18181b]">{value}</div>
        </div>
    );
}

export function WorkspaceHero({
    badgeIcon,
    badgeLabel,
    title,
    summary,
    meta,
    metrics,
    titleClassName = "text-3xl font-semibold tracking-tight text-[#18181b]",
    metricsContainerClassName = "grid grid-cols-2 gap-3 sm:grid-cols-4",
    showAccent = true,
}: {
    badgeIcon: ReactNode;
    badgeLabel: string;
    title: string;
    summary: string;
    meta?: string | null;
    metrics: WorkspaceHeroMetric[];
    titleClassName?: string;
    metricsContainerClassName?: string;
    showAccent?: boolean;
}) {
    return (
        <section className={profileHeroSurfaceClass}>
            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
                        {badgeIcon}
                        {badgeLabel}
                    </div>
                    <h1 className={titleClassName}>{title}</h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#52525b]">{summary}</p>
                    {meta ? (
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#9ca3af]">{meta}</p>
                    ) : null}
                </div>

                <div className={metricsContainerClassName}>
                    {metrics.map((metric) => (
                        <WorkspaceMetricCard key={metric.label} {...metric} />
                    ))}
                </div>
            </div>
            {showAccent ? (
                <div className="pointer-events-none absolute -right-16 top-0 hidden h-40 w-40 rounded-full bg-[#111111]/5 blur-3xl sm:block" />
            ) : null}
        </section>
    );
}
