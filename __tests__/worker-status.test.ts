import { describe, expect, it } from "vitest";

import {
    assertManualAdminWorkerStatusWriteSucceeded,
    canUseManualAdminWorkerStatusOverride,
    getAllowedManualAdminWorkerStatuses,
    resolveManualAdminWorkerStatusUpdate,
} from "@/lib/worker-status";

describe("worker status manual admin guards", () => {
    it("allows only pre-payment manual statuses before Job Finder is active", () => {
        expect(getAllowedManualAdminWorkerStatuses({
            currentStatus: "NEW",
            entryFeePaid: false,
            jobSearchActive: false,
            adminApproved: false,
        })).toEqual(["NEW", "PROFILE_COMPLETE", "VERIFIED", "PENDING_APPROVAL", "REJECTED"]);
    });

    it("returns no manual options once admin approval is already active", () => {
        expect(getAllowedManualAdminWorkerStatuses({
            currentStatus: "APPROVED",
            entryFeePaid: false,
            jobSearchActive: false,
            adminApproved: true,
        })).toEqual([]);
    });

    it("locks manual override entirely once Job Finder is active", () => {
        expect(canUseManualAdminWorkerStatusOverride({
            currentStatus: "IN_QUEUE",
            entryFeePaid: true,
            jobSearchActive: true,
        })).toBe(false);

        expect(resolveManualAdminWorkerStatusUpdate({
            requestedStatus: "NEW",
            currentStatus: "IN_QUEUE",
            entryFeePaid: true,
            jobSearchActive: true,
            adminApproved: true,
            completion: 100,
        })).toEqual({
            allowed: false,
            error: "Manual status updates are locked after Job Finder is active. Use queue, offer, visa, or refund tools instead.",
        });
    });

    it("forces approval ownership through the approve button", () => {
        expect(resolveManualAdminWorkerStatusUpdate({
            requestedStatus: "APPROVED",
            currentStatus: "PENDING_APPROVAL",
            entryFeePaid: false,
            jobSearchActive: false,
            adminApproved: false,
            completion: 100,
        })).toEqual({
            allowed: false,
            error: "Use the approval button to approve the worker and set admin approval flags together.",
        });
    });

    it("blocks completion-gated manual statuses when completion is below 100", () => {
        expect(resolveManualAdminWorkerStatusUpdate({
            requestedStatus: "VERIFIED",
            currentStatus: "NEW",
            entryFeePaid: false,
            jobSearchActive: false,
            adminApproved: false,
            completion: 74,
        })).toEqual({
            allowed: false,
            error: "Worker profile must be 100% complete before using Profile Complete, Verified, or Pending Approval.",
        });
    });

    it("blocks manual changes on admin-approved cases until approval is revoked", () => {
        expect(resolveManualAdminWorkerStatusUpdate({
            requestedStatus: "REJECTED",
            currentStatus: "APPROVED",
            entryFeePaid: false,
            jobSearchActive: false,
            adminApproved: true,
            completion: 100,
        })).toEqual({
            allowed: false,
            error: "Use the revoke approval button before changing worker status manually.",
        });
    });

    it("allows REJECTED as a pre-payment manual administrative status", () => {
        expect(resolveManualAdminWorkerStatusUpdate({
            requestedStatus: "REJECTED",
            currentStatus: "NEW",
            entryFeePaid: false,
            jobSearchActive: false,
            adminApproved: false,
            completion: 42,
        })).toEqual({
            allowed: true,
            nextStatus: "REJECTED",
            clearsApproval: false,
        });
    });

    it("fails closed when the admin worker status write returns an error", () => {
        expect(() => assertManualAdminWorkerStatusWriteSucceeded({
            updatedWorkerId: null,
            updateErrorMessage: "permission denied",
        })).toThrow("Failed to update worker status: permission denied");
    });

    it("fails closed when the admin worker status write does not persist a row", () => {
        expect(() => assertManualAdminWorkerStatusWriteSucceeded({
            updatedWorkerId: null,
            updateErrorMessage: null,
        })).toThrow("Worker status update did not persist.");
    });
});
