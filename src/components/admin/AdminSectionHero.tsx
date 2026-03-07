"use client";

type AdminHeroMetric = {
    label: string;
    value: string | number;
    meta?: string;
};

export default function AdminSectionHero({
    eyebrow,
    title,
    description,
    metrics,
}: {
    eyebrow: string;
    title: string;
    description: string;
    metrics: AdminHeroMetric[];
}) {
    return (
        <section className="rounded-[28px] border border-[#e8e5de] bg-[linear-gradient(135deg,#fcfbf7_0%,#f1eee5_50%,#f7f5ef_100%)] p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-3 inline-flex items-center rounded-full border border-[#dfdbd0] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                        {eyebrow}
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-[#18181b]">{title}</h1>
                    <p className="mt-2 text-sm leading-relaxed text-[#57534e]">{description}</p>
                </div>

                <div className={`grid gap-3 ${metrics.length >= 5 ? "sm:grid-cols-5" : "sm:grid-cols-4"} grid-cols-2`}>
                    {metrics.map((metric) => (
                        <div
                            key={metric.label}
                            className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_35px_-32px_rgba(15,23,42,0.45)]"
                        >
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8479]">
                                {metric.label}
                            </div>
                            <div className="mt-2 text-2xl font-semibold tracking-tight text-[#18181b]">
                                {metric.value}
                            </div>
                            {metric.meta ? (
                                <div className="mt-1 text-xs text-[#78716c]">{metric.meta}</div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
