import { describe, expect, it } from "vitest";

import {
    extractResponsesJsonText,
    getDailyExceptionReasons,
    parseBrainAnalysis,
} from "@/lib/brain-monitor";

describe("brain monitor helpers", () => {
    it("extracts JSON from Responses API content blocks", () => {
        const jsonText = extractResponsesJsonText({
            output: [
                {
                    content: [
                        {
                            text: "```json\n{\"summary\":\"ok\",\"healthScore\":92}\n```",
                        },
                    ],
                },
            ],
        });

        expect(jsonText).toBe("{\"summary\":\"ok\",\"healthScore\":92}");
    });

    it("normalizes partial AI analysis without crashing on missing issue fields", () => {
        const analysis = parseBrainAnalysis({
            output_text: JSON.stringify({
                summary: "Monitor found one problem",
                healthScore: 81,
                operations: [
                    {
                        name: "Email & WhatsApp",
                        emoji: "📨",
                        findings: ["Recent platform-side WhatsApp failures need review"],
                    },
                ],
                issues: [
                    {
                        title: "WhatsApp template failures are climbing",
                        body: "Investigate template send errors in the last 24h",
                    },
                ],
            }),
        });

        expect(analysis.summary).toBe("Monitor found one problem");
        expect(analysis.operations[0]?.status).toBe("WARNING");
        expect(analysis.issues[0]?.priority).toBe("P2");
        expect(analysis.issues[0]?.labels).toEqual([]);
        expect(analysis.metrics.emailDeliveryRate).toBe("N/A");
    });

    it("derives exception reasons from normalized analysis", () => {
        const analysis = parseBrainAnalysis({
            output_text: JSON.stringify({
                summary: "Critical auth drift detected",
                healthScore: 70,
                operations: [
                    {
                        name: "Auth Health",
                        emoji: "🔐",
                        status: "CRITICAL",
                        findings: ["Users are missing onboarding rows"],
                        score: 35,
                    },
                ],
                issues: [
                    {
                        title: "Auth rows are missing",
                        body: "Create missing records",
                        priority: "P0",
                        labels: ["bug", "auth-health"],
                    },
                ],
                actions: [
                    {
                        type: "retry_email",
                        description: "Retry failed welcome email",
                    },
                ],
            }),
        });

        expect(getDailyExceptionReasons(analysis, 85)).toEqual([
            "1 issue(s) detected",
            "auto-retry email action suggested",
            "at least one operation is CRITICAL",
            "health score below 85",
        ]);
    });
});
