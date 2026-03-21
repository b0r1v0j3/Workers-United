import { describe, expect, it } from "vitest";

import { getManualMatchFailureFeedback } from "@/lib/manual-match-feedback";

describe("manual match feedback helper", () => {
    it("returns the plain backend error when rollback did not fail", () => {
        expect(getManualMatchFailureFeedback({
            error: "Failed to create offer",
            rollbackFailed: false,
        })).toEqual({
            message: "Failed to create offer",
            detail: null,
        });
    });

    it("adds cleanup detail when rollback failed", () => {
        expect(getManualMatchFailureFeedback({
            error: "Failed to reserve the job position. Cleanup may be incomplete.",
            rollbackFailed: true,
            cleanupErrors: ["delete_offer: row locked", "delete_match: blocked"],
        })).toEqual({
            message: "Failed to reserve the job position. Cleanup may be incomplete.",
            detail: "Cleanup may be incomplete. Check worker, offer, and match records before retrying. delete_offer: row locked | delete_match: blocked",
        });
    });

    it("falls back to generic cleanup guidance when cleanup errors are missing", () => {
        expect(getManualMatchFailureFeedback({
            error: "Failed to update worker status. Cleanup may be incomplete.",
            rollbackFailed: true,
            cleanupErrors: [],
        })).toEqual({
            message: "Failed to update worker status. Cleanup may be incomplete.",
            detail: "Cleanup may be incomplete. Check worker, offer, and match records before retrying.",
        });
    });
});
