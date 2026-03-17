import { describe, expect, it } from "vitest";
import { canSendWorkerDirectNotifications } from "@/lib/worker-notification-eligibility";

describe("worker notification eligibility", () => {
    it("blocks hidden draft owners and internal/test contacts", () => {
        expect(canSendWorkerDirectNotifications({
            email: "draft-worker-1@workersunited.internal",
            phone: "+381641234567",
            isHiddenDraftOwner: true,
        })).toBe(false);

        expect(canSendWorkerDirectNotifications({
            email: "codex-worker-storage-123@workersunited.dev",
            phone: "+381641234567",
        })).toBe(false);
    });

    it("requires both submitted email and phone for agency draft worker direct notifications", () => {
        expect(canSendWorkerDirectNotifications({
            email: "worker@gmail.com",
            phone: null,
            worker: {
                agency_id: "agency-1",
                profile_id: null,
                submitted_email: "worker@gmail.com",
                phone: null,
            },
        })).toBe(false);

        expect(canSendWorkerDirectNotifications({
            email: "worker@gmail.com",
            phone: "+381641234567",
            worker: {
                agency_id: "agency-1",
                profile_id: null,
                submitted_email: "worker@gmail.com",
                phone: "+381641234567",
            },
        })).toBe(true);
    });

    it("allows normal worker notifications with a real email", () => {
        expect(canSendWorkerDirectNotifications({
            email: "worker@gmail.com",
            phone: null,
            worker: {
                agency_id: null,
                profile_id: "profile-1",
                submitted_email: null,
                phone: null,
            },
        })).toBe(true);
    });
});
