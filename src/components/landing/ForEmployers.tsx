import { Check } from "lucide-react";

export function ForEmployers() {
    return (
        <section id="employers" className="py-20 md:py-24 bg-white">
            <div className="container mx-auto px-5 max-w-[1120px]">
                <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-12 items-center">
                    {/* Left Card similar to For Workers reverse */}
                    <div className="bg-bg-alt rounded-2xl p-5 md:p-6 border border-border shadow-[0_12px_32px_rgba(9,30,66,0.18)] h-fit order-last md:order-first">
                        <h3 className="text-lg font-semibold text-primary mb-2">
                            What serious employers get from us
                        </h3>
                        <p className="text-sm text-muted mb-4">
                            We help employers who are ready to respect the law and treat workers fairly – but do not have time or experience to manage the full process alone.
                        </p>
                        <ul className="space-y-3 mb-4">
                            {[
                                "We speak honestly with workers so they clearly understand pay, duties and life conditions before travelling.",
                                "We help prepare correct invitations, contracts and other documents for work visa applications.",
                                "We reduce misunderstandings and early resignations by aligning expectations on both sides from the start.",
                                "We stay available after arrival to help solve small issues before they become big problems.",
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-text-main">
                                    <span className="w-[18px] h-[18px] rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 text-[11px] mt-0.5">
                                        <Check size={10} strokeWidth={3} />
                                    </span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-wrap gap-2 pt-2">
                            {["Less risk", "Clear communication", "Stable cooperation"].map((tag) => (
                                <span key={tag} className="px-2.5 py-1 rounded-full bg-[#183b56]/5 text-muted text-[11px]">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Right Text */}
                    <div className="order-first md:order-last">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider bg-[#183b56]/5 text-muted mb-4">
                            For employers
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4">
                            For employers who want stability, not only &quot;cheap labour&quot;
                        </h2>
                        <p className="text-sm text-muted mb-6">
                            Workers United is not a mass online portal. We focus on realistic offers, transparent communication and long-term cooperation, so you do not have to constantly replace staff.
                        </p>

                        <ul className="space-y-2">
                            {[
                                "We speak both \"workers language\" and \"legal language\" and help connect them.",
                                "We are available in flexible hours, including evenings and weekends when workers can really talk.",
                                "We build cooperation step by step – starting from a few positions and growing together.",
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-text-main">
                                    <span className="text-accent mt-0.5">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
