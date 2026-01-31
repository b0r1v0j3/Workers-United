export function HowItWorks() {
    const steps = [
        {
            number: 1,
            title: "You contact us",
            text: "Worker or employer sends us a message with basic information. We reply personally – not with automatic messages.",
        },
        {
            number: 2,
            title: "We understand your situation",
            text: "We ask specific questions about the job, salary, accommodation and family situation, to see if everything is realistic and legal before we continue.",
        },
        {
            number: 3,
            title: "Documents & visa support",
            text: "We help prepare invitations, contracts and other paperwork for work visa. We also explain what every document means so there are no surprises later.",
        },
        {
            number: 4,
            title: "Arrival & follow-up",
            text: "After arrival we remain available to both worker and employer, to solve problems early and keep cooperation stable, not only for the first month.",
        },
    ];

    return (
        <section id="how-it-works" className="py-20 md:py-24 bg-white">
            <div className="container mx-auto px-5 max-w-[1120px]">
                <div className="text-center max-w-[640px] mx-auto mb-12">
                    <div className="text-xs uppercase tracking-[0.12em] text-muted mb-2">Step by step</div>
                    <h2 className="text-2xl md:text-3xl font-bold text-primary mb-3">How Workers United process looks</h2>
                    <p className="text-sm text-muted">
                        Clear steps for both sides – from first contact until the worker arrives and starts working.
                    </p>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                    {steps.map((step) => (
                        <div key={step.number} className="bg-bg-alt rounded-2xl p-4 md:p-5 border border-border shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-primary-soft/10 text-primary-soft flex items-center justify-center font-bold text-sm mb-3">
                                {step.number}
                            </div>
                            <div className="text-[15px] font-semibold text-primary mb-2">{step.title}</div>
                            <div className="text-[13px] text-muted leading-relaxed">
                                {step.text}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
