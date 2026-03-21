import { describe, expect, it } from "vitest";

import {
    getApprovalActionBannerData,
    buildManualWorkerStatusEmailData,
    getDocumentActionBannerData,
    getStatusActionBannerData,
    resolveAdminWorkerNotificationStatus,
} from "@/lib/admin-worker-notifications";

describe("admin worker notification helpers", () => {
    it("builds manual status email copy from the display label instead of raw enums", () => {
        expect(buildManualWorkerStatusEmailData("Pending Approval")).toEqual({
            title: "Status Update",
            subject: "Application Status Updated: Pending Approval",
            message: "Your application status has been updated to: Pending Approval.",
        });
    });

    it("marks accepted retry delivery as queued", () => {
        expect(resolveAdminWorkerNotificationStatus({
            sent: false,
            queued: true,
            error: "421 temporary failure",
        })).toEqual({
            status: "queued",
            error: "421 temporary failure",
            whatsappStatus: "skipped",
            whatsappError: null,
        });
    });

    it("marks terminal delivery failure as failed", () => {
        expect(resolveAdminWorkerNotificationStatus({
            sent: false,
            queued: false,
            error: "smtp failed",
        })).toEqual({
            status: "failed",
            error: "smtp failed",
            whatsappStatus: "skipped",
            whatsappError: null,
        });
    });

    it("preserves WhatsApp sidecar failure alongside email success", () => {
        expect(resolveAdminWorkerNotificationStatus({
            sent: true,
            queued: false,
            error: null,
            whatsapp: {
                attempted: true,
                sent: false,
                error: "recipient blocked",
            },
        })).toEqual({
            status: "sent",
            error: null,
            whatsappStatus: "failed",
            whatsappError: "recipient blocked",
        });
    });

    it("treats document re-upload email sent as sent instead of queued", () => {
        expect(getDocumentActionBannerData("requested", undefined, "sent")).toMatchObject({
            tone: "emerald",
            title: "Worker re-upload requested",
            copy: expect.stringContaining("sent successfully"),
            icon: "check",
        });
    });

    it("returns queued status banner copy for worker status updates", () => {
        expect(getStatusActionBannerData("updated", "queued", undefined)).toMatchObject({
            tone: "blue",
            title: "Worker status saved, email queued",
            copy: expect.stringContaining("queued for automatic delivery"),
            icon: "mail",
        });
    });

    it("returns a partial-failure approval banner when WhatsApp fails after email success", () => {
        expect(getApprovalActionBannerData("approved", "sent", undefined, "failed")).toMatchObject({
            tone: "amber",
            title: "Worker approved, WhatsApp failed",
            copy: expect.stringContaining("approval email was sent successfully"),
            icon: "alert",
        });
    });
});
