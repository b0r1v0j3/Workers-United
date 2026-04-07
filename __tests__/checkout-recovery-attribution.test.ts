import { describe, expect, it } from "vitest";

import {
    buildCheckoutFunnelStage,
    deriveCheckoutEntrySource,
    getCheckoutEntrySourceLabel,
    getCheckoutFunnelStageLabel,
    getCheckoutRecoveryOutcomeLabel,
    readCheckoutRecoveryMetadata,
} from "@/lib/checkout-recovery-attribution";

describe("checkout recovery attribution helpers", () => {
    it("derives worker queue entry source from checkout return paths", () => {
        expect(deriveCheckoutEntrySource({
            explicitSource: null,
            isAgencyCheckout: false,
            successPath: "/profile/worker/queue",
            cancelPath: "/profile/worker/queue",
        })).toBe("worker_queue");
    });

    it("keeps explicit known source values", () => {
        expect(deriveCheckoutEntrySource({
            explicitSource: "agency_worker_profile",
            isAgencyCheckout: true,
            successPath: "/profile/agency",
            cancelPath: "/profile/agency",
        })).toBe("agency_worker_profile");
    });

    it("builds deterministic stage labels from recovery step and outcome", () => {
        expect(buildCheckoutFunnelStage({ recoveryStep: 2, recoveryOutcome: "queued" })).toBe("recovery_step_2");
        expect(buildCheckoutFunnelStage({ recoveryStep: 3, recoveryOutcome: "abandoned" })).toBe("checkout_abandoned");
        expect(buildCheckoutFunnelStage({ recoveryStep: 1, recoveryOutcome: "failed" })).toBe("recovery_failed");
    });

    it("reads fallback metadata when legacy rows miss new fields", () => {
        expect(readCheckoutRecoveryMetadata({
            checkout_started_at: "2026-04-07T08:00:00.000Z",
            agency_checkout: true,
        })).toMatchObject({
            entrySource: "agency_dashboard",
            checkoutOpenedAt: "2026-04-07T08:00:00.000Z",
            latestFunnelStage: "checkout_opened",
        });
    });

    it("exposes human-friendly labels for ops surfaces", () => {
        expect(getCheckoutEntrySourceLabel("worker_dashboard")).toBe("Worker dashboard");
        expect(getCheckoutFunnelStageLabel("recovery_step_3")).toBe("Recovery step 3");
        expect(getCheckoutRecoveryOutcomeLabel("suppressed")).toBe("Recovery suppressed");
    });
});
