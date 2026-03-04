import { describe, expect, it } from "vitest";
import { evaluateSmoke } from "@/lib/smoke-evaluator";

describe("evaluateSmoke", () => {
    it("returns critical when any route fails", () => {
        const result = evaluateSmoke(
            [{ name: "supabase", state: "ok", required: true }],
            [{ path: "/login", ok: false, status: 500, latencyMs: 120 }]
        );

        expect(result.status).toBe("critical");
        expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it("returns degraded when required service is degraded", () => {
        const result = evaluateSmoke(
            [{ name: "smtp", state: "degraded", required: true }],
            [{ path: "/api/health", ok: true, status: 200, latencyMs: 100 }]
        );

        expect(result.status).toBe("degraded");
        expect(result.warnings.some((w) => w.includes("smtp"))).toBe(true);
    });

    it("returns healthy when all checks are ok", () => {
        const result = evaluateSmoke(
            [
                { name: "supabase", state: "ok", required: true },
                { name: "stripe", state: "ok", required: true },
            ],
            [
                { path: "/login", ok: true, status: 200, latencyMs: 100 },
                { path: "/signup", ok: true, status: 200, latencyMs: 150 },
            ]
        );

        expect(result.status).toBe("healthy");
        expect(result.criticalIssues).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
    });
});

