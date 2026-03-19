import { describe, expect, it } from "vitest";
import { buildWorkerPaymentUnlockedEmailData } from "@/lib/worker-approval-notifications";

describe("worker-approval-notifications", () => {
    it("builds the Job Finder unlock email payload", () => {
        const payload = buildWorkerPaymentUnlockedEmailData();

        expect(payload.subject).toBe("Job Finder Is Now Unlocked");
        expect(payload.title).toBe("Profile Approved");
        expect(payload.message).toContain("Job Finder checkout is now unlocked");
        expect(payload.actionText).toBe("Open Job Finder");
        expect(payload.actionLink).toContain("/profile/worker");
    });
});
