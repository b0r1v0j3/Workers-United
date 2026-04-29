import { describe, expect, it } from "vitest";
import { isCsrfExempt } from "@/proxy";

describe("CSRF proxy exemptions", () => {
    it("allows the bearer-protected email agent bridge to receive server-to-server POSTs", () => {
        expect(isCsrfExempt("/api/agent/email")).toBe(true);
        expect(isCsrfExempt("/api/agent/email/")).toBe(true);
    });
});
