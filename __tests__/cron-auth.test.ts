import { describe, expect, it, vi, afterEach } from "vitest";
import {
    getCronAuthorizationHeader,
    getCronSecret,
    hasValidCronBearerToken,
} from "@/lib/cron-auth";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("cron-auth", () => {
    it("fails closed when CRON_SECRET is missing instead of accepting Bearer undefined", () => {
        vi.stubEnv("CRON_SECRET", "");

        expect(getCronSecret()).toBeNull();
        expect(getCronAuthorizationHeader()).toBeNull();
        expect(hasValidCronBearerToken("Bearer undefined")).toBe(false);
        expect(hasValidCronBearerToken(null)).toBe(false);
    });

    it("accepts only the exact bearer token when CRON_SECRET exists", () => {
        vi.stubEnv("CRON_SECRET", "super-secret");

        expect(getCronSecret()).toBe("super-secret");
        expect(getCronAuthorizationHeader()).toBe("Bearer super-secret");
        expect(hasValidCronBearerToken("Bearer super-secret")).toBe(true);
        expect(hasValidCronBearerToken("Bearer wrong")).toBe(false);
    });
});
