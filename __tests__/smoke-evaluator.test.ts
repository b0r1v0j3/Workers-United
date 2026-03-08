import { describe, expect, it } from "vitest";
import { evaluateSmoke } from "@/lib/smoke-evaluator";

describe("smoke evaluator", () => {
    it("returns healthy when routes and services are all healthy", () => {
        const evaluation = evaluateSmoke(
            [
                { name: "supabase", state: "ok", required: true },
                { name: "stripe", state: "ok", required: true },
                { name: "whatsapp", state: "ok", required: false },
            ],
            [
                { path: "/", ok: true, status: 200, latencyMs: 120 },
                { path: "/login", ok: true, status: 200, latencyMs: 180 },
            ]
        );

        expect(evaluation.status).toBe("healthy");
        expect(evaluation.warnings).toHaveLength(0);
        expect(evaluation.criticalIssues).toHaveLength(0);
    });

    it("returns degraded when an optional service is degraded", () => {
        const evaluation = evaluateSmoke(
            [
                { name: "supabase", state: "ok", required: true },
                { name: "whatsapp", state: "degraded", required: false },
            ],
            [
                { path: "/", ok: true, status: 200, latencyMs: 90 },
            ]
        );

        expect(evaluation.status).toBe("degraded");
        expect(evaluation.warnings).toContain("Optional service whatsapp is degraded");
    });

    it("returns critical when a required service is down", () => {
        const evaluation = evaluateSmoke(
            [
                { name: "supabase", state: "down", required: true },
                { name: "whatsapp", state: "ok", required: false },
            ],
            [
                { path: "/", ok: true, status: 200, latencyMs: 90 },
            ]
        );

        expect(evaluation.status).toBe("critical");
        expect(evaluation.criticalIssues).toContain("Service supabase is down");
    });
});
