import { describe, expect, it } from "vitest";
import {
    PROFILE_INACTIVITY_DELETE_AFTER_DAYS,
    getProfileRetentionState,
    pickLatestRetentionTimestamp,
} from "@/lib/profile-retention";

describe("profile retention helper", () => {
    it("picks the latest meaningful timestamp across all signals", () => {
        expect(pickLatestRetentionTimestamp([
            "2026-03-01T10:00:00.000Z",
            null,
            "2026-03-12T09:30:00.000Z",
            "2026-03-10T18:00:00.000Z",
        ])).toBe("2026-03-12T09:30:00.000Z");
    });

    it("treats recent case emails as activity that resets the deletion timer", () => {
        const retention = getProfileRetentionState({
            authCreatedAt: "2026-01-01T00:00:00.000Z",
            latestCaseEmailAt: "2026-03-18T09:00:00.000Z",
        }, new Date("2026-03-18T12:00:00.000Z"));

        expect(retention.daysSinceLastMeaningfulActivity).toBe(0);
        expect(retention.daysUntilDeletion).toBe(PROFILE_INACTIVITY_DELETE_AFTER_DAYS);
        expect(retention.shouldDelete).toBe(false);
    });

    it("enters the warning window based on days left, not account age", () => {
        const retention = getProfileRetentionState({
            authCreatedAt: "2025-12-01T00:00:00.000Z",
            latestDocumentAt: "2026-01-11T00:00:00.000Z",
        }, new Date("2026-03-28T12:00:00.000Z"));

        expect(retention.daysUntilDeletion).toBe(14);
        expect(retention.isWarningDay).toBe(true);
        expect(retention.isNearDeletion).toBe(true);
    });

    it("flags deletion only after the full inactivity window passes", () => {
        const retention = getProfileRetentionState({
            authCreatedAt: "2025-12-01T00:00:00.000Z",
        }, new Date("2026-03-05T00:00:00.000Z"));

        expect(retention.daysSinceLastMeaningfulActivity).toBeGreaterThanOrEqual(PROFILE_INACTIVITY_DELETE_AFTER_DAYS);
        expect(retention.daysUntilDeletion).toBe(0);
        expect(retention.shouldDelete).toBe(true);
    });
});
