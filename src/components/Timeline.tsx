"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface TimelineProps {
    candidateId?: string;
}

const TIMELINE_STEPS = [
    {
        id: "new",
        title: "Application Received",
        description: "We have received your basic information.",
        statuses: ["NEW", "DOCS REQUESTED"]
    },
    {
        id: "docs",
        title: "Documents Review",
        description: "We check your CV, Passport, and qualifications.",
        statuses: ["DOCS_RECEIVED", "UNDER REVIEW"]
    },
    {
        id: "review",
        title: "Job Matching",
        description: "Finding the right employer for your profile.",
        statuses: ["APPROVED", "MATCHING"]
    },
    {
        id: "approved",
        title: "Contract & Visa",
        description: "Signing employment contract and applying for permits.",
        statuses: ["MATCHED", "VISA_PROCESSING", "COMPLETE"]
    }
];

export default function Timeline({ candidateId }: TimelineProps) {
    const [currentStatus, setCurrentStatus] = useState<string>("NEW");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (candidateId) {
            fetchStatus();
        } else {
            setLoading(false);
        }
    }, [candidateId]);

    async function fetchStatus() {
        const supabase = createClient();
        try {
            const { data } = await supabase
                .from("candidates")
                .select("status")
                .eq("id", candidateId)
                .single();

            if (data?.status) {
                setCurrentStatus(data.status);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function getStepState(step: typeof TIMELINE_STEPS[0], index: number): "completed" | "active" | "upcoming" {
        // Find which step the current status belongs to
        let currentStepIndex = 0;
        for (let i = 0; i < TIMELINE_STEPS.length; i++) {
            if (TIMELINE_STEPS[i].statuses.includes(currentStatus)) {
                currentStepIndex = i;
                break;
            }
        }

        if (index < currentStepIndex) return "completed";
        if (index === currentStepIndex) return "active";
        return "upcoming";
    }

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-40 bg-gray-200 rounded"></div>
            </div>
        );
    }

    return (
        <div className="card">
            <h3 style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#183b56",
                marginBottom: "20px"
            }}>
                Application Progress
            </h3>

            <div className="timeline">
                {TIMELINE_STEPS.map((step, index) => {
                    const state = getStepState(step, index);

                    return (
                        <div
                            key={step.id}
                            className={`timeline-item ${state === "completed" ? "step-completed" :
                                    state === "active" ? "step-active" : ""
                                }`}
                        >
                            {/* Vertical Line */}
                            {index < TIMELINE_STEPS.length - 1 && (
                                <div className="timeline-line" />
                            )}

                            {/* Step Dot */}
                            <div className="step-dot">
                                {state === "completed" ? "✓" : index + 1}
                            </div>

                            {/* Content */}
                            <div className="step-content">
                                <div className="step-title" style={{ marginBottom: "4px" }}>
                                    {step.title}
                                </div>
                                <div className="step-desc">
                                    {step.description}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
