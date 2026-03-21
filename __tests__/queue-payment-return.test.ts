import { describe, expect, it } from "vitest";
import { getQueuePaymentReturnMode } from "@/lib/queue-payment-return";

describe("queue-payment-return", () => {
    it("requires session verification for real payment success returns", () => {
        expect(getQueuePaymentReturnMode("success", "cs_test_123")).toBe("confirm_session");
    });

    it("does not treat payment success without a session id as a verified success", () => {
        expect(getQueuePaymentReturnMode("success", null)).toBe("verification_pending");
        expect(getQueuePaymentReturnMode("success", "")).toBe("verification_pending");
    });

    it("keeps sandbox success and cancellations on their dedicated branches", () => {
        expect(getQueuePaymentReturnMode("sandbox_success", null)).toBe("sandbox_success");
        expect(getQueuePaymentReturnMode("cancelled", null)).toBe("cancelled");
        expect(getQueuePaymentReturnMode(null, null)).toBe("ignore");
    });
});
