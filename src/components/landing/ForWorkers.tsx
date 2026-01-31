import { Check } from "lucide-react";

export function ForWorkers() {
    return (
        <section id="workers" className="py-20 md:py-24">
            <div className="container mx-auto px-5 max-w-[1120px]">
                <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-12">
                    {/* Left Text */}
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider bg-[#183b56]/5 text-muted mb-4">
                            For workers
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4">
                            For workers who want a real chance, not empty promises
                        </h2>
                        <p className="text-sm text-muted mb-6">
                            Many people hear big promises and nice stories, and then the reality is completely different. Our goal is to help you understand what you are signing and what you can really expect when you arrive.
                        </p>

                        <ul className="space-y-3">
                            {[
                                "We explain your contract and conditions in simple language – salary, working hours, days off, accommodation.",
                                "We tell you honestly if an offer looks unrealistic or dangerous, even if that means we do not continue the process.",
                                "We support you with documents for work visa and give clear instructions step by step.",
                                "You can always ask questions before and after arrival – by call, message or email.",
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-text-main">
                                    <span className="w-[18px] h-[18px] rounded-full border border-accent/60 flex items-center justify-center text-accent shrink-0 text-[11px] mt-0.5">
                                        <Check size={10} strokeWidth={3} />
                                    </span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right Card */}
                    <div className="bg-bg-alt rounded-2xl p-5 md:p-6 border border-border shadow-[0_12px_32px_rgba(9,30,66,0.18)] h-fit">
                        <h3 className="text-lg font-semibold text-primary mb-2">
                            What workers usually ask us
                        </h3>
                        <p className="text-sm text-muted mb-4">We most often help workers who:</p>
                        <ul className="space-y-2 mb-4">
                            {[
                                "already have an offer but are not sure if it is safe or fair;",
                                "need help to understand what is written in the contract and visa documents;",
                                "want someone neutral to check both the employer and the agent before they decide.",
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-text-main">
                                    <span className="text-accent mt-0.5">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-wrap gap-2 pt-2">
                            {["Simple explanations", "Real expectations", "Support before & after arrival"].map((tag) => (
                                <span key={tag} className="px-2.5 py-1 rounded-full bg-[#183b56]/5 text-muted text-[11px]">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
