import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepTrackerProps {
    currentStep: number;
}

const steps = [
    {
        number: 1,
        title: "Application Received",
        description: "We have received your basic information.",
    },
    {
        number: 2,
        title: "Documents Review",
        description: "We check your CV, Passport, and qualifications.",
    },
    {
        number: 3,
        title: "Job Matching",
        description: "Finding the right employer for your profile.",
    },
    {
        number: 4,
        title: "Contract & Visa",
        description: "Signing employment contract and applying for permits.",
    },
];

export function StepTracker({ currentStep }: StepTrackerProps) {
    return (
        <div className="flex flex-col relative space-y-0">
            {steps.map((step, index) => {
                const isCompleted = step.number < currentStep;
                const isActive = step.number === currentStep;
                const isLast = index === steps.length - 1;

                return (
                    <div key={step.number} className="flex gap-4 pb-6 last:pb-0 relative">
                        {/* Vertical Line */
                            !isLast && (
                                <div
                                    className={cn(
                                        "absolute left-[14px] top-[10px] bottom-0 w-[2px] z-0",
                                        isCompleted ? "bg-accent" : "bg-border"
                                    )}
                                />
                            )}

                        {/* Dot */}
                        <div
                            className={cn(
                                "relative z-10 flex items-center justify-center w-[30px] h-[30px] rounded-full border-2 text-sm font-semibold transition-all duration-300 shrink-0",
                                isCompleted
                                    ? "bg-accent border-accent text-white"
                                    : isActive
                                        ? "bg-primary-soft border-primary-soft text-white ring-4 ring-primary-soft/20"
                                        : "bg-white border-muted/30 text-muted"
                            )}
                        >
                            {isCompleted ? <Check size={16} strokeWidth={3} /> : step.number}
                        </div>

                        {/* Content */}
                        <div className="pt-1 flex-1">
                            <div className={cn("font-bold text-[15px] mb-1", isActive ? "text-primary" : "text-text-main")}>
                                {step.title}
                            </div>
                            <div className="text-[13px] text-muted leading-relaxed">
                                {step.description}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
