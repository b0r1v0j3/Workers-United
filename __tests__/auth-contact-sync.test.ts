import { describe, expect, it } from "vitest";
import { buildAuthContactSyncPlan, normalizeAuthContactPhone } from "@/lib/auth-contact-sync";

describe("auth contact sync helpers", () => {
    it("normalizes valid international phones and rejects invalid ones", () => {
        expect(normalizeAuthContactPhone("+381 64 123 4567")).toBe("+381641234567");
        expect(normalizeAuthContactPhone("+212-655-123456")).toBe("+212655123456");
        expect(normalizeAuthContactPhone("0641234567")).toBeNull();
        expect(normalizeAuthContactPhone("")).toBeNull();
    });

    it("plans a top-level auth phone update when canonical phone changed", () => {
        const plan = buildAuthContactSyncPlan(
            {
                phone: null,
                phone_confirmed_at: null,
                user_metadata: { full_name: "Worker One" },
            },
            {
                userId: "worker-1",
                phone: "+381 64 123 4567",
                fullName: "Worker One",
            }
        );

        expect(plan.normalizedPhone).toBe("+381641234567");
        expect(plan.shouldSetPhone).toBe(true);
        expect(plan.shouldUpdate).toBe(true);
        expect(plan.nextMetadata.phone).toBe("+381641234567");
    });

    it("updates metadata only when the canonical phone was cleared", () => {
        const plan = buildAuthContactSyncPlan(
            {
                phone: "+381641234567",
                phone_confirmed_at: "2026-03-18T10:00:00.000Z",
                user_metadata: {
                    full_name: "Worker One",
                    phone: "+381641234567",
                },
            },
            {
                userId: "worker-1",
                phone: null,
                fullName: "Worker One",
            }
        );

        expect(plan.normalizedPhone).toBeNull();
        expect(plan.shouldSetPhone).toBe(false);
        expect(plan.shouldUpdate).toBe(true);
        expect(plan.nextMetadata.phone).toBeNull();
    });

    it("stays idle when auth phone and metadata are already aligned", () => {
        const plan = buildAuthContactSyncPlan(
            {
                phone: "+381641234567",
                phone_confirmed_at: "2026-03-18T10:00:00.000Z",
                user_metadata: {
                    full_name: "Worker One",
                    phone: "+381641234567",
                },
            },
            {
                userId: "worker-1",
                phone: "+381641234567",
                fullName: "Worker One",
            }
        );

        expect(plan.shouldSetPhone).toBe(false);
        expect(plan.shouldUpdate).toBe(false);
    });
});
