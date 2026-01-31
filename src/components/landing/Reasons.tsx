export function Reasons() {
    const reasons = [
        {
            title: "Real humans, not just online forms",
            text: "Workers and employers can speak directly with a person who understands both sides – not with a chatbot or anonymous email address.",
        },
        {
            title: "Safety before speed",
            text: "It is better to say \"no\" to a bad offer than to send people into problems. We prefer safe and legal processes, even if they are slower.",
        },
        {
            title: "Clear communication",
            text: "We explain every important detail: salary, overtime, accommodation, travel costs, paperwork – so everyone knows what to expect.",
        },
    ];

    return (
        <section className="py-20 md:py-24">
            <div className="container mx-auto px-5 max-w-[1120px]">
                <div className="text-center max-w-[640px] mx-auto mb-12">
                    <div className="text-xs uppercase tracking-[0.12em] text-muted mb-2">Why choose us</div>
                    <h2 className="text-2xl md:text-3xl font-bold text-primary mb-3">What makes Workers United different</h2>
                    <p className="text-sm text-muted">
                        We do not promise &quot;magic solutions&quot;. We focus on honest information, realistic expectations and stable cooperation.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    {reasons.map((reason) => (
                        <div key={reason.title} className="bg-bg-alt rounded-2xl p-4 md:p-5 border border-border shadow-sm">
                            <div className="text-[15px] font-semibold text-primary mb-2">{reason.title}</div>
                            <div className="text-[13px] text-muted leading-relaxed">
                                {reason.text}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
