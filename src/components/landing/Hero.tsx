import { Button } from "@/components/ui/Button";
import { Check } from "lucide-react";

export function Hero() {
    return (
        <section className="pt-10 pb-10 md:pt-20 md:pb-20">
            <div className="container mx-auto px-5 max-w-[1120px]">
                <div className="grid md:grid-cols-[1.15fr_0.9fr] gap-8 md:gap-12 items-center">
                    {/* Left Content */}
                    <div className="bg-[radial-gradient(circle_at_top_left,#e4ebff,#f9fbff)] rounded-[32px] p-6 md:p-8 shadow-[var(--shadow-soft)] border border-[#dde3ec]/90 relative overflow-hidden">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-[#183b56]/5 text-muted mb-4">
                            <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_0_4px_rgba(29,191,115,0.25)]" />
                            Safe, legal and personalised support
                        </div>

                        <h1 className="text-3xl md:text-[38px] leading-[1.15] font-bold text-primary tracking-[-0.03em] mb-3">
                            International hiring made simple & legal.
                        </h1>

                        <p className="text-base text-muted max-w-[520px] mb-6">
                            Workers United connects serious employers with reliable workers worldwide and guides both sides through the full work visa process – without fake promises or hidden conditions.
                        </p>

                        <div className="flex flex-wrap gap-2.5 mb-5">
                            <Button href="/#workers">For workers</Button>
                            <Button href="/#employers" variant="ghost">For employers</Button>
                        </div>

                        <p className="text-xs text-muted">
                            <strong className="text-primary">If you have any questions</strong>, please feel free to contact us by phone or email. A member of our team will reply personally.
                        </p>
                    </div>

                    {/* Right Content */}
                    <div className="grid gap-4">
                        <div className="bg-bg-alt rounded-2xl p-5 border border-border shadow-[0_10px_28px_rgba(9,30,66,0.15)]">
                            <div className="text-sm font-semibold text-primary mb-2">What you can expect</div>
                            <ul className="space-y-2">
                                {[
                                    "We carefully explain contracts so you know what you are really signing.",
                                    "We support the full work visa process – not only finding a job.",
                                    "We work only with employers who are ready to follow the law and treat workers fairly.",
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-[13px] text-muted">
                                        <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 mt-0.5">
                                            <Check size={10} strokeWidth={3} />
                                        </span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-gradient-to-br from-[#183b56] to-[#2f6fed] rounded-2xl p-4 text-[#eaf1ff] text-[13px] flex flex-col gap-1.5 shadow-lg">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] uppercase tracking-wider w-fit">
                                <span>Trusted cooperation</span>
                            </div>
                            <div>
                                <strong className="text-white">We talk to people, not only collect documents.</strong>
                                <br />
                                Every worker and employer has direct contact with a real person from our team, before and after arrival.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
