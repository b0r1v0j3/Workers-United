import { describe, expect, it } from "vitest";
import { getWorkerQueueStage } from "@/lib/worker-workspace-state";

describe("worker-workspace-state", () => {
    it("treats pre-queue paid workers as payment pending activation", () => {
        expect(getWorkerQueueStage({
            activeOfferCount: 0,
            hasPaidEntryFee: true,
            inQueue: false,
            workerStatus: "PENDING_APPROVAL",
        })).toBe("payment_pending_activation");
    });

    it("keeps in-queue workers on the queue stage", () => {
        expect(getWorkerQueueStage({
            activeOfferCount: 0,
            hasPaidEntryFee: true,
            inQueue: true,
            workerStatus: "IN_QUEUE",
        })).toBe("in_queue");
    });

    it("treats advanced post-payment worker states as case-active instead of queue activation", () => {
        expect(getWorkerQueueStage({
            activeOfferCount: 0,
            hasPaidEntryFee: true,
            inQueue: false,
            workerStatus: "OFFER_ACCEPTED",
        })).toBe("post_payment_case_active");
    });

    it("treats offer-pending drift without an active offer as case-active instead of queue activation", () => {
        expect(getWorkerQueueStage({
            activeOfferCount: 0,
            hasPaidEntryFee: true,
            inQueue: false,
            workerStatus: "OFFER_PENDING",
        })).toBe("post_payment_case_active");
    });

    it("treats refund-flagged paid workers as case-active instead of queue activation", () => {
        expect(getWorkerQueueStage({
            activeOfferCount: 0,
            hasPaidEntryFee: true,
            inQueue: false,
            workerStatus: "REFUND_FLAGGED",
        })).toBe("post_payment_case_active");
    });

    it("treats queue-joined paid workers as case-active even if the status string is stale", () => {
        expect(getWorkerQueueStage({
            activeOfferCount: 0,
            hasPaidEntryFee: true,
            inQueue: false,
            queueJoinedAt: "2026-03-21T10:00:00.000Z",
            workerStatus: "PENDING_APPROVAL",
        })).toBe("post_payment_case_active");
    });

    it("does not enter queue-state messaging when a pending offer already exists", () => {
        expect(getWorkerQueueStage({
            activeOfferCount: 1,
            hasPaidEntryFee: true,
            inQueue: false,
            workerStatus: "OFFER_PENDING",
        })).toBe("none");
    });
});
