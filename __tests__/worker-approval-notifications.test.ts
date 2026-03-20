import { describe, expect, it, vi } from "vitest";
import { buildWorkerPaymentUnlockedEmailData, resolveWorkerApprovalNotificationRecipient } from "@/lib/worker-approval-notifications";

describe("worker-approval-notifications", () => {
    it("builds the Job Finder unlock email payload", () => {
        const payload = buildWorkerPaymentUnlockedEmailData();

        expect(payload.subject).toBe("Job Finder Is Now Unlocked");
        expect(payload.title).toBe("Profile Approved");
        expect(payload.message).toContain("Job Finder checkout is now unlocked");
        expect(payload.actionText).toBe("Open Job Finder");
        expect(payload.actionLink).toContain("/profile/worker");
    });

    it("normalizes bare NEXT_PUBLIC_BASE_URL in the unlock CTA", async () => {
        const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

        try {
            vi.resetModules();
            process.env.NEXT_PUBLIC_BASE_URL = "workersunited.example";
            const { buildWorkerPaymentUnlockedEmailData: buildPayload } = await import("@/lib/worker-approval-notifications");

            expect(buildPayload().actionLink).toBe("https://workersunited.example/profile/worker");
        } finally {
            process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
            vi.resetModules();
        }
    });

    it("prefers canonical worker notification emails and blocks hidden agency drafts", () => {
        expect(resolveWorkerApprovalNotificationRecipient({
            worker: {
                agency_id: null,
                profile_id: "profile-1",
                submitted_email: "worker@company.com",
                phone: "+381641234567",
            },
            workerProfileEmail: "worker@company.com",
            authEmail: "fallback@company.com",
            displayName: "Worker One",
        })).toEqual({
            email: "worker@company.com",
            name: "Worker One",
        });

        expect(resolveWorkerApprovalNotificationRecipient({
            worker: {
                agency_id: "agency-1",
                profile_id: null,
                submitted_email: "agency-worker@company.com",
                phone: "+381641234567",
            },
            workerProfileEmail: null,
            authEmail: "hidden-owner@company.com",
            displayName: "Hidden Worker",
        })).toBeNull();
    });
});
