import { describe, expect, it } from "vitest";
import { shouldSuppressWorkerReviewNotification } from "@/lib/worker-review";

describe("worker-review notification dedupe", () => {
    it("only suppresses retries for sent email_queue rows", () => {
        expect(shouldSuppressWorkerReviewNotification({ status: "sent" })).toBe(true);
        expect(shouldSuppressWorkerReviewNotification({ status: "failed" })).toBe(false);
        expect(shouldSuppressWorkerReviewNotification(null)).toBe(false);
    });
});
